import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, View } from 'react-native';

import { confirmarMfa } from '@/api/auth';
import { ThemedButton, ThemedCard, ThemedInput, ThemedScreen } from '@/design/components';
import { useTheme } from '@/design/ThemeContext';
import { useAuth } from '@/hooks/useAuth';

interface MfaLoginModalProps {
  visible: boolean;
  mfaToken: string | null;
  onClose: () => void;
}

export default function MfaLoginModal({ visible, mfaToken, onClose }: MfaLoginModalProps) {
  const { tema } = useTheme();
  const { finalizarLogin } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConfirmar = async () => {
    if (!mfaToken) return;
    setError(null);
    if (code.length !== 6) {
      setError('Ingresa el código de 6 dígitos');
      return;
    }
    setLoading(true);
    try {
      const tokens = await confirmarMfa(mfaToken, code);
      await finalizarLogin(tokens);
      setCode('');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Código incorrecto');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <ThemedScreen>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.contenedor}
        >
          <View style={styles.cabecera}>
            <Text style={[styles.titulo, { color: tema.texto }]}>Verificación en dos pasos</Text>
            <Text style={[styles.subtitulo, { color: tema.textoSuave }]}>
              Esta cuenta tiene MFA activado. Abre tu app de autenticación (Google
              Authenticator, etc.) e ingresa el código de 6 dígitos.
            </Text>
          </View>

          <ThemedCard style={styles.card}>
            <ThemedInput
              icono="keypad-outline"
              label="Código"
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={(t) => setCode(t.replace(/[^0-9]/g, ''))}
              autoFocus
            />

            {error && <Text style={[styles.errorTexto, { color: tema.peligro }]}>{error}</Text>}

            <ThemedButton
              titulo="VERIFICAR"
              icono="shield-checkmark"
              onPress={handleConfirmar}
              loading={loading}
              style={{ marginTop: 6 }}
            />
            <ThemedButton
              titulo="CANCELAR"
              icono="close"
              variante="fantasma"
              onPress={onClose}
              disabled={loading}
            />
          </ThemedCard>
        </KeyboardAvoidingView>
      </ThemedScreen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  cabecera: {
    marginBottom: 20,
    gap: 6,
  },
  titulo: {
    fontSize: 28,
    fontWeight: '800',
  },
  subtitulo: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    padding: 20,
  },
  errorTexto: {
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
});