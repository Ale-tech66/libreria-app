from sqlalchemy import Column, DateTime, Integer, String
from app.core.database import Base


class RateLimit(Base):
    """Contador de intentos por clave (ip:usuario, ip, usuario) en BD.

    A diferencia de un dict en memoria, sobrevive reinicios del servidor:
    un atacante no puede esquivar el bloqueo reiniciando la app.
    """

    __tablename__ = "rate_limits"

    clave = Column(String(200), primary_key=True)
    intentos = Column(Integer, nullable=False, default=1)
    expira = Column(DateTime, nullable=False, index=True)


class MfaTokenUsado(Base):
    """jti de los mfa_token ya canjeados (anti-replay persistente)."""

    __tablename__ = "mfa_tokens_usados"

    jti = Column(String(32), primary_key=True)
    expira = Column(DateTime, nullable=False, index=True)