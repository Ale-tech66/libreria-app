"""Envío de correos (SMTP) y códigos de verificación/recuperación.

Si SMTP no está configurado, todas las funciones fallan con RuntimeError:
la app funciona igual, solo que la verificación de correo queda desactivada.
"""
import hashlib
import hmac
import logging
import secrets
import smtplib
from datetime import datetime, timedelta
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger("libreria")

CODIGO_MINUTOS_VALIDO = 15


def correo_configurado() -> bool:
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
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as smtp:
        smtp.starttls()
        smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.send_message(mensaje)
    logger.info("Correo enviado a %s: %s", destinatario, asunto)


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