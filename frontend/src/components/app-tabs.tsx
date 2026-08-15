import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/design/ThemeContext';
import { Rol } from '@/types';

interface AppTabsProps {
  rol: Rol | null;
}

export default function AppTabs({ rol }: AppTabsProps) {
  const { tema } = useTheme();
  const esAdmin = rol === 'admin';

  const opciones = (nombre: string, icono: keyof typeof Ionicons.glyphMap) => ({
    tabBarIcon: ({ color, size }: { color: string; size: number }) => (
      <Ionicons name={icono} size={size} color={color} />
    ),
    tabBarAccessibilityLabel: nombre,
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: !rol
          ? styles.oculto
          : [
              styles.tabBar,
              {
                backgroundColor:
                  tema.estilo === 'neumorfo' ? tema.superficie : 'rgba(0,0,0,0.25)',
                borderTopColor: tema.borde,
              },
            ],
        tabBarActiveTintColor: tema.primario,
        tabBarInactiveTintColor: tema.textoSuave,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen name="index" options={opciones('Inicio', 'home')} />
      <Tabs.Screen name="explore" options={opciones('Inventario', 'library')} />
      {esAdmin && (
        <Tabs.Screen name="reportes" options={opciones('Reportes', 'stats-chart')} />
      )}
      <Tabs.Screen name="ajustes" options={opciones('Ajustes', 'settings')} />
      {esAdmin && (
        <Tabs.Screen name="usuarios" options={opciones('Usuarios', 'people')} />
      )}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  oculto: {
    display: 'none',
  },
  tabBar: {
    borderTopWidth: 1,
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    borderRadius: 22,
    overflow: 'hidden',
    height: 64,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});