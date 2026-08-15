import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { getAuditoria } from '@/api/auditoria';
import { ThemedCard, ThemedChip, ThemedHeader, ThemedScreen } from '@/design/components';
import { useTheme } from '@/design/ThemeContext';
import { AuditLog } from '@/types';

const PAGE_SIZE = 50;
const RECURSOS = ['todos', 'usuario', 'producto', 'venta', 'sesion'] as const;
type RecursoFiltro = (typeof RECURSOS)[number];

const ICONOS: Record<string, keyof typeof Ionicons.glyphMap> = {
  usuario: 'person',
  producto: 'book',
  venta: 'cart',
  sesion: 'key',
};

export default function AuditoriaScreen() {
  const { tema } = useTheme();
  const [registros, setRegistros] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recurso, setRecurso] = useState<RecursoFiltro>('todos');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const cargar = useCallback(
    async (reset: boolean) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const pagina = reset ? 1 : page;
        const data = await getAuditoria({
          page: pagina,
          page_size: PAGE_SIZE,
          recurso: recurso === 'todos' ? undefined : recurso,
        });
        setRegistros((prev) => (reset ? data.items : [...prev, ...data.items]));
        setTotal(data.total);
        setPage(pagina);
        setHasMore(pagina * PAGE_SIZE < data.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar la auditoría');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [page, recurso]
  );

  useEffect(() => {
    cargar(true);
  }, [recurso, cargar]);

  const loadMore = () => {
    if (loading || loadingMore || !hasMore) return;
    cargar(false);
  };

  return (
    <ThemedScreen>
      <View style={styles.contenido}>
        <ThemedHeader
          titulo="Auditoría"
          subtitulo={`${total} registro(s) de actividad`}
        />

        <View style={styles.filtros}>
          {RECURSOS.map((r) => (
            <ThemedChip
              key={r}
              etiqueta={r === 'todos' ? 'Todos' : r}
              seleccionado={recurso === r}
              onPress={() => setRecurso(r)}
            />
          ))}
        </View>

        {error && (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: tema.superficie, borderColor: tema.peligro },
            ]}
          >
            <Text style={[styles.errorTexto, { color: tema.peligro }]}>{error}</Text>
            <TouchableOpacity onPress={() => cargar(true)}>
              <Text style={[styles.reintentar, { color: tema.primario }]}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={tema.primario} />
          </View>
        ) : (
          <FlatList
            data={registros}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingBottom: 90 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeIn.delay(Math.min(index, 8) * 40).duration(300)}>
                <ThemedCard entering={false} style={styles.card}>
                  <View style={styles.fila}>
                    <View
                      style={[
                        styles.icono,
                        {
                          backgroundColor:
                            item.accion === 'desactivar' ? tema.peligro : tema.primario,
                        },
                      ]}
                    >
                      <Ionicons
                        name={ICONOS[item.recurso] ?? 'document-text'}
                        size={18}
                        color={tema.primarioTexto}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.accion, { color: tema.texto }]} numberOfLines={2}>
                        {item.detalle ?? `${item.accion} ${item.recurso}`}
                      </Text>
                      <Text style={[styles.meta, { color: tema.textoSuave }]}>
                        {item.username ?? 'Sistema'} · {formatearFecha(item.fecha)}
                      </Text>
                    </View>
                  </View>
                </ThemedCard>
              </Animated.View>
            )}
            ListEmptyComponent={
              <Text style={[styles.vacio, { color: tema.textoSuave }]}>
                Sin registros de actividad.
              </Text>
            }
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator style={{ margin: 16 }} color={tema.primario} />
              ) : null
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
          />
        )}
      </View>
    </ThemedScreen>
  );
}

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  const dia = fecha.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
  const hora = fecha.toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dia} ${hora}`;
}

const styles = StyleSheet.create({
  contenido: {
    flex: 1,
    padding: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorTexto: {
    flex: 1,
  },
  reintentar: {
    fontWeight: '700',
    marginLeft: 10,
  },
  card: {
    padding: 12,
    marginBottom: 10,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icono: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accion: {
    fontSize: 14,
    fontWeight: '600',
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
  vacio: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
});