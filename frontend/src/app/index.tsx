import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import HistorialModal from '@/components/HistorialModal';
import VentasModal from '@/components/VentasModal';
import {
  ThemedButton,
  ThemedCard,
  ThemedChip,
  ThemedHeader,
  ThemedInput,
  ThemedScreen,
} from '@/design/components';
import { useTheme } from '@/design/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { ThemeId } from '@/design/themes';

export default function HomeScreen() {
  const { user, ready, loading, login, logout } = useAuth();
  const { tema } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showVentas, setShowVentas] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);
  const [exito, setExito] = useState(false);
  const anteriorUsuario = useRef(user);

  // Animación de éxito al iniciar sesión
  useEffect(() => {
    if (user && !anteriorUsuario.current) {
      setExito(true);
      const t = setTimeout(() => setExito(false), 1400);
      return () => clearTimeout(t);
    }
    anteriorUsuario.current = user;
  }, [user]);

  if (!ready) return null;

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('Ingresa usuario y contraseña');
      return;
    }
    setError(null);
    try {
      await login(username.trim(), password);
      setUsername('');
      setPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al iniciar sesión');
    }
  };

  if (!user) {
    return (
      <ThemedScreen>
        <View style={styles.loginContenedor}>
          <SelectorTemas />

          <Animated.View
            entering={FadeInDown.duration(600).delay(150)}
            style={[styles.logo, { backgroundColor: tema.primario }]}
          >
            <Ionicons name="library" size={52} color={tema.primarioTexto} />
          </Animated.View>
          <Text style={[styles.tituloLogin, { color: tema.texto }]}>Librería</Text>
          <Text style={[styles.subtituloLogin, { color: tema.textoSuave }]}>
            Punto de venta e inventario
          </Text>

          <ThemedCard style={styles.loginCard} delay={250}>
            <ThemedInput
              icono="person-outline"
              placeholder="Usuario"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
            />
            <ThemedInput
              icono="lock-closed-outline"
              placeholder="Contraseña"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {error && (
              <Text style={[styles.errorTexto, { color: tema.peligro }]}>{error}</Text>
            )}
            <ThemedButton
              titulo="INGRESAR"
              icono="log-in-outline"
              onPress={handleLogin}
              loading={loading}
              style={{ marginTop: 6 }}
            />
          </ThemedCard>
        </View>
      </ThemedScreen>
    );
  }

  const puedeVender = user.rol === 'admin' || user.rol === 'ventas';
  const puedeHistorial = user.rol === 'admin';

  return (
    <ThemedScreen scroll>
      <Animated.View entering={FadeIn.duration(400)}>
        <ThemedHeader
          titulo="¡Bienvenido!"
          subtitulo={`Sesión iniciada como ${user.username}`}
          derecho={
            <ThemedChip etiqueta={user.rol} seleccionado icono="shield-checkmark" onPress={() => {}} />
          }
        />

        <ThemedCard style={styles.rolCard} delay={100}>
          <Ionicons name="book" size={34} color={tema.primario} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rolTitulo, { color: tema.texto }]}>Librería App</Text>
            <Text style={[styles.rolSubtitulo, { color: tema.textoSuave }]}>
              Tu rol es {user.rol}. Elige una opción:
            </Text>
          </View>
        </ThemedCard>

        {puedeVender && (
          <ThemedButton
            titulo="PUNTO DE VENTA"
            icono="cart"
            onPress={() => setShowVentas(true)}
            style={styles.botonAccion}
          />
        )}

        {puedeHistorial && (
          <ThemedButton
            titulo="HISTORIAL DE VENTAS"
            icono="time"
            variante="secundario"
            onPress={() => setShowHistorial(true)}
            style={styles.botonAccion}
          />
        )}

        <ThemedButton
          titulo="CERRAR SESIÓN"
          icono="exit"
          variante="peligro"
          onPress={() => {
            Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Salir', style: 'destructive', onPress: logout },
            ]);
          }}
          style={styles.botonAccion}
        />

        <VentasModal visible={showVentas} onClose={() => setShowVentas(false)} />
        <HistorialModal visible={showHistorial} onClose={() => setShowHistorial(false)} />
      </Animated.View>

      {exito && <OverlayExito />}
    </ThemedScreen>
  );
}

function SelectorTemas() {
  const { tema, temas, setTemaId } = useTheme();
  return (
    <View style={styles.temas}>
      {temas.map((t) => (
        <ThemedChip
          key={t.id}
          etiqueta={t.nombre}
          seleccionado={tema.id === t.id}
          onPress={() => setTemaId(t.id as ThemeId)}
        />
      ))}
    </View>
  );
}

function OverlayExito() {
  const { tema } = useTheme();
  const escala = useSharedValue(0.2);
  const opacidad = useSharedValue(0);

  useEffect(() => {
    escala.value = withSpring(1, { damping: 9, stiffness: 140 });
    opacidad.value = withSpring(1, { damping: 12 });
  }, [escala, opacidad]);

  const estilos = useAnimatedStyle(() => ({
    transform: [{ scale: escala.value }],
    opacity: opacidad.value,
  }));

  return (
    <Animated.View
      exiting={FadeOut.duration(500)}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.overlayExito, { backgroundColor: tema.fondo[0] }]}
    >
      <Animated.View
        style={[styles.check, { backgroundColor: tema.exito }, estilos]}
      >
        <Ionicons name="checkmark" size={54} color="#ffffff" />
      </Animated.View>
      <Text style={[styles.checkTexto, { color: tema.texto }]}>Sesión iniciada</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  loginContenedor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  temas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
    maxWidth: 330,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  tituloLogin: {
    fontSize: 34,
    fontWeight: '800',
  },
  subtituloLogin: {
    fontSize: 15,
    marginBottom: 28,
  },
  loginCard: {
    width: '100%',
    padding: 20,
    gap: 4,
  },
  errorTexto: {
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  rolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    marginBottom: 14,
  },
  rolTitulo: {
    fontSize: 18,
    fontWeight: '700',
  },
  rolSubtitulo: {
    fontSize: 13,
    marginTop: 2,
  },
  botonAccion: {
    marginBottom: 12,
  },
  overlayExito: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  check: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkTexto: {
    fontSize: 20,
    fontWeight: '700',
  },
});