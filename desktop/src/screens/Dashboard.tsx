import { motion } from 'framer-motion';
import { BookOpen, History, ShoppingCart, Store } from 'lucide-react';

import { useAuth } from '../context/AuthContext';

export function Dashboard({ irA }: { irA: (seccion: string) => void }) {
  const { sesion } = useAuth();
  const rol = sesion?.usuario.rol;
  const esAdmin = rol === 'admin';

  const acciones = [
    {
      id: 'ventas',
      etiqueta: 'Punto de venta',
      descripcion: 'Cobrar con escáner o teclado',
      icono: ShoppingCart,
      visible: esAdmin || rol === 'ventas',
    },
    {
      id: 'inventario',
      etiqueta: 'Inventario',
      descripcion: 'Productos, fotos y stock',
      icono: BookOpen,
      visible: true,
    },
    {
      id: 'historial',
      etiqueta: 'Historial',
      descripcion: 'Ventas y recibos',
      icono: History,
      visible: esAdmin,
    },
  ];

  return (
    <div>
      <motion.div
        className="tarjeta bienvenida"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="bienvenida-icono">
          <Store size={26} />
        </div>
        <div>
          <h2>¡Bienvenido, {sesion?.usuario.username}!</h2>
          <p className="sub">
            {sesion?.usuario.organizacion ? sesion.usuario.organizacion : 'Tu negocio'} · Rol:{' '}
            <span className="pill-rol">{rol}</span>
          </p>
        </div>
      </motion.div>

      <div className="dashboard-acciones">
        {acciones
          .filter((a) => a.visible)
          .map((a, i) => (
            <motion.button
              key={a.id}
              className="tarjeta accion"
              onClick={() => irA(a.id)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.08 * (i + 1) }}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
            >
              <a.icono size={24} />
              <strong>{a.etiqueta}</strong>
              <span>{a.descripcion}</span>
            </motion.button>
          ))}
      </div>
    </div>
  );
}