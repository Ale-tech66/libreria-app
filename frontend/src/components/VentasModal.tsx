import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { buscarProductoPorCodigo } from '@/api/productos';
import ScannerModal from '@/components/ScannerModal';
import { ThemedButton, ThemedCard, ThemedChip, ThemedHeader, ThemedScreen } from '@/design/components';
import { useTheme } from '@/design/ThemeContext';
import { useCarrito } from '@/hooks/useCarrito';
import { MetodoPago } from '@/types';

const METODOS: MetodoPago[] = ['efectivo', 'tarjeta', 'transferencia', 'yape'];

interface VentasModalProps {
  visible: boolean;
  onClose: () => void;
  onCobrado?: (ventaId: number) => void;
}

export default function VentasModal({ visible, onClose, onCobrado }: VentasModalProps) {
  const { tema } = useTheme();
  const { items, total, cobrando, agregar, cambiarCantidad, eliminar, cobrar } = useCarrito();
  const [scanning, setScanning] = useState(false);
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');

  const handleScan = async (data: string) => {
    setScanning(false);
    try {
      const producto = await buscarProductoPorCodigo(data);
      if (!producto) {
        Alert.alert('Error', 'Producto no registrado. Ve a Inventario para agregarlo.');
        return;
      }
      if (!producto.activo) {
        Alert.alert('Error', 'Este producto está desactivado y no puede venderse.');
        return;
      }
      agregar(producto);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error al escanear');
    }
  };

  const handleCobrar = async () => {
    try {
      const venta = await cobrar(metodo);
      onClose();
      onCobrado?.(venta.id);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error al registrar la venta');
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <ThemedScreen>
        <View style={styles.contenido}>
          <ThemedHeader
            titulo="Punto de Venta"
            subtitulo="Escanea y cobra"
            derecho={
              <TouchableOpacity
                onPress={onClose}
                style={[styles.botonCerrar, { backgroundColor: tema.peligro }]}
              >
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            }
          />

          <ThemedButton
            titulo="Escanear Producto"
            icono="scan"
            onPress={() => setScanning(true)}
            style={{ marginBottom: 12 }}
          />

          <Text style={[styles.etiquetaMetodo, { color: tema.textoSuave }]}>
            MÉTODO DE PAGO
          </Text>
          <View style={styles.filaMetodos}>
            {METODOS.map((m) => (
              <ThemedChip
                key={m}
                etiqueta={m}
                icono={
                  m === 'efectivo'
                    ? 'cash-outline'
                    : m === 'tarjeta'
                      ? 'card-outline'
                      : m === 'transferencia'
                        ? 'swap-horizontal'
                        : 'phone-portrait-outline'
                }
                seleccionado={metodo === m}
                onPress={() => setMetodo(m)}
              />
            ))}
          </View>

          <FlatList
            data={items}
            keyExtractor={(item) => item.producto_id.toString()}
            style={{ flex: 1, marginTop: 12 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => (
              <ThemedCard entering={false} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.nombre, { color: tema.texto }]} numberOfLines={1}>
                    {item.nombre}
                  </Text>
                  <TouchableOpacity onPress={() => eliminar(item.producto_id)}>
                    <Ionicons name="trash-outline" size={20} color={tema.peligro} />
                  </TouchableOpacity>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      onPress={() => cambiarCantidad(item.producto_id, item.cantidad - 1)}
                      style={[styles.stepBoton, { backgroundColor: tema.primario }]}
                    >
                      <Ionicons name="remove" size={18} color={tema.primarioTexto} />
                    </TouchableOpacity>
                    <Text style={[styles.cantidad, { color: tema.texto }]}>{item.cantidad}</Text>
                    <TouchableOpacity
                      onPress={() => cambiarCantidad(item.producto_id, item.cantidad + 1)}
                      disabled={item.cantidad >= item.stock}
                      style={[
                        styles.stepBoton,
                        { backgroundColor: tema.primario },
                        item.cantidad >= item.stock && { opacity: 0.4 },
                      ]}
                    >
                      <Ionicons name="add" size={18} color={tema.primarioTexto} />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.subtotal, { color: tema.exito }]}>
                    ${(item.cantidad * item.precio_unitario).toFixed(2)}
                  </Text>
                </View>

                {item.cantidad >= item.stock && (
                  <Text style={[styles.stockHint, { color: tema.advertencia }]}>
                    Stock máximo: {item.stock}
                  </Text>
                )}
              </ThemedCard>
            )}
            ListEmptyComponent={
              <Text style={[styles.vacio, { color: tema.textoSuave }]}>
                Carrito vacío. Escanea para vender.
              </Text>
            }
          />

          <View style={[styles.footer, { backgroundColor: tema.superficie, borderColor: tema.borde }]}>
            <View>
              <Text style={[styles.footerEtiqueta, { color: tema.textoSuave }]}>TOTAL</Text>
              <Text style={[styles.total, { color: tema.texto }]}>${total.toFixed(2)}</Text>
            </View>
            {cobrando ? (
              <ActivityIndicator size="large" color={tema.primario} />
            ) : (
              <ThemedButton
                titulo="COBRAR"
                icono="checkmark-circle"
                onPress={handleCobrar}
                disabled={items.length === 0}
              />
            )}
          </View>

          <ScannerModal
            visible={scanning}
            onScan={handleScan}
            onClose={() => setScanning(false)}
          />
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
  etiquetaMetodo: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  filaMetodos: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  card: {
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  nombre: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBoton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cantidad: {
    fontSize: 18,
    fontWeight: '800',
    minWidth: 24,
    textAlign: 'center',
  },
  subtotal: {
    fontSize: 18,
    fontWeight: '800',
  },
  stockHint: {
    fontSize: 12,
    marginTop: 6,
  },
  vacio: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginTop: 10,
  },
  footerEtiqueta: {
    fontSize: 12,
    fontWeight: '600',
  },
  total: {
    fontSize: 26,
    fontWeight: '800',
  },
});