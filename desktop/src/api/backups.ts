import { pedir } from './client';
import type { TelegramEstado, TelegramResultado } from './types';

export const getEstadoTelegram = () => pedir<TelegramEstado>('/backups/telegram');

export const configurarTelegram = (botToken: string) =>
  pedir<TelegramResultado>('/backups/telegram', { method: 'PUT', body: JSON.stringify({ bot_token: botToken }) });

export const probarTelegram = () => pedir<TelegramResultado>('/backups/telegram/probar', { method: 'POST' });

export const descargarRespaldo = () => pedir<Blob>('/backups/descargar', { blob: true });