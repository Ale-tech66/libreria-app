import { pedir } from './client';
import type { Paginated, Producto, ProductoPayload } from './types';

export const getProductos = (params: { q?: string; page?: number; page_size?: number; incluir_inactivos?: boolean }) => {
  const consulta = new URLSearchParams();
  if (params.q) consulta.set('q', params.q);
  if (params.page !== undefined) consulta.set('page', String(params.page));
  if (params.page_size !== undefined) consulta.set('page_size', String(params.page_size));
  if (params.incluir_inactivos) consulta.set('incluir_inactivos', 'true');
  const sufijo = consulta.toString() ? `?${consulta}` : '';
  return pedir<Paginated<Producto>>(`/productos/${sufijo}`);
};

export const buscarProductoPorCodigo = async (codigo: string): Promise<Producto | null> => {
  try {
    return await pedir<Producto>(`/productos/${encodeURIComponent(codigo)}`);
  } catch (err) {
    if (err instanceof Error && 'status' in err && (err as { status: number }).status === 404) return null;
    throw err;
  }
};

export const crearProducto = (producto: ProductoPayload) =>
  pedir<Producto>('/productos/', { method: 'POST', body: JSON.stringify(producto) });

export const actualizarProducto = (id: number, producto: ProductoPayload) =>
  pedir<Producto>(`/productos/${id}`, { method: 'PUT', body: JSON.stringify(producto) });

export const desactivarProducto = (id: number) => pedir<Producto>(`/productos/${id}`, { method: 'DELETE' });

export const subirFotoProducto = (id: number, archivo: Blob) => {
  const form = new FormData();
  form.append('foto', archivo, 'foto.jpg');
  return pedir<Producto>(`/productos/${id}/foto`, { method: 'POST', body: form });
};

export const urlFoto = (foto?: string | null): string | null => {
  if (!foto) return null;
  if (foto.startsWith('http')) return foto;
  return `https://libreria-api-4lr3.onrender.com/uploads/${foto}`;
};