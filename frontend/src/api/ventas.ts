import { isAxiosError } from 'axios';
import { api, getErrorMessage } from './client';
import {
  Paginated,
  ReciboData,
  SyncVentasResponse,
  Venta,
  VentaPayload,
  VentaPendiente,
} from '../types';

export async function registrarVenta(venta: VentaPayload): Promise<Venta> {
  try {
    const response = await api.post<Venta>('/ventas/', venta);
    return response.data;
  } catch (error) {
    if (isAxiosError(error) && !error.response) throw error;
    throw new Error(getErrorMessage(error, 'Error al registrar la venta'));
  }
}

export async function sincronizarVentas(
  pendientes: VentaPendiente[]
): Promise<SyncVentasResponse> {
  try {
    const response = await api.post<SyncVentasResponse>('/ventas/offline-sync', {
      ventas: pendientes.map(({ id_local, fecha, metodo_pago, detalles }) => ({
        id_local,
        fecha,
        metodo_pago,
        detalles,
      })),
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al sincronizar ventas'));
  }
}

export async function getRecibo(ventaId: number): Promise<ReciboData> {
  try {
    const response = await api.get<ReciboData>(`/ventas/${ventaId}/recibo`);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al obtener el recibo'));
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