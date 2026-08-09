import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal } from 'react-native';
import { buscarProductoPorCodigo, registrarVenta } from '../api';
import ScannerModal from './ScannerModal';

interface VentasModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function VentasModal({ visible, onClose }: VentasModalProps) {
  const [carrito, setCarrito] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const t = carrito.reduce((sum, item) => sum + item.subtotal, 0);
    setTotal(t);
  }, [carrito]);

  const handleScan = async (data: string) => {
    setScanning(false);
    try {
      const producto = await buscarProductoPorCodigo(data);
      if (producto) {
        const existente = carrito.find(item => item.producto_id === producto.id);
        if (existente) {
          setCarrito(carrito.map(item => 
            item.producto_id === producto.id 
              ? { ...item, cantidad: item.cantidad + 1, subtotal: (item.cantidad + 1) * item.precio_unitario } 
              : item
          ));
        } else {
          setCarrito([...carrito, { 
            producto_id: producto.id, 
            nombre: producto.nombre, 
            cantidad: 1, 
            precio_unitario: producto.precio_venta, 
            subtotal: producto.precio_venta 
          }]);
        }
      } else {
        Alert.alert('Error', 'Producto no registrado.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleCobrar = async () => {
    if (carrito.length === 0) return;
    setLoading(true);
    try {
      const ventaData = {
        metodo_pago: 'efectivo',
        detalles: carrito.map(item => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
        }))
      };
      await registrarVenta(ventaData);
      Alert.alert('Éxito', `Venta registrada correctamente.\nTotal: $${total.toFixed(2)}`);
      setCarrito([]); // Limpiar carrito
      onClose(); // Cerrar modal al cobrar
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Punto de Venta</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>X</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.scanButton} onPress={() => setScanning(true)}>
          <Text style={styles.scanButtonText}>Escanear Producto</Text>
        </TouchableOpacity>

        <FlatList
          data={carrito}
          keyExtractor={(item, index) => index.toString()}
          style={{ flex: 1, marginTop: 10 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.nombre}>{item.nombre}</Text>
              <Text style={styles.detalle}>{item.cantidad} x ${item.precio_unitario.toFixed(2)}</Text>
              <Text style={styles.subtotal}>Subtotal: ${item.subtotal.toFixed(2)}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Carrito vacío. Escanea para vender.</Text>}
        />

        <View style={styles.footer}>
          <Text style={styles.totalText}>TOTAL: ${total.toFixed(2)}</Text>
          {loading ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <TouchableOpacity style={styles.cobrarButton} onPress={handleCobrar} disabled={carrito.length === 0}>
              <Text style={styles.cobrarText}>COBRAR</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScannerModal 
          visible={scanning} 
          onScan={handleScan} 
          onClose={() => setScanning(false)} 
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5', marginTop: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  closeButton: { backgroundColor: '#dc3545', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  closeText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  scanButton: { backgroundColor: '#007bff', padding: 15, borderRadius: 8, alignItems: 'center' },
  scanButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, elevation: 2 },
  nombre: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  detalle: { fontSize: 14, color: '#666', marginTop: 2 },
  subtotal: { fontSize: 16, fontWeight: 'bold', color: '#28a745', marginTop: 5, textAlign: 'right' },
  empty: { textAlign: 'center', color: '#666', marginTop: 50, fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#343a40', padding: 20, borderRadius: 8 },
  totalText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  cobrarButton: { backgroundColor: '#28a745', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 8 },
  cobrarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
});