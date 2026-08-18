export const API_URL = 'https://libreria-api-4lr3.onrender.com';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const CLAVE_SESION = 'libreria_sesion';

export function getAccessToken(): string | null {
  try {
    const cruda = localStorage.getItem(CLAVE_SESION);
    return cruda ? ((JSON.parse(cruda) as { access_token: string }).access_token ?? null) : null;
  } catch {
    return null;
  }
}

function getRefreshToken(): string | null {
  try {
    const cruda = localStorage.getItem(CLAVE_SESION);
    return cruda ? ((JSON.parse(cruda) as { refresh_token: string }).refresh_token ?? null) : null;
  } catch {
    return null;
  }
}

function guardarTokens(access: string, refreshToken: string): void {
  try {
    const cruda = localStorage.getItem(CLAVE_SESION);
    const sesion = cruda ? (JSON.parse(cruda) as Record<string, unknown>) : {};
    sesion.access_token = access;
    sesion.refresh_token = refreshToken;
    localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
  } catch {
    /* sin sesión */
  }
}

export function limpiarSesionLocal(): void {
  try {
    localStorage.removeItem(CLAVE_SESION);
  } catch {
    /* sin sesión */
  }
}

let alSinSesion: (() => void) | null = null;
export function setAlSinSesion(cb: () => void): void {
  alSinSesion = cb;
}

let refrescando: Promise<'ok' | 'red' | 'invalido'> | null = null;

export async function renovarToken(): Promise<'ok' | 'red' | 'invalido'> {
  if (!refrescando) {
    refrescando = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return 'invalido';
      try {
        const respuesta = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        const datos = (await respuesta.json()) as { access_token?: string; refresh_token?: string };
        if (!respuesta.ok || !datos.access_token) return 'invalido';
        guardarTokens(datos.access_token, datos.refresh_token ?? refreshToken);
        return 'ok';
      } catch {
        // Error de red: la sesión sigue siendo válida, no hay que desloguear
        return 'red';
      } finally {
        refrescando = null;
      }
    })();
  }
  return refrescando;
}

const TIEMPO_ESPERA_MS = 45_000;

interface Opciones extends RequestInit {
  auth?: boolean;
  blob?: boolean;
}

export async function pedir<T>(ruta: string, opciones: Opciones = {}, reintento = true): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(opciones.headers || {});
  if (opciones.body && !(opciones.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (opciones.auth !== false && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), TIEMPO_ESPERA_MS);
  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      headers,
      signal: control.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, 'El servidor tardó demasiado en responder. Intenta de nuevo.');
    }
    throw new ApiError(0, 'No hay conexión con el servidor. Revisa tu internet.');
  } finally {
    clearTimeout(timer);
  }
  if (respuesta.ok && opciones.blob) {
    return (await respuesta.blob()) as unknown as T;
  }
  const texto = await respuesta.text();
  let datos: unknown = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = texto;
  }

  if (respuesta.status === 401 && opciones.auth !== false && reintento) {
    const resultado = await renovarToken();
    if (resultado === 'ok') {
      return pedir<T>(ruta, opciones, false);
    }
    if (resultado === 'invalido') {
      limpiarSesionLocal();
      alSinSesion?.();
      throw new ApiError(401, 'Tu sesión venció. Inicia sesión de nuevo.');
    }
    // Error de red durante la renovación: la sesión sigue siendo válida
    throw new ApiError(0, 'No hay conexión con el servidor. Revisa tu internet.');
  }

  if (!respuesta.ok) {
    const detalle = (datos as { detail?: string })?.detail;
    throw new ApiError(respuesta.status, detalle || `Error ${respuesta.status}`);
  }
  return datos as T;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  return fallback;
}