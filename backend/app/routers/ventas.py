from datetime import date, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.core.audit import registrar
from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.organization import Organization
from app.models.producto import Producto
from app.models.user import User
from app.models.venta import Venta, VentaDetalle
from app.schemas import (
    Paginated,
    ProductoTop,
    ReciboOut,
    ReporteVentas,
    VentaCreate,
    VentaOut,
    VentaPorDia,
)

router = APIRouter(
    prefix="/ventas",
    tags=["Ventas"],
    dependencies=[Depends(require_role("admin", "ventas"))],
)


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


@router.post("/", response_model=VentaOut)
def crear_venta(
    venta: VentaCreate,
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    total_venta = Decimal("0.00")
    detalles_db: list[VentaDetalle] = []

    # 1. Procesar cada producto del carrito
    for detalle in venta.detalles:
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

    try:
        nueva_venta = Venta(
            total=total_venta,
            metodo_pago=venta.metodo_pago,
            organization_id=usuario.organization_id,
            usuario_id=usuario.id,
        )
        db.add(nueva_venta)
        db.flush()  # Obtiene el ID de la venta

        for detalle in detalles_db:
            detalle.venta_id = nueva_venta.id
            db.add(detalle)

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
    registrar(
        db,
        accion="vender",
        recurso="venta",
        recurso_id=nueva_venta.id,
        detalle=f"Venta por {total_venta} ({venta.metodo_pago})",
        usuario_id=usuario.id,
        username=usuario.username,
        organization_id=usuario.organization_id,
    )
    return _venta_out(nueva_venta)


@router.get("/", response_model=Paginated[VentaOut])
def listar_ventas(
    page: int = Query(default=1, ge=1),
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
    desde = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=dias - 1)
    hasta = datetime.now().replace(hour=23, minute=59, second=59, microsecond=999999)

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