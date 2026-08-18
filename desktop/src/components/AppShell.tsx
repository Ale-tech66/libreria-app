import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  History,
  LayoutDashboard,
  LogOut,
  Palette,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { Auditoria } from '../screens/Auditoria';
import { Ajustes } from '../screens/Ajustes';
import { Dashboard } from '../screens/Dashboard';
import { Historial } from '../screens/Historial';
import { Inventario } from '../screens/Inventario';
import { onCarritoCambio, PuntoVenta } from '../screens/PuntoVenta';
import { Reportes } from '../screens/Reportes';
import { Usuarios } from '../screens/Usuarios';

type Pantalla = 'inicio' | 'ventas' | 'inventario' | 'historial' | 'reportes' | 'usuarios' | 'auditoria' | 'ajustes';

interface ItemNav {
  id: Pantalla;
  etiqueta: string;
  icono: React.ElementType;
  soloAdmin?: boolean;
}

const NAV: ItemNav[] = [
  { id: 'inicio', etiqueta: 'Inicio', icono: LayoutDashboard },
  { id: 'ventas', etiqueta: 'Punto de venta', icono: ShoppingCart },
  { id: 'inventario', etiqueta: 'Inventario', icono: BookOpen },
  { id: 'historial', etiqueta: 'Historial', icono: History, soloAdmin: true },
  { id: 'reportes', etiqueta: 'Reportes', icono: Palette, soloAdmin: true },
  { id: 'usuarios', etiqueta: 'Usuarios', icono: Users, soloAdmin: true },
  { id: 'auditoria', etiqueta: 'Auditoría', icono: ShieldCheck, soloAdmin: true },
  { id: 'ajustes', etiqueta: 'Ajustes', icono: Settings },
];

export function AppShell() {
  const { sesion, cerrar } = useAuth();
  const esAdmin = sesion?.usuario.rol === 'admin';
  const [pantalla, setPantalla] = useState<Pantalla>('inicio');
  const [itemsCarrito, setItemsCarrito] = useState(0);

  useEffect(() => onCarritoCambio(setItemsCarrito), []);

  const navegar = (id: Pantalla) => {
    if (pantalla === 'ventas' && id !== 'ventas' && itemsCarrito > 0) {
      const salir = window.confirm(
        `Tienes ${itemsCarrito} producto(s) en el carrito sin cobrar. ¿Salir igualmente? Se perderá el carrito.`,
      );
      if (!salir) return;
    }
    setPantalla(id);
  };

  const items = NAV.filter((n) => !n.soloAdmin || esAdmin);

  return (
    <div className="app-cuerpo">
      <header className="app-bar">
        <div className="app-titulo">
          <BookOpen size={18} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 8 }} />
          Librería App
        </div>
        <div className="app-usuario">
          <span>
            {sesion?.usuario.username} · <span className="pill-rol">{sesion?.usuario.rol}</span>
          </span>
          <button className="boton-ocular" onClick={() => void cerrar()} title="Cerrar sesión" aria-label="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="app-contenido">
        <nav className="app-nav">
          {items.map(({ id, etiqueta, icono: Icono }) => (
            <button
              key={id}
              className={`nav-item${pantalla === id ? ' activo' : ''}`}
              onClick={() => navegar(id)}
            >
              <Icono size={17} />
              {etiqueta}
            </button>
          ))}
        </nav>

        <main className="app-pantalla">
          <AnimatePresence mode="wait">
            <motion.div
              key={pantalla}
              className="pantalla-caja"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {pantalla === 'inicio' && <Dashboard irA={(s) => navegar(s as Pantalla)} />}
              {pantalla === 'ventas' && <PuntoVenta />}
              {pantalla === 'inventario' && <Inventario />}
              {pantalla === 'historial' && esAdmin && <Historial />}
              {pantalla === 'reportes' && esAdmin && <Reportes />}
              {pantalla === 'usuarios' && esAdmin && <Usuarios />}
              {pantalla === 'auditoria' && esAdmin && <Auditoria />}
              {pantalla === 'ajustes' && <Ajustes />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}