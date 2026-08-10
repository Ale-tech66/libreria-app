import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { getProductos } from '../api';
import ScannerModal from '../components/ScannerModal'; 
import { buscarProductoPorCodigo } from '../api';
import ProductoFormModal from '../components/ProductoFormModal'; 
import { RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function InventarioScreen() {
  const [productos, setProductos] = useState<any[]>([]);
  const [productoEditar, setProductoEditar] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [showForm, setShowForm] = useState(false); 
  const [refreshing, setRefreshing] = useState(false);
  const [rol, setRol] = useState('');
  const [scannedCode, setScannedCode] = useState(''); 

  useEffect(() => {
    cargarProductos();
    const getRol = async () => {
      const savedRol = await AsyncStorage.getItem('rol');
      if (savedRol) setRol(savedRol);
    };
    getRol();
  }, []);

  const cargarProductos = async () => {
    setLoading(true);
    try {
      const data = await getProductos();
      setProductos(data);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await cargarProductos();
    setRefreshing(false);
  };

  const handleBarCodeScanned = async (data: string) => {
    setScanning(false); // Apagamos la cámara
    
    try {
      const producto = await buscarProductoPorCodigo(data);
      
      if (producto) {
        // Si existe, preparamos para editar
        setScannedCode(data);
        setProductoEditar(producto);
        setShowForm(true);
      } else {
        // Si no existe, preparamos para crear
        setScannedCode(data);
        setProductoEditar(null);
        setShowForm(true);
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventario</Text>
        {(rol === 'admin' || rol === 'inventario') && (
          <TouchableOpacity 
            style={styles.scanButton}
            onPress={() => setScanning(true)}
          >
            <Text style={styles.scanButtonText}>Escanear</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <FlatList
        data={productos}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.nombre}>{item.nombre}</Text>
            <Text style={styles.detalle}>Autor: {item.autor || 'N/A'}</Text>
            <Text style={styles.detalle}>Código: {item.codigo_barras}</Text>
            <View style={styles.footerCard}>
              <Text style={styles.precio}>${item.precio_venta}</Text>
              <Text style={styles.stock}>Stock: {item.stock}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text>No hay productos registrados.</Text>}

        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#007bff"]} // Color del circulito en Android
          />
        }
      />

            {/* Usamos nuestro componente limpio */}
      <ScannerModal 
        visible={scanning} 
        onScan={handleBarCodeScanned} 
        onClose={() => setScanning(false)} 
      />

      {/* Formulario de registro */}
            {/* Formulario de registro/edición */}
      <ProductoFormModal 
        visible={showForm}
        codigoBarras={scannedCode}
        productoEditar={productoEditar}
        onClose={() => {
          setShowForm(false);
          setProductoEditar(null); // Limpiar al cerrar
        }}
        onProductoGuardado={cargarProductos} // Recarga la lista
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  scanButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 8,
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 2,
  },
  nombre: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  detalle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  footerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  precio: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#28a745',
  },
  stock: {
    fontSize: 14,
    color: '#dc3545',
    fontWeight: 'bold',
  },
});