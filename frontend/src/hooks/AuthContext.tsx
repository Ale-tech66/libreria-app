import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { cerrarSesion, esMfaRequerido, getMe, login as apiLogin } from '../api/auth';
import {
  clearSession,
  getRefreshToken,
  loadStoredUser,
  saveSession,
  setUnauthorizedHandler,
} from '../api/client';
import { LoginResponse, User } from '../types';

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  finalizarLogin: (tokens: LoginResponse) => Promise<void>;
  refrescarUsuario: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const logout = useCallback(async () => {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      await cerrarSesion(refreshToken);
    }
    await clearSession();
    setUser(null);
  }, []);

  const finalizarLogin = useCallback(async (tokens: LoginResponse) => {
    const { access_token, refresh_token } = tokens;
    await saveSession(access_token, refresh_token, null);
    const me = await getMe();
    await saveSession(access_token, refresh_token, me);
    setUser(me);
  }, []);

  const refrescarUsuario = useCallback(async () => {
    const me = await getMe();
    setUser(me);
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      setLoading(true);
      try {
        const resultado = await apiLogin(username, password);
        if (esMfaRequerido(resultado)) {
          return resultado.mfa_token;
        }
        await finalizarLogin(resultado);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [finalizarLogin]
  );

  const restore = useCallback(async () => {
    const stored = await loadStoredUser();
    if (!stored) {
      setReady(true);
      return;
    }
    try {
      const me = await getMe();
      setUser(me);
    } catch {
      await logout();
    } finally {
      setReady(true);
    }
  }, [logout]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    restore();
  }, [restore]);

  const value = useMemo(
    () => ({ user, ready, loading, login, finalizarLogin, refrescarUsuario, logout }),
    [user, ready, loading, login, finalizarLogin, refrescarUsuario, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return ctx;
}