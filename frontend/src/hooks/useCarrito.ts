import { useCallback, useMemo, useState } from 'react';

import { registrarVenta } from '../api/ventas';
import { CarritoItem, MetodoPago, Producto, Venta } from '../types';

export function useCarrito() {
  const [items, setItems] = useState<CarritoItem[]>([]);
  const [cobrando, setCobrando] = useState(false);

  const agregar = useCallback((producto: Producto) => {
    setItems((prev) => {
      const existente = prev.find((item) => item.producto_id === producto.id);
      if (existente) {
        if (existente.cantidad >= existente.stock) {
          return prev; // Sin stock disponible
        }
        return prev.map((item) =>
          item.producto_id === producto.id
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        );
      }
      if (producto.stock < 1) return prev;
      return [
        ...prev,
        {
          producto_id: producto.id,
          nombre: producto.nombre,
          cantidad: 1,
          precio_unitario: producto.precio_venta,
          stock: producto.stock,
        },
      ];
    });
  }, []);

  const cambiarCantidad = useCallback((productoId: number, cantidad: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.producto_id === productoId
          ? { ...item, cantidad: Math.min(Math.max(1, cantidad), item.stock) }
          : item
      )
    );
  }, []);

  const eliminar = useCallback((productoId: number) => {
    setItems((prev) => prev.filter((item) => item.producto_id !== productoId));
  }, []);

  const limpiar = useCallback(() => setItems([]), []);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.cantidad * item.precio_unitario, 0),
    [items]
  );

  const cobrar = useCallback(
    async (metodoPago: MetodoPago = 'efectivo'): Promise<Venta> => {
      setCobrando(true);
      try {
        const venta = await registrarVenta({
          metodo_pago: metodoPago,
          detalles: items.map(({ producto_id, cantidad }) => ({ producto_id, cantidad })),
        });
        setItems([]);
        return venta;
      } finally {
        setCobrando(false);
      }
    },
    [items]
  );

  return { items, total, cobrando, agregar, cambiarCantidad, eliminar, limpiar, cobrar };
}