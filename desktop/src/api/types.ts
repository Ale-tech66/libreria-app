export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginResponse {
  mfa_required: boolean;
  mfa_token?: string;
  token_type: string;
  access_token?: string;
  refresh_token?: string;
}

export interface UserOut {
  id: number;
  username: string;
  rol: string;
  activo: boolean;
  organizacion?: string | null;
  mfa_activo?: boolean | null;
  correo?: string | null;
}

export interface RegistroOut extends UserOut {
  requiere_verificacion: boolean;
  mensaje?: string | null;
}

export interface MfaSetupOut {
  otpauth_url: string;
  secret: string;
}

export interface Producto {
  id: number;
  codigo_barras: string;
  nombre: string;
  autor?: string | null;
  editorial?: string | null;
  precio_venta: number;
  stock: number;
  unidades_por_caja: number;
  activo: boolean;
  foto?: string | null;
}

export interface ProductoPayload {
  codigo_barras: string;
  nombre: string;
  autor?: string | null;
  editorial?: string | null;
  precio_venta: number;
  stock: number;
  unidades_por_caja: number;
  activo: boolean;
}

export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'yape';

export interface VentaDetalleCreate {
  producto_id: number;
  cantidad: number;
}

export interface VentaPayload {
  metodo_pago: MetodoPago;
  detalles: VentaDetalleCreate[];
}

export interface VentaDetalleOut {
  id: number;
  producto_id: number;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
}

export interface VentaOut {
  id: number;
  fecha: string;
  total: number;
  metodo_pago: string;
  detalles: VentaDetalleOut[];
}

export interface NegocioOut {
  nombre: string;
  tipo_negocio?: string | null;
  telefono?: string | null;
  correo?: string | null;
  pais?: string | null;
}

export interface ReciboOut {
  venta: VentaOut;
  vendedor?: string | null;
  negocio: NegocioOut;
}

export interface VentaPorDia {
  fecha: string;
  total: number;
  cantidad: number;
}

export interface ProductoTop {
  producto_id: number;
  producto_nombre: string;
  cantidad: number;
  ingresos: number;
}

export interface ReporteVentas {
  total_ventas: number;
  ingresos_totales: number;
  por_dia: VentaPorDia[];
  top_productos: ProductoTop[];
}

export interface AuditLogOut {
  id: number;
  usuario_id?: number | null;
  username?: string | null;
  accion: string;
  recurso: string;
  recurso_id?: number | null;
  detalle?: string | null;
  fecha: string;
}

export interface Paginated<T> {
  total: number;
  page: number;
  page_size: number;
  items: T[];
}

export interface TelegramEstado {
  bot_token_guardado: boolean;
  bot_token_sufijo?: string | null;
  chat_id?: string | null;
}

export interface TelegramResultado {
  ok: boolean;
  chat_id?: string | null;
  detalle?: string | null;
}

export interface UserUpdatePayload {
  rol?: string;
  activo?: boolean;
  password?: string;
}