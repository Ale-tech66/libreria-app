import { BookOpen, ImagePlus, Loader2, ScanLine } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { actualizarProducto, crearProducto, subirFotoProducto, urlFoto } from '../api/productos';
import type { Producto } from '../api/types';
import { Boton, Campo, Modal } from './ui';

interface ProductoFormProps {
  abierto: boolean;
  producto: Producto | null;
  codigoInicial?: string;
  onCerrar: () => void;
  onGuardado: (producto: Producto) => void;
}

export function ProductoFormModal({ abierto, producto, codigoInicial, onCerrar, onGuardado }: ProductoFormProps) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [autor, setAutor] = useState('');
  const [editorial, setEditorial] = useState('');
  const [precio, setPrecio] = useState('');
  const [stock, setStock] = useState('');
  const [unidadesCaja, setUnidadesCaja] = useState('1');
  const [foto, setFoto] = useState<string | null>(null);
  const [archivo, setArchivo] = useState<Blob | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const fotoUrlRef = useRef<string | null>(null);

  const revocarFoto = () => {
    if (fotoUrlRef.current) {
      URL.revokeObjectURL(fotoUrlRef.current);
      fotoUrlRef.current = null;
    }
  };

  useEffect(() => {
    if (!abierto) return;
    revocarFoto();
    setError(null);
    setFoto(null);
    setArchivo(null);
    if (producto) {
      setCodigo(producto.codigo_barras);
      setNombre(producto.nombre);
      setAutor(producto.autor ?? '');
      setEditorial(producto.editorial ?? '');
      setPrecio(String(producto.precio_venta));
      setStock(String(producto.stock));
      setUnidadesCaja(String(producto.unidades_por_caja));
    } else {
      setCodigo(codigoInicial ?? '');
      setNombre('');
      setAutor('');
      setEditorial('');
      setPrecio('');
      setStock('');
      setUnidadesCaja('1');
    }
  }, [abierto, producto, codigoInicial]);

  const elegirFoto = () => {
    inputArchivoRef.current?.click();
  };

  const alElegirArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arch = e.target.files?.[0];
    if (!arch) return;
    revocarFoto();
    const url = URL.createObjectURL(arch);
    fotoUrlRef.current = url;
    setArchivo(arch);
    setFoto(url);
  };

  const guardar = async () => {
    if (cargando) return;
    setCargando(true);
    setError(null);
    try {
      const payload = {
        codigo_barras: codigo.trim(),
        nombre: nombre.trim(),
        autor: autor.trim() || null,
        editorial: editorial.trim() || null,
        precio_venta: Number(precio),
        stock: Math.max(0, Math.floor(Number(stock) || 0)),
        unidades_por_caja: Math.max(1, Math.floor(Number(unidadesCaja) || 1)),
        activo: producto?.activo ?? true,
      };
      const guardado = producto
        ? await actualizarProducto(producto.id, payload)
        : await crearProducto(payload);
      if (archivo) {
        await subirFotoProducto(guardado.id, archivo);
        guardado.foto = `foto-${guardado.id}.jpg`;
      }
      onGuardado(guardado);
      onCerrar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el producto');
    } finally {
      setCargando(false);
    }
  };

  useEffect(
    () => () => {
      revocarFoto();
    },
    [],
  );

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={producto ? 'Editar producto' : 'Nuevo producto'}
      ancho={560}
    >
      <div className="form-grid">
        <div className="form-foto">
          {foto ? (
            <img src={foto} alt="Foto del producto" />
          ) : producto && urlFoto(producto.foto) ? (
            <img src={urlFoto(producto.foto)!} alt={producto.nombre} />
          ) : (
            <div className="form-foto-vacio">
              <BookOpen size={36} />
            </div>
          )}
          <button type="button" className="boton boton-secundario form-foto-boton" onClick={elegirFoto}>
            <ImagePlus size={15} /> Foto
          </button>
          <input ref={inputArchivoRef} type="file" accept="image/*" hidden onChange={alElegirArchivo} />
        </div>

        <div className="form-campos">
          <label className="login-etiqueta">Código de barras</label>
          <Campo icono={<ScanLine size={17} />} valor={codigo} onChange={setCodigo} placeholder="Código del producto" />

          <label className="login-etiqueta">Nombre *</label>
          <Campo icono={<BookOpen size={17} />} valor={nombre} onChange={setNombre} placeholder="Ej. Cien años de soledad" />

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="login-etiqueta">Autor</label>
              <Campo valor={autor} onChange={setAutor} placeholder="Autor" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="login-etiqueta">Editorial</label>
              <Campo valor={editorial} onChange={setEditorial} placeholder="Editorial" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="login-etiqueta">Precio de venta *</label>
              <Campo valor={precio} onChange={setPrecio} placeholder="0.00" type="number" inputMode="numeric" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="login-etiqueta">Stock *</label>
              <Campo valor={stock} onChange={setStock} placeholder="0" type="number" inputMode="numeric" />
            </div>
            <div style={{ flex: 1 }}>
              <label className="login-etiqueta">Unid. por caja</label>
              <Campo valor={unidadesCaja} onChange={setUnidadesCaja} placeholder="1" type="number" inputMode="numeric" />
            </div>
          </div>

          {error && <div className="error-burbuja">{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <Boton onClick={guardar} cargando={cargando} style={{ flex: 1 }}>
              {cargando && <Loader2 size={17} className="spinner" />}
              {producto ? 'Guardar cambios' : 'Crear producto'}
            </Boton>
            <Boton variante="secundario" onClick={onCerrar}>
              Cancelar
            </Boton>
          </div>
        </div>
      </div>
    </Modal>
  );
}