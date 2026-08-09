from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

class UserCreate(BaseModel):
    username: str
    password: str
    rol: str = "ventas" # Por defecto es ventas, pero puede ser admin o inventario

class UserOut(BaseModel):
    id: int
    username: str
    rol: str
    activo: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class ProductoBase(BaseModel):
    codigo_barras: str
    nombre: str
    autor: Optional[str] = None
    editorial: Optional[str] = None
    precio_venta: float
    stock: int = 0
    unidades_por_caja: int = 1

class ProductoCreate(ProductoBase):
    pass

class ProductoOut(ProductoBase):
    id: int

    class Config:
        from_attributes = True


class VentaDetalleCreate(BaseModel):
    producto_id: int
    cantidad: int
    precio_unitario: float

class VentaCreate(BaseModel):
    metodo_pago: str = "efectivo"
    detalles: List[VentaDetalleCreate]

class VentaOut(BaseModel):
    id: int
    fecha: datetime
    total: float
    metodo_pago: str

    class Config:
        from_attributes = True