import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAxiosError } from 'axios';
import { api, getErrorMessage } from './client';
import { Paginated, Producto, ProductoPayload } from '../types';

const CLAVE_CACHE = 'productos_cache';

export interface ProductoParams {
  q?: string;
  page?: number;
  page_size?: number;
  incluir_inactivos?: boolean;
}

export async function getProductos(params: ProductoParams = {}): Promise<Paginated<Producto>> {
  try {
    const response = await api.get<Paginated<Producto>>('/productos/', { params });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al obtener productos'));
  }
}

export async function buscarProductoPorCodigo(codigo: string): Promise<Producto | null> {
  try {
    const response = await api.get<Producto>(`/productos/${codigo}`);
    return response.data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw new Error(getErrorMessage(error, 'Error al buscar producto'));
  }
}

async function leerCache(): Promise<Producto[]> {
  try {
    const raw = await AsyncStorage.getItem(CLAVE_CACHE);
    return raw ? (JSON.parse(raw) as Producto[]) : [];
  } catch {
    return [];
  }
}

export async function guardarProductosEnCache(items: Producto[], append = false): Promise<void> {
  try {
    const previos = append ? await leerCache() : [];
    const mapa = new Map(previos.map((p) => [p.id, p]));
    items.forEach((p) => mapa.set(p.id, p));
    await AsyncStorage.setItem(CLAVE_CACHE, JSON.stringify([...mapa.values()]));
  } catch {
    // El caché es best-effort: nunca debe romper el flujo normal
  }
}

export async function buscarProductoEnCache(codigo: string): Promise<Producto | null> {
  const lista = await leerCache();
  return lista.find((p) => p.codigo_barras === codigo) ?? null;
}

export async function refrescarCacheProductos(): Promise<void> {
  let items: Producto[] = [];
  let pagina = 1;
  const pageSize = 100;
  let total = Infinity;
  while (items.length < total && pagina <= 6) {
    const data = await getProductos({ page: pagina, page_size: pageSize });
    total = data.total;
    items = [...items, ...data.items];
    pagina += 1;
  }
  await guardarProductosEnCache(items, false);
}

export async function crearProducto(producto: ProductoPayload): Promise<Producto> {
  try {
    const response = await api.post<Producto>('/productos/', producto);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al crear el producto'));
  }
}

export async function actualizarProducto(
  id: number,
  producto: ProductoPayload
): Promise<Producto> {
  try {
    const response = await api.put<Producto>(`/productos/${id}`, producto);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al actualizar el producto'));
  }
}

export async function desactivarProducto(id: number): Promise<Producto> {
  try {
    const response = await api.delete<Producto>(`/productos/${id}`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al desactivar el producto'));
  }
}

export async function subirFotoProducto(id: number, uri: string): Promise<Producto> {
  const formData = new FormData();
  const nombreArchivo = uri.split('/').pop() ?? 'foto.jpg';
  formData.append('foto', {
    uri,
    name: nombreArchivo,
    type: 'image/jpeg',
  } as unknown as Blob);
  try {
    const response = await api.post<Producto>(`/productos/${id}/foto`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 20000,
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al subir la foto'));
  }
}