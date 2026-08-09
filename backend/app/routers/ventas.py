from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.venta import Venta, VentaDetalle
from app.models.producto import Producto
from app.schemas import VentaCreate, VentaOut
from decimal import Decimal

router = APIRouter(
    prefix="/ventas",
    tags=["Ventas"],
    dependencies=[Depends(get_current_user)]
)

@router.post("/", response_model=VentaOut)
def crear_venta(venta: VentaCreate, db: Session = Depends(get_db)):
    total_venta = Decimal(0.0)
    detalles_db = []
    
    # 1. Procesar cada producto del carrito
    for detalle in venta.detalles:
        producto = db.query(Producto).filter(Producto.id == detalle.producto_id).first()
        if not producto:
            raise HTTPException(status_code=404, detail=f"Producto ID {detalle.producto_id} no encontrado")
        
        if producto.stock < detalle.cantidad:
            raise HTTPException(status_code=400, detail=f"Stock insuficiente para {producto.nombre}")
        
        # Descontar stock
        producto.stock -= detalle.cantidad
        
        # Calcular subtotal
        subtotal = Decimal(detalle.cantidad) * Decimal(detalle.precio_unitario)
        total_venta += subtotal
        
        # Guardar detalle
        nuevo_detalle = VentaDetalle(
            producto_id=detalle.producto_id,
            cantidad=detalle.cantidad,
            precio_unitario=detalle.precio_unitario
        )
        detalles_db.append(nuevo_detalle)

    # 2. Crear la venta general
    nueva_venta = Venta(
        total=total_venta,
        metodo_pago=venta.metodo_pago
    )
    db.add(nueva_venta)
    db.flush() # Para obtener el ID de la venta
    
    # 3. Asignar el ID de la venta a los detalles y guardar
    for detalle in detalles_db:
        detalle.venta_id = nueva_venta.id
        db.add(detalle)
        
    db.commit()
    db.refresh(nueva_venta)
    
    return nueva_venta