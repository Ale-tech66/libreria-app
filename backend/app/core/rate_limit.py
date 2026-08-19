"""Rate limiting persistente en BD.

Los contadores viven en tablas (`rate_limits`, `mfa_tokens_usados`): no se
pierden al reiniciar el servidor, así que un atacante no puede reseteárselos
reiniciando la app. Funciona con Postgres y SQLite (los tests).
"""
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.rate_limit import MfaTokenUsado, RateLimit


def _ahora() -> datetime:
    # Naive UTC, igual que el resto de la base de datos.
    return datetime.utcnow()


def intentos(db: Session, clave: str, ventana: timedelta) -> int:
    """Intentos vigentes para la clave (0 si no existe o venció)."""
    fila = db.execute(
        select(RateLimit).where(RateLimit.clave == clave).with_for_update()
    ).scalar_one_or_none()
    if fila is None:
        return 0
    if fila.expira <= _ahora():
        db.delete(fila)
        db.commit()
        return 0
    return fila.intentos


def registrar(db: Session, clave: str, ventana: timedelta) -> None:
    """Suma un intento (ventana deslizante desde ahora)."""
    fila = db.execute(
        select(RateLimit).where(RateLimit.clave == clave).with_for_update()
    ).scalar_one_or_none()
    if fila is None:
        db.add(RateLimit(clave=clave, intentos=1, expira=_ahora() + ventana))
    else:
        fila.intentos += 1
        fila.expira = _ahora() + ventana
    db.commit()


def limpiar(db: Session, clave: str) -> None:
    """Borra el contador (login exitoso, código correcto...)."""
    fila = db.execute(
        select(RateLimit).where(RateLimit.clave == clave).with_for_update()
    ).scalar_one_or_none()
    if fila is not None:
        db.delete(fila)
        db.commit()


def mfa_token_usado(db: Session, jti: str) -> bool:
    """True si el jti ya se canjeó; si no, lo registra como usado."""
    fila = db.execute(
        select(MfaTokenUsado).where(MfaTokenUsado.jti == jti).with_for_update()
    ).scalar_one_or_none()
    if fila is not None:
        return True
    db.add(MfaTokenUsado(jti=jti, expira=_ahora() + timedelta(minutes=5)))
    db.commit()
    return False