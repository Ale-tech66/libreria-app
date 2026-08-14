import { useCallback, useEffect, useState } from 'react';

import { getMe, login as apiLogin } from '../api/auth';
import { clearSession, loadStoredUser, saveSession, setUnauthorizedHandler } from '../api/client';
import { User } from '../types';

export function useAuth() {
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
      // Valida el token contra el servidor; si expiró, /me devuelve 401
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

  return { user, ready, loading, login, logout };
}