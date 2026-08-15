import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getMe, login as apiLogin } from '../api/auth';
import { clearSession, loadStoredUser, saveSession, setUnauthorizedHandler } from '../api/client';
import { User } from '../types';

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const logout = useCallback(async () => {
    await clearSession();
    setUser(null);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      const { access_token } = await apiLogin(username, password);
      await saveSession(access_token, null);
      const me = await getMe();
      await saveSession(access_token, me);
      setUser(me);
    } finally {
      setLoading(false);
    }
  }, []);

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
    () => ({ user, ready, loading, login, logout }),
    [user, ready, loading, login, logout]
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