export type Rol = 'admin' | 'inventario' | 'ventas';
export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'yape';

export interface User {
  id: number;
  username: string;
  rol: Rol;
  activo: boolean;
}

export interface UserUpdatePayload {
  rol?: Rol;
  activo?: boolean;
  password?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface Producto {
  id: number;
  codigo_barras: string;
  nombre: string;
  autor: string | null;
  editorial: string | null;
  precio_venta: number;
  stock: number;
  unidades_por_caja: number;
  foto: string | null;
  activo: boolean;
}

export type ProductoPayload = Omit<Producto, 'id' | 'foto'>;

export interface VentaDetalle {
  id: number;
  producto_id: number;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
}

export interface Venta {
  id: number;
  fecha: string;
  total: number;
  metodo_pago: MetodoPago;
  detalles: VentaDetalle[];
}

export interface DetalleVentaPayload {
  producto_id: number;
  cantidad: number;
}

export interface VentaPayload {
  metodo_pago: MetodoPago;
  detalles: DetalleVentaPayload[];
}

export interface Paginated<T> {
  total: number;
  page: number;
  page_size: number;
  items: T[];
}

export interface CarritoItem {
  producto_id: number;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  stock: number;
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