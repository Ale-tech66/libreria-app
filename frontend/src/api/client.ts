import AsyncStorage from '@react-native-async-storage/async-storage';
import { AxiosError, create, isAxiosError } from 'axios';
import Constants from 'expo-constants';

export const API_URL =
  Constants.expoConfig?.extra?.apiUrl ?? 'https://libreria-api-4lr3.onrender.com';

export const api = create({
  baseURL: API_URL,
  timeout: 15000,
});

const TOKEN_KEY = 'token';
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

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);

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

export async function saveSession(token: string, user: unknown): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function loadStoredUser(): Promise<unknown | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}