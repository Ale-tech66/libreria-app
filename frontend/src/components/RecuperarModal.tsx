import React, { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { recuperar, recuperarConfirmar } from '@/api/auth';
import { ThemedButton, ThemedCard, ThemedInput } from '@/design/components';
import { useTheme } from '@/design/ThemeContext';

interface RecuperarModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function RecuperarModal({ visible, onClose }: RecuperarModalProps) {
  const { tema } = useTheme();
  const [paso, setPaso] = useState<'usuario' | 'codigo' | 'listo'>('usuario');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const cerrar = () => {
    if (loading) return;
    setPaso('usuario');
    setUsername('');
    setCode('');
    setNuevaPassword('');
    setConfirmacion('');
    setError(null);
    onClose();
  };

  const handleSolicitar = async () => {
    setError(null);
    if (!username.trim()) {
      setError('Escribe tu usuario');
      return;
    }
    setLoading(true);
    try {
      await recuperar(username.trim());
      setPaso('codigo');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al solicitar la recuperación');
    } finally {
      setLoading(false);
    }
  };

  const handleRestablecer = async () => {
    setError(null);
    if (code.length !== 6) {
      setError('Ingresa el código de 6 dígitos que recibiste por correo');
      return;
    }
    if (nuevaPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (nuevaPassword !== confirmacion) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      await recuperarConfirmar(username.trim(), code, nuevaPassword);
      setPaso('listo');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Código incorrecto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cerrar}>
      <View style={[styles.fondo, { backgroundColor: tema.fondo[0] }]}>
        <ThemedCard style={styles.card}>
          <View style={[styles.icono, { backgroundColor: tema.primario }]}>
            <Ionicons name="key-outline" size={34} color={tema.primarioTexto} />
          </View>
          <Text style={[styles.titulo, { color: tema.texto }]}>
            {paso === 'usuario'
              ? '¿Olvidaste tu contraseña?'
              : paso === 'codigo'
                ? 'Restablece tu contraseña'
                : '¡Listo!'}
          </Text>

          {paso === 'usuario' && (
            <>
              <Text style={[styles.texto, { color: tema.textoSuave }]}>
                Te enviaremos un código a tu correo para restablecerla.
              </Text>
              <ThemedInput
                icono="person-outline"
                label="Usuario"
                placeholder="Escribe tu usuario"
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
              />
              {error && <Text style={[styles.error, { color: tema.peligro }]}>{error}</Text>}
              <ThemedButton
                titulo="ENVIAR CÓDIGO"
                icono="mail-outline"
                onPress={handleSolicitar}
                loading={loading}
              />
            </>
          )}

          {paso === 'codigo' && (
            <>
              <Text style={[styles.texto, { color: tema.textoSuave }]}>
                Ingresa el código de 6 dígitos que recibiste por correo y define tu
                nueva contraseña.
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
              <ThemedInput
                icono="lock-closed-outline"
                label="Nueva contraseña"
                placeholder="Mínimo 6 caracteres"
                secureTextEntry
                value={nuevaPassword}
                onChangeText={setNuevaPassword}
              />
              <ThemedInput
                icono="lock-closed-outline"
                label="Confirmar contraseña"
                placeholder="Repite la contraseña"
                secureTextEntry
                value={confirmacion}
                onChangeText={setConfirmacion}
              />
              {error && <Text style={[styles.error, { color: tema.peligro }]}>{error}</Text>}
              <ThemedButton
                titulo="RESTABLECER"
                icono="checkmark-circle"
                onPress={handleRestablecer}
                loading={loading}
              />
              <ThemedButton
                titulo="Volver"
                icono="arrow-back"
                variante="fantasma"
                onPress={() => {
                  if (!loading) {
                    setPaso('usuario');
                    setError(null);
                  }
                }}
                disabled={loading}
              />
            </>
          )}

          {paso === 'listo' && (
            <>
              <Text style={[styles.texto, { color: tema.textoSuave }]}>
                Tu contraseña se cambió correctamente. Ya puedes iniciar sesión.
              </Text>
              <ThemedButton titulo="ENTENDIDO" icono="checkmark" onPress={cerrar} />
            </>
          )}
        </ThemedCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  icono: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
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
  error: {
    fontSize: 13,
    textAlign: 'center',
  },
});