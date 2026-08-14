import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { getReporte } from '@/api/reportes';
import { ThemedCard, ThemedHeader, ThemedScreen } from '@/design/components';
import { useTheme } from '@/design/ThemeContext';
import { ReporteVentas } from '@/types';

export default function ReportesScreen() {
  const { tema } = useTheme();
  const [reporte, setReporte] = useState<ReporteVentas | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setReporte(await getReporte(7));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al obtener el reporte');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (loading) {
    return (
      <ThemedScreen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={tema.primario} />
        </View>
      </ThemedScreen>
    );
  }

  if (error) {
    return (
      <ThemedScreen>
        <View style={styles.center}>
          <Text style={[styles.errorTexto, { color: tema.peligro }]}>{error}</Text>
          <TouchableOpacity onPress={cargar}>
            <Text style={[styles.reintentar, { color: tema.primario }]}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </ThemedScreen>
    );
  }

  const maxDia = Math.max(...reporte!.por_dia.map((d) => d.total), 1);
  const diaActual = new Date().getDate();

  return (
    <ThemedScreen scroll>
      <ThemedHeader titulo="Reportes" subtitulo="Últimos 7 días" />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 90 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              cargar();
            }}
            colors={[tema.primario]}
            tintColor={tema.primario}
          />
        }
      >
        <View style={styles.filaResumen}>
          <Animated.View entering={FadeInDown.delay(50).duration(350)} style={{ flex: 1 }}>
            <ThemedCard entering={false} style={styles.tarjetaResumen}>
              <Ionicons name="receipt-outline" size={24} color={tema.primario} />
              <Text style={[styles.resumenValor, { color: tema.texto }]}>
                {reporte!.total_ventas}
              </Text>
              <Text style={[styles.resumenEtiqueta, { color: tema.textoSuave }]}>Ventas</Text>
            </ThemedCard>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(120).duration(350)} style={{ flex: 1 }}>
            <ThemedCard entering={false} style={styles.tarjetaResumen}>
              <Ionicons name="cash-outline" size={24} color={tema.exito} />
              <Text style={[styles.resumenValor, { color: tema.texto }]}>
                ${reporte!.ingresos_totales.toFixed(2)}
              </Text>
              <Text style={[styles.resumenEtiqueta, { color: tema.textoSuave }]}>Ingresos</Text>
            </ThemedCard>
          </Animated.View>
        </View>

        <ThemedCard style={styles.tarjetaGrafico} delay={150}>
          <Text style={[styles.seccionTitulo, { color: tema.texto }]}>Ventas por día</Text>
          <View style={styles.grafico}>
            {reporte!.por_dia.map((dia, i) => {
              const altura = Math.max((dia.total / maxDia) * 90, 3);
              const esHoy = new Date(dia.fecha).getDate() === diaActual;
              return (
                <View key={dia.fecha} style={styles.barraColumna}>
                  <Text style={[styles.barraValor, { color: tema.textoSuave }]}>
                    {dia.total > 0 ? `$${dia.total.toFixed(0)}` : ''}
                  </Text>
                  <View style={[styles.barraTrack, { backgroundColor: tema.superficie }]}>
                    <Animated.View
                      entering={FadeIn.delay(200 + i * 60).duration(500)}
                      style={[
                        styles.barra,
                        {
                          height: altura,
                          backgroundColor: esHoy ? tema.primario : tema.textoSuave,
                          borderRadius: 6,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barraEtiqueta, { color: tema.textoSuave }]}>
                    {new Date(dia.fecha).getDate()}/{new Date(dia.fecha).getMonth() + 1}
                  </Text>
                </View>
              );
            })}
          </View>
        </ThemedCard>

        <ThemedCard style={styles.tarjetaTop} delay={250}>
          <Text style={[styles.seccionTitulo, { color: tema.texto }]}>Más vendidos</Text>
          {reporte!.top_productos.length === 0 ? (
            <Text style={[styles.vacio, { color: tema.textoSuave }]}>
              Aún no hay ventas en este período.
            </Text>
          ) : (
            reporte!.top_productos.map((p, i) => (
              <View key={p.producto_id} style={styles.filaTop}>
                <View style={[styles.puesto, { backgroundColor: tema.primario }]}>
                  <Text style={[styles.puestoTexto, { color: tema.primarioTexto }]}>
                    {i + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.topNombre, { color: tema.texto }]} numberOfLines={1}>
                    {p.producto_nombre}
                  </Text>
                  <Text style={[styles.topDetalle, { color: tema.textoSuave }]}>
                    {p.cantidad} unidad(es)
                  </Text>
                </View>
                <Text style={[styles.topIngresos, { color: tema.exito }]}>
                  ${p.ingresos.toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </ThemedCard>
      </ScrollView>
    </ThemedScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  errorTexto: {
    fontSize: 15,
  },
  reintentar: {
    fontWeight: '700',
  },
  filaResumen: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  tarjetaResumen: {
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  resumenValor: {
    fontSize: 22,
    fontWeight: '800',
  },
  resumenEtiqueta: {
    fontSize: 13,
  },
  tarjetaGrafico: {
    padding: 18,
    marginBottom: 14,
  },
  seccionTitulo: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  grafico: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 150,
  },
  barraColumna: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barraValor: {
    fontSize: 10,
  },
  barraTrack: {
    width: 18,
    height: 90,
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barra: {
    width: '100%',
  },
  barraEtiqueta: {
    fontSize: 10,
  },
  tarjetaTop: {
    padding: 18,
  },
  filaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  puesto: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  puestoTexto: {
    fontWeight: '800',
    fontSize: 13,
  },
  topNombre: {
    fontSize: 15,
    fontWeight: '600',
  },
  topDetalle: {
    fontSize: 12,
  },
  topIngresos: {
    fontWeight: '800',
  },
  vacio: {
    textAlign: 'center',
    marginTop: 10,
  },
});