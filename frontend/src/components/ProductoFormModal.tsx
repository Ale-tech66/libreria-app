import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert } from 'react-native';
import { crearProducto, actualizarProducto } from '../api';

interface ProductoFormModalProps {
  visible: boolean;
  codigoBarras: string;
  productoEditar?: any | null; // Si viene, es para editar
  onClose: () => void;
  onProductoGuardado: () => void;
}

export default function ProductoFormModal({ visible, codigoBarras, productoEditar, onClose, onProductoGuardado }: ProductoFormModalProps) {
  const [nombre, setNombre] = useState('');
  const [autor, setAutor] = useState('');
  const [precio, setPrecio] = useState('');
  const [stock, setStock] = useState('');
  const [unidadesCaja, setUnidadesCaja] = useState('1');
  const [loading, setLoading] = useState(false);

  // Si estamos editando, llenamos los campos
  useEffect(() => {
    if (productoEditar) {
      setNombre(productoEditar.nombre);
      setAutor(productoEditar.autor || '');
      setPrecio(productoEditar.precio_venta.toString());
      setStock(productoEditar.stock.toString());
      setUnidadesCaja(productoEditar.unidades_por_caja.toString());
    } else {
      // Si es nuevo, limpiamos
      setNombre(''); setAutor(''); setPrecio(''); setStock(''); setUnidadesCaja('1');
    }
  }, [productoEditar, visible]);

  const handleGuardar = async () => {
    if (!nombre || !precio || !stock) {
      Alert.alert('Error', 'Nombre, precio y stock son obligatorios');
      return;
    }
    setLoading(true);
    try {
      const data = {
        codigo_barras: codigoBarras,
        nombre: nombre,
        autor: autor,
        precio_venta: parseFloat(precio),
        stock: parseInt(stock),
        unidades_por_caja: parseInt(unidadesCaja) || 1,
      };

      if (productoEditar) {
        // Si hay productoEditar, actualizamos
        await actualizarProducto(productoEditar.id, data);
        Alert.alert('Éxito', 'Producto actualizado correctamente');
      } else {
        // Si no, creamos uno nuevo
        await crearProducto(data);
        Alert.alert('Éxito', 'Producto registrado correctamente');
      }
      
      onProductoGuardado(); // Avisar a la pantalla anterior
      onClose(); // Cerrar modal
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <Text style={styles.title}>{productoEditar ? 'Editar Producto' : 'Registrar Nuevo Producto'}</Text>
        
        <Text style={styles.label}>Código de Barras:</Text>
        <TextInput style={[styles.input, styles.disabledInput]} value={codigoBarras} editable={false} />

        <Text style={styles.label}>Nombre del Libro: *</Text>
        <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej: El Quijote" />

        <Text style={styles.label}>Autor:</Text>
        <TextInput style={styles.input} value={autor} onChangeText={setAutor} placeholder="Ej: Cervantes" />

        <Text style={styles.label}>Precio de Venta: *</Text>
        <TextInput style={styles.input} value={precio} onChangeText={setPrecio} keyboardType="numeric" placeholder="0.00" />

        <Text style={styles.label}>Stock Actual: *</Text>
        <TextInput style={styles.input} value={stock} onChangeText={setStock} keyboardType="numeric" placeholder="0" />

        <Text style={styles.label}>Unidades por Caja:</Text>
        <TextInput style={styles.input} value={unidadesCaja} onChangeText={setUnidadesCaja} keyboardType="numeric" placeholder="1" />

        {loading ? (
          <ActivityIndicator size="large" color="#007bff" style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.saveButton} onPress={handleGuardar}>
              <Text style={styles.buttonText}>GUARDAR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.buttonText}>CANCELAR</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginTop: 10 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 15, height: 50, marginTop: 5 },
  disabledInput: { backgroundColor: '#e9ecef', color: '#6c757d' },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 },
  saveButton: { backgroundColor: '#28a745', padding: 15, borderRadius: 8, flex: 1, marginRight: 10, alignItems: 'center' },
  cancelButton: { backgroundColor: '#dc3545', padding: 15, borderRadius: 8, flex: 1, marginLeft: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});