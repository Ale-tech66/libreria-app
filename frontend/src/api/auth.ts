import { api, getErrorMessage } from './client';
import { LoginResponse, User } from '../types';

export async function login(username: string, password: string): Promise<LoginResponse> {
  try {
    const response = await api.post<LoginResponse>(
      '/auth/login',
      new URLSearchParams({ username, password }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al iniciar sesión'));
  }
}

export async function getMe(): Promise<User> {
  try {
    const response = await api.get<User>('/auth/me');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Sesión no válida'));
  }
}

export async function cerrarSesion(refreshToken: string): Promise<void> {
  try {
    await api.post('/auth/logout', { refresh_token: refreshToken });
  } catch {
    // El logout local siempre se hace; revocar es lo mejor posible
  }
}

export interface RegistroDatos {
  nombreNegocio?: string;
  tipoNegocio?: string;
}

export async function register(
  username: string,
  password: string,
  datos?: RegistroDatos
): Promise<User> {
  try {
    const response = await api.post<User>('/auth/register', {
      username,
      password,
      nombre_negocio: datos?.nombreNegocio,
      tipo_negocio: datos?.tipoNegocio,
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al registrarse'));
  }
}