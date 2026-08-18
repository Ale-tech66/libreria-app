import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Loader2, Minus, Plus, RefreshCw, X } from 'lucide-react';
import type { ReactNode } from 'react';

export function Spinner({ texto }: { texto?: string }) {
  return (
    <div className="centrado">
      <Loader2 size={30} className="spinner" />
      {texto && <p className="centrado-texto">{texto}</p>}
    </div>
  );
}

export function ErrorBox({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  return (
    <div className="error-caja">
      <AlertTriangle size={18} />
      <span>{mensaje}</span>
      {onReintentar && (
        <button className="enlace" onClick={onReintentar} style={{ marginLeft: 'auto' }}>
          <RefreshCw size={13} /> Reintentar
        </button>
      )}
    </div>
  );
}

export function Vacio({ mensaje }: { mensaje: string }) {
  return (
    <div className="vacio">
      <p>{mensaje}</p>
    </div>
  );
}

interface BotonProps {
  children: ReactNode;
  variante?: 'primario' | 'secundario' | 'peligro' | 'fantasma';
  cargando?: boolean;
  deshabilitado?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  className?: string;
  style?: React.CSSProperties;
}

export function Boton({ children, variante = 'primario', cargando, deshabilitado, onClick, type, className, style }: BotonProps) {
  return (
    <button
      className={`boton boton-${variante}${className ? ` ${className}` : ''}`}
      disabled={deshabilitado || cargando}
      onClick={onClick}
      type={type ?? 'button'}
      style={style}
    >
      {cargando && <Loader2 size={17} className="spinner" />}
      {children}
    </button>
  );
}

interface CampoProps {
  icono?: ReactNode;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  id?: string;
  autoFocus?: boolean;
  required?: boolean;
  inputMode?: 'text' | 'numeric' | 'email';
  maxLength?: number;
  error?: boolean;
  className?: string;
  autoCompletar?: string;
}

export function Campo({ icono, valor, onChange, placeholder, type, id, autoFocus, required, inputMode, maxLength, error, className, autoCompletar }: CampoProps) {
  return (
    <div className={`campo${error ? ' campo-error' : ''}${className ? ` ${className}` : ''}`}>
      {icono}
      <input
        id={id}
        type={type ?? 'text'}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        required={required}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoCompletar}
      />
    </div>
  );
}

interface ChipProps {
  activo?: boolean;
  onClick?: () => void;
  children: ReactNode;
  titulo?: string;
}

export function Chip({ activo, onClick, children, titulo }: ChipProps) {
  return (
    <button type="button" className={`chip${activo ? ' activo' : ''}`} onClick={onClick} title={titulo}>
      {children}
    </button>
  );
}

interface ModalProps {
  abierto: boolean;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: number;
  titulo?: string;
}

export function Modal({ abierto, onCerrar, children, ancho = 520, titulo }: ModalProps) {
  return (
    <AnimatePresence>
      {abierto && (
        <motion.div
          className="modal-fondo"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onCerrar();
          }}
        >
          <motion.div
            className="modal-caja"
            style={{ maxWidth: ancho }}
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 24 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            {titulo && (
              <div className="modal-cabecera">
                <strong>{titulo}</strong>
                <button className="boton-ocular" onClick={onCerrar} aria-label="Cerrar">
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="modal-cuerpo">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface CantidadProps {
  valor: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}

export function Cantidad({ valor, min = 1, max, onChange }: CantidadProps) {
  const cambiar = (delta: number) => {
    const nuevo = Math.max(min, Math.min(max ?? Infinity, valor + delta));
    onChange(nuevo);
  };
  return (
    <div className="cantidad">
      <button type="button" onClick={() => cambiar(-1)} disabled={valor <= min} aria-label="Disminuir">
        <Minus size={14} />
      </button>
      <span>{valor}</span>
      <button type="button" onClick={() => cambiar(1)} disabled={max !== undefined && valor >= max} aria-label="Aumentar">
        <Plus size={14} />
      </button>
    </div>
  );
}

export function tituloRecurso(recurso: string): string {
  return recurso.charAt(0).toUpperCase() + recurso.slice(1);
}

export function formatearFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatearMoneda(valor: number): string {
  return `$${valor.toFixed(2)}`;
}