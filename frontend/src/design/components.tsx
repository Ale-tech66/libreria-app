import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { ReactNode } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from './ThemeContext';

// ─────────────────────────── Fondo de pantalla ───────────────────────────

interface ThemedScreenProps {
  children: ReactNode;
  scroll?: boolean;
}

export function ThemedScreen({ children, scroll = false }: ThemedScreenProps) {
  const { tema } = useTheme();
  const colores = (
    tema.fondo.length >= 2 ? [...tema.fondo] : [tema.fondo[0], tema.fondo[0]]
  ) as [string, string, ...string[]];

  return (
    <LinearGradient
      colors={colores}
      style={styles.flex}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Decoraciones tema={tema} />
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scrollContenido}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

function Decoraciones({ tema }: { tema: ReturnType<typeof useTheme>['tema'] }) {
  const activas = tema.estilo === 'aurora' || tema.id === 'liquid';
  if (!activas) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.blob, styles.blobUno, { backgroundColor: 'rgba(255,255,255,0.10)' }]} />
      <View style={[styles.blob, styles.blobDos, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
      <View style={[styles.blob, styles.blobTres, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
    </View>
  );
}

// ─────────────────────────── Tarjeta temática ───────────────────────────

interface ThemedCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  entering?: boolean;
  delay?: number;
}

export function ThemedCard({ children, style, entering = true, delay = 0 }: ThemedCardProps) {
  const { tema } = useTheme();
  const vidrio = tema.estilo === 'vidrio' || tema.estilo === 'aurora';

  const base: ViewStyle = {
    borderRadius: tema.radio,
    backgroundColor: tema.superficie,
  };

  let capa: ViewStyle = {};
  if (tema.estilo === 'arcilla') {
    capa = {
      borderWidth: 1,
      borderColor: tema.borde,
      shadowColor: tema.sombra,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.45,
      shadowRadius: 14,
      elevation: 6,
    };
  } else if (tema.estilo === 'neumorfo') {
    capa = {
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.65)',
      shadowColor: tema.sombra,
      shadowOffset: { width: 7, height: 7 },
      shadowOpacity: 0.55,
      shadowRadius: 14,
      elevation: 8,
    };
  } else if (tema.estilo === 'esqueuo') {
    capa = {
      borderWidth: 1,
      borderColor: tema.borde,
      borderTopColor: 'rgba(255,255,255,0.8)',
      borderBottomWidth: 3,
      shadowColor: tema.sombra,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
      elevation: 3,
    };
  } else if (tema.estilo === 'minimal') {
    capa = {
      borderWidth: 1,
      borderColor: tema.borde,
      shadowColor: tema.sombra,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 2,
    };
  } else {
    capa = {
      borderWidth: 1,
      borderColor: tema.borde,
      overflow: 'hidden',
    };
  }

  const contenido = (
    <View style={[base, capa, style]}>{children}</View>
  );

  const envuelto =
    vidrio ? (
      <BlurView
        intensity={22}
        tint={tema.oscuro ? 'dark' : 'light'}
        style={[base, capa, style]}
      >
        {children}
      </BlurView>
    ) : tema.estilo === 'esqueuo' ? (
      <LinearGradient
        colors={[tema.superficie, tema.fondo[0]]}
        style={[base, capa, style]}
      >
        {children}
      </LinearGradient>
    ) : (
      contenido
    );

  if (!entering) return envuelto;
  return (
    <Animated.View
      entering={FadeIn.delay(delay).duration(350)}
      style={{ borderRadius: tema.radio }}
    >
      {envuelto}
    </Animated.View>
  );
}

// ─────────────────────────── Botón temático ───────────────────────────

interface ThemedButtonProps {
  titulo: string;
  icono?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'peligro' | 'fantasma';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ThemedButton({
  titulo,
  icono,
  onPress,
  variante = 'primario',
  loading = false,
  disabled = false,
  style,
}: ThemedButtonProps) {
  const { tema } = useTheme();
  const escala = useSharedValue(1);

  const animada = useAnimatedStyle(() => ({
    transform: [{ scale: escala.value }],
  }));

  const presionar = () => {
    if (disabled || loading) return;
    escala.value = withTiming(0.95, { duration: 90 });
    setTimeout(() => {
      escala.value = withTiming(1, { duration: 120 });
    }, 90);
    onPress();
  };

  const estilos: Record<string, ViewStyle> = {
    primario: {
      backgroundColor: tema.primario,
      shadowColor: tema.sombra,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 5,
    },
    secundario: {
      backgroundColor: tema.superficie,
      borderWidth: 1,
      borderColor: tema.borde,
    },
    peligro: {
      backgroundColor: tema.peligro,
      shadowColor: tema.sombra,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 4,
    },
    fantasma: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: tema.primario,
    },
  };

  const textoColor =
    variante === 'primario' || variante === 'peligro'
      ? tema.primarioTexto
      : variante === 'fantasma'
        ? tema.primario
        : tema.texto;

  return (
    <Animated.View style={[{ borderRadius: tema.radio }, animada]}>
      <TouchableOpacity
        onPress={presionar}
        disabled={disabled || loading}
        activeOpacity={0.85}
        style={[
          styles.boton,
          { borderRadius: tema.radio },
          estilos[variante],
          (disabled || loading) && { opacity: 0.55 },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={textoColor} />
        ) : (
          <>
            {icono && <Ionicons name={icono} size={20} color={textoColor} />}
            <Text style={[styles.botonTexto, { color: textoColor }]}>{titulo}</Text>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────── Entrada temática ───────────────────────────

interface ThemedInputProps extends Omit<TextInputProps, 'style'> {
  icono?: keyof typeof Ionicons.glyphMap;
  error?: string;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function ThemedInput({ icono, error, label, style, ...props }: ThemedInputProps) {
  const { tema } = useTheme();
  return (
    <View style={[styles.campo, style]}>
      {label && <Text style={[styles.etiqueta, { color: tema.textoSuave }]}>{label}</Text>}
      <View
        style={[
          styles.inputContenedor,
          {
            backgroundColor: tema.superficie,
            borderColor: error ? tema.peligro : tema.borde,
            borderRadius: tema.radio * 0.6,
          },
        ]}
      >
        {icono && <Ionicons name={icono} size={18} color={tema.textoSuave} />}
        <TextInput
          placeholderTextColor={tema.textoSuave}
          style={[styles.input, { color: tema.texto }]}
          {...props}
        />
      </View>
      {error && <Text style={[styles.error, { color: tema.peligro }]}>{error}</Text>}
    </View>
  );
}

// ─────────────────────────── Chip / selector ───────────────────────────

interface ThemedChipProps {
  etiqueta: string;
  seleccionado?: boolean;
  onPress: () => void;
  icono?: keyof typeof Ionicons.glyphMap;
}

export function ThemedChip({ etiqueta, seleccionado, onPress, icono }: ThemedChipProps) {
  const { tema } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.chip,
        {
          borderRadius: 999,
          borderColor: tema.borde,
          backgroundColor: seleccionado ? tema.primario : tema.superficie,
        },
      ]}
    >
      {icono && (
        <Ionicons
          name={icono}
          size={15}
          color={seleccionado ? tema.primarioTexto : tema.textoSuave}
        />
      )}
      <Text
        style={[
          styles.chipTexto,
          { color: seleccionado ? tema.primarioTexto : tema.texto },
        ]}
      >
        {etiqueta}
      </Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────── Encabezado ───────────────────────────

interface ThemedHeaderProps {
  titulo: string;
  subtitulo?: string;
  derecho?: ReactNode;
}

export function ThemedHeader({ titulo, subtitulo, derecho }: ThemedHeaderProps) {
  const { tema } = useTheme();
  return (
    <View style={styles.encabezado}>
      <View style={styles.encabezadoTexto}>
        <Text style={[styles.titulo, { color: tema.texto }]}>{titulo}</Text>
        {subtitulo && (
          <Text style={[styles.subtitulo, { color: tema.textoSuave }]}>{subtitulo}</Text>
        )}
      </View>
      {derecho}
    </View>
  );
}

// ─────────────────────────── Estilos base ───────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContenido: {
    flexGrow: 1,
    paddingBottom: 90,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobUno: {
    width: 260,
    height: 260,
    top: -60,
    right: -80,
  },
  blobDos: {
    width: 200,
    height: 200,
    bottom: '30%',
    left: -90,
  },
  blobTres: {
    width: 140,
    height: 140,
    top: '45%',
    right: -40,
  },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    minHeight: 52,
  },
  botonTexto: {
    fontSize: 16,
    fontWeight: '700',
  },
  campo: {
    marginBottom: 14,
  },
  etiqueta: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputContenedor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 50,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  error: {
    fontSize: 12,
    marginTop: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  chipTexto: {
    fontSize: 14,
    fontWeight: '600',
  },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  encabezadoTexto: {
    flex: 1,
  },
  titulo: {
    fontSize: 26,
    fontWeight: '800',
  },
  subtitulo: {
    fontSize: 14,
    marginTop: 2,
  },
});