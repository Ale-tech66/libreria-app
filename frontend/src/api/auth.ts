import { api, getErrorMessage } from './client';
import { LoginResponse, LoginResult, MfaRequired, MfaSetupResult, User } from '../types';

export async function login(username: string, password: string): Promise<LoginResult> {
  try {
    const response = await api.post<LoginResult>(
      '/auth/login',
      new URLSearchParams({ username, password }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al iniciar sesión'));
  }
}

export function esMfaRequerido(resultado: LoginResult): resultado is MfaRequired {
  return (resultado as MfaRequired).mfa_required === true;
}

export async function confirmarMfa(
  mfaToken: string,
  code: string
): Promise<LoginResponse> {
  try {
    const response = await api.post<LoginResponse>('/auth/mfa/confirm', {
      mfa_token: mfaToken,
      code,
    });
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Código incorrecto'));
  }
}

export async function mfaSetup(): Promise<MfaSetupResult> {
  try {
    const response = await api.post<MfaSetupResult>('/auth/mfa/setup');
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Error al activar MFA'));
  }
}

export async function mfaVerifySetup(code: string): Promise<void> {
  try {
    await api.post('/auth/mfa/verify-setup', { code });
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Código incorrecto'));
  }
}

export async function mfaDisable(code: string): Promise<void> {
  try {
    await api.post('/auth/mfa/disable', { code });
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Código incorrecto'));
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