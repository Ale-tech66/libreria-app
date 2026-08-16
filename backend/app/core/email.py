"""Envío de correos (SMTP) y códigos de verificación/recuperación.

Si SMTP no está configurado, todas las funciones fallan con RuntimeError:
la app funciona igual, solo que la verificación de correo queda desactivada.
"""
import hashlib
import hmac
import logging
import secrets
import smtplib
import socket
from datetime import datetime, timedelta
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger("libreria")

CODIGO_MINUTOS_VALIDO = 15


class _SMTP(smtplib.SMTP):
    """SMTP que conecta forzando IPv4 primero.

    En hosts sin IPv6 (como algunos entornos de nube) la resolución
    devuelve direcciones IPv6 y el intento falla con
    'OSError: Network is unreachable'. Al probar IPv4 primero se evita.
    """

    def _get_socket(self, host, port, timeout):
        errores: list[Exception] = []
        for familia in (socket.AF_INET, socket.AF_INET6):
            try:
                infos = socket.getaddrinfo(host, port, familia, socket.SOCK_STREAM)
            except socket.gaierror as e:
                errores.append(e)
                continue
            try:
                return socket.create_connection(infos[0][4][:2], timeout, self.source_address)
            except OSError as e:
                errores.append(e)
        if errores:
            raise errores[-1]
        raise socket.gaierror(f"No se pudo resolver {host}")


class _SMTP_SSL(_SMTP, smtplib.SMTP_SSL):
    """Idéntico a _SMTP pero con TLS implícito (puerto 465)."""


def correo_configurado() -> bool:
    if settings.BREVO_API_KEY:
        return True
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)


def generar_codigo() -> str:
    """Código numérico de 6 dígitos."""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_codigo(codigo: str) -> str:
    return hashlib.sha256(codigo.encode()).hexdigest()


def codigo_correcto(guardado: str | None, codigo: str) -> bool:
    if not guardado:
        return False
    return hmac.compare_digest(guardado, hash_codigo(codigo))


def codigo_vencido(expira: datetime | None) -> bool:
    if not expira:
        return True
    return datetime.utcnow() > expira


def _enviar_por_brevo(destinatario: str, asunto: str, cuerpo: str) -> None:
    """Envía vía la API HTTP de Brevo (funciona aunque los puertos SMTP estén bloqueados)."""
    import requests

    respuesta = requests.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={
            "api-key": settings.BREVO_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        json={
            "sender": {
                "name": "Librería App",
                "email": settings.SMTP_FROM or settings.SMTP_USER,
            },
            "to": [{"email": destinatario}],
            "subject": asunto,
            "textContent": cuerpo,
        },
        timeout=30,
    )
    if respuesta.status_code >= 400:
        raise RuntimeError(f"Brevo rechazó el correo: {respuesta.text[:200]}")


def enviar_correo(destinatario: str, asunto: str, cuerpo: str) -> None:
    if not correo_configurado():
        raise RuntimeError(
            "El envío de correo no está configurado en el servidor (SMTP)"
        )
    mensaje = EmailMessage()
    mensaje["From"] = settings.SMTP_FROM or settings.SMTP_USER
    mensaje["To"] = destinatario
    mensaje["Subject"] = asunto
    mensaje.set_content(cuerpo)

    if settings.BREVO_API_KEY:
        _enviar_por_brevo(destinatario, asunto, cuerpo)
        logger.info("Correo enviado a %s (Brevo): %s", destinatario, asunto)
        return

    # Prueba el puerto configurado y, si la red falla, el alternativo (465/587)
    alternativo = 465 if settings.SMTP_PORT != 465 else 587
    ultimo_error: Exception | None = None
    for puerto in (settings.SMTP_PORT, alternativo):
        try:
            clase = _SMTP_SSL if puerto == 465 else _SMTP
            with clase(settings.SMTP_HOST, puerto, timeout=30) as smtp:
                if puerto != 465:
                    smtp.starttls()
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                smtp.send_message(mensaje)
            logger.info("Correo enviado a %s: %s", destinatario, asunto)
            return
        except OSError as e:
            # Error de red: probamos el otro puerto antes de rendirnos
            ultimo_error = e
        except smtplib.SMTPException:
            # Error de protocolo o credenciales: no tiene sentido probar otro puerto
            raise
    raise RuntimeError(f"No se pudo enviar el correo: {ultimo_error}")


def enviar_codigo(destinatario: str, asunto: str, cuerpo_antes_codigo: str) -> str:
    """Genera un código, lo envía por correo y devuelve SU HASH (para la BD)."""
    codigo = generar_codigo()
    cuerpo = (
        f"{cuerpo_antes_codigo}\n\n"
        f"Tu código es: {codigo}\n\n"
        f"Es válido por {CODIGO_MINUTOS_VALIDO} minutos. Si no fuiste tú, ignora este correo.\n\n"
        "— Librería App"
    )
    enviar_correo(destinatario, asunto, cuerpo)
    return hash_codigo(codigo), timedelta(minutes=CODIGO_MINUTOS_VALIDO)