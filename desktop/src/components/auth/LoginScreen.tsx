import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  AtSign,
  BookOpen,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Store,
  User,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';

import {
  login,
  mfaConfirmar,
  recuperar,
  recuperarConfirmar,
  reenviarCodigo,
  registrar,
  verificarCodigo,
} from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { IlustracionLibreria } from './IlustracionLibreria';

type Modo = 'login' | 'registro' | 'recuperar' | 'mfa' | 'codigo';

interface LoginScreenProps {
  onEntrar: () => void;
}

export function LoginScreen({ onEntrar }: LoginScreenProps) {
  const { iniciar } = useAuth();
  const [modo, setModo] = useState<Modo>('login');
  const [pasoRecuperar, setPasoRecuperar] = useState<'usuario' | 'codigo'>('usuario');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);

  const [mfaToken, setMfaToken] = useState('');
  const [codigoMfa, setCodigoMfa] = useState('');
  const [codigoRecuperacion, setCodigoRecuperacion] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');

  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCorreo, setRegCorreo] = useState('');
  const [regNombreNegocio, setRegNombreNegocio] = useState('');
  const [regTipoNegocio, setRegTipoNegocio] = useState('');
  const [regTelefono, setRegTelefono] = useState('');
  const [regPais, setRegPais] = useState('');

  const [codigoVerif, setCodigoVerif] = useState('');

  const alternarModo = (nuevo: Modo) => {
    setModo(nuevo);
    setError(null);
    setExito(null);
  };

  const manejarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cargando) return;
    setCargando(true);
    setError(null);
    try {
      const resultado = await login(username.trim(), password);
      if (resultado.mfa_required && resultado.mfa_token) {
        setMfaToken(resultado.mfa_token);
        setCodigoMfa('');
        setModo('mfa');
      } else if (resultado.access_token && resultado.refresh_token) {
        await iniciar({
          access_token: resultado.access_token,
          refresh_token: resultado.refresh_token,
          token_type: 'bearer',
        });
        onEntrar();
      } else {
        setError('Respuesta inesperada del servidor');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setCargando(false);
    }
  };

  const manejarMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cargando) return;
    setCargando(true);
    setError(null);
    try {
      const tokens = await mfaConfirmar(mfaToken, codigoMfa.trim());
      await iniciar(tokens);
      onEntrar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código incorrecto');
    } finally {
      setCargando(false);
    }
  };

  const manejarRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cargando) return;
    setCargando(true);
    setError(null);
    try {
      const resultado = await registrar({
        username: regUsername.trim(),
        password: regPassword,
        nombre_negocio: regNombreNegocio.trim() || undefined,
        tipo_negocio: regTipoNegocio.trim() || undefined,
        correo: regCorreo.trim() || undefined,
        telefono: regTelefono.trim() || undefined,
        pais: regPais.trim() || undefined,
      });
      if (resultado.requiere_verificacion) {
        setCodigoVerif('');
        setModo('codigo');
        setExito('Te enviamos un código a tu correo. Revísalo para activar tu cuenta.');
      } else {
        setExito('Cuenta creada. Ya puedes iniciar sesión.');
        setTimeout(() => alternarModo('login'), 1600);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrarte');
    } finally {
      setCargando(false);
    }
  };

  const manejarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cargando) return;
    setCargando(true);
    setError(null);
    try {
      await verificarCodigo(regUsername.trim(), codigoVerif.trim());
      setExito('Cuenta activada. Ya puedes iniciar sesión.');
      setTimeout(() => alternarModo('login'), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código incorrecto');
    } finally {
      setCargando(false);
    }
  };

  const manejarSolicitarRecuperacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cargando) return;
    setCargando(true);
    setError(null);
    try {
      await recuperar(username.trim());
      setPasoRecuperar('codigo');
      setExito('Te enviamos un código de recuperación a tu correo.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al solicitar la recuperación');
    } finally {
      setCargando(false);
    }
  };

  const manejarNuevaPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cargando) return;
    setCargando(true);
    setError(null);
    try {
      await recuperarConfirmar(username.trim(), codigoRecuperacion.trim(), nuevaPassword);
      setExito('Contraseña actualizada. Ya puedes iniciar sesión.');
      setTimeout(() => alternarModo('login'), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña');
    } finally {
      setCargando(false);
    }
  };

  const panelIzquierda = () => {
    switch (modo) {
      case 'login':
        return (
          <form onSubmit={manejarLogin} style={{ width: '100%' }}>
            <label className="login-etiqueta" htmlFor="login-user">
              Usuario
            </label>
            <div className="campo">
              <User size={18} />
              <input
                id="login-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tu usuario"
                autoFocus
                required
              />
            </div>

            <label className="login-etiqueta" htmlFor="login-pass">
              Contraseña
            </label>
            <div className="campo">
              <Lock size={18} />
              <input
                id="login-pass"
                type={verPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                required
              />
              <button
                type="button"
                className="boton-ocular"
                onClick={() => setVerPassword((v) => !v)}
                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && <div className="error-burbuja">{error}</div>}

            <button className="boton-primario" disabled={cargando} type="submit">
              {cargando ? <Loader2 size={18} className="spinner" /> : <LogInIcono />}
              Iniciar sesión
            </button>

            <div className="login-pie">
              <button type="button" className="enlace" onClick={() => alternarModo('recuperar')}>
                ¿Olvidaste tu contraseña?
              </button>
              <button
                type="button"
                className="enlace"
                onClick={() => {
                  setExito(null);
                  setModo('registro');
                }}
              >
                Registrarme
              </button>
            </div>
          </form>
        );

      case 'recuperar':
        if (pasoRecuperar === 'usuario') {
          return (
            <form onSubmit={manejarSolicitarRecuperacion} style={{ width: '100%' }}>
              <h2 className="login-titulo" style={{ fontSize: 24 }}>
                Recuperar contraseña
              </h2>
              <p className="login-subtitulo">
                Escribe tu usuario y te enviaremos un código de 6 dígitos a tu correo.
              </p>

              <label className="login-etiqueta" htmlFor="rec-user">
                Usuario
              </label>
              <div className="campo">
                <User size={18} />
                <input
                  id="rec-user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Tu usuario"
                  autoFocus
                  required
                />
              </div>

{error && <div className="error-burbuja">{error}</div>}
              {exito && <div className="exito-burbuja">{exito}</div>}

              <button className="boton-primario" disabled={cargando} type="submit">
                {cargando && <Loader2 size={18} className="spinner" />}
                Cambiar contraseña
              </button>

              <div className="login-pie">
                <button type="button" className="enlace" onClick={() => alternarModo('login')}>
                  Volver a iniciar sesión
                </button>
              </div>
            </form>
          );
        }
        return (
          <form onSubmit={manejarNuevaPassword} style={{ width: '100%' }}>
            <h2 className="login-titulo" style={{ fontSize: 24 }}>
              Recuperar contraseña
            </h2>
            <p className="login-subtitulo">
              Escribe el código que enviamos a tu correo y define una contraseña nueva.
            </p>

            <label className="login-etiqueta" htmlFor="rec-codigo">
              Código de 6 dígitos
            </label>
            <div className="campo">
              <KeyRound size={18} />
              <input
                id="rec-codigo"
                value={codigoRecuperacion}
                onChange={(e) => setCodigoRecuperacion(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                maxLength={6}
                required
              />
            </div>

            <label className="login-etiqueta" htmlFor="rec-pass">
              Contraseña nueva
            </label>
            <div className="campo">
              <Lock size={18} />
              <input
                id="rec-pass"
                type={verPassword ? 'text' : 'password'}
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
              />
              <button
                type="button"
                className="boton-ocular"
                onClick={() => setVerPassword((v) => !v)}
                aria-label="Mostrar u ocultar contraseña"
              >
                {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && <div className="error-burbuja">{error}</div>}
            {exito && <div className="exito-burbuja">{exito}</div>}

            <button className="boton-primario" disabled={cargando} type="submit">
              {cargando && <Loader2 size={18} className="spinner" />}
              Cambiar contraseña
            </button>

            <div className="login-pie">
              <button type="button" className="enlace" onClick={() => alternarModo('login')}>
                Volver a iniciar sesión
              </button>
            </div>
          </form>
        );

      case 'mfa':
        return (
          <form onSubmit={manejarMfa} style={{ width: '100%' }}>
            <h2 className="login-titulo" style={{ fontSize: 24 }}>
              Verificación en dos pasos
            </h2>
            <p className="login-subtitulo">
              Abre tu app de autenticación y escribe el código de 6 dígitos para {username}.
            </p>

            <label className="login-etiqueta" htmlFor="mfa-code">
              Código
            </label>
            <div className="campo">
              <KeyRound size={18} />
              <input
                id="mfa-code"
                value={codigoMfa}
                onChange={(e) => setCodigoMfa(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                required
              />
            </div>

            {error && <div className="error-burbuja">{error}</div>}

            <button className="boton-primario" disabled={cargando} type="submit">
              {cargando ? <Loader2 size={18} className="spinner" /> : <KeyRound size={18} />}
              Verificar
            </button>

            <div className="login-pie">
              <button type="button" className="enlace" onClick={() => alternarModo('login')}>
                Volver
              </button>
            </div>
          </form>
        );

      case 'registro':
      case 'codigo':
        return (
          <form onSubmit={manejarRegistro} style={{ width: '100%' }}>
            <h2 className="login-titulo" style={{ fontSize: 24 }}>
              ¡Bienvenido!
            </h2>
            <p className="login-subtitulo">Crea tu negocio y tu cuenta de administrador.</p>

            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <label className="login-etiqueta" htmlFor="reg-user">
                  Usuario
                </label>
                <div className="campo">
                  <User size={18} />
                  <input
                    id="reg-user"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="admin"
                    required
                  />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label className="login-etiqueta" htmlFor="reg-pass">
                  Contraseña
                </label>
                <div className="campo">
                  <Lock size={18} />
                  <input
                    id="reg-pass"
                    type={verPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Mínimo 6"
                    required
                  />
                </div>
              </div>
            </div>

            <label className="login-etiqueta" htmlFor="reg-negocio">
              Nombre del negocio
            </label>
            <div className="campo">
              <Store size={18} />
              <input
                id="reg-negocio"
                value={regNombreNegocio}
                onChange={(e) => setRegNombreNegocio(e.target.value)}
                placeholder="Mi Librería"
              />
            </div>

            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <label className="login-etiqueta" htmlFor="reg-tipo">
                  Tipo de negocio
                </label>
                <div className="campo">
                  <BookOpen size={18} />
                  <input
                    id="reg-tipo"
                    value={regTipoNegocio}
                    onChange={(e) => setRegTipoNegocio(e.target.value)}
                    placeholder="Librería"
                  />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label className="login-etiqueta" htmlFor="reg-pais">
                  País
                </label>
                <div className="campo">
                  <UserRound size={18} />
                  <input
                    id="reg-pais"
                    value={regPais}
                    onChange={(e) => setRegPais(e.target.value)}
                    placeholder="Perú"
                  />
                </div>
              </div>
            </div>

            <label className="login-etiqueta" htmlFor="reg-correo">
              Correo (para verificar tu cuenta)
            </label>
            <div className="campo">
              <Mail size={18} />
              <input
                id="reg-correo"
                type="email"
                value={regCorreo}
                onChange={(e) => setRegCorreo(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                required
              />
            </div>

            <label className="login-etiqueta" htmlFor="reg-tel">
              Teléfono (opcional)
            </label>
            <div className="campo">
              <AtSign size={18} />
              <input
                id="reg-tel"
                value={regTelefono}
                onChange={(e) => setRegTelefono(e.target.value)}
                placeholder="+51 999 999 999"
              />
            </div>

            {error && <div className="error-burbuja">{error}</div>}
            {exito && <div className="exito-burbuja">{exito}</div>}

            <button className="boton-primario" disabled={cargando} type="submit">
              {cargando && <Loader2 size={18} className="spinner" />}
              Crear cuenta
            </button>

            <div className="login-pie">
              <button type="button" className="enlace" onClick={() => alternarModo('login')}>
                Ya tengo una cuenta
              </button>
            </div>
          </form>
        );
    }
  };

  return (
    <div className="login-fondo">
      {/* ─── Izquierda: iniciar sesión ─── */}
      <div className="login-panel">
        <div className="login-marca">
          <BookOpen size={20} />
          Librería App
        </div>
        <div className="login-caja">
          <AnimatePresence mode="wait">
            <motion.div
              key={modo}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              {modo !== 'login' && (
                <button type="button" className="boton-regreso" onClick={() => alternarModo('login')}>
                  <ArrowLeft size={16} />
                  Volver
                </button>
              )}
              <h1 className="login-titulo" style={{ fontSize: 30 }}>
                {modo === 'mfa' ? 'Verificación' : 'Inicia sesión'}
              </h1>
              <p className="login-subtitulo">
                {modo === 'mfa'
                  ? 'Código de un solo uso de tu app de autenticación.'
                  : 'Punto de venta e inventario para tu librería.'}
              </p>
              {panelIzquierda()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ─── Derecha: imagen + registro ─── */}
      <div className="login-lado">
        <div className="login-lado-imagen">
          <IlustracionLibreria />
        </div>
        <div className="login-lado-velo" />

        <AnimatePresence mode="wait">
          {modo === 'registro' || modo === 'codigo' ? (
            <motion.div
              key="registro"
              initial={{ opacity: 0, x: 160, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 160, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            >
              <div className="registro-panel">
                <h3>{modo === 'codigo' ? 'Verifica tu correo' : 'Crea tu cuenta'}</h3>
                <p className="subtitulo">
                  {modo === 'codigo'
                    ? `Enviamos un código de 6 dígitos a ${regCorreo || 'tu correo'}.`
                    : 'El primer registro crea tu empresa. Los demás usuarios los agrega el administrador.'}
                </p>

                {modo === 'codigo' ? (
                  <form onSubmit={manejarCodigo}>
                    <div className="codigo-cajas">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <input
                          key={i}
                          className="codigo-caja"
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={codigoVerif[i] ?? ''}
                          autoFocus={i === 0}
                          onChange={(e) => {
                            const digito = e.target.value.replace(/\D/g, '');
                            const nuevo = codigoVerif.slice(0, i) + digito + codigoVerif.slice(i + 1);
                            setCodigoVerif(nuevo.slice(0, 6));
                            if (digito) {
                              const siguiente = document.querySelectorAll<HTMLInputElement>('.codigo-caja')[i + 1];
                              siguiente?.focus();
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' && !codigoVerif[i]) {
                              const anterior = document.querySelectorAll<HTMLInputElement>('.codigo-caja')[i - 1];
                              anterior?.focus();
                            }
                          }}
                        />
                      ))}
                    </div>

                    {error && <div className="error-burbuja">{error}</div>}
                    {exito && <div className="exito-burbuja">{exito}</div>}

                    <button className="boton-primario" disabled={cargando || codigoVerif.length < 6} type="submit">
                      {cargando ? <Loader2 size={18} className="spinner" /> : <KeyRound size={18} />}
                      Activar cuenta
                    </button>

                    <div className="login-pie">
                      <button
                        type="button"
                        className="enlace"
                        onClick={async () => {
                          setError(null);
                          setCargando(true);
                          try {
                            await reenviarCodigo(regUsername.trim());
                            setExito('Código reenviado. Revisa tu correo.');
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'No se pudo reenviar');
                          } finally {
                            setCargando(false);
                          }
                        }}
                      >
                        <RefreshCw size={13} /> Reenviar código
                      </button>
                      <button type="button" className="enlace" onClick={() => alternarModo('login')}>
                        Ya tengo una cuenta
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={manejarRegistro}>
                    <label className="login-etiqueta" htmlFor="reg-user-2">
                      Usuario
                    </label>
                    <div className="campo">
                      <User size={18} />
                      <input
                        id="reg-user-2"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="admin"
                        required
                      />
                    </div>

                    <label className="login-etiqueta" htmlFor="reg-correo-2">
                      Correo
                    </label>
                    <div className="campo">
                      <Mail size={18} />
                      <input
                        id="reg-correo-2"
                        type="email"
                        value={regCorreo}
                        onChange={(e) => setRegCorreo(e.target.value)}
                        placeholder="tucorreo@ejemplo.com"
                        required
                      />
                    </div>

                    <label className="login-etiqueta" htmlFor="reg-negocio-2">
                      Nombre del negocio
                    </label>
                    <div className="campo">
                      <Store size={18} />
                      <input
                        id="reg-negocio-2"
                        value={regNombreNegocio}
                        onChange={(e) => setRegNombreNegocio(e.target.value)}
                        placeholder="Mi Librería"
                      />
                    </div>

                    <label className="login-etiqueta" htmlFor="reg-pass-2">
                      Contraseña
                    </label>
                    <div className="campo">
                      <Lock size={18} />
                      <input
                        id="reg-pass-2"
                        type={verPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        required
                      />
                    </div>

                    {error && <div className="error-burbuja">{error}</div>}

                    <button className="boton-primario" disabled={cargando} type="submit">
                      {cargando ? <Loader2 size={18} className="spinner" /> : <UserRound size={18} />}
                      Crear cuenta
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="hero"
              className="login-lado-contenido"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.3 }}
            >
              <h2>Tu librería, organizada.</h2>
              <p>
                Inventario con fotos, punto de venta con escáner, reportes y control de
                usuarios: todo en una sola aplicación, en tu PC.
              </p>
              <button type="button" className="boton-secundario" onClick={() => alternarModo('registro')}>
                <UserRound size={18} />
                Crear mi cuenta
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function LogInIcono() {
  return <UserRound size={18} />;
}