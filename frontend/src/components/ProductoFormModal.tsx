import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { API_URL } from '../api/client';
import {
  actualizarProducto,
  crearProducto,
  subirFotoProducto,
} from '../api/productos';
import { ThemedButton, ThemedCard, ThemedHeader, ThemedInput, ThemedScreen } from '../design/components';
import { useTheme } from '../design/ThemeContext';
import { Producto, ProductoPayload } from '../types';

interface ProductoFormModalProps {
  visible: boolean;
  codigoBarras: string;
  productoEditar?: Producto | null;
  onClose: () => void;
  onProductoGuardado: () => void;
}

interface Errores {
  nombre?: string;
  precio?: string;
  stock?: string;
}

export default function ProductoFormModal({
  visible,
  codigoBarras,
  productoEditar,
  onClose,
  onProductoGuardado,
}: ProductoFormModalProps) {
  const { tema } = useTheme();
  const [nombre, setNombre] = useState('');
  const [autor, setAutor] = useState('');
  const [editorial, setEditorial] = useState('');
  const [precio, setPrecio] = useState('');
  const [stock, setStock] = useState('');
  const [unidadesCaja, setUnidadesCaja] = useState('1');
  const [errores, setErrores] = useState<Errores>({});
  const [loading, setLoading] = useState(false);
  const [fotoUri, setFotoUri] = useState<string | null>(null);

  useEffect(() => {
    if (productoEditar) {
      setNombre(productoEditar.nombre);
      setAutor(productoEditar.autor ?? '');
      setEditorial(productoEditar.editorial ?? '');
      setPrecio(String(productoEditar.precio_venta));
      setStock(String(productoEditar.stock));
      setUnidadesCaja(String(productoEditar.unidades_por_caja));
    } else {
      setNombre('');
      setAutor('');
      setEditorial('');
      setPrecio('');
      setStock('');
      setUnidadesCaja('1');
    }
    setErrores({});
    setFotoUri(null);
  }, [productoEditar, visible]);

  const elegirFoto = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la galería para la foto.');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
    });
    if (!resultado.canceled && resultado.assets[0]) {
      setFotoUri(resultado.assets[0].uri);
    }
  };

  const validar = (): ProductoPayload | null => {
    const nuevos: Errores = {};
    const precioNum = parseFloat(precio);
    const stockNum = parseInt(stock, 10);
    const cajaNum = parseInt(unidadesCaja, 10);

    if (!nombre.trim()) nuevos.nombre = 'El nombre es obligatorio';
    if (!precio || Number.isNaN(precioNum) || precioNum <= 0) {
      nuevos.precio = 'Precio inválido (debe ser mayor a 0)';
    }
    if (!stock || Number.isNaN(stockNum) || stockNum < 0) {
      nuevos.stock = 'Stock inválido (debe ser 0 o mayor)';
    }

    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return null;

    return {
      codigo_barras: codigoBarras,
      nombre: nombre.trim(),
      autor: autor.trim() || null,
      editorial: editorial.trim() || null,
      precio_venta: precioNum,
      stock: stockNum,
      unidades_por_caja: Number.isNaN(cajaNum) || cajaNum < 1 ? 1 : cajaNum,
      activo: productoEditar?.activo ?? true,
    };
  };

  const handleGuardar = async () => {
    const data = validar();
    if (!data) return;

    setLoading(true);
    try {
      const guardado = productoEditar
        ? await actualizarProducto(productoEditar.id, data)
        : await crearProducto(data);
      if (fotoUri) {
        await subirFotoProducto(guardado.id, fotoUri);
      }
      onProductoGuardado();
      onClose();
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : 'Error al guardar el producto';
      setErrores({ nombre: mensaje });
    } finally {
      setLoading(false);
    }
  };

  const fotoActual = fotoUri ?? (productoEditar?.foto ? `${API_URL}/uploads/${productoEditar.foto}` : null);

  return (
    <Modal visible={visible} animationType="slide">
      <ThemedScreen>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.contenido}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <ThemedHeader
              titulo={productoEditar ? 'Editar Producto' : 'Nuevo Producto'}
              subtitulo={`Código: ${codigoBarras}`}
            />

            <View style={styles.filaFoto}>
              {fotoActual ? (
                <Image source={{ uri: fotoActual }} style={styles.fotoPreview} contentFit="cover" />
              ) : (
                <View style={[styles.fotoPreview, styles.sinFoto, { backgroundColor: tema.superficie }]}>
                  <Ionicons name="book-outline" size={40} color={tema.textoSuave} />
                </View>
              )}
              <ThemedButton
                titulo={fotoActual ? 'Cambiar foto' : 'Agregar foto'}
                icono="images-outline"
                variante="secundario"
                onPress={elegirFoto}
                style={{ flex: 1, alignSelf: 'stretch' }}
              />
            </View>

            <ThemedCard entering={false} style={styles.formCard}>
              <ThemedInput
                icono="barcode-outline"
                label="Nombre del libro"
                placeholder="Ej: El Quijote"
                value={nombre}
                onChangeText={setNombre}
                error={errores.nombre}
              />
              <ThemedInput
                icono="person-outline"
                label="Autor"
                placeholder="Ej: Cervantes"
                value={autor}
                onChangeText={setAutor}
              />
              <ThemedInput
                icono="business-outline"
                label="Editorial"
                placeholder="Ej: Alfaguara"
                value={editorial}
                onChangeText={setEditorial}
              />
              <ThemedInput
                icono="pricetag-outline"
                label="Precio de venta (S/)"
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={precio}
                onChangeText={setPrecio}
                error={errores.precio}
              />
              <ThemedInput
                icono="layers-outline"
                label="Stock actual"
                placeholder="0"
                keyboardType="number-pad"
                value={stock}
                onChangeText={setStock}
                error={errores.stock}
              />
              <ThemedInput
                icono="cube-outline"
                label="Unidades por caja"
                placeholder="1"
                keyboardType="number-pad"
                value={unidadesCaja}
                onChangeText={setUnidadesCaja}
              />

              <View style={styles.filaBotones}>
                <ThemedButton
                  titulo="GUARDAR"
                  icono="checkmark"
                  onPress={handleGuardar}
                  loading={loading}
                  style={{ flex: 1 }}
                />
                <ThemedButton
                  titulo="Cancelar"
                  variante="fantasma"
                  onPress={onClose}
                  style={{ flex: 1 }}
                />
              </View>
            </ThemedCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </ThemedScreen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  contenido: {
    padding: 20,
  },
  filaFoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  fotoPreview: {
    width: 88,
    height: 116,
    borderRadius: 12,
  },
  sinFoto: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    padding: 18,
  },
  filaBotones: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
});