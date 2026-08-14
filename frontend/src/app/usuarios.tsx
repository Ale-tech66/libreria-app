import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { actualizarUsuario, crearUsuario, getUsuarios } from '@/api/usuarios';
import {
  ThemedButton,
  ThemedCard,
  ThemedChip,
  ThemedHeader,
  ThemedInput,
  ThemedScreen,
} from '@/design/components';
import { useTheme } from '@/design/ThemeContext';
import { Rol, User } from '@/types';

export default function UsuariosScreen() {
  const { tema } = useTheme();
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNuevo, setShowNuevo] = useState(false);
  const [cambiarPass, setCambiarPass] = useState<User | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setUsuarios(await getUsuarios());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiarActivo = (usuario: User) => {
    const accion = usuario.activo ? 'Desactivar' : 'Activar';
    Alert.alert(
      `${accion} usuario`,
      `¿Seguro que quieres ${accion.toLowerCase()} a "${usuario.username}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: accion,
          style: usuario.activo ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await actualizarUsuario(usuario.id, { activo: !usuario.activo });
              cargar();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Error');
            }
          },
        },
      ]
    );
  };

  const cambiarRol = async (usuario: User, rol: Rol) => {
    try {
      await actualizarUsuario(usuario.id, { rol });
      cargar();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error');
    }
  };

  const cambiarPassword = (usuario: User) => {
    setCambiarPass(usuario);
  };

  return (
    <ThemedScreen>
      <View style={styles.contenido}>
        <ThemedHeader
          titulo="Usuarios"
          subtitulo="Gestiona cuentas y permisos"
          derecho={
            <TouchableOpacity
              onPress={() => setShowNuevo(true)}
              style={[styles.botonNuevo, { backgroundColor: tema.primario }]}
            >
              <Ionicons name="person-add" size={20} color={tema.primarioTexto} />
            </TouchableOpacity>
          }
        />

        {error && (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: tema.superficie, borderColor: tema.peligro },
            ]}
          >
            <Text style={[styles.errorTexto, { color: tema.peligro }]}>{error}</Text>
            <TouchableOpacity onPress={cargar}>
              <Text style={[styles.reintentar, { color: tema.primario }]}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={tema.primario} />
          </View>
        ) : (
          <FlatList
            data={usuarios}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingBottom: 90 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeIn.delay(Math.min(index, 8) * 40).duration(300)}>
                <ThemedCard entering={false} style={styles.card}>
                  <View style={styles.filaUsuario}>
                    <View
                      style={[
                        styles.avatar,
                        {
                          backgroundColor: item.activo ? tema.primario : tema.textoSuave,
                        },
                      ]}
                    >
                      <Ionicons name="person" size={22} color={tema.primarioTexto} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.usuarioNombre, { color: tema.texto }]}>
                        {item.username}
                      </Text>
                      <Text style={[styles.usuarioRol, { color: tema.textoSuave }]}>
                        {item.activo ? 'Activo' : 'Desactivado'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => cambiarPassword(item)}
                      style={styles.iconoAccion}
                    >
                      <Ionicons name="key-outline" size={20} color={tema.textoSuave} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => cambiarActivo(item)} style={styles.iconoAccion}>
                      <Ionicons
                        name={item.activo ? 'pause-circle-outline' : 'play-circle-outline'}
                        size={22}
                        color={item.activo ? tema.peligro : tema.exito}
                      />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.filaRoles}>
                    {(['admin', 'inventario', 'ventas'] as const).map((rol) => (
                      <ThemedChip
                        key={rol}
                        etiqueta={rol}
                        seleccionado={item.rol === rol}
                        onPress={() => cambiarRol(item, rol)}
                      />
                    ))}
                  </View>
                </ThemedCard>
              </Animated.View>
            )}
          />
        )}

        <ModalNuevoUsuario
          visible={showNuevo}
          onClose={() => setShowNuevo(false)}
          onCreado={() => {
            setShowNuevo(false);
            cargar();
          }}
        />

        <ModalPassword
          usuario={cambiarPass}
          onClose={() => setCambiarPass(null)}
          onCambiada={() => {
            setCambiarPass(null);
            Alert.alert('Éxito', 'Contraseña actualizada');
          }}
        />
      </View>
    </ThemedScreen>
  );
}

function ModalNuevoUsuario({
  visible,
  onClose,
  onCreado,
}: {
  visible: boolean;
  onClose: () => void;
  onCreado: () => void;
}) {
  const { tema } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<Rol>('ventas');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    if (!username.trim() || password.length < 6) {
      setError('Usuario (mín. 3) y contraseña (mín. 6 caracteres)');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await crearUsuario(username.trim(), password, rol);
      setUsername('');
      setPassword('');
      onCreado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear el usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalFondo}>
        <ThemedCard entering={false} style={styles.modalCard}>
          <Text style={[styles.modalTitulo, { color: tema.texto }]}>Nuevo usuario</Text>

          <ThemedInput
            icono="person-outline"
            label="Usuario"
            placeholder="Ej: cajero1"
            autoCapitalize="none"
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

          <Text style={[styles.etiquetaRol, { color: tema.textoSuave }]}>Rol</Text>
          <View style={styles.filaRoles}>
            {(['admin', 'inventario', 'ventas'] as const).map((r) => (
              <ThemedChip key={r} etiqueta={r} seleccionado={rol === r} onPress={() => setRol(r)} />
            ))}
          </View>

          {error && <Text style={[styles.errorTexto, { color: tema.peligro }]}>{error}</Text>}

          <View style={styles.filaBotones}>
            <ThemedButton titulo="Guardar" icono="checkmark" onPress={guardar} loading={loading} />
            <ThemedButton titulo="Cancelar" variante="fantasma" onPress={onClose} />
          </View>
        </ThemedCard>
      </View>
    </Modal>
  );
}

function ModalPassword({
  usuario,
  onClose,
  onCambiada,
}: {
  usuario: User | null;
  onClose: () => void;
  onCambiada: () => void;
}) {
  const { tema } = useTheme();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPassword('');
    setError(null);
  }, [usuario]);

  const guardar = async () => {
    if (!usuario) return;
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await actualizarUsuario(usuario.id, { password });
      onCambiada();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={usuario !== null} animationType="slide" transparent>
      <View style={styles.modalFondo}>
        <ThemedCard entering={false} style={styles.modalCard}>
          <Text style={[styles.modalTitulo, { color: tema.texto }]}>Nueva contraseña</Text>
          <Text style={[styles.detallePass, { color: tema.textoSuave }]}>
            {`Para "${usuario?.username ?? ''}" (mínimo 6 caracteres)`}
          </Text>

          <ThemedInput
            icono="lock-closed-outline"
            placeholder="Nueva contraseña"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />

          {error && <Text style={[styles.errorTexto, { color: tema.peligro }]}>{error}</Text>}

          <View style={styles.filaBotones}>
            <ThemedButton
              titulo="Guardar"
              icono="checkmark"
              onPress={guardar}
              loading={loading}
            />
            <ThemedButton titulo="Cancelar" variante="fantasma" onPress={onClose} />
          </View>
        </ThemedCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  contenido: {
    flex: 1,
    padding: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonNuevo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorTexto: {
    flex: 1,
  },
  reintentar: {
    fontWeight: '700',
    marginLeft: 10,
  },
  card: {
    padding: 14,
    marginBottom: 12,
  },
  filaUsuario: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usuarioNombre: {
    fontSize: 16,
    fontWeight: '700',
  },
  usuarioRol: {
    fontSize: 13,
  },
  iconoAccion: {
    padding: 6,
  },
  filaRoles: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  etiquetaRol: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  detallePass: {
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalFondo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    padding: 22,
  },
  modalTitulo: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  filaBotones: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
});