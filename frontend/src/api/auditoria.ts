import { api, getErrorMessage } from './client';
import { AuditLog, Paginated } from '../types';

export async function getAuditoria(params: {
  page?: number;
  page_size?: number;
  recurso?: string;
} = {}): Promise<Paginated<AuditLog>> {
  try {
    const response = await api.get<Paginated<AuditLog>>('/auditoria/', { params });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al cargar la auditoría'));
  }
}