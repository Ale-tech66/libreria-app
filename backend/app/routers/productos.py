from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.producto import Producto
from app.schemas import ProductoCreate, ProductoOut

router = APIRouter(
    prefix="/productos",
    tags=["Productos"],
    dependencies=[Depends(get_current_user)] # ¡Todos los endpoints requieren login!
)

@router.get("/", response_model=list[ProductoOut])
def listar_productos(db: Session = Depends(get_db)):
    return db.query(Producto).all()

@router.post("/", response_model=ProductoOut)
def crear_producto(producto: ProductoCreate, db: Session = Depends(get_db)):
    db_producto = db.query(Producto).filter(Producto.codigo_barras == producto.codigo_barras).first()
    if db_producto:
        raise HTTPException(status_code=400, detail="El código de barras ya existe")
    
    nuevo_producto = Producto(**producto.dict())
    db.add(nuevo_producto)
    db.commit()
    db.refresh(nuevo_producto)
    return nuevo_producto

@router.get("/{codigo_barras}", response_model=ProductoOut)
def buscar_producto(codigo_barras: str, db: Session = Depends(get_db)):
    producto = db.query(Producto).filter(Producto.codigo_barras == codigo_barras).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return producto

@router.put("/{producto_id}", response_model=ProductoOut)
def actualizar_producto(producto_id: int, producto_update: ProductoCreate, db: Session = Depends(get_db)):
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    # Actualizamos los campos
    producto.codigo_barras = producto_update.codigo_barras
    producto.nombre = producto_update.nombre
    producto.autor = producto_update.autor
    producto.editorial = producto_update.editorial
    producto.precio_venta = producto_update.precio_venta
    producto.stock = producto_update.stock
    producto.unidades_por_caja = producto_update.unidades_por_caja
    
    db.commit()
    db.refresh(producto)
    return producto    
