from datetime import datetime, timedelta, timezone
import hashlib
import secrets
import jwt
import bcrypt
from app.core.config import settings

def verify_password(plain_password, hashed_password):
    # bcrypt requiere que los strings se conviertan a bytes
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def _clave_jwt() -> str:
    """Clave para firmar JWT: JWT_SECRET_KEY si está definida, si no SECRET_KEY."""
    return settings.JWT_SECRET_KEY or settings.SECRET_KEY

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, _clave_jwt(), algorithm=settings.ALGORITHM)

def create_mfa_token(data: dict, minutes: int = 2):
    """Token de un solo propósito (MFA pendiente), corta duración y un solo uso.

    Incluye `jti` (identificador único): /auth/mfa/confirm registra los usados
    para que un token jamás pueda reutilizarse.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    to_encode.update({"exp": expire, "type": "mfa", "jti": secrets.token_urlsafe(16)})
    return jwt.encode(to_encode, _clave_jwt(), algorithm=settings.ALGORITHM)

def generate_refresh_token() -> str:
    """Genera un token opaco aleatorio (se guarda solo su hash)."""
    return secrets.token_urlsafe(48)

def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode('utf-8')).hexdigest()