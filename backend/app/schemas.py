from datetime import date, datetime
from typing import Generic, List, Literal, Optional, TypeVar

from pydantic import BaseModel, Field

# ─────────────────────────────── Usuarios / Auth ───────────────────────────────

ROL_VENTAS = "ventas"
ROLES = Literal["admin", "inventario", "ventas"]
METODOS_PAGO = Literal["efectivo", "tarjeta", "transferencia", "yape"]


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=72)
    rol: ROLES = ROL_VENTAS


class UserUpdate(BaseModel):
    rol: Optional[ROLES] = None
    activo: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=6, max_length=72)


class UserOut(BaseModel):
    id: int
    username: str
    rol: str
    activo: bool

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str


# ─────────────────────────────── Productos ───────────────────────────────


class ProductoBase(BaseModel):
    codigo_barras: str = Field(min_length=1, max_length=50)
    nombre: str = Field(min_length=1, max_length=200)
    autor: Optional[str] = Field(default=None, max_length=150)
    editorial: Optional[str] = Field(default=None, max_length=100)
    precio_venta: float = Field(gt=0)
    stock: int = Field(ge=0)
    unidades_por_caja: int = Field(default=1, ge=1)
    activo: bool = True


class ProductoCreate(ProductoBase):
    pass


class ProductoOut(ProductoBase):
    id: int
    foto: Optional[str] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────── Ventas ───────────────────────────────


class VentaDetalleCreate(BaseModel):
    producto_id: int
    cantidad: int = Field(gt=0)
    # Nota: el precio SIEMPRE lo define el servidor, este campo se ignora.


class VentaCreate(BaseModel):
    metodo_pago: METODOS_PAGO = "efectivo"
    detalles: List[VentaDetalleCreate] = Field(min_length=1)


class VentaDetalleOut(BaseModel):
    id: int
    producto_id: int
    producto_nombre: str
    cantidad: int
    precio_unitario: float


class VentaOut(BaseModel):
    id: int
    fecha: datetime
    total: float
    metodo_pago: str
    detalles: List[VentaDetalleOut]


class VentaPorDia(BaseModel):
    fecha: date
    total: float
    cantidad: int


class ProductoTop(BaseModel):
    producto_id: int
    producto_nombre: str
    cantidad: int
    ingresos: float


class ReporteVentas(BaseModel):
    total_ventas: int
    ingresos_totales: float
    por_dia: List[VentaPorDia]
    top_productos: List[ProductoTop]


# ─────────────────────────────── Auditoría ───────────────────────────────


class AuditLogOut(BaseModel):
    id: int
    usuario_id: Optional[int] = None
    username: Optional[str] = None
    accion: str
    recurso: str
    recurso_id: Optional[int] = None
    detalle: Optional[str] = None
    fecha: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────── Paginación ───────────────────────────────

T = TypeVar("T")


class Paginated(BaseModel, Generic[T]):
    total: int
    page: int
    page_size: int
    items: List[T]