import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { CameraView } from 'expo-camera';

// Definimos qué props recibe el componente
interface ScannerModalProps {
  visible: boolean;        // Si está visible o no
  onScan: (data: string) => void; // Función que se ejecuta al escanear
  onClose: () => void;     // Función para cerrar la cámara
}

export default function ScannerModal({ visible, onScan, onClose }: ScannerModalProps) {
  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <CameraView
          onBarcodeScanned={({ data }) => onScan(data)}
          barcodeScannerSettings={{
            barcodeTypes: ["qr", "pdf417", "ean13", "ean8", "code128", "upc_a", "upc_e"],
          }}
          style={StyleSheet.absoluteFillObject}
        />
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeButton: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 20,
    backgroundColor: '#dc3545',
    padding: 15,
    borderRadius: 10,
  },
});