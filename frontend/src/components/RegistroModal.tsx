import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, View } from 'react-native';

import { register as apiRegister } from '@/api/auth';
import { ThemedButton, ThemedCard, ThemedInput, ThemedScreen } from '@/design/components';
import { useTheme } from '@/design/ThemeContext';
import { useAuth } from '@/hooks/useAuth';

interface RegistroModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function RegistroModal({ visible, onClose }: RegistroModalProps) {
  const { tema } = useTheme();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [nombreNegocio, setNombreNegocio] = useState('');
  const [tipoNegocio, setTipoNegocio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const cerrar = () => {
    if (loading) return;
    setError(null);
    setUsername('');
    setPassword('');
    setConfirmacion('');
    setNombreNegocio('');
    setTipoNegocio('');
    onClose();
  };

  const handleRegistrar = async () => {
    setError(null);
    const usuario = username.trim();
    if (!usuario || !password) {
      setError('Ingresa un usuario y una contraseña');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      await apiRegister(
        usuario,
        password,
        { nombreNegocio: nombreNegocio.trim() || undefined, tipoNegocio: tipoNegocio.trim() || undefined },
      );
      await login(usuario, password);
      cerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cerrar}>
      <ThemedScreen>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.contenedor}
        >
          <View style={styles.cabecera}>
            <Text style={[styles.titulo, { color: tema.texto }]}>Crear cuenta</Text>
            <Text style={[styles.subtitulo, { color: tema.textoSuave }]}>
              El primer usuario registrado crea su empresa y se convierte en
              administrador. Los empleados se agregan desde la sección Usuarios.
            </Text>
          </View>

          <ThemedCard style={styles.card}>
            <ThemedInput
              icono="person-outline"
              label="Usuario"
              placeholder="Escribe tu usuario"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
            />
            <ThemedInput
              icono="lock-closed-outline"
              label="Contraseña"
              placeholder="Mínimo 6 caracteres"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <ThemedInput
              icono="lock-closed-outline"
              label="Confirmar contraseña"
              placeholder="Repite la contraseña"
              secureTextEntry
              value={confirmacion}
              onChangeText={setConfirmacion}
            />

            <View style={styles.divisor} />
            <Text style={[styles.subtitulo, { color: tema.textoSuave }]}>
              Datos de tu negocio (opcional)
            </Text>
            <ThemedInput
              icono="storefront-outline"
              label="Nombre del negocio"
              placeholder="Ej. La Feria del Libro"
              autoCapitalize="words"
              value={nombreNegocio}
              onChangeText={setNombreNegocio}
            />
            <ThemedInput
              icono="pricetag-outline"
              label="Tipo de negocio"
              placeholder="Ej. librería, papelería"
              autoCapitalize="none"
              value={tipoNegocio}
              onChangeText={setTipoNegocio}
            />

            {error && (
              <Text style={[styles.errorTexto, { color: tema.peligro }]}>{error}</Text>
            )}

            <ThemedButton
              titulo="REGISTRARSE"
              icono="person-add"
              onPress={handleRegistrar}
              loading={loading}
              style={{ marginTop: 6 }}
            />
            <ThemedButton
              titulo="CANCELAR"
              icono="close"
              variante="fantasma"
              onPress={cerrar}
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
    fontSize: 30,
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
  divisor: {
    height: 1,
    backgroundColor: '#444',
    marginVertical: 16,
  },
});