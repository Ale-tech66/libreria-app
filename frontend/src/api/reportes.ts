import { api, getErrorMessage } from './client';
import { ReporteVentas } from '../types';

export async function getReporte(dias = 7): Promise<ReporteVentas> {
  try {
    const response = await api.get<ReporteVentas>('/ventas/reporte', {
      params: { dias },
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al obtener el reporte'));
  }
}