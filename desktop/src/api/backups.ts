import { API_URL, pedir } from './client';
import type { TelegramEstado, TelegramResultado } from './types';

export const getEstadoTelegram = () => pedir<TelegramEstado>('/backups/telegram');

export const configurarTelegram = (botToken: string) =>
  pedir<TelegramResultado>('/backups/telegram', { method: 'PUT', body: JSON.stringify({ bot_token: botToken }) });

export const probarTelegram = () => pedir<TelegramResultado>('/backups/telegram/probar', { method: 'POST' });

export async function descargarRespaldo(): Promise<Blob> {
  const token = localStorage.getItem('libreria_sesion');
  const access = token ? (JSON.parse(token) as { access_token: string }).access_token : null;
  const respuesta = await fetch(`${API_URL}/backups/descargar`, {
    headers: access ? { Authorization: `Bearer ${access}` } : {},
  });
  if (!respuesta.ok) throw new Error(`Error ${respuesta.status}`);
  return respuesta.blob();
}