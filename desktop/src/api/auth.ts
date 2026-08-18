import { API_URL, pedir, type ApiError } from './client';
import type { LoginResponse, MfaSetupOut, RegistroOut, Token, UserOut } from './types';

export type { ApiError };

export async function login(username: string, password: string): Promise<LoginResponse> {
  const cuerpo = new URLSearchParams({ username, password });
  const respuesta = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: cuerpo,
  });
  const texto = await respuesta.text();
  let datos: unknown = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = texto;
  }
  if (!respuesta.ok) {
    const detalle = (datos as { detail?: string })?.detail;
    throw new Error(detalle || `Error ${respuesta.status}`);
  }
  return datos as LoginResponse;
}

export const mfaConfirmar = (mfaToken: string, code: string) =>
  pedir<Token>('/auth/mfa/confirm', { method: 'POST', body: JSON.stringify({ mfa_token: mfaToken, code }) });

export const mfaSetup = () => pedir<MfaSetupOut>('/auth/mfa/setup', { method: 'POST' });

export const mfaVerifySetup = (secret: string, code: string, password: string) =>
  pedir<{ ok: boolean }>('/auth/mfa/verify-setup', { method: 'POST', body: JSON.stringify({ secret, code, password }) });

export const mfaDisable = (code: string) =>
  pedir<{ ok: boolean }>('/auth/mfa/disable', { method: 'POST', body: JSON.stringify({ code }) });

export const registrar = (datos: {
  username: string;
  password: string;
  nombre_negocio?: string;
  tipo_negocio?: string;
  correo?: string;
  telefono?: string;
  pais?: string;
}) => pedir<RegistroOut>('/auth/register', { method: 'POST', body: JSON.stringify({ ...datos, rol: 'admin' }) });

export const verificarCodigo = (username: string, code: string) =>
  pedir<{ ok: boolean }>('/auth/verificar-codigo', { method: 'POST', body: JSON.stringify({ username, code }) });

export const reenviarCodigo = (username: string) =>
  pedir<{ ok: boolean }>('/auth/reenviar-codigo', { method: 'POST', body: JSON.stringify({ username }) });

export const recuperar = (username: string) =>
  pedir<{ ok: boolean }>('/auth/recuperar', { method: 'POST', body: JSON.stringify({ username }) });

export const recuperarConfirmar = (username: string, code: string, nueva_password: string) =>
  pedir<{ ok: boolean }>('/auth/recuperar-confirmar', {
    method: 'POST',
    body: JSON.stringify({ username, code, nueva_password }),
  });

export const refresh = (refreshToken: string) =>
  pedir<Token>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) });

export const me = (accessToken: string) =>
  pedir<UserOut>('/auth/me', { headers: { Authorization: `Bearer ${accessToken}` } });

export const cerrarSesionApi = (refreshToken: string) =>
  pedir<{ ok: boolean }>('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) });

export const actualizarCorreo = (correo: string, password: string) =>
  pedir<UserOut>('/auth/correo', { method: 'PUT', body: JSON.stringify({ correo, password }) });

export const getUsuarios = () => pedir<UserOut[]>('/auth/users');

export const crearUsuario = (username: string, password: string, rol: string) =>
  pedir<UserOut>('/auth/register', { method: 'POST', body: JSON.stringify({ username, password, rol }) });

export const actualizarUsuario = (id: number, update: { rol?: string; activo?: boolean; password?: string }) =>
  pedir<UserOut>(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(update) });