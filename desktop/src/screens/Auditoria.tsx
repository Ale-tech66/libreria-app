import { BookOpen, KeyRound, Receipt, ShieldAlert, UserRound } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getAuditoria } from '../api/auditoria';
import type { AuditLogOut } from '../api/types';
import { Boton, Chip, ErrorBox, formatearFecha, Spinner, Vacio, tituloRecurso } from '../components/ui';

const RECURSOS = [
  { id: '', etiqueta: 'Todos', icono: ShieldAlert },
  { id: 'usuario', etiqueta: 'Usuarios', icono: UserRound },
  { id: 'producto', etiqueta: 'Productos', icono: BookOpen },
  { id: 'venta', etiqueta: 'Ventas', icono: Receipt },
  { id: 'sesion', etiqueta: 'Sesiones', icono: KeyRound },
];

const POR_PAGINA = 50;

function iconoRecurso(recurso: string) {
  return RECURSOS.find((r) => r.id === recurso)?.icono ?? ShieldAlert;
}

export function Auditoria() {
  const [registros, setRegistros] = useState<AuditLogOut[]>([]);
  const [total, setTotal] = useState(0);
  const [recurso, setRecurso] = useState('');
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const secuenciaRef = useRef(0);

  const cargar = useCallback(async (pag: number, rec: string) => {
    const sec = ++secuenciaRef.current;
    if (pag === 1) setCargando(true);
    else setCargandoMas(true);
    setError(null);
    try {
      const datos = await getAuditoria({ page: pag, page_size: POR_PAGINA, recurso: rec || undefined });
      if (sec !== secuenciaRef.current) return;
      setRegistros((prev) => (pag === 1 ? datos.items : [...prev, ...datos.items]));
      setTotal(datos.total);
      setPagina(pag);
    } catch (err) {
      if (sec !== secuenciaRef.current) return;
      setError(err instanceof Error ? err.message : 'No se pudo cargar la auditoría');
    } finally {
      if (sec === secuenciaRef.current) {
        setCargando(false);
        setCargandoMas(false);
      }
    }
  }, []);

  useEffect(() => {
    void cargar(1, recurso);
  }, [recurso, cargar]);

  const hayMas = pagina * POR_PAGINA < total;

  return (
    <div className="tarjeta">
      <div className="inventario-cabecera">
        <div>
          <h2>Auditoría</h2>
          <p className="sub">{total} registro(s)</p>
        </div>
      </div>

      <div className="chips" style={{ marginBottom: 12 }}>
        {RECURSOS.map(({ id, etiqueta, icono: Icono }) => (
          <Chip key={id || 'todos'} activo={recurso === id} onClick={() => setRecurso(id)}>
            <Icono size={14} /> {etiqueta}
          </Chip>
        ))}
      </div>

      {error && <ErrorBox mensaje={error} onReintentar={() => void cargar(1, recurso)} />}

      {cargando ? (
        <Spinner texto="Cargando auditoría…" />
      ) : registros.length === 0 ? (
        <Vacio mensaje="Sin registros para este filtro." />
      ) : (
        <div className="auditoria-lista">
          {registros.map((r) => {
            const Icono = iconoRecurso(r.recurso);
            return (
              <div className="auditoria-fila" key={r.id}>
                <div className={`auditoria-icono${r.accion === 'desactivar' ? ' peligro' : ''}`}>
                  <Icono size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <strong>{r.detalle ?? `${tituloRecurso(r.accion)} · ${tituloRecurso(r.recurso)}`}</strong>
                  <span>
                    {r.username ?? 'sistema'} · {formatearFecha(r.fecha)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hayMas && (
        <div style={{ textAlign: 'center', padding: 12 }}>
          <Boton variante="secundario" onClick={() => void cargar(pagina + 1, recurso)} cargando={cargandoMas}>
            Cargar más
          </Boton>
        </div>
      )}
    </div>
  );
}