import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { API_URL } from '@/api/client';
import { buscarProductoPorCodigo, desactivarProducto } from '@/api/productos';
import ProductoFormModal from '@/components/ProductoFormModal';
import ScannerModal from '@/components/ScannerModal';
import { ThemedCard, ThemedHeader, ThemedInput, ThemedScreen } from '@/design/components';
import { useTheme } from '@/design/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { useProductos } from '@/hooks/useProductos';
import { Producto } from '@/types';

const STOCK_BAJO = 5;

export default function InventarioScreen() {
  const { user } = useAuth();
  const puedeGestionar = user?.rol === 'admin' || user?.rol === 'inventario';
  const {
    productos,
    total,
    loading,
    refreshing,
    loadingMore,
    error,
    query,
    buscar,
    onRefresh,
    loadMore,
  } = useProductos(puedeGestionar);

  const { tema } = useTheme();
  const [scanning, setScanning] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [productoEditar, setProductoEditar] = useState<Producto | null>(null);

  const handleBarCodeScanned = async (data: string) => {
    setScanning(false);
    try {
      const producto = await buscarProductoPorCodigo(data);
      setScannedCode(data);
      setProductoEditar(producto);
      setShowForm(true);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error al buscar el producto');
    }
  };

  const toggleActivo = (producto: Producto) => {
    if (producto.activo) {
      Alert.alert(
        'Desactivar producto',
        `"${producto.nombre}" dejará de venderse. ¿Continuar?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Desactivar',
            style: 'destructive',
            onPress: async () => {
              try {
                await desactivarProducto(producto.id);
                onRefresh();
              } catch (e) {
                Alert.alert('Error', e instanceof Error ? e.message : 'Error');
              }
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Reactivar producto',
        `"${producto.nombre}" volverá a estar disponible. ¿Continuar?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Reactivar',
            onPress: () => {
              setProductoEditar(producto);
              setShowForm(true);
            },
          },
        ]
      );
    }
  };

  if (loading) {
    return (
      <ThemedScreen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={tema.primario} />
        </View>
      </ThemedScreen>
    );
  }

  return (
    <ThemedScreen>
      <View style={styles.contenido}>
        <ThemedHeader
          titulo="Inventario"
          subtitulo={`${total} producto(s)`}
          derecho={
            puedeGestionar && (
              <TouchableOpacity
                onPress={() => setScanning(true)}
                style={[styles.botonEscanear, { backgroundColor: tema.primario }]}
              >
                <Ionicons name="scan" size={20} color={tema.primarioTexto} />
                <Text style={[styles.botonEscanearTexto, { color: tema.primarioTexto }]}>
                  Escanear
                </Text>
              </TouchableOpacity>
            )
          }
        />

        <ThemedInput
          icono="search"
          placeholder="Buscar por nombre o código..."
          value={query}
          onChangeText={buscar}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {error && (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: tema.superficie, borderColor: tema.peligro },
            ]}
          >
            <Text style={[styles.errorTexto, { color: tema.peligro }]}>{error}</Text>
            <TouchableOpacity onPress={onRefresh}>
              <Text style={[styles.reintentar, { color: tema.primario }]}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          data={productos}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 90 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeIn.delay(Math.min(index, 8) * 40).duration(300)}>
              <TarjetaProducto
                producto={item}
                editable={puedeGestionar}
                onToggle={() => toggleActivo(item)}
                onPress={() => {
                  if (puedeGestionar) {
                    setScannedCode(item.codigo_barras);
                    setProductoEditar(item);
                    setShowForm(true);
                  }
                }}
              />
            </Animated.View>
          )}
          ListEmptyComponent={
            <Text style={[styles.vacio, { color: tema.textoSuave }]}>
              {query ? 'Sin resultados para la búsqueda.' : 'No hay productos registrados.'}
            </Text>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator style={{ margin: 16 }} color={tema.primario} />
            ) : null
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[tema.primario]}
              tintColor={tema.primario}
            />
          }
        />

        <ScannerModal
          visible={scanning}
          onScan={handleBarCodeScanned}
          onClose={() => setScanning(false)}
        />

        <ProductoFormModal
          visible={showForm}
          codigoBarras={scannedCode}
          productoEditar={productoEditar}
          onClose={() => {
            setShowForm(false);
            setProductoEditar(null);
          }}
          onProductoGuardado={onRefresh}
        />
      </View>
    </ThemedScreen>
  );
}

function TarjetaProducto({
  producto,
  editable,
  onToggle,
  onPress,
}: {
  producto: Producto;
  editable: boolean;
  onToggle: () => void;
  onPress: () => void;
}) {
  const { tema } = useTheme();
  const stockBajo = producto.activo && producto.stock <= STOCK_BAJO;
  const uri = producto.foto
      ? producto.foto.startsWith('http')
        ? producto.foto
        : `${API_URL}/uploads/${producto.foto}`
      : null;

  return (
    <ThemedCard
      entering={false}
      style={[
        styles.card,
        !producto.activo && { opacity: 0.55 },
        stockBajo && { borderColor: tema.advertencia, borderWidth: 1.5 },
      ]}
    >
      <TouchableOpacity onPress={onPress} activeOpacity={editable ? 0.8 : 1} style={styles.cardCuerpo}>
        {uri ? (
          <Image source={{ uri }} style={styles.foto} contentFit="cover" />
        ) : (
          <View style={[styles.foto, styles.sinFoto, { backgroundColor: tema.superficie }]}>
            <Ionicons name="book-outline" size={30} color={tema.textoSuave} />
          </View>
        )}

        <View style={styles.cardInfo}>
          <Text style={[styles.nombre, { color: tema.texto }]} numberOfLines={2}>
            {producto.nombre}
          </Text>
          <Text style={[styles.detalle, { color: tema.textoSuave }]}>
            {producto.autor || 'Autor N/A'}
          </Text>
          <Text style={[styles.detalle, { color: tema.textoSuave }]}>
            Código: {producto.codigo_barras}
          </Text>

          <View style={styles.filaInferior}>
            <Text style={[styles.precio, { color: tema.exito }]}>
              ${producto.precio_venta.toFixed(2)}
            </Text>
            <View style={styles.insignias}>
              {stockBajo && (
                <View style={[styles.insignia, { backgroundColor: tema.advertencia }]}>
                  <Text style={styles.insigniaTexto}>Stock bajo</Text>
                </View>
              )}
              <View
                style={[
                  styles.insignia,
                  {
                    backgroundColor:
                      producto.stock === 0 ? tema.peligro : tema.superficie,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.insigniaTexto,
                    { color: producto.stock === 0 ? '#fff' : tema.texto },
                  ]}
                >
                  Stock: {producto.stock}
                </Text>
              </View>
              {!producto.activo && (
                <View style={[styles.insignia, { backgroundColor: tema.textoSuave }]}>
                  <Text style={styles.insigniaTexto}>Inactivo</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {editable && (
          <TouchableOpacity onPress={onToggle} style={styles.botonToggle}>
            <Ionicons
              name={producto.activo ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={producto.activo ? tema.peligro : tema.exito}
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </ThemedCard>
  );
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
  botonEscanear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  botonEscanearTexto: {
    fontWeight: '700',
    fontSize: 14,
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
    marginBottom: 12,
  },
  cardCuerpo: {
    flexDirection: 'row',
    padding: 14,
    gap: 12,
  },
  foto: {
    width: 64,
    height: 84,
    borderRadius: 10,
  },
  sinFoto: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  nombre: {
    fontSize: 16,
    fontWeight: '700',
  },
  detalle: {
    fontSize: 13,
    marginTop: 2,
  },
  filaInferior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
  },
  precio: {
    fontSize: 17,
    fontWeight: '800',
  },
  insignias: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  insignia: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  insigniaTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  botonToggle: {
    alignSelf: 'flex-start',
    padding: 6,
  },
  vacio: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
});