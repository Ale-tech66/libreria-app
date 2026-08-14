import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedButton, ThemedCard, ThemedHeader, ThemedScreen } from '@/design/components';
import { useTheme } from '@/design/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { Theme, ThemeId } from '@/design/themes';

export default function AjustesScreen() {
  const { tema, temas, setTemaId } = useTheme();
  const { user, logout } = useAuth();

  return (
    <ThemedScreen scroll>
      <View style={styles.contenido}>
        <ThemedHeader titulo="Ajustes" subtitulo="Personaliza tu experiencia" />

        <Text style={[styles.seccion, { color: tema.textoSuave }]}>TEMA DE LA APP</Text>
        <View style={styles.cuadricula}>
          {temas.map((t) => (
            <TarjetaTema
              key={t.id}
              temaDef={t}
              seleccionado={tema.id === t.id}
              onPress={() => setTemaId(t.id as ThemeId)}
            />
          ))}
        </View>

        <Text style={[styles.seccion, { color: tema.textoSuave }]}>CUENTA</Text>
        <ThemedCard style={styles.tarjetaCuenta}>
          <View style={[styles.avatar, { backgroundColor: tema.primario }]}>
            <Ionicons name="person" size={26} color={tema.primarioTexto} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.usuario, { color: tema.texto }]}>{user?.username}</Text>
            <Text style={[styles.rol, { color: tema.textoSuave }]}>Rol: {user?.rol}</Text>
          </View>
        </ThemedCard>

        <ThemedButton
          titulo="CERRAR SESIÓN"
          icono="exit"
          variante="peligro"
          onPress={() =>
            Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Salir', style: 'destructive', onPress: logout },
            ])
          }
        />

        <Text style={[styles.version, { color: tema.textoSuave }]}>
          Librería App · Versión 1.1.0
        </Text>
      </View>
    </ThemedScreen>
  );
}

function TarjetaTema({
  temaDef,
  seleccionado,
  onPress,
}: {
  temaDef: Theme;
  seleccionado: boolean;
  onPress: () => void;
}) {
  const { tema } = useTheme();
  return (
    <ThemedCard
      entering={false}
      style={[styles.tarjetaTema, seleccionado && { borderColor: tema.primario, borderWidth: 2 }]}
    >
      <LinearGradient
        colors={
          (temaDef.fondo.length >= 2
            ? [...temaDef.fondo]
            : [temaDef.fondo[0], temaDef.fondo[0]]) as [string, string, ...string[]]
        }
        style={styles.temaVista}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={[styles.temaMiniCard, { backgroundColor: temaDef.superficie }]}>
          <View style={[styles.temaMiniBoton, { backgroundColor: temaDef.primario }]} />
        </View>
      </LinearGradient>
      <Text style={[styles.temaNombre, { color: tema.texto }]}>{temaDef.nombre}</Text>
      <Text style={[styles.temaDesc, { color: tema.textoSuave }]} numberOfLines={2}>
        {temaDef.descripcion}
      </Text>
      <ThemedButton
        titulo={seleccionado ? 'Activo' : 'Usar'}
        icono={seleccionado ? 'checkmark-circle' : 'color-palette-outline'}
        variante={seleccionado ? 'secundario' : 'primario'}
        onPress={onPress}
        style={{ marginTop: 8, minHeight: 42, paddingVertical: 10 }}
      />
    </ThemedCard>
  );
}

const styles = StyleSheet.create({
  contenido: {
    padding: 20,
  },
  seccion: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 6,
  },
  cuadricula: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  tarjetaTema: {
    width: '48.5%',
    padding: 12,
    marginBottom: 12,
  },
  temaVista: {
    height: 64,
    borderRadius: 12,
    padding: 8,
    justifyContent: 'flex-end',
  },
  temaMiniCard: {
    height: 20,
    borderRadius: 6,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  temaMiniBoton: {
    width: 34,
    height: 8,
    borderRadius: 4,
  },
  temaNombre: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  temaDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  tarjetaCuenta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    marginBottom: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usuario: {
    fontSize: 17,
    fontWeight: '700',
  },
  rol: {
    fontSize: 13,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 24,
  },
});