import { BookOpen, Eye, EyeOff, Plus, ScanLine, Search } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { buscarProductoPorCodigo, desactivarProducto, getProductos, urlFoto } from '../api/productos';
import type { Producto } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { ProductoFormModal } from '../components/ProductoForm';
import { Boton, ErrorBox, formatearMoneda, Spinner, Vacio } from '../components/ui';

const STOCK_BAJO = 5;
const POR_PAGINA = 50;

export function Inventario() {
  const { sesion } = useAuth();
  const puedeGestionar = sesion?.usuario.rol === 'admin' || sesion?.usuario.rol === 'inventario';

  const [items, setItems] = useState<Producto[]>([]);
  const [total, setTotal] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);

  const [formAbierto, setFormAbierto] = useState(false);
  const [formProducto, setFormProducto] = useState<Producto | null>(null);
  const [formCodigo, setFormCodigo] = useState<string | undefined>(undefined);
  const [codigoEscaneo, setCodigoEscaneo] = useState('');
  const escanerRef = useRef<HTMLInputElement>(null);
  const secuenciaRef = useRef(0);

  const cargar = useCallback(
    async (pag: number, q: string, reiniciar: boolean) => {
      // "Última petición gana": una respuesta lenta de una búsqueda o página
      // anterior no puede pisar ni mezclar la lista actual.
      const sec = ++secuenciaRef.current;
      if (reiniciar) setCargando(true);
      else setCargandoMas(true);
      setError(null);
      try {
        const datos = await getProductos({
          q: q || undefined,
          page: pag,
          page_size: POR_PAGINA,
          incluir_inactivos: puedeGestionar,
        });
        if (sec !== secuenciaRef.current) return;
        setItems((prev) => (reiniciar ? datos.items : [...prev, ...datos.items]));
        setTotal(datos.total);
        setPagina(pag);
        setHayMas(pag * datos.page_size < datos.total);
      } catch (err) {
        if (sec !== secuenciaRef.current) return;
        setError(err instanceof Error ? err.message : 'No se pudo cargar el inventario');
      } finally {
        if (sec === secuenciaRef.current) {
          setCargando(false);
          setCargandoMas(false);
        }
      }
    },
    [puedeGestionar],
  );

  useEffect(() => {
    const id = setTimeout(() => {
      setItems([]);
      void cargar(1, busqueda, true);
    }, 400);
    return () => clearTimeout(id);
  }, [busqueda, cargar]);

  const cargarMas = () => {
    if (hayMas && !cargandoMas && !cargando) void cargar(pagina + 1, busqueda, false);
  };

  const manejarEscaneo = async (e: React.FormEvent) => {
    e.preventDefault();
    const codigo = codigoEscaneo.trim();
    if (!codigo) return;
    try {
      const producto = await buscarProductoPorCodigo(codigo);
      setFormProducto(producto);
      setFormCodigo(codigo);
      setFormAbierto(true);
    } catch {
      setFormProducto(null);
      setFormCodigo(codigo);
      setFormAbierto(true);
    }
    setCodigoEscaneo('');
    escanerRef.current?.focus();
  };

  const alGuardado = () => {
    void cargar(1, busqueda, true);
  };

  const alternarActivo = async (producto: Producto) => {
    if (producto.activo) {
      const confirmar = window.confirm(`¿Desactivar "${producto.nombre}"?`);
      if (!confirmar) return;
      try {
        await desactivarProducto(producto.id);
        void cargar(1, busqueda, true);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'No se pudo desactivar');
      }
    } else {
      setFormProducto(producto);
      setFormAbierto(true);
    }
  };

  const abrirNuevo = () => {
    setFormProducto(null);
    setFormCodigo(undefined);
    setFormAbierto(true);
  };

  const alCerrarForm = () => {
    setFormAbierto(false);
    setFormProducto(null);
    setFormCodigo(undefined);
  };

  return (
    <div className="tarjeta inventario">
      <div className="inventario-cabecera">
        <div>
          <h2>Inventario</h2>
          <p className="sub">{total} producto(s)</p>
        </div>
        <div className="inventario-acciones">
          <form onSubmit={manejarEscaneo} className="codigo-form compacto">
            <div className="campo">
              <ScanLine size={17} />
              <input
                ref={escanerRef}
                value={codigoEscaneo}
                onChange={(e) => setCodigoEscaneo(e.target.value)}
                placeholder="Código de barras (Enter)…"
              />
            </div>
          </form>
          {puedeGestionar && (
            <Boton onClick={abrirNuevo}>
              <Plus size={17} /> Nuevo
            </Boton>
          )}
        </div>
      </div>

      <div className="campo inventario-busqueda">
        <Search size={17} />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, autor o código…"
        />
      </div>

      {error && <ErrorBox mensaje={error} onReintentar={() => void cargar(1, busqueda, true)} />}

      {cargando ? (
        <Spinner texto="Cargando productos…" />
      ) : items.length === 0 ? (
        <Vacio mensaje={busqueda ? `No hay resultados para "${busqueda}"` : 'Aún no hay productos. ¡Crea el primero!'} />
      ) : (
        <div className="productos-lista">
          {items.map((p) => (
            <div
              key={p.id}
              className={`producto-tarjeta${p.activo ? '' : ' inactivo'}`}
              onClick={() => {
                if (!puedeGestionar) return;
                setFormProducto(p);
                setFormCodigo(undefined);
                setFormAbierto(true);
              }}
            >
              {urlFoto(p.foto) ? (
                <img src={urlFoto(p.foto)!} alt={p.nombre} className="producto-foto" />
              ) : (
                <div className="producto-foto producto-foto-vacia">
                  <BookOpen size={20} />
                </div>
              )}
              <div className="producto-info">
                <strong>{p.nombre}</strong>
                <span>
                  {p.autor ? `${p.autor} · ` : ''}
                  {p.codigo_barras}
                </span>
              </div>
              <div className="producto-stock">
                {!p.activo && <span className="pill pill-inactivo">Inactivo</span>}
                {p.activo && p.stock <= STOCK_BAJO && <span className="pill pill-bajo">Stock bajo</span>}
                {p.activo && (
                  <span className={p.stock === 0 ? 'stock-rojo' : ''}>
                    Stock: {p.stock}
                  </span>
                )}
              </div>
              <strong className="producto-precio">{formatearMoneda(p.precio_venta)}</strong>
              {puedeGestionar && (
                <button
                  className="boton-ocular"
                  onClick={(e) => {
                    e.stopPropagation();
                    void alternarActivo(p);
                  }}
                  title={p.activo ? 'Desactivar' : 'Reactivar'}
                >
                  {p.activo ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            </div>
          ))}

          {hayMas && (
            <div style={{ textAlign: 'center', padding: 12 }}>
              <Boton variante="secundario" onClick={cargarMas} cargando={cargandoMas}>
                Cargar más
              </Boton>
            </div>
          )}
        </div>
      )}

      <ProductoFormModal
        abierto={formAbierto}
        producto={formProducto}
        codigoInicial={formCodigo}
        onCerrar={alCerrarForm}
        onGuardado={alGuardado}
      />
    </div>
  );
}