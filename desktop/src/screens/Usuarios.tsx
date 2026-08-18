import { KeyRound, Pause, Play, Plus, UserRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { actualizarUsuario, crearUsuario, getUsuarios } from '../api/auth';
import type { UserOut } from '../api/types';
import { Boton, Campo, Chip, ErrorBox, Modal, Spinner, Vacio } from '../components/ui';

const ROLES = ['admin', 'inventario', 'ventas'];

export function Usuarios() {
  const [usuarios, setUsuarios] = useState<UserOut[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [passwordAbierto, setPasswordAbierto] = useState<UserOut | null>(null);
  const [cargandoAccion, setCargandoAccion] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setUsuarios(await getUsuarios());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los usuarios');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const actualizar = async (id: number, update: { rol?: string; activo?: boolean; password?: string }) => {
    setCargandoAccion(id);
    try {
      await actualizarUsuario(id, update);
      await cargar();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo actualizar el usuario');
    } finally {
      setCargandoAccion(null);
    }
  };

  const alternarActivo = (u: UserOut) => {
    const accion = u.activo ? 'desactivar' : 'reactivar';
    if (!window.confirm(`¿${accion === 'desactivar' ? 'Desactivar' : 'Reactivar'} a "${u.username}"?`)) return;
    void actualizar(u.id, { activo: !u.activo });
  };

  return (
    <div className="tarjeta">
      <div className="inventario-cabecera">
        <div>
          <h2>Usuarios</h2>
          <p className="sub">{usuarios.length} cuenta(s)</p>
        </div>
        <Boton onClick={() => setNuevoAbierto(true)}>
          <Plus size={17} /> Nuevo usuario
        </Boton>
      </div>

      {error && <ErrorBox mensaje={error} onReintentar={() => void cargar()} />}

      {cargando ? (
        <Spinner texto="Cargando usuarios…" />
      ) : usuarios.length === 0 ? (
        <Vacio mensaje="Aún no hay usuarios." />
      ) : (
        <div className="usuarios-lista">
          {usuarios.map((u) => (
            <div className="usuario-fila" key={u.id}>
              <div className={`usuario-avatar${u.activo ? '' : ' inactivo'}`}>
                <UserRound size={18} />
              </div>
              <div className="usuario-info">
                <strong>
                  {u.username}
                  {!u.activo && <span className="pill pill-inactivo" style={{ marginLeft: 8 }}>Desactivado</span>}
                </strong>
                <span>{u.rol}</span>
              </div>
              <div className="chips">
                {ROLES.map((rol) => (
                  <Chip
                    key={rol}
                    activo={u.rol === rol}
                    onClick={() => {
                      if (u.rol !== rol && window.confirm(`¿Cambiar el rol de "${u.username}" a ${rol}?`)) {
                        void actualizar(u.id, { rol });
                      }
                    }}
                  >
                    {rol}
                  </Chip>
                ))}
              </div>
              <button
                className="boton-ocular"
                title="Cambiar contraseña"
                onClick={() => setPasswordAbierto(u)}
              >
                <KeyRound size={16} />
              </button>
              <button
                className="boton-ocular"
                title={u.activo ? 'Desactivar' : 'Reactivar'}
                disabled={cargandoAccion === u.id}
                onClick={() => alternarActivo(u)}
              >
                {u.activo ? <Pause size={16} /> : <Play size={16} />}
              </button>
            </div>
          ))}
        </div>
      )}

      <ModalNuevoUsuario
        abierto={nuevoAbierto}
        onCerrar={() => setNuevoAbierto(false)}
        onCreado={() => {
          setNuevoAbierto(false);
          void cargar();
        }}
      />
      <ModalPassword
        usuario={passwordAbierto}
        onCerrar={() => setPasswordAbierto(null)}
        onCambiada={() => {
          setPasswordAbierto(null);
        }}
      />
    </div>
  );
}

function ModalNuevoUsuario({
  abierto,
  onCerrar,
  onCreado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onCreado: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('inventario');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (abierto) {
      setUsername('');
      setPassword('');
      setRol('inventario');
      setError(null);
    }
  }, [abierto]);

  const guardar = async () => {
    if (!username.trim() || password.length < 6) {
      setError('Usuario obligatorio y contraseña de al menos 6 caracteres.');
      return;
    }
    setCargando(true);
    setError(null);
    try {
      await crearUsuario(username.trim(), password, rol);
      onCreado();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el usuario');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Nuevo usuario">
      <label className="login-etiqueta" htmlFor="nu-user">Usuario</label>
      <Campo id="nu-user" icono={<UserRound size={17} />} valor={username} onChange={setUsername} placeholder="usuario" />

      <label className="login-etiqueta" htmlFor="nu-pass">Contraseña</label>
      <Campo id="nu-pass" type="password" valor={password} onChange={setPassword} placeholder="Mínimo 6 caracteres" />

      <label className="login-etiqueta">Rol</label>
      <div className="chips">
        {ROLES.map((r) => (
          <Chip key={r} activo={rol === r} onClick={() => setRol(r)}>
            {r}
          </Chip>
        ))}
      </div>

      {error && <div className="error-burbuja">{error}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <Boton onClick={guardar} cargando={cargando} style={{ flex: 1 }}>
          Crear usuario
        </Boton>
        <Boton variante="secundario" onClick={onCerrar}>
          Cancelar
        </Boton>
      </div>
    </Modal>
  );
}

function ModalPassword({
  usuario,
  onCerrar,
  onCambiada,
}: {
  usuario: UserOut | null;
  onCerrar: () => void;
  onCambiada: () => void;
}) {
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (usuario) {
      setPassword('');
      setError(null);
    }
  }, [usuario]);

  const guardar = async () => {
    if (!usuario || password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setCargando(true);
    setError(null);
    try {
      await actualizarUsuario(usuario.id, { password });
      window.alert('Contraseña actualizada.');
      onCambiada();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal abierto={!!usuario} onCerrar={onCerrar} titulo={`Nueva contraseña · ${usuario?.username ?? ''}`}>
      <label className="login-etiqueta" htmlFor="pw">Contraseña</label>
      <Campo id="pw" type="password" valor={password} onChange={setPassword} placeholder="Mínimo 6 caracteres" />
      {error && <div className="error-burbuja">{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <Boton onClick={guardar} cargando={cargando} style={{ flex: 1 }}>
          Cambiar contraseña
        </Boton>
        <Boton variante="secundario" onClick={onCerrar}>
          Cancelar
        </Boton>
      </div>
    </Modal>
  );
}