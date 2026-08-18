import { pedir } from './client';
import type { AuditLogOut, Paginated } from './types';

export const getAuditoria = (params: { page?: number; page_size?: number; recurso?: string }) => {
  const consulta = new URLSearchParams();
  if (params.page !== undefined) consulta.set('page', String(params.page));
  if (params.page_size !== undefined) consulta.set('page_size', String(params.page_size));
  if (params.recurso) consulta.set('recurso', params.recurso);
  return pedir<Paginated<AuditLogOut>>(`/auditoria/?${consulta.toString()}`);
};