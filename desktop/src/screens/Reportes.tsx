import { motion } from 'framer-motion';
import { DollarSign, Receipt, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { getReporte } from '../api/ventas';
import type { ReporteVentas } from '../api/types';
import { ErrorBox, formatearFecha, formatearMoneda, Spinner, Vacio } from '../components/ui';

export function Reportes() {
  const [reporte, setReporte] = useState<ReporteVentas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setReporte(await getReporte(7));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el reporte');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (cargando) {
    return (
      <div className="tarjeta">
        <div className="inventario-cabecera">
          <div>
            <h2>Reporte · últimos 7 días</h2>
            <p className="sub">Resumen de ventas de la semana</p>
          </div>
        </div>
        <Spinner texto="Calculando reporte…" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="tarjeta">
        <div className="inventario-cabecera">
          <div>
            <h2>Reporte · últimos 7 días</h2>
            <p className="sub">Resumen de ventas de la semana</p>
          </div>
        </div>
        <ErrorBox mensaje={error} onReintentar={() => void cargar()} />
      </div>
    );
  }
  if (!reporte) return <Vacio mensaje="Sin datos de reporte." />;

  const maxDia = Math.max(1, ...reporte.por_dia.map((d) => d.total));
  const ahora = new Date();
  const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;

  return (
    <div className="tarjeta">
      <div className="inventario-cabecera">
        <div>
          <h2>Reporte · últimos 7 días</h2>
          <p className="sub">Resumen de ventas de la semana</p>
        </div>
        <button className="enlace" onClick={() => void cargar()}>
          Actualizar
        </button>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="kpi-icono">
            <Receipt size={20} />
          </div>
          <div>
            <span>Ventas</span>
            <strong>{reporte.total_ventas}</strong>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-icono">
            <DollarSign size={20} />
          </div>
          <div>
            <span>Ingresos</span>
            <strong>{formatearMoneda(reporte.ingresos_totales)}</strong>
          </div>
        </div>
      </div>

      <h3 className="seccion-titulo">
        <TrendingUp size={17} /> Ventas por día
      </h3>
      {reporte.por_dia.length === 0 ? (
        <Vacio mensaje="Sin ventas en los últimos 7 días." />
      ) : (
        <div className="barras">
          {reporte.por_dia.map((d, i) => (
            <motion.div
              key={d.fecha}
              className="barra-col"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i, duration: 0.3 }}
            >
              <span className="barra-valor">{d.total > 0 ? formatearMoneda(d.total) : ''}</span>
              <div className="barra-pista">
                <motion.div
                  className={`barra${d.fecha === hoy ? ' hoy' : ''}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(3, (d.total / maxDia) * 100)}%` }}
                  transition={{ delay: 0.1 + 0.06 * i, type: 'spring', stiffness: 120, damping: 20 }}
                />
              </div>
              <span className="barra-fecha">{formatearFecha(d.fecha).slice(0, 5)}</span>
            </motion.div>
          ))}
        </div>
      )}

      <h3 className="seccion-titulo">Más vendidos</h3>
      {reporte.top_productos.length === 0 ? (
        <Vacio mensaje="Aún no hay productos vendidos." />
      ) : (
        <div className="ranking">
          {reporte.top_productos.map((p, i) => (
            <div className="ranking-fila" key={p.producto_id}>
              <span className={`ranking-puesto${i < 3 ? ` top${i + 1}` : ''}`}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <strong>{p.producto_nombre}</strong>
                <span>
                  {p.cantidad} unidad(es) · {formatearMoneda(p.ingresos)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}