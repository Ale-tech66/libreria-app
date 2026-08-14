from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import require_role
from app.models.producto import Producto
from app.schemas import Paginated, ProductoCreate, ProductoOut

router = APIRouter(
    prefix="/productos",
    tags=["Productos"],
    dependencies=[Depends(require_role("admin", "inventario", "ventas"))],
)

TIPOS_PERMITIDOS = {"image/jpeg", "image/png", "image/webp"}
MAX_FOTO_BYTES = 5 * 1024 * 1024  # 5 MB


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

    directorio = Path(settings.UPLOAD_DIR)
    directorio.mkdir(parents=True, exist_ok=True)
    nombre = f"producto_{producto_id}{extension}"
    (directorio / nombre).write_bytes(contenido)
    return nombre


@router.get("/", response_model=Paginated[ProductoOut])
def listar_productos(
    q: str = Query(default="", max_length=100, description="Filtra por nombre o código de barras"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    incluir_inactivos: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    query = db.query(Producto)
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
    _: None = Depends(require_role("admin", "inventario")),
):
    db_producto = (
        db.query(Producto)
        .filter(Producto.codigo_barras == producto.codigo_barras)
        .first()
    )
    if db_producto:
        raise HTTPException(status_code=400, detail="El código de barras ya existe")

    nuevo_producto = Producto(**producto.model_dump())
    db.add(nuevo_producto)
    db.commit()
    db.refresh(nuevo_producto)
    return nuevo_producto


@router.get("/{codigo_barras}", response_model=ProductoOut)
def buscar_producto(codigo_barras: str, db: Session = Depends(get_db)):
    producto = (
        db.query(Producto)
        .filter(Producto.codigo_barras == codigo_barras)
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
    _: None = Depends(require_role("admin", "inventario")),
):
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    for campo, valor in producto_update.model_dump().items():
        setattr(producto, campo, valor)

    db.commit()
    db.refresh(producto)
    return producto


@router.delete("/{producto_id}", response_model=ProductoOut)
def desactivar_producto(
    producto_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_role("admin", "inventario")),
):
    """Eliminación lógica: marca el producto como inactivo."""
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    producto.activo = False
    db.commit()
    db.refresh(producto)
    return producto


@router.post("/{producto_id}/foto", response_model=ProductoOut)
def subir_foto(
    producto_id: int,
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: None = Depends(require_role("admin", "inventario")),
):
    """Sube o reemplaza la foto de un producto."""
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    nombre = _guardar_foto(producto_id, archivo)

    # Elimina la foto anterior si cambió de extensión
    if producto.foto and producto.foto != nombre:
        anterior = Path(settings.UPLOAD_DIR) / producto.foto
        if anterior.exists():
            anterior.unlink()

    producto.foto = nombre
    db.commit()
    db.refresh(producto)
    return producto