import { motion } from 'framer-motion';
import { Barcode, CreditCard, Landmark, ScanLine, ShoppingCart, Smartphone, Trash2, Wallet } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { buscarProductoPorCodigo } from '../api/productos';
import { getRecibo, registrarVenta } from '../api/ventas';
import type { MetodoPago, Producto, ReciboOut } from '../api/types';
import { ReciboModal } from '../components/Recibo';
import { Boton, Cantidad, formatearMoneda } from '../components/ui';

interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}

const METODOS: { id: MetodoPago; etiqueta: string; icono: React.ElementType }[] = [
  { id: 'efectivo', etiqueta: 'Efectivo', icono: Wallet },
  { id: 'tarjeta', etiqueta: 'Tarjeta', icono: CreditCard },
  { id: 'transferencia', etiqueta: 'Transferencia', icono: Landmark },
  { id: 'yape', etiqueta: 'Yape', icono: Smartphone },
];

// Notifica a AppShell cuántos productos hay en el carrito (para avisar antes
// de navegar a otra pantalla y perder el carrito sin cobrar).
type ListenerCarrito = (n: number) => void;
const listenersCarrito = new Set<ListenerCarrito>();

export function onCarritoCambio(listener: ListenerCarrito): () => void {
  listenersCarrito.add(listener);
  return () => {
    listenersCarrito.delete(listener);
  };
}

export function PuntoVenta() {
  const [items, setItems] = useState<ItemCarrito[]>([]);
  const [codigo, setCodigo] = useState('');
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recibo, setRecibo] = useState<ReciboOut | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cobrandoRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    listenersCarrito.forEach((l) => l(items.length));
  }, [items]);

  const agregar = useCallback((producto: Producto) => {
    setItems((prev) => {
      const existente = prev.find((i) => i.producto.id === producto.id);
      if (existente) {
        return prev.map((i) =>
          i.producto.id === producto.id
            ? { ...i, cantidad: Math.min(i.cantidad + 1, i.producto.stock) }
            : i,
        );
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  }, []);

  const manejarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo.trim()) return;
    setError(null);
    try {
      const producto = await buscarProductoPorCodigo(codigo.trim());
      if (!producto) {
        setError('Producto no registrado con ese código.');
      } else if (!producto.activo) {
        setError('Ese producto está desactivado.');
      } else if (producto.stock < 1) {
        setError('Ese producto no tiene stock.');
      } else {
        agregar(producto);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar el producto');
    }
    setCodigo('');
    inputRef.current?.focus();
  };

  const cambiarCantidad = (id: number, cantidad: number) => {
    setItems((prev) => prev.map((i) => (i.producto.id === id ? { ...i, cantidad } : i)));
  };

  const eliminar = (id: number) => {
    setItems((prev) => prev.filter((i) => i.producto.id !== id));
  };

  const total = Math.round(
    items.reduce((acc, i) => acc + i.producto.precio_venta * i.cantidad, 0) * 100,
  ) / 100;

  const cobrar = async () => {
    // Candado síncrono: el doble clic (o Enter) no puede crear dos ventas
    if (items.length === 0 || cobrandoRef.current) return;
    cobrandoRef.current = true;
    setCargando(true);
    setError(null);
    try {
      const venta = await registrarVenta({
        metodo_pago: metodo,
        detalles: items.map((i) => ({ producto_id: i.producto.id, cantidad: i.cantidad })),
      });
      // La venta YA se registró: se limpia el carrito de inmediato para que
      // un fallo al cargar el recibo (red) no produzca una segunda venta.
      setItems([]);
      setMetodo('efectivo');
      try {
        setRecibo(await getRecibo(venta.id));
      } catch {
        setError('Venta registrada, pero no se pudo cargar el recibo. Revisa Historial.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la venta');
    } finally {
      cobrandoRef.current = false;
      setCargando(false);
    }
  };

  return (
    <div className="pos-grid">
      <div className="pos-izquierda">
        <div className="tarjeta pos-codigo">
          <h2>Punto de venta</h2>
          <p className="sub">
            Escanea con tu lector USB o escribe el código y presiona Enter.
          </p>
          <form onSubmit={manejarCodigo} className="codigo-form">
            <div className="campo">
              <ScanLine size={18} />
              <input
                ref={inputRef}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Código de barras…"
                autoFocus
                onBlur={() => {
                  // El lector USB escribe en el elemento con foco: si se pierde
                  // (clic en el carrito), el Enter del lector dispararía el botón
                  // enfocado. El foco vuelve al campo del código.
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
              />
            </div>
            <Boton type="submit" deshabilitado={cargando}>
              <Barcode size={17} /> Agregar
            </Boton>
          </form>
          {error && <div className="error-burbuja">{error}</div>}
        </div>

        <div className="tarjeta pos-metodos">
          <h3>Método de pago</h3>
          <div className="chips">
            {METODOS.map(({ id, etiqueta, icono: Icono }) => (
              <button
                key={id}
                className={`chip metodo-chip${metodo === id ? ' activo' : ''}`}
                onClick={() => setMetodo(id)}
              >
                <Icono size={16} /> {etiqueta}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pos-derecha">
        <div className="tarjeta pos-carrito">
          <div className="carrito-cabecera">
            <h3>
              <ShoppingCart size={17} /> Carrito ({items.length})
            </h3>
          </div>

          {items.length === 0 ? (
            <div className="vacio" style={{ padding: '32px 0' }}>
              <ShoppingCart size={34} />
              <p>El carrito está vacío. Escanea o escribe un código.</p>
            </div>
          ) : (
            <div className="carrito-lista">
              {items.map((i) => (
                <motion.div
                  key={i.producto.id}
                  className="carrito-item"
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="carrito-info">
                    <strong>{i.producto.nombre}</strong>
                    <span>
                      {formatearMoneda(i.producto.precio_venta)} · stock {i.producto.stock}
                    </span>
                  </div>
                  <Cantidad
                    valor={i.cantidad}
                    max={i.producto.stock}
                    onChange={(v) => cambiarCantidad(i.producto.id, v)}
                  />
                  <span className="carrito-subtotal">{formatearMoneda(i.producto.precio_venta * i.cantidad)}</span>
                  <button
                    className="boton-ocular"
                    onClick={() => eliminar(i.producto.id)}
                    aria-label="Quitar del carrito"
                  >
                    <Trash2 size={16} />
                  </button>
                </motion.div>
              ))}
            </div>
          )}

          <div className="carrito-total">
            <span>TOTAL</span>
            <strong>{formatearMoneda(total)}</strong>
          </div>
          <Boton
            onClick={cobrar}
            cargando={cargando}
            deshabilitado={items.length === 0}
            className="cobrar"
          >
            <Wallet size={18} /> COBRAR · {formatearMoneda(total)}
          </Boton>
        </div>
      </div>

      <ReciboModal abierto={!!recibo} recibo={recibo} onCerrar={() => setRecibo(null)} />
    </div>
  );
}