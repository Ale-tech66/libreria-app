import QRCode from 'qrcode';
import {
  Download,
  LogOut,
  Mail,
  Palette,
  Send,
  Shield,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { configurarTelegram, descargarRespaldo, getEstadoTelegram, probarTelegram } from '../api/backups';
import { actualizarCorreo, mfaDisable, mfaSetup, mfaVerifySetup } from '../api/auth';
import type { TelegramEstado } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { TEMAS } from '../theme/themes';
import { Boton, Campo, Modal, Spinner } from '../components/ui';

export function Ajustes() {
  const { sesion, refrescarUsuario, cerrar } = useAuth();
  const { temaId, setTemaId } = useTheme();
  const esAdmin = sesion?.usuario.rol === 'admin';

  const [mfaAbierto, setMfaAbierto] = useState(false);
  const [correo, setCorreo] = useState(sesion?.usuario.correo ?? '');
  const [guardandoCorreo, setGuardandoCorreo] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [telegram, setTelegram] = useState<TelegramEstado | null>(null);
  const [token, setToken] = useState('');
  const [cargandoTelegram, setCargandoTelegram] = useState(true);
  const [errorTelegram, setErrorTelegram] = useState<string | null>(null);
  const [mensajeTelegram, setMensajeTelegram] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [passwordCorreo, setPasswordCorreo] = useState('');

  useEffect(() => {
    setCorreo(sesion?.usuario.correo ?? '');
  }, [sesion]);

  const cargarTelegram = useCallback(async () => {
    if (!esAdmin) return;
    setCargandoTelegram(true);
    setErrorTelegram(null);
    try {
      setTelegram(await getEstadoTelegram());
    } catch {
      setTelegram(null);
      setErrorTelegram('No se pudo consultar el estado del bot de Telegram.');
    } finally {
      setCargandoTelegram(false);
    }
  }, [esAdmin]);

  useEffect(() => {
    void cargarTelegram();
  }, [cargarTelegram]);

  const guardarCorreo = async () => {
    if (guardandoCorreo) return;
    if (!correo.trim() || !passwordCorreo) {
      setError('Correo y contraseña son obligatorios.');
      return;
    }
    setGuardandoCorreo(true);
    setMensaje(null);
    setError(null);
    try {
      await actualizarCorreo(correo.trim(), passwordCorreo);
      setPasswordCorreo('');
      await refrescarUsuario();
      setMensaje('Correo guardado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el correo');
    } finally {
      setGuardandoCorreo(false);
    }
  };

  const guardarToken = async () => {
    if (!token.trim()) return;
    setMensajeTelegram(null);
    setErrorTelegram(null);
    try {
      const resultado = await configurarTelegram(token.trim());
      setToken('');
      setMensajeTelegram(resultado.detalle ?? 'Bot conectado.');
      await cargarTelegram();
    } catch (err) {
      setErrorTelegram(`Error: ${err instanceof Error ? err.message : 'No se pudo conectar'}`);
    }
  };

  const probar = async () => {
    setMensajeTelegram(null);
    setErrorTelegram(null);
    try {
      const resultado = await probarTelegram();
      setMensajeTelegram(resultado.detalle ?? 'Mensaje de prueba enviado.');
    } catch (err) {
      setErrorTelegram(`Error: ${err instanceof Error ? err.message : 'No se pudo enviar'}`);
    }
  };

  const bajarRespaldo = async () => {
    setDescargando(true);
    try {
      const blob = await descargarRespaldo();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `respaldo-${new Date().toISOString().slice(0, 10)}.json.gz`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo descargar el respaldo');
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="tarjeta">
      <h2>
        <Palette size={18} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 8 }} />
        Ajustes y tema
      </h2>
      <p className="sub">Personaliza el aspecto de la aplicación y administra tu cuenta.</p>

      <h3 className="seccion-titulo">Tema de la app</h3>
      <div className="tema-cuadricula">
        {TEMAS.map((tema) => (
          <button
            key={tema.id}
            className={`tema-tarjeta${temaId === tema.id ? ' seleccionado' : ''}`}
            onClick={() => setTemaId(tema.id)}
          >
            <div
              className="tema-muestra"
              style={{ background: `linear-gradient(135deg, ${tema.fondo.join(', ')})` }}
            />
            <strong>{tema.nombre}</strong>
            <span>{tema.descripcion}</span>
          </button>
        ))}
      </div>

      <h3 className="seccion-titulo">Seguridad</h3>
      <div className="ajustes-fila">
        <div style={{ flex: 1 }}>
          <strong>Verificación en dos pasos</strong>
          <span>
            {sesion?.usuario.mfa_activo ? 'Activada: pide un código al iniciar sesión.' : 'Desactivada.'}
          </span>
        </div>
        <Boton variante={sesion?.usuario.mfa_activo ? 'secundario' : 'primario'} onClick={() => setMfaAbierto(true)}>
          {sesion?.usuario.mfa_activo ? (
            <>
              <ShieldCheck size={16} /> Configurar
            </>
          ) : (
            <>
              <Shield size={16} /> Activar
            </>
          )}
        </Boton>
      </div>

      {esAdmin && (
        <>
          <h3 className="seccion-titulo">Respaldos</h3>
          <div className="ajustes-fila">
            <div style={{ flex: 1 }}>
              <strong>Descargar respaldo</strong>
              <span>Respaldo completo de tu negocio en un archivo .json.gz</span>
            </div>
            <Boton variante="secundario" onClick={() => void bajarRespaldo()} cargando={descargando}>
              <Download size={16} /> Descargar
            </Boton>
          </div>

          <div className="ajustes-fila columna">
            <div>
              <strong>Respaldo automático por Telegram</strong>
              <span>
                {cargandoTelegram
                  ? 'Consultando estado del bot…'
                  : errorTelegram
                    ? errorTelegram
                    : telegram?.bot_token_guardado
                      ? `Bot configurado${telegram.chat_id ? ` · chat ${telegram.chat_id}` : ''}. Se enviará un respaldo cada día a las 11:00 PM.`
                      : 'No hay bot configurado. El respaldo se envía cada día a las 11:00 PM.'}
              </span>
            </div>
            <div className="telegram-fila">
              <Campo
                type="password"
                valor={token}
                onChange={setToken}
                placeholder="Token del bot (de @BotFather)"
              />
              <Boton variante="secundario" onClick={guardarToken}>
                Guardar bot
              </Boton>
              <Boton
                variante="fantasma"
                onClick={probar}
                deshabilitado={!telegram?.bot_token_guardado}
                className="telegram-probar"
              >
                <Send size={15} /> Probar
              </Boton>
            </div>
            {mensajeTelegram && <div className="exito-burbuja">{mensajeTelegram}</div>}
            {errorTelegram && <div className="error-burbuja">{errorTelegram}</div>}
          </div>
        </>
      )}

      <h3 className="seccion-titulo">Cuenta</h3>
      <div className="ajustes-fila">
        <div style={{ flex: 1 }}>
          <strong>{sesion?.usuario.username}</strong>
          <span>
            Rol: {sesion?.usuario.rol}
            {sesion?.usuario.organizacion ? ` · ${sesion.usuario.organizacion}` : ''}
          </span>
        </div>
      </div>
      <div className="ajustes-fila columna">
        <div>
          <strong>Correo</strong>
          <span>Usado para verificación y recuperación de cuenta.</span>
        </div>
        <div className="telegram-fila">
          <Campo type="email" icono={<Mail size={16} />} valor={correo} onChange={setCorreo} placeholder="tucorreo@ejemplo.com" />
          <Campo type="password" valor={passwordCorreo} onChange={setPasswordCorreo} placeholder="Contraseña" />
          <Boton variante="secundario" onClick={guardarCorreo} cargando={guardandoCorreo}>
            Guardar
          </Boton>
        </div>
      </div>
      {mensaje && <div className="exito-burbuja">{mensaje}</div>}
      {error && <div className="error-burbuja">{error}</div>}

      <div className="ajustes-footer">
        <Boton variante="peligro" onClick={() => void cerrar()}>
          <LogOut size={16} /> Cerrar sesión
        </Boton>
        <span className="sub">Librería App · Versión 1.0.0</span>
      </div>

      <MfaModal abierto={mfaAbierto} onCerrar={() => setMfaAbierto(false)} onCambio={() => void refrescarUsuario()} />
    </div>
  );
}

function MfaModal({
  abierto,
  onCerrar,
  onCambio,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const { sesion } = useAuth();
  const [paso, setPaso] = useState<'menu' | 'activar' | 'desactivar'>('menu');
  const [qr, setQr] = useState<string | null>(null);
  const [secreto, setSecreto] = useState('');
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const temporizadorRef = useRef<number | null>(null);

  useEffect(() => {
    if (abierto) {
      setPaso('menu');
      setQr(null);
      setCodigo('');
      setPassword('');
      setError(null);
      setExito(null);
    }
  }, [abierto]);

  useEffect(
    () => () => {
      if (temporizadorRef.current !== null) window.clearTimeout(temporizadorRef.current);
    },
    [],
  );

  const activar = async () => {
    setCargando(true);
    setError(null);
    try {
      const setup = await mfaSetup();
      setSecreto(setup.secret);
      setQr(await QRCode.toDataURL(setup.otpauth_url, { width: 190, margin: 1 }));
      setPaso('activar');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar la configuración');
    } finally {
      setCargando(false);
    }
  };

  const confirmarActivacion = async () => {
    if (cargando || codigo.length !== 6 || password.length < 6) {
      setError('Código de 6 dígitos y contraseña de al menos 6 caracteres.');
      return;
    }
    setCargando(true);
    setError(null);
    try {
      await mfaVerifySetup(secreto, codigo, password);
      setExito('Verificación en dos pasos activada.');
      temporizadorRef.current = window.setTimeout(() => {
        onCambio();
        onCerrar();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código incorrecto');
    } finally {
      setCargando(false);
    }
  };

  const desactivar = async () => {
    if (cargando || codigo.length !== 6) return;
    setCargando(true);
    setError(null);
    try {
      await mfaDisable(codigo);
      setExito('Verificación en dos pasos desactivada.');
      temporizadorRef.current = window.setTimeout(() => {
        onCambio();
        onCerrar();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código incorrecto');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Verificación en dos pasos">
      {paso === 'menu' && (
        <div className="mfa-menu">
          <p className="sub">
            {sesion?.usuario.mfa_activo
              ? 'La verificación está activa. Puedes desactivarla con tu código de autenticación.'
              : 'Añade una capa extra de seguridad: al iniciar sesión pedirá un código de 6 dígitos desde tu app de autenticación (Google Authenticator, etc.).'}
          </p>
          {sesion?.usuario.mfa_activo ? (
            <Boton variante="peligro" onClick={() => setPaso('desactivar')}>
              <ShieldOff size={16} /> Desactivar
            </Boton>
          ) : (
            <Boton onClick={activar} cargando={cargando}>
              <Shield size={16} /> Activar
            </Boton>
          )}
        </div>
      )}

      {paso === 'activar' && (
        <div className="mfa-paso">
          {qr ? (
            <img src={qr} alt="QR de autenticación" className="mfa-qr" />
          ) : (
            <Spinner texto="Generando código QR…" />
          )}
          <p className="sub">
            Escanea el QR con tu app de autenticación. Si no puedes, usa el secreto:
          </p>
          <code className="mfa-secreto">{secreto}</code>
          <label className="login-etiqueta">Código de 6 dígitos</label>
          <Campo
            valor={codigo}
            onChange={(v) => setCodigo(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
            maxLength={6}
          />
          <label className="login-etiqueta">Contraseña</label>
          <Campo
            type="password"
            valor={password}
            onChange={setPassword}
            placeholder="Tu contraseña actual"
          />
          {error && <div className="error-burbuja">{error}</div>}
          {exito && <div className="exito-burbuja">{exito}</div>}
          <Boton onClick={confirmarActivacion} cargando={cargando} deshabilitado={codigo.length !== 6 || password.length < 6}>
            Confirmar
          </Boton>
        </div>
      )}

      {paso === 'desactivar' && (
        <div className="mfa-paso">
          <p className="sub">Escribe tu código de autenticación para desactivar la verificación.</p>
          <label className="login-etiqueta">Código de 6 dígitos</label>
          <Campo
            valor={codigo}
            onChange={(v) => setCodigo(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
            maxLength={6}
          />
          {error && <div className="error-burbuja">{error}</div>}
          {exito && <div className="exito-burbuja">{exito}</div>}
          <Boton variante="peligro" onClick={desactivar} cargando={cargando} deshabilitado={codigo.length !== 6}>
            <ShieldOff size={16} /> Desactivar
          </Boton>
        </div>
      )}
    </Modal>
  );
}