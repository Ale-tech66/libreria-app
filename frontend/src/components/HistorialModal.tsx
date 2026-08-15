import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getHistorialVentas } from '../api/ventas';
import { ThemedCard, ThemedHeader, ThemedScreen } from '../design/components';
import { useTheme } from '../design/ThemeContext';
import { MetodoPago, Venta } from '../types';

interface HistorialModalProps {
  visible: boolean;
  onClose: () => void;
  onVerRecibo?: (ventaId: number) => void;
}

const PAGE_SIZE = 50;

const ICONOS_METODO: Record<MetodoPago, keyof typeof Ionicons.glyphMap> = {
  efectivo: 'cash-outline',
  tarjeta: 'card-outline',
  transferencia: 'swap-horizontal',
  yape: 'phone-portrait-outline',
};

export default function HistorialModal({ visible, onClose, onVerRecibo }: HistorialModalProps) {
  const { tema } = useTheme();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (nextPage: number) => {
    if (nextPage === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const data = await getHistorialVentas(nextPage, PAGE_SIZE);
      setVentas((prev) => (nextPage === 1 ? data.items : [...prev, ...data.items]));
      setTotal(data.total);
      setPage(nextPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al obtener el historial');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setVentas([]);
      setPage(1);
      cargar(1);
    }
  }, [visible, cargar]);

  const loadMore = () => {
    if (loading || loadingMore || page * PAGE_SIZE >= total) return;
    cargar(page + 1);
  };

  const formatearFecha = (fechaISO: string) => {
    const fecha = new Date(fechaISO);
    return (
      fecha.toLocaleDateString() +
      ' ' +
      fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  };

  return (
    <Modal visible={visible} animationType="slide">
      <ThemedScreen>
        <View style={styles.contenido}>
          <ThemedHeader
            titulo="Historial de Ventas"
            subtitulo={`${total} venta(s)`}
            derecho={
              <TouchableOpacity
                onPress={onClose}
                style={[styles.botonCerrar, { backgroundColor: tema.peligro }]}
              >
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            }
          />

          {error && (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: tema.superficie, borderColor: tema.peligro },
              ]}
            >
              <Text style={[styles.errorTexto, { color: tema.peligro }]}>{error}</Text>
              <TouchableOpacity onPress={() => cargar(1)}>
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
              data={ventas}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
              renderItem={({ item }) => (
                <ThemedCard entering={false} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.ventaId, { color: tema.primario }]}>
                      Venta #{item.id}
                    </Text>
                    <Text style={[styles.total, { color: tema.exito }]}>
                      ${item.total.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.filaDetalle}>
                    <Ionicons name="calendar-outline" size={14} color={tema.textoSuave} />
                    <Text style={[styles.detalle, { color: tema.textoSuave }]}>
                      {formatearFecha(item.fecha)}
                    </Text>
                  </View>
                  <View style={styles.filaDetalle}>
                    <Ionicons name={ICONOS_METODO[item.metodo_pago]} size={14} color={tema.textoSuave} />
                    <Text style={[styles.detalle, { color: tema.textoSuave }]}>
                      Pago: {item.metodo_pago}
                    </Text>
                  </View>
                  {item.detalles.map((detalle) => (
                    <View key={detalle.id} style={styles.itemDetalle}>
                      <Ionicons name="ellipse" size={6} color={tema.primario} />
                      <Text style={[styles.itemTexto, { color: tema.texto }]}>
                        {detalle.producto_nombre} x{detalle.cantidad}
                      </Text>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={[styles.botonRecibo, { borderColor: tema.primario }]}
                    onPress={() => onVerRecibo?.(item.id)}
                  >
                    <Ionicons name="print-outline" size={14} color={tema.primario} />
                    <Text style={[styles.botonReciboTexto, { color: tema.primario }]}>
                      Imprimir recibo
                    </Text>
                  </TouchableOpacity>
                </ThemedCard>
              )}
              ListEmptyComponent={
                <Text style={[styles.vacio, { color: tema.textoSuave }]}>
                  No hay ventas registradas.
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  contenido: {
    flex: 1,
    padding: 20,
  },
  botonCerrar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ventaId: {
    fontSize: 17,
    fontWeight: '800',
  },
  total: {
    fontSize: 19,
    fontWeight: '800',
  },
  filaDetalle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  detalle: {
    fontSize: 13,
  },
  itemDetalle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
    paddingLeft: 4,
  },
  itemTexto: {
    fontSize: 13,
    flex: 1,
  },
  botonRecibo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    marginTop: 10,
  },
  botonReciboTexto: {
    fontSize: 13,
    fontWeight: '700',
  },
  vacio: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
});