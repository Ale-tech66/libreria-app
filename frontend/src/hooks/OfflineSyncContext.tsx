import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Alert, AppState } from 'react-native';

import { refrescarCacheProductos } from '../api/productos';
import { getToken } from '../api/client';
import { sincronizarVentas } from '../api/ventas';
import { VentaPendiente, VentaPayload } from '../types';

const CLAVE_PENDIENTES = 'ventas_pendientes';
const INTERVALO_SYNC_MS = 30000;

interface OfflineSyncValue {
  pendientes: VentaPendiente[];
  sincronizando: boolean;
  agregarPendiente: (venta: VentaPayload) => Promise<void>;
  sincronizarAhora: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncValue | null>(null);

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const [pendientes, setPendientes] = useState<VentaPendiente[]>([]);
  const [sincronizando, setSincronizando] = useState(false);

  const pendientesRef = useRef<VentaPendiente[]>([]);
  const sincronizandoRef = useRef(false);

  useEffect(() => {
    pendientesRef.current = pendientes;
    AsyncStorage.setItem(CLAVE_PENDIENTES, JSON.stringify(pendientes)).catch(() => {});
  }, [pendientes]);

  // Carga la cola guardada al iniciar la app
  useEffect(() => {
    AsyncStorage.getItem(CLAVE_PENDIENTES)
      .then((raw) => {
        if (!raw) return;
        const lista = JSON.parse(raw) as VentaPendiente[];
        if (Array.isArray(lista)) {
          setPendientes(lista);
          pendientesRef.current = lista;
        }
      })
      .catch(() => {});
  }, []);

  const agregarPendiente = useCallback(async (venta: VentaPayload) => {
    const pendiente: VentaPendiente = {
      ...venta,
      id_local: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fecha: new Date().toISOString(),
    };
    setPendientes((prev) => [...prev, pendiente]);
  }, []);

  const sincronizarAhora = useCallback(async () => {
    if (sincronizandoRef.current) return;
    const lista = pendientesRef.current;
    if (lista.length === 0) return;
    if (!(await getToken())) return;

    sincronizandoRef.current = true;
    setSincronizando(true);
    try {
      const res = await sincronizarVentas(lista);
      const procesadas = new Set(res.resultados.map((r) => r.id_local));
      const sincronizadas = res.resultados.filter((r) => r.error == null);
      const fallidas = res.resultados.filter((r) => r.error != null);

      if (procesadas.size > 0) {
        setPendientes((prev) => prev.filter((p) => !procesadas.has(p.id_local)));
      }
      if (sincronizadas.length > 0) {
        refrescarCacheProductos().catch(() => {});
      }
      if (fallidas.length > 0) {
        const primera = fallidas[0].error ?? 'Error desconocido';
        Alert.alert(
          'Sincronización incompleta',
          `${fallidas.length} venta(s) guardada(s) sin conexión no pudieron registrarse y se eliminaron de la cola.\n\n${primera}`
        );
      }
    } catch {
      // Sigue sin conexión: se reintentará en el siguiente ciclo
    } finally {
      sincronizandoRef.current = false;
      setSincronizando(false);
    }
  }, []);

  // Reintento periódico mientras haya pendientes
  useEffect(() => {
    const timer = setInterval(() => {
      if (pendientesRef.current.length > 0) {
        sincronizarAhora();
      }
    }, INTERVALO_SYNC_MS);
    return () => clearInterval(timer);
  }, [sincronizarAhora]);

  // Al volver la app al primer plano
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') sincronizarAhora();
    });
    return () => sub.remove();
  }, [sincronizarAhora]);

  // Primer intento poco después de iniciar sesión
  useEffect(() => {
    const t = setTimeout(() => sincronizarAhora(), 3000);
    return () => clearTimeout(t);
  }, [sincronizarAhora]);

  return (
    <OfflineSyncContext.Provider
      value={{ pendientes, sincronizando, agregarPendiente, sincronizarAhora }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync(): OfflineSyncValue {
  const contexto = useContext(OfflineSyncContext);
  if (!contexto) {
    throw new Error('useOfflineSync debe usarse dentro de OfflineSyncProvider');
  }
  return contexto;
}