import { pedir } from './client';
import type { Paginated, ReciboOut, ReporteVentas, VentaOut, VentaPayload } from './types';

export const registrarVenta = (venta: VentaPayload) =>
  pedir<VentaOut>('/ventas/', { method: 'POST', body: JSON.stringify(venta) });

export const getHistorialVentas = (page: number, pageSize: number) =>
  pedir<Paginated<VentaOut>>(`/ventas/?page=${page}&page_size=${pageSize}`);

export const getRecibo = (ventaId: number) => pedir<ReciboOut>(`/ventas/${ventaId}/recibo`);

export const getReporte = (dias = 7) => pedir<ReporteVentas>(`/ventas/reporte?dias=${dias}`);