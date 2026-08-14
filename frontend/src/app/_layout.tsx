import * as SplashScreen from 'expo-splash-screen';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import AppTabs from '@/components/app-tabs';
import { ThemeProvider, useTheme } from '@/design/ThemeContext';
import { useAuth } from '@/hooks/useAuth';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppRoot />
    </ThemeProvider>
  );
}

function AppRoot() {
  const { user, ready } = useAuth();

  if (!ready) return null;

  return (
    <View style={{ flex: 1 }}>
      <AppTabs rol={user?.rol ?? null} />
      <SplashAnimada />
    </View>
  );
}

/** Splash animado con el logo de la app (libro) */
function SplashAnimada() {
  const { tema } = useTheme();
  const escala = useSharedValue(0.4);
  const opacidad = useSharedValue(0);
  const [visible, setVisible] = React.useState(true);

  const estilos = useAnimatedStyle(() => ({
    transform: [{ scale: escala.value }],
    opacity: opacidad.value,
  }));

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    escala.value = withSpring(1, { damping: 12, stiffness: 100 });
    opacidad.value = withDelay(200, withSpring(1, { damping: 14 }));
    const temporizador = setTimeout(() => setVisible(false), 1700);
    return () => clearTimeout(temporizador);
  }, [escala, opacidad]);

  if (!visible) return null;

  return (
    <Animated.View
      exiting={FadeOut.duration(600)}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.splash, { backgroundColor: tema.fondo[0] }]}
    >
      <Animated.View entering={FadeInDown.duration(500)} style={styles.splashCentro}>
        <Animated.View style={estilos}>
          <View style={[styles.logo, { backgroundColor: tema.primario }]}>
            <Ionicons name="library" size={44} color={tema.primarioTexto} />
          </View>
        </Animated.View>
        <Text style={[styles.nombreApp, { color: tema.texto }]}>Librería</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  splash: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  splashCentro: {
    alignItems: 'center',
    gap: 16,
  },
  logo: {
    width: 92,
    height: 92,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nombreApp: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 1,
  },
});