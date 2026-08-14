import { api, getErrorMessage } from './client';
import { Paginated, Venta, VentaPayload } from '../types';

export async function registrarVenta(venta: VentaPayload): Promise<Venta> {
  try {
    const response = await api.post<Venta>('/ventas/', venta);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al registrar la venta'));
  }
}

export async function getHistorialVentas(page = 1, pageSize = 50): Promise<Paginated<Venta>> {
  try {
    const response = await api.get<Paginated<Venta>>('/ventas/', {
      params: { page, page_size: pageSize },
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al obtener el historial'));
  }
}