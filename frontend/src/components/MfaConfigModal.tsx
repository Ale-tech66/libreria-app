import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { mfaDisable, mfaSetup, mfaVerifySetup } from '@/api/auth';
import { ThemedButton, ThemedCard, ThemedHeader, ThemedInput, ThemedScreen } from '@/design/components';
import { useTheme } from '@/design/ThemeContext';
import { useAuth } from '@/hooks/useAuth';

interface MfaConfigModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function MfaConfigModal({ visible, onClose }: MfaConfigModalProps) {
  const { tema } = useTheme();
  const { user, refrescarUsuario } = useAuth();
  const mfaActivo = user?.mfa_activo === true;

  const [paso, setPaso] = useState<'menu' | 'activar' | 'desactivar'>('menu');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [secreto, setSecreto] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setPaso('menu');
      setCode('');
      setError(null);
    }
  }, [visible]);

  const iniciarActivacion = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await mfaSetup();
      setOtpauthUrl(data.otpauth_url);
      setSecreto(data.secret);
      setPaso('activar');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al activar MFA');
    } finally {
      setLoading(false);
    }
  };

  const confirmarActivacion = async () => {
    setError(null);
    if (code.length !== 6) {
      setError('Ingresa el código de 6 dígitos');
      return;
    }
    setLoading(true);
    try {
      await mfaVerifySetup(code);
      await refrescarUsuario();
      Alert.alert('MFA activado', 'Tu cuenta ahora requiere el código de 6 dígitos al iniciar sesión.');
      setPaso('menu');
      setCode('');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Código incorrecto');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const iniciarDesactivacion = () => {
    setCode('');
    setError(null);
    setPaso('desactivar');
  };

  const confirmarDesactivacion = async () => {
    setError(null);
    if (code.length !== 6) {
      setError('Ingresa el código de 6 dígitos');
      return;
    }
    setLoading(true);
    try {
      await mfaDisable(code);
      await refrescarUsuario();
      Alert.alert('MFA desactivado', 'Ya no se pedirá código al iniciar sesión.');
      setPaso('menu');
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ThemedScreen>
        <View style={styles.contenido}>
          <ThemedHeader titulo="Verificación en dos pasos" subtitulo="Protege tu cuenta" />

          {paso === 'menu' && (
            <ThemedCard style={styles.card}>
              <Text style={[styles.texto, { color: tema.texto }]}>
                {mfaActivo
                  ? 'El MFA está activado: al iniciar sesión se pedirá un código de 6 dígitos de tu app de autenticación.'
                  : 'Activa la verificación en dos pasos para proteger tu cuenta. Necesitarás una app de autenticación (Google Authenticator, Authy, etc.).'}
              </Text>
              {error && <Text style={[styles.error, { color: tema.peligro }]}>{error}</Text>}
              {mfaActivo ? (
                <ThemedButton
                  titulo="DESACTIVAR MFA"
                  icono="shield-outline"
                  variante="peligro"
                  onPress={iniciarDesactivacion}
                />
              ) : (
                <ThemedButton
                  titulo="ACTIVAR MFA"
                  icono="shield-checkmark"
                  onPress={iniciarActivacion}
                  loading={loading}
                />
              )}
              <ThemedButton
                titulo="CERRAR"
                icono="close"
                variante="fantasma"
                onPress={onClose}
                disabled={loading}
              />
            </ThemedCard>
          )}

          {paso === 'activar' && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <ThemedCard style={styles.card}>
                <Text style={[styles.texto, { color: tema.texto }]}>
                  Escanea este código con tu app de autenticación o ingresa el secreto
                  manualmente:
                </Text>
                <View style={styles.qrContenedor}>
                  <QRCode value={otpauthUrl} size={190} backgroundColor="white" color="black" />
                </View>
                <Text style={[styles.secreto, { color: tema.textoSuave }]} selectable>
                  {secreto}
                </Text>
                <Text style={[styles.texto, { color: tema.texto }]}>
                  Luego ingresa el código que muestra tu app para confirmar:
                </Text>
                <ThemedInput
                  icono="keypad-outline"
                  label="Código"
                  placeholder="000000"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/[^0-9]/g, ''))}
                />
                {error && <Text style={[styles.error, { color: tema.peligro }]}>{error}</Text>}
                <ThemedButton
                  titulo="CONFIRMAR"
                  icono="checkmark-circle"
                  onPress={confirmarActivacion}
                  loading={loading}
                  style={{ marginTop: 6 }}
                />
                <ThemedButton
                  titulo="CANCELAR"
                  icono="close"
                  variante="fantasma"
                  onPress={() => setPaso('menu')}
                  disabled={loading}
                />
              </ThemedCard>
            </ScrollView>
          )}

          {paso === 'desactivar' && (
            <ThemedCard style={styles.card}>
              <Text style={[styles.texto, { color: tema.texto }]}>
                Para desactivar MFA ingresa el código actual de tu app de autenticación:
              </Text>
              <ThemedInput
                icono="keypad-outline"
                label="Código"
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={(t) => setCode(t.replace(/[^0-9]/g, ''))}
              />
              {error && <Text style={[styles.error, { color: tema.peligro }]}>{error}</Text>}
              <ThemedButton
                titulo="DESACTIVAR"
                icono="shield-outline"
                variante="peligro"
                onPress={confirmarDesactivacion}
                loading={loading}
                style={{ marginTop: 6 }}
              />
              <ThemedButton
                titulo="CANCELAR"
                icono="close"
                variante="fantasma"
                onPress={() => setPaso('menu')}
                disabled={loading}
              />
            </ThemedCard>
          )}
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
  card: {
    padding: 20,
  },
  texto: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  error: {
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
  qrContenedor: {
    alignItems: 'center',
    marginVertical: 14,
  },
  secreto: {
    textAlign: 'center',
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
    marginBottom: 14,
  },
});