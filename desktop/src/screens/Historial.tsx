import { Receipt } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { getHistorialVentas, getRecibo } from '../api/ventas';
import type { ReciboOut, VentaOut } from '../api/types';
import { ReciboModal } from '../components/Recibo';
import { Boton, ErrorBox, formatearFecha, formatearMoneda, Spinner, Vacio } from '../components/ui';

const POR_PAGINA = 30;

export function Historial() {
  const [ventas, setVentas] = useState<VentaOut[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recibo, setRecibo] = useState<ReciboOut | null>(null);
  const [reciboId, setReciboId] = useState<number | null>(null);

  const cargar = useCallback(async (pag: number) => {
    if (pag === 1) setCargando(true);
    else setCargandoMas(true);
    setError(null);
    try {
      const datos = await getHistorialVentas(pag, POR_PAGINA);
      setVentas((prev) => (pag === 1 ? datos.items : [...prev, ...datos.items]));
      setTotal(datos.total);
      setPagina(pag);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el historial');
    } finally {
      setCargando(false);
      setCargandoMas(false);
    }
  }, []);

  useEffect(() => {
    void cargar(1);
  }, [cargar]);

  useEffect(() => {
    if (reciboId === null) return;
    // Último recibo solicitado gana: un clic rápido en dos recibos no deja
    // que la respuesta del primero pise al segundo.
    const pedido = reciboId;
    getRecibo(pedido)
      .then((datos) => {
        if (reciboId === pedido) setRecibo(datos);
      })
      .catch((err) => window.alert(err instanceof Error ? err.message : 'No se pudo cargar el recibo'))
      .finally(() => {
        if (reciboId === pedido) setReciboId(null);
      });
  }, [reciboId]);

  const hayMas = pagina * POR_PAGINA < total;

  return (
    <div className="tarjeta">
      <div className="inventario-cabecera">
        <div>
          <h2>Historial de ventas</h2>
          <p className="sub">{total} venta(s)</p>
        </div>
      </div>

      {error && <ErrorBox mensaje={error} onReintentar={() => void cargar(1)} />}

      {cargando ? (
        <Spinner texto="Cargando ventas…" />
      ) : ventas.length === 0 ? (
        <Vacio mensaje="Aún no hay ventas registradas." />
      ) : (
        <div className="tabla">
          <div className="tabla-fila tabla-cabecera">
            <span>#</span>
            <span>Fecha</span>
            <span>Método</span>
            <span>Productos</span>
            <span>Total</span>
            <span />
          </div>
          {ventas.map((v) => (
            <div className="tabla-fila" key={v.id}>
              <span>{v.id}</span>
              <span>{formatearFecha(v.fecha)}</span>
              <span className="pill pill-metodo">{v.metodo_pago}</span>
              <span>
                {v.detalles.map((d) => `${d.producto_nombre} × ${d.cantidad}`).join(', ')}
              </span>
              <strong>{formatearMoneda(v.total)}</strong>
              <span>
                <button className="boton-ocular" onClick={() => setReciboId(v.id)} title="Ver recibo">
                  <Receipt size={16} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {hayMas && (
        <div style={{ textAlign: 'center', padding: 12 }}>
          <Boton variante="secundario" onClick={() => void cargar(pagina + 1)} cargando={cargandoMas}>
            Cargar más
          </Boton>
        </div>
      )}

      <ReciboModal abierto={!!recibo} recibo={recibo} onCerrar={() => setRecibo(null)} />
    </div>
  );
}