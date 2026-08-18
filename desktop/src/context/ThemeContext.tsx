import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { aplicarTema, obtenerTema, TEMAS, type ThemeId } from '../theme/themes';

const CLAVE_TEMA = 'libreria_tema';

interface ThemeContextValue {
  temaId: ThemeId;
  setTemaId: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ temaId: 'aurora', setTemaId: () => undefined });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [temaId, setTemaIdState] = useState<ThemeId>(() => {
    const guardado = localStorage.getItem(CLAVE_TEMA) as ThemeId | null;
    return TEMAS.some((t) => t.id === guardado) ? (guardado as ThemeId) : 'aurora';
  });

  useEffect(() => {
    aplicarTema(obtenerTema(temaId));
    localStorage.setItem(CLAVE_TEMA, temaId);
  }, [temaId]);

  const setTemaId = useCallback((id: ThemeId) => setTemaIdState(id), []);

  const valor = useMemo(() => ({ temaId, setTemaId }), [temaId, setTemaId]);
  return <ThemeContext.Provider value={valor}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}