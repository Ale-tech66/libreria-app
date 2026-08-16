import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
  configurarTelegram,
  descargarRespaldo,
  getEstadoTelegram,
  probarTelegram,
} from '@/api/backups';
import MfaConfigModal from '@/components/MfaConfigModal';
import { ThemedButton, ThemedCard, ThemedHeader, ThemedInput, ThemedScreen } from '@/design/components';
import { useTheme } from '@/design/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { Theme, ThemeId } from '@/design/themes';

export default function AjustesScreen() {
  const { tema, temas, setTemaId } = useTheme();
  const { user, logout } = useAuth();
  const [showMfa, setShowMfa] = useState(false);
  const esAdmin = user?.rol === 'admin';

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

        <Text style={[styles.seccion, { color: tema.textoSuave }]}>SEGURIDAD</Text>
        <ThemedCard style={styles.tarjetaCuenta}>
          <View style={[styles.avatar, { backgroundColor: tema.primario }]}>
            <Ionicons
              name={user?.mfa_activo ? 'shield-checkmark' : 'shield-outline'}
              size={26}
              color={tema.primarioTexto}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.usuario, { color: tema.texto }]}>
              Verificación en dos pasos
            </Text>
            <Text style={[styles.rol, { color: tema.textoSuave }]}>
              {user?.mfa_activo ? 'Activado' : 'Desactivado'}
            </Text>
          </View>
          <ThemedButton
            titulo={user?.mfa_activo ? 'Configurar' : 'Activar'}
            icono={user?.mfa_activo ? 'settings-outline' : 'shield-checkmark'}
            variante={user?.mfa_activo ? 'secundario' : 'primario'}
            onPress={() => setShowMfa(true)}
            style={{ minHeight: 40, paddingVertical: 8, paddingHorizontal: 14 }}
          />
        </ThemedCard>

        {esAdmin && <SeccionRespaldo />}

        <Text style={[styles.seccion, { color: tema.textoSuave }]}>CUENTA</Text>
        <ThemedCard style={styles.tarjetaCuenta}>
          <View style={[styles.avatar, { backgroundColor: tema.primario }]}>
            <Ionicons name="person" size={26} color={tema.primarioTexto} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.usuario, { color: tema.texto }]}>{user?.username}</Text>
            <Text style={[styles.rol, { color: tema.textoSuave }]}>Rol: {user?.rol}</Text>
            {user?.organizacion ? (
              <Text style={[styles.rol, { color: tema.textoSuave }]}>
                Empresa: {user.organizacion}
              </Text>
            ) : null}
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
          Librería App · Versión 1.2.0
        </Text>
      </View>

      <MfaConfigModal visible={showMfa} onClose={() => setShowMfa(false)} />
    </ThemedScreen>
  );
}

function SeccionRespaldo() {
  const { tema } = useTheme();
  const [token, setToken] = useState('');
  const [estado, setEstado] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [tokenGuardado, setTokenGuardado] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargarEstado = useCallback(async () => {
    try {
      const data = await getEstadoTelegram();
      setTokenGuardado(data.bot_token_guardado);
      setChatId(data.chat_id);
    } catch {
      // Sin red o sin permiso: se muestra la sección sin estado
    }
  }, []);

  useEffect(() => {
    cargarEstado();
  }, [cargarEstado]);

  const handleDescargar = async () => {
    setDescargando(true);
    try {
      await descargarRespaldo();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error al descargar el respaldo');
    } finally {
      setDescargando(false);
    }
  };

  const handleGuardar = async () => {
    if (!token.trim()) {
      Alert.alert('Aviso', 'Pega el token que te dio @BotFather');
      return;
    }
    setGuardando(true);
    setEstado(null);
    try {
      const resultado = await configurarTelegram(token);
      setChatId(resultado.chat_id);
      setTokenGuardado(true);
      setToken('');
      setEstado(
        resultado.chat_id
          ? `Conectado al chat: ${resultado.chat_id}`
          : resultado.detalle
      );
    } catch (e) {
      setEstado(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const handleProbar = async () => {
    setGuardando(true);
    try {
      const resultado = await probarTelegram();
      Alert.alert('Listo', resultado.detalle);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Error al enviar la prueba');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <Text style={[styles.seccion, { color: tema.textoSuave }]}>RESPALDOS</Text>

      <ThemedCard style={styles.tarjetaCuenta}>
        <View style={[styles.avatar, { backgroundColor: tema.primario }]}>
          <Ionicons name="cloud-download-outline" size={26} color={tema.primarioTexto} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.usuario, { color: tema.texto }]}>Descargar respaldo</Text>
          <Text style={[styles.rol, { color: tema.textoSuave }]}>
            Copia completa de tus datos (productos, ventas, usuarios)
          </Text>
        </View>
        <ThemedButton
          titulo="Descargar"
          icono="download-outline"
          variante="secundario"
          onPress={handleDescargar}
          loading={descargando}
          style={{ minHeight: 40, paddingVertical: 8, paddingHorizontal: 14 }}
        />
      </ThemedCard>

      <ThemedCard style={styles.tarjetaTelegram}>
        <Text style={[styles.usuario, { color: tema.texto }]}>Respaldo automático por Telegram</Text>
        <Text style={[styles.rol, { color: tema.textoSuave }]}>
          Cada día a las 11:00 PM se enviará el respaldo a tu chat de Telegram.
        </Text>
        {tokenGuardado && (
          <Text style={[styles.rol, { color: tema.exito }]}>
            {chatId ? `Conectado: ${chatId}` : 'Bot guardado'}
          </Text>
        )}
        <ThemedInput
          icono="paper-plane-outline"
          placeholder="Token del bot (@BotFather)"
          secureTextEntry
          autoCapitalize="none"
          value={token}
          onChangeText={setToken}
          style={{ marginTop: 10 }}
        />
        <View style={styles.filaTelegram}>
          <ThemedButton
            titulo="Guardar bot"
            icono="save-outline"
            onPress={handleGuardar}
            loading={guardando}
            style={{ flex: 1 }}
          />
          <ThemedButton
            titulo="Probar"
            icono="send-outline"
            variante="secundario"
            onPress={handleProbar}
            disabled={!tokenGuardado}
            style={{ flex: 1 }}
          />
        </View>
        {estado && (
          <Text style={[styles.rol, { color: tema.advertencia, marginTop: 8 }]}>{estado}</Text>
        )}
      </ThemedCard>
    </>
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
  tarjetaTelegram: {
    padding: 16,
    marginBottom: 14,
    gap: 4,
  },
  filaTelegram: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
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