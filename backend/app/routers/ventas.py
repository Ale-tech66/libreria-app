from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import time

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.audit import registrar
from app.core.database import get_db
from app.core.deps import get_current_user, ip_cliente, require_role
from app.models.organization import Organization
from app.models.producto import Producto
from app.models.user import User
from app.models.venta import Venta, VentaDetalle
from app.schemas import (
    Paginated,
    ProductoTop,
    ReciboOut,
    ReporteVentas,
    SyncVentasRequest,
    SyncVentasResponse,
    VentaCreate,
    VentaOut,
    VentaPendienteSync,
    VentaPorDia,
)

router = APIRouter(
    prefix="/ventas",
    tags=["Ventas"],
    dependencies=[Depends(require_role("admin", "ventas"))],
)

# Cache en memoria SOLO como atajo (evita consultas repetidas). La garantía
# real de deduplicación está en la BD: el índice único (organization_id,
# id_local) impide crear la misma venta dos veces aunque dos requests
# lleguen en paralelo o el proceso se reinicie.
_IDS_SINCRONIZADOS: dict[tuple[int, str], tuple[int, float]] = {}
_ID_SYNC_TTL_SEGUNDOS = 3600
_ID_SYNC_MAX_ENTRIES = 20_000


def _purge_ids_sincronizados() -> None:
    if len(_IDS_SINCRONIZADOS) < _ID_SYNC_MAX_ENTRIES:
        return
    ahora = time.time()
    for clave in list(_IDS_SINCRONIZADOS.keys()):
        _, marcado = _IDS_SINCRONIZADOS[clave]
        if ahora - marcado > _ID_SYNC_TTL_SEGUNDOS:
            _IDS_SINCRONIZADOS.pop(clave, None)


def _fecha_sync_valida(fecha: datetime | None) -> datetime | None:
    """Acepta solo fechas creíbles (no en el futuro ni en el pasado lejano)."""
    if fecha is None:
        return None
    # El cliente envía la fecha local sin zona horaria: se compara en UTC naive
    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    if fecha > ahora + timedelta(minutes=5):
        raise HTTPException(status_code=400, detail="La fecha de la venta es inválida (futuro)")
    if fecha < ahora - timedelta(days=30):
        raise HTTPException(status_code=400, detail="La fecha de la venta es inválida (pasado lejano)")
    return fecha


def _venta_out(venta: Venta) -> dict:
    """Serializa una venta con sus detalles y el nombre del producto."""
    return {
        "id": venta.id,
        "fecha": venta.fecha,
        "total": float(venta.total),
        "metodo_pago": venta.metodo_pago,
        "detalles": [
            {
                "id": detalle.id,
                "producto_id": detalle.producto_id,
                "producto_nombre": detalle.producto.nombre,
                "cantidad": detalle.cantidad,
                "precio_unitario": float(detalle.precio_unitario),
            }
            for detalle in venta.detalles
        ],
    }


def _crear_venta_db(
    db: Session,
    usuario: User,
    detalles,
    metodo_pago: str,
    fecha=None,
    id_local: str | None = None,
    ip: str | None = None,
) -> Venta:
    """Valida productos, descuenta stock y crea la venta (precio del servidor).

    La venta, el descuento de stock y el log de auditoría se cometen en UNA
    sola transacción: si algo falla, no queda ninguna venta a medias.
    """
    total_venta = Decimal("0.00")
    detalles_db: list[VentaDetalle] = []

    for detalle in detalles:
        # Bloquea la fila para evitar sobreventa en ventas concurrentes
        producto = (
            db.query(Producto)
            .filter(
                Producto.id == detalle.producto_id,
                Producto.organization_id == usuario.organization_id,
            )
            .with_for_update()
            .first()
        )
        if not producto:
            raise HTTPException(
                status_code=404,
                detail=f"Producto ID {detalle.producto_id} no encontrado",
            )
        if not producto.activo:
            raise HTTPException(
                status_code=400,
                detail=f"El producto {producto.nombre} ya no está disponible",
            )
        if producto.stock < detalle.cantidad:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para {producto.nombre}",
            )

        # El precio SIEMPRE lo define el servidor, no el cliente
        precio = Decimal(producto.precio_venta)
        producto.stock -= detalle.cantidad
        total_venta += Decimal(detalle.cantidad) * precio

        detalles_db.append(
            VentaDetalle(
                producto_id=detalle.producto_id,
                cantidad=detalle.cantidad,
                precio_unitario=precio,
            )
        )

    if total_venta > Decimal("99999999.99"):
        db.rollback()
        raise HTTPException(status_code=400, detail="El total de la venta es demasiado grande")

    nueva_venta = Venta(
        total=total_venta,
        metodo_pago=metodo_pago,
        organization_id=usuario.organization_id,
        usuario_id=usuario.id,
        fecha=fecha,
        id_local=id_local,
    )
    db.add(nueva_venta)
    try:
        db.flush()  # Obtiene el ID de la venta

        for detalle in detalles_db:
            detalle.venta_id = nueva_venta.id
            db.add(detalle)

        registrar(
            db,
            accion="vender",
            recurso="venta",
            recurso_id=nueva_venta.id,
            detalle=f"Venta por {total_venta} ({metodo_pago})"
            + (" [sincronizada offline]" if fecha else ""),
            usuario_id=usuario.id,
            username=usuario.username,
            organization_id=usuario.organization_id,
            commit=False,
            ip=ip,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    # Recarga con los detalles para la respuesta
    nueva_venta = (
        db.query(Venta)
        .options(selectinload(Venta.detalles).selectinload(VentaDetalle.producto))
        .filter(Venta.id == nueva_venta.id)
        .first()
    )
    return nueva_venta


def _venta_existente(db: Session, organization_id: int, id_local: str) -> Venta | None:
    """Busca una venta ya registrada con el mismo id_local (dedup en BD)."""
    return (
        db.query(Venta)
        .options(selectinload(Venta.detalles).selectinload(VentaDetalle.producto))
        .filter(
            Venta.organization_id == organization_id,
            Venta.id_local == id_local,
        )
        .first()
    )


@router.post("/", response_model=VentaOut)
def crear_venta(
    venta: VentaCreate,
    request: Request,
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    """Crea una venta. Si el cliente envía `id_local`, la venta es idempotente:
    reintentar con el mismo id no cobra dos veces."""
    ip = ip_cliente(request)
    if venta.id_local:
        existente = _venta_existente(db, usuario.organization_id, venta.id_local)
        if existente:
            return _venta_out(existente)
        try:
            nueva_venta = _crear_venta_db(
                db, usuario, venta.detalles, venta.metodo_pago, id_local=venta.id_local, ip=ip
            )
        except IntegrityError:
            # Dos requests simultáneos con el mismo id_local: gana el primero
            db.rollback()
            existente = _venta_existente(db, usuario.organization_id, venta.id_local)
            if existente:
                return _venta_out(existente)
            raise
    else:
        nueva_venta = _crear_venta_db(db, usuario, venta.detalles, venta.metodo_pago, ip=ip)
    return _venta_out(nueva_venta)


@router.post("/offline-sync", response_model=SyncVentasResponse)
def sincronizar_ventas_offline(
    datos: SyncVentasRequest,
    request: Request,
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    """Recibe las ventas guardadas sin conexión y las registra una a una.

    Cada venta se valida por separado: si una falla (producto inexistente,
    stock insuficiente...), el resto igual se procesa y el dispositivo
    recibe el motivo por venta.
    """
    resultados = []
    ip = ip_cliente(request)
    for pendiente in datos.ventas:
        clave = (usuario.organization_id, pendiente.id_local)
        _purge_ids_sincronizados()
        duplicado = _IDS_SINCRONIZADOS.get(clave)
        if duplicado and time.time() - duplicado[1] < _ID_SYNC_TTL_SEGUNDOS:
            resultados.append(
                {
                    "id_local": pendiente.id_local,
                    "id_servidor": duplicado[0],
                    "total": None,
                    "error": None,
                }
            )
            continue
        # Garantía real de dedup: la BD (índice único org+id_local)
        existente = _venta_existente(db, usuario.organization_id, pendiente.id_local)
        if existente:
            _IDS_SINCRONIZADOS[clave] = (existente.id, time.time())
            resultados.append(
                {
                    "id_local": pendiente.id_local,
                    "id_servidor": existente.id,
                    "total": float(existente.total),
                    "error": None,
                }
            )
            continue
        try:
            venta = _crear_venta_db(
                db,
                usuario,
                pendiente.detalles,
                pendiente.metodo_pago,
                fecha=_fecha_sync_valida(pendiente.fecha),
                id_local=pendiente.id_local,
                ip=ip,
            )
            _IDS_SINCRONIZADOS[clave] = (venta.id, time.time())
            resultados.append(
                {
                    "id_local": pendiente.id_local,
                    "id_servidor": venta.id,
                    "total": float(venta.total),
                    "error": None,
                }
            )
        except IntegrityError:
            # Dos requests en paralelo con el mismo id_local: el otro ganó
            db.rollback()
            existente = _venta_existente(db, usuario.organization_id, pendiente.id_local)
            if existente:
                _IDS_SINCRONIZADOS[clave] = (existente.id, time.time())
                resultados.append(
                    {
                        "id_local": pendiente.id_local,
                        "id_servidor": existente.id,
                        "total": float(existente.total),
                        "error": None,
                    }
                )
            else:
                resultados.append(
                    {
                        "id_local": pendiente.id_local,
                        "id_servidor": None,
                        "total": None,
                        "error": "No se pudo registrar la venta. Intenta de nuevo.",
                    }
                )
        except HTTPException as e:
            resultados.append(
                {
                    "id_local": pendiente.id_local,
                    "id_servidor": None,
                    "total": None,
                    "error": e.detail,
                }
            )
    return {"resultados": resultados}


@router.get("/", response_model=Paginated[VentaOut])
def listar_ventas(
    page: int = Query(default=1, ge=1, le=1000),
    page_size: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    total = (
        db.query(Venta)
        .filter(Venta.organization_id == admin.organization_id)
        .count()
    )
    ventas = (
        db.query(Venta)
        .options(selectinload(Venta.detalles).selectinload(VentaDetalle.producto))
        .filter(Venta.organization_id == admin.organization_id)
        .order_by(Venta.fecha.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_venta_out(v) for v in ventas],
    }


@router.get("/{venta_id}/recibo", response_model=ReciboOut)
def obtener_recibo(
    venta_id: int,
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    """Datos completos para imprimir el ticket: venta, vendedor y negocio."""
    venta = (
        db.query(Venta)
        .options(selectinload(Venta.detalles).selectinload(VentaDetalle.producto))
        .filter(
            Venta.id == venta_id,
            Venta.organization_id == usuario.organization_id,
        )
        .first()
    )
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")

    negocio = (
        db.query(Organization)
        .filter(Organization.id == venta.organization_id)
        .first()
    )
    return {
        "venta": _venta_out(venta),
        "vendedor": venta.vendedor.username if venta.vendedor else None,
        "negocio": {
            "nombre": negocio.nombre if negocio else "Mi Negocio",
            "tipo_negocio": negocio.tipo_negocio if negocio else None,
            "telefono": negocio.telefono if negocio else None,
            "correo": negocio.correo if negocio else None,
            "pais": negocio.pais if negocio else None,
        },
    }


@router.get("/reporte", response_model=ReporteVentas)
def reporte_ventas(
    dias: int = Query(default=7, ge=1, le=90),
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Resumen de ventas de los últimos N días: totales, por día y top productos."""
    ahora = datetime.utcnow()  # las fechas se guardan en UTC
    desde = ahora.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=dias - 1)
    hasta = ahora.replace(hour=23, minute=59, second=59, microsecond=999999)

    ventas = (
        db.query(Venta)
        .options(selectinload(Venta.detalles).selectinload(VentaDetalle.producto))
        .filter(
            Venta.organization_id == admin.organization_id,
            Venta.fecha >= desde,
            Venta.fecha <= hasta,
        )
        .all()
    )

    ingresos_totales = sum(float(v.total) for v in ventas)

    # Agrupación por día (se rellena con ceros los días sin ventas)
    por_dia_map: dict[date, dict] = {}
    for i in range(dias):
        dia = (desde + timedelta(days=i)).date()
        por_dia_map[dia] = {"fecha": dia, "total": 0.0, "cantidad": 0}

    top_map: dict[int, dict] = {}
    for venta in ventas:
        dia = venta.fecha.date()
        por_dia_map[dia]["total"] += float(venta.total)
        por_dia_map[dia]["cantidad"] += 1
        for detalle in venta.detalles:
            entry = top_map.setdefault(
                detalle.producto_id,
                {
                    "producto_id": detalle.producto_id,
                    "producto_nombre": detalle.producto.nombre,
                    "cantidad": 0,
                    "ingresos": 0.0,
                },
            )
            entry["cantidad"] += detalle.cantidad
            entry["ingresos"] += float(detalle.precio_unitario) * detalle.cantidad

    top_productos = sorted(
        top_map.values(), key=lambda p: p["ingresos"], reverse=True
    )[:5]

    return {
        "total_ventas": len(ventas),
        "ingresos_totales": ingresos_totales,
        "por_dia": list(por_dia_map.values()),
        "top_productos": top_productos,
    }