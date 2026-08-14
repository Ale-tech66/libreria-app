import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { obtenerTema, TEMAS, Theme, ThemeId } from './themes';

const CLAVE_TEMA = 'tema';

interface ThemeContextValue {
  tema: Theme;
  temas: readonly Theme[];
  setTemaId: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [temaId, setTemaIdState] = useState<ThemeId>('aurora');
  const [listo, setListo] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CLAVE_TEMA).then((guardado) => {
      if (guardado && TEMAS.some((t) => t.id === guardado)) {
        setTemaIdState(guardado as ThemeId);
      }
      setListo(true);
    });
  }, []);

  const setTemaId = useCallback((id: ThemeId) => {
    setTemaIdState(id);
    AsyncStorage.setItem(CLAVE_TEMA, id).catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ tema: obtenerTema(temaId), temas: TEMAS, setTemaId }),
    [temaId, setTemaId]
  );

  return (
    <ThemeContext.Provider value={value}>
      {listo ? children : null}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return ctx;
}