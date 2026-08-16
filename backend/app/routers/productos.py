from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.audit import registrar
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.producto import Producto
from app.models.user import User
from app.schemas import Paginated, ProductoCreate, ProductoOut

router = APIRouter(
    prefix="/productos",
    tags=["Productos"],
    dependencies=[Depends(require_role("admin", "inventario", "ventas"))],
)

TIPOS_PERMITIDOS = {"image/jpeg", "image/png", "image/webp"}
MAX_FOTO_BYTES = 5 * 1024 * 1024  # 5 MB


def _r2_cliente():
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def _r2_activo() -> bool:
    return bool(
        settings.R2_ACCOUNT_ID
        and settings.R2_ACCESS_KEY_ID
        and settings.R2_SECRET_ACCESS_KEY
        and settings.R2_BUCKET
    )


def _guardar_foto(producto_id: int, archivo: UploadFile) -> str:
    if archivo.content_type not in TIPOS_PERMITIDOS:
        raise HTTPException(
            status_code=400,
            detail="Solo se permiten imágenes JPG, PNG o WebP",
        )

    contenido = archivo.file.read()
    if len(contenido) > MAX_FOTO_BYTES:
        raise HTTPException(status_code=400, detail="La imagen supera los 5 MB")

    extension = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
    }[archivo.content_type]

    if _r2_activo():
        # Object storage: la foto vive en R2 y devolvemos su URL pública
        clave = f"productos/producto_{producto_id}{extension}"
        _r2_cliente().put_object(
            Bucket=settings.R2_BUCKET,
            Key=clave,
            Body=contenido,
            ContentType=archivo.content_type,
        )
        base = settings.R2_PUBLIC_URL.rstrip("/") if settings.R2_PUBLIC_URL else ""
        return f"{base}/{clave}" if base else clave

    directorio = Path(settings.UPLOAD_DIR)
    directorio.mkdir(parents=True, exist_ok=True)
    nombre = f"producto_{producto_id}{extension}"
    (directorio / nombre).write_bytes(contenido)
    return nombre


def _borrar_foto(foto: str | None) -> None:
    if not foto:
        return
    if foto.startswith("http") and _r2_activo():
        # URL pública de R2: borra el objeto
        clave = foto.rsplit("/", 1)[-1]
        try:
            _r2_cliente().delete_object(Bucket=settings.R2_BUCKET, Key=clave)
        except Exception:  # noqa: BLE001
            pass
        return
    anterior = Path(settings.UPLOAD_DIR) / foto
    if anterior.exists():
        anterior.unlink()


@router.get("/", response_model=Paginated[ProductoOut])
def listar_productos(
    q: str = Query(default="", max_length=100, description="Filtra por nombre o código de barras"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    incluir_inactivos: bool = Query(default=False),
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    query = db.query(Producto).filter(
        Producto.organization_id == usuario.organization_id
    )
    if not incluir_inactivos:
        query = query.filter(Producto.activo.is_(True))
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            Producto.nombre.ilike(like) | Producto.codigo_barras.ilike(like)
        )

    total = query.count()
    items = (
        query.order_by(Producto.nombre.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.post("/", response_model=ProductoOut)
def crear_producto(
    producto: ProductoCreate,
    db: Session = Depends(get_db),
    usuario: User = Depends(require_role("admin", "inventario")),
):
    db_producto = (
        db.query(Producto)
        .filter(
            Producto.codigo_barras == producto.codigo_barras,
            Producto.organization_id == usuario.organization_id,
        )
        .first()
    )
    if db_producto:
        raise HTTPException(status_code=400, detail="El código de barras ya existe")

    nuevo_producto = Producto(
        **producto.model_dump(), organization_id=usuario.organization_id
    )
    db.add(nuevo_producto)
    db.commit()
    db.refresh(nuevo_producto)
    registrar(
        db,
        accion="crear",
        recurso="producto",
        recurso_id=nuevo_producto.id,
        detalle=f"Producto '{nuevo_producto.nombre}' (código {nuevo_producto.codigo_barras})",
        usuario_id=usuario.id,
        username=usuario.username,
        organization_id=usuario.organization_id,
    )
    return nuevo_producto


@router.get("/{codigo_barras}", response_model=ProductoOut)
def buscar_producto(
    codigo_barras: str,
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    producto = (
        db.query(Producto)
        .filter(
            Producto.codigo_barras == codigo_barras,
            Producto.organization_id == usuario.organization_id,
        )
        .first()
    )
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return producto


@router.put("/{producto_id}", response_model=ProductoOut)
def actualizar_producto(
    producto_id: int,
    producto_update: ProductoCreate,
    db: Session = Depends(get_db),
    usuario: User = Depends(require_role("admin", "inventario")),
):
    producto = (
        db.query(Producto)
        .filter(
            Producto.id == producto_id,
            Producto.organization_id == usuario.organization_id,
        )
        .first()
    )
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    for campo, valor in producto_update.model_dump().items():
        setattr(producto, campo, valor)

    db.commit()
    db.refresh(producto)
    registrar(
        db,
        accion="editar",
        recurso="producto",
        recurso_id=producto.id,
        detalle=f"Producto '{producto.nombre}' actualizado",
        usuario_id=usuario.id,
        username=usuario.username,
        organization_id=usuario.organization_id,
    )
    return producto


@router.delete("/{producto_id}", response_model=ProductoOut)
def desactivar_producto(
    producto_id: int,
    db: Session = Depends(get_db),
    usuario: User = Depends(require_role("admin", "inventario")),
):
    """Eliminación lógica: marca el producto como inactivo."""
    producto = (
        db.query(Producto)
        .filter(
            Producto.id == producto_id,
            Producto.organization_id == usuario.organization_id,
        )
        .first()
    )
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    producto.activo = False
    db.commit()
    db.refresh(producto)
    registrar(
        db,
        accion="desactivar",
        recurso="producto",
        recurso_id=producto.id,
        detalle=f"Producto '{producto.nombre}' desactivado",
        usuario_id=usuario.id,
        username=usuario.username,
        organization_id=usuario.organization_id,
    )
    return producto


@router.post("/{producto_id}/foto", response_model=ProductoOut)
def subir_foto(
    producto_id: int,
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    usuario: User = Depends(require_role("admin", "inventario")),
):
    """Sube o reemplaza la foto de un producto."""
    producto = (
        db.query(Producto)
        .filter(
            Producto.id == producto_id,
            Producto.organization_id == usuario.organization_id,
        )
        .first()
    )
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    nombre = _guardar_foto(producto_id, archivo)

    # Elimina la foto anterior (local o en R2)
    if producto.foto and producto.foto != nombre:
        _borrar_foto(producto.foto)

    producto.foto = nombre
    db.commit()
    db.refresh(producto)
    registrar(
        db,
        accion="foto",
        recurso="producto",
        recurso_id=producto.id,
        detalle=f"Foto actualizada para '{producto.nombre}'",
        usuario_id=usuario.id,
        username=usuario.username,
        organization_id=usuario.organization_id,
    )
    return producto