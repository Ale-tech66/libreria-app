import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedButton, ThemedCard } from '@/design/components';
import { useTheme } from '@/design/ThemeContext';

interface RecuperarModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function RecuperarModal({ visible, onClose }: RecuperarModalProps) {
  const { tema } = useTheme();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.fondo}>
        <ThemedCard style={styles.card}>
          <View style={[styles.icono, { backgroundColor: tema.primario }]}>
            <Ionicons name="key-outline" size={34} color={tema.primarioTexto} />
          </View>
          <Text style={[styles.titulo, { color: tema.texto }]}>
            ¿Olvidaste tu contraseña?
          </Text>
          <Text style={[styles.texto, { color: tema.textoSuave }]}>
            Las contraseñas solo las restablece el administrador. Pídele que la
            cambie desde la sección{' '}
            <Text style={{ fontWeight: '700', color: tema.texto }}>Usuarios</Text>{' '}
            de su app, y luego vuelve a iniciar sesión aquí.
          </Text>
          <ThemedButton titulo="ENTENDIDO" icono="checkmark" onPress={onClose} />
        </ThemedCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    padding: 24,
    alignItems: 'center',
    gap: 14,
  },
  icono: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  texto: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 6,
  },
});