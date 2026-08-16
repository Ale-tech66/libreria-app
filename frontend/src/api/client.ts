import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosError, create, isAxiosError } from 'axios';
import Constants from 'expo-constants';

import { LoginResponse } from '../types';

export const API_URL =
  Constants.expoConfig?.extra?.apiUrl ?? 'https://libreria-api-4lr3.onrender.com';

export const api = create({
  baseURL: API_URL,
  timeout: 15000,
});

const TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user';

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Renovación silenciosa: ante un 401 se intenta refrescar el token una vez
// y se reintenta la petición original. Si el refresco falla, se cierra la sesión.
let refreshPromise: Promise<string> | null = null;

async function renovarToken(): Promise<string> {
  const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) throw new Error('Sin sesión');
  const response = await axios.post(`${API_URL}/auth/refresh`, {
    refresh_token: refreshToken,
  });
  const { access_token, refresh_token } = response.data as LoginResponse;
  await AsyncStorage.multiSet([
    [TOKEN_KEY, access_token],
    [REFRESH_TOKEN_KEY, refresh_token],
  ]);
  return access_token;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const ruta = error.config?.url ?? '';
    const esAuth =
      ruta.includes('/auth/login') || ruta.includes('/auth/refresh') || ruta.includes('/auth/logout');

    if (error.response?.status === 401 && !esAuth) {
      try {
        refreshPromise ??= renovarToken().finally(() => {
          refreshPromise = null;
        });
        const nuevoToken = await refreshPromise;
        const config = error.config!;
        config.headers.Authorization = `Bearer ${nuevoToken}`;
        return api.request(config);
      } catch {
        await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
        onUnauthorized?.();
      }
    }
    return Promise.reject(error);
  }
);

export function esErrorDeRed(error: unknown): boolean {
  return isAxiosError(error) && !error.response;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
    if (typeof detail === 'string') return detail;
  }
  return fallback;
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function saveSession(
  token: string,
  refreshToken: string,
  user: unknown
): Promise<void> {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [REFRESH_TOKEN_KEY, refreshToken],
    [USER_KEY, JSON.stringify(user)],
  ]);
}

export async function loadStoredUser(): Promise<unknown | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
}