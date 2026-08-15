import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getRecibo } from '@/api/ventas';
import { ThemedButton, ThemedScreen } from '@/design/components';
import { useTheme } from '@/design/ThemeContext';
import { ReciboData } from '@/types';

interface ReciboModalProps {
  ventaId: number | null;
  onClose: () => void;
}

function formatearFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function ReciboModal({ ventaId, onClose }: ReciboModalProps) {
  const { tema } = useTheme();
  const [recibo, setRecibo] = useState<ReciboData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    let activo = true;
    if (ventaId === null) {
      setRecibo(null);
      return;
    }
    setLoading(true);
    getRecibo(ventaId)
      .then((data) => {
        if (activo) setRecibo(data);
      })
      .catch((e) => {
        if (activo) {
          Alert.alert('Error', e instanceof Error ? e.message : 'Error al obtener el recibo');
          onClose();
        }
      })
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ventaId]);

  const htmlTicket = (): string => {
    if (!recibo) return '';
    const { venta, negocio, vendedor } = recibo;
    const filas = venta.detalles
      .map((d) => {
        const subtotal = (d.cantidad * d.precio_unitario).toFixed(2);
        return `
          <tr>
            <td style="padding:2px 0;">${d.producto_nombre}</td>
          </tr>
          <tr>
            <td style="padding:2px 0; color:#555;">  ${d.cantidad} x $${d.precio_unitario.toFixed(2)}</td>
            <td style="text-align:right; padding:2px 0;">$${subtotal}</td>
          </tr>`;
      })
      .join('');
    const contacto = [negocio.telefono, negocio.correo, negocio.pais]
      .filter(Boolean)
      .join(' · ');
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { margin: 12px; }
      body {
        font-family: 'Courier New', monospace;
        font-size: 13px;
        color: #000;
        width: 280px;
        margin: 0 auto;
      }
      .centro { text-align: center; }
      h2 { margin: 2px 0; font-size: 16px; }
      hr { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
      table { width: 100%; border-collapse: collapse; }
      .total { font-size: 16px; font-weight: bold; }
      .pie { margin-top: 10px; }
    </style>
  </head>
  <body>
    <div class="centro">
      <h2>${negocio.nombre}</h2>
      ${negocio.tipo_negocio ? `<p style="margin:0;">${negocio.tipo_negocio}</p>` : ''}
      ${contacto ? `<p style="margin:0;">${contacto}</p>` : ''}
    </div>
    <hr />
    <p style="margin:2px 0;">Venta #${venta.id}</p>
    <p style="margin:2px 0;">${formatearFecha(venta.fecha)}</p>
    ${vendedor ? `<p style="margin:2px 0;">Atendido por: ${vendedor}</p>` : ''}
    <hr />
    <table>
      ${filas}
    </table>
    <hr />
    <table>
      <tr>
        <td>Total</td>
        <td class="total" style="text-align:right;">$${venta.total.toFixed(2)}</td>
      </tr>
      <tr>
        <td>Pago</td>
        <td style="text-align:right;">${venta.metodo_pago}</td>
      </tr>
    </table>
    <p class="pie centro">¡Gracias por su compra!</p>
  </body>
</html>`;
  };

  const imprimir = async () => {
    try {
      await Print.printAsync({ html: htmlTicket() });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo imprimir');
    }
  };

  const exportarPdf = async () => {
    setGenerando(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: htmlTicket() });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Recibo de venta',
          UTI: '.pdf',
        });
      } else {
        Alert.alert('Compartir no disponible', `El PDF se guardó en: ${uri}`);
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo generar el PDF');
    } finally {
      setGenerando(false);
    }
  };

  return (
    <Modal visible={ventaId !== null} animationType="slide" onRequestClose={onClose}>
      <ThemedScreen>
        <View style={styles.contenido}>
          <View style={styles.cabecera}>
            <Text style={[styles.titulo, { color: tema.texto }]}>Recibo de venta</Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.botonCerrar, { backgroundColor: tema.peligro }]}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centroCarga}>
              <ActivityIndicator size="large" color={tema.primario} />
            </View>
          ) : recibo ? (
            <>
              <ScrollView showsVerticalScrollIndicator={false} style={styles.ticketScroll}>
                <View style={[styles.ticket, { backgroundColor: tema.superficie, borderColor: tema.borde }]}>
                  <Text style={[styles.negocio, { color: tema.texto }]}>
                    {recibo.negocio.nombre}
                  </Text>
                  {recibo.negocio.tipo_negocio ? (
                    <Text style={[styles.dato, { color: tema.textoSuave }]}>
                      {recibo.negocio.tipo_negocio}
                    </Text>
                  ) : null}
                  {[recibo.negocio.telefono, recibo.negocio.correo, recibo.negocio.pais]
                    .filter(Boolean)
                    .join(' · ') ? (
                    <Text style={[styles.dato, { color: tema.textoSuave }]}>
                      {[recibo.negocio.telefono, recibo.negocio.correo, recibo.negocio.pais]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  ) : null}

                  <View style={[styles.linea, { borderColor: tema.borde }]} />
                  <Text style={[styles.dato, { color: tema.texto }]}>Venta #{recibo.venta.id}</Text>
                  <Text style={[styles.dato, { color: tema.textoSuave }]}>
                    {formatearFecha(recibo.venta.fecha)}
                  </Text>
                  {recibo.vendedor ? (
                    <Text style={[styles.dato, { color: tema.textoSuave }]}>
                      Atendido por: {recibo.vendedor}
                    </Text>
                  ) : null}

                  <View style={[styles.linea, { borderColor: tema.borde }]} />
                  {recibo.venta.detalles.map((d) => (
                    <View key={d.id}>
                      <Text style={[styles.itemNombre, { color: tema.texto }]}>
                        {d.producto_nombre}
                      </Text>
                      <View style={styles.itemFila}>
                        <Text style={[styles.itemSub, { color: tema.textoSuave }]}>
                          {d.cantidad} x ${d.precio_unitario.toFixed(2)}
                        </Text>
                        <Text style={[styles.itemSub, { color: tema.texto }]}>
                          ${(d.cantidad * d.precio_unitario).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  ))}

                  <View style={[styles.linea, { borderColor: tema.borde }]} />
                  <View style={styles.itemFila}>
                    <Text style={[styles.totalEtiqueta, { color: tema.texto }]}>TOTAL</Text>
                    <Text style={[styles.totalValor, { color: tema.exito }]}>
                      ${recibo.venta.total.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.itemFila}>
                    <Text style={[styles.dato, { color: tema.textoSuave }]}>Pago</Text>
                    <Text style={[styles.dato, { color: tema.textoSuave }]}>
                      {recibo.venta.metodo_pago}
                    </Text>
                  </View>
                  <Text style={[styles.gracias, { color: tema.textoSuave }]}>
                    ¡Gracias por su compra!
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.botones}>
                <ThemedButton
                  titulo="IMPRIMIR"
                  icono="print"
                  onPress={imprimir}
                  style={{ marginBottom: 8 }}
                />
                <ThemedButton
                  titulo="GUARDAR COMO PDF"
                  icono="document-text"
                  variante="secundario"
                  onPress={exportarPdf}
                  loading={generando}
                  style={{ marginBottom: 8 }}
                />
                <ThemedButton titulo="CERRAR" icono="close" variante="fantasma" onPress={onClose} />
              </View>
            </>
          ) : null}
        </View>
      </ThemedScreen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  contenido: {
    flex: 1,
    padding: 20,
  },
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titulo: {
    fontSize: 24,
    fontWeight: '800',
  },
  botonCerrar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centroCarga: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketScroll: {
    flex: 1,
  },
  ticket: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  negocio: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  dato: {
    fontSize: 13,
    textAlign: 'center',
  },
  linea: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    alignSelf: 'stretch',
    marginVertical: 10,
  },
  itemNombre: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  itemFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  itemSub: {
    fontSize: 13,
  },
  totalEtiqueta: {
    fontSize: 16,
    fontWeight: '800',
  },
  totalValor: {
    fontSize: 20,
    fontWeight: '800',
  },
  gracias: {
    marginTop: 12,
    fontSize: 13,
    textAlign: 'center',
  },
  botones: {
    marginTop: 12,
  },
});