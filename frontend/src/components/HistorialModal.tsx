import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert } from 'react-native';
import { getHistorialVentas } from '../api';

interface HistorialModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function HistorialModal({ visible, onClose }: HistorialModalProps) {
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      cargarVentas();
    }
  }, [visible]);

  const cargarVentas = async () => {
    setLoading(true);
    try {
      const data = await getHistorialVentas();
      setVentas(data);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatearFecha = (fechaISO: string) => {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleDateString() + ' ' + fecha.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Historial de Ventas</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>X</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#007bff" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={ventas}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.ventaId}>Venta #{item.id}</Text>
                  <Text style={styles.total}>${item.total.toFixed(2)}</Text>
                </View>
                <Text style={styles.detalle}>Fecha: {formatearFecha(item.fecha)}</Text>
                <Text style={styles.detalle}>Pago: {item.metodo_pago}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No hay ventas registradas.</Text>}
          />
        )}
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
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  ventaId: { fontSize: 18, fontWeight: 'bold', color: '#007bff' },
  total: { fontSize: 20, fontWeight: 'bold', color: '#28a745' },
  detalle: { fontSize: 14, color: '#666', marginTop: 2 },
  empty: { textAlign: 'center', color: '#666', marginTop: 50, fontSize: 16 },
});