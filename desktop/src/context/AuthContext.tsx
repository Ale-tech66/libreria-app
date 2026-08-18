import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { cerrarSesionApi, me } from '../api/auth';
import { limpiarSesionLocal, renovarToken, setAlSinSesion } from '../api/client';
import type { Token, UserOut } from '../api/types';

interface Sesion {
  access_token: string;
  refresh_token: string;
  usuario: UserOut;
}

interface AuthContextValue {
  sesion: Sesion | null;
  iniciar: (tokens: Token) => Promise<void>;
  refrescarUsuario: () => Promise<void>;
  cerrar: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  sesion: null,
  iniciar: async () => undefined,
  refrescarUsuario: async () => undefined,
  cerrar: async () => undefined,
});

const CLAVE_SESION = 'libreria_sesion';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(() => {
    try {
      const cruda = localStorage.getItem(CLAVE_SESION);
      return cruda ? (JSON.parse(cruda) as Sesion) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (sesion) {
      localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    } else {
      localStorage.removeItem(CLAVE_SESION);
    }
  }, [sesion]);

  useEffect(() => {
    setAlSinSesion(() => setSesion(null));
  }, []);

  const iniciar = useCallback(async (tokens: Token) => {
    const usuario = await me(tokens.access_token);
    setSesion({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, usuario });
  }, []);

  const refrescarUsuario = useCallback(async () => {
    if (!sesion) return;
    try {
      const usuario = await me(sesion.access_token);
      setSesion({ ...sesion, usuario });
    } catch {
      /* el flujo 401 lo maneja el cliente */
    }
  }, [sesion]);

  const renovar = useCallback(async () => {
    // Usa el mismo renovador del cliente API (single-flight): nunca hay dos
    // refrescos en paralelo con el mismo token, y un error de red no borra
    // la sesión. Los tokens nuevos quedan en localStorage (guardarTokens).
    const resultado = await renovarToken();
    if (resultado !== 'ok') return;
    try {
      const cruda = localStorage.getItem(CLAVE_SESION);
      if (!cruda) return;
      const guardada = JSON.parse(cruda) as { access_token: string; refresh_token: string };
      const usuario = await me(guardada.access_token);
      setSesion({ ...guardada, usuario });
    } catch {
      /* el próximo 401 lo maneja el cliente */
    }
  }, []);

  useEffect(() => {
    const intervalo = setInterval(() => void renovar(), 25 * 60 * 1000);
    return () => clearInterval(intervalo);
  }, [renovar]);

  const cerrar = useCallback(async () => {
    try {
      if (sesion) await cerrarSesionApi(sesion.refresh_token);
    } catch {
      /* sin conexión: igual cerramos local */
    }
    limpiarSesionLocal();
    setSesion(null);
  }, [sesion]);

  const valor = useMemo(
    () => ({ sesion, iniciar, refrescarUsuario, cerrar }),
    [sesion, iniciar, refrescarUsuario, cerrar],
  );
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}