import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { api, API_URL, getErrorMessage, getToken } from './client';
import { TelegramEstado, TelegramResultado } from '../types';

export async function getEstadoTelegram(): Promise<TelegramEstado> {
  try {
    const response = await api.get<TelegramEstado>('/backups/telegram');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al consultar la configuración'));
  }
}

export async function configurarTelegram(botToken: string): Promise<TelegramResultado> {
  try {
    const response = await api.put<TelegramResultado>('/backups/telegram', {
      bot_token: botToken.trim(),
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al guardar la configuración'));
  }
}

export async function probarTelegram(): Promise<TelegramResultado> {
  try {
    const response = await api.post<TelegramResultado>('/backups/telegram/probar');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al enviar el mensaje de prueba'));
  }
}

export async function descargarRespaldo(): Promise<void> {
  const token = await getToken();
  if (!token) throw new Error('Sin sesión');
  const nombre = `respaldo-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.json.gz`;
  const archivo = new File(Paths.cache, nombre);
  await File.downloadFileAsync(`${API_URL}/backups/descargar`, archivo, {
    headers: { Authorization: `Bearer ${token}` },
    idempotent: true,
  });
  await Sharing.shareAsync(archivo.uri, {
    mimeType: 'application/gzip',
    dialogTitle: 'Respaldo de Librería App',
  });
}