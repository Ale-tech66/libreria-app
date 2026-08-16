from datetime import date, datetime
from typing import Generic, List, Literal, Optional, TypeVar

from pydantic import BaseModel, Field, field_validator

from app.models.organization import Organization

# ─────────────────────────────── Usuarios / Auth ───────────────────────────────

ROL_VENTAS = "ventas"
ROLES = Literal["admin", "inventario", "ventas"]
METODOS_PAGO = Literal["efectivo", "tarjeta", "transferencia", "yape"]


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=72)
    rol: ROLES = ROL_VENTAS
    # Datos de la empresa (solo se usan al registrar la primera cuenta)
    nombre_negocio: Optional[str] = Field(default=None, max_length=200)
    tipo_negocio: Optional[str] = Field(default=None, max_length=50)
    correo: Optional[str] = Field(default=None, max_length=200)
    telefono: Optional[str] = Field(default=None, max_length=50)
    pais: Optional[str] = Field(default=None, max_length=100)


class UserUpdate(BaseModel):
    rol: Optional[ROLES] = None
    activo: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=6, max_length=72)


class UserOut(BaseModel):
    id: int
    username: str
    rol: str
    activo: bool
    organizacion: Optional[str] = None
    mfa_activo: Optional[bool] = None

    @field_validator("organizacion", mode="before")
    @classmethod
    def organizacion_nombre(cls, v):
        """Acepta el objeto Organization y se queda con su nombre."""
        if isinstance(v, Organization):
            return v.nombre
        return v

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20)


# ─────────────────────────────── MFA (TOTP) ───────────────────────────────


class MfaRequired(BaseModel):
    mfa_required: bool
    mfa_token: str
    token_type: str


LoginResponse = Token | MfaRequired


class MfaConfirmRequest(BaseModel):
    mfa_token: str
    code: str = Field(min_length=6, max_length=6)


class MfaCodeRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class MfaVerifyRequest(BaseModel):
    """Verificación del QR: el secreto se confirma y recién ahí se guarda."""
    secret: str = Field(min_length=16, max_length=64)
    code: str = Field(min_length=6, max_length=6)


class MfaSetupOut(BaseModel):
    otpauth_url: str
    secret: str


class CodigoVerificacionRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    code: str = Field(min_length=6, max_length=6)


class ReenviarCodigoRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)


class RecuperarRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)


class RecuperarConfirmarRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    code: str = Field(min_length=6, max_length=6)
    nueva_password: str = Field(min_length=6, max_length=72)


class RegistroOut(UserOut):
    """Respuesta del registro: indica si hay que verificar el correo."""
    requiere_verificacion: bool = False
    mensaje: str | None = None


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


class VentaPendienteSync(BaseModel):
    """Venta registrada sin conexión en el dispositivo."""
    id_local: str = Field(min_length=1, max_length=100)
    fecha: datetime
    metodo_pago: METODOS_PAGO = "efectivo"
    detalles: List[VentaDetalleCreate] = Field(min_length=1)


class SyncVentasRequest(BaseModel):
    ventas: List[VentaPendienteSync] = Field(min_length=1)


class ResultadoSyncVenta(BaseModel):
    id_local: str
    id_servidor: Optional[int] = None
    total: Optional[float] = None
    error: Optional[str] = None


class SyncVentasResponse(BaseModel):
    resultados: List[ResultadoSyncVenta]


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


class NegocioOut(BaseModel):
    nombre: str
    tipo_negocio: Optional[str] = None
    telefono: Optional[str] = None
    correo: Optional[str] = None
    pais: Optional[str] = None


class ReciboOut(BaseModel):
    venta: VentaOut
    vendedor: Optional[str] = None
    negocio: NegocioOut


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