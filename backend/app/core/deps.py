from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.security import _clave_jwt
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


def ip_cliente(request: Request) -> str:
    """IP real del cliente.

    Detrás del proxy de Render, la última entrada de X-Forwarded-For es la
    que añade el propio proxy (la del cliente) y no es controlable por el
    atacante (Render la sobreescribe al final). Se lee de derecha a
    izquierda para ignorar valores falsificados por el cliente.
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        entradas = [e.strip() for e in xff.split(",") if e.strip()]
        if entradas:
            return entradas[-1]
    return request.client.host if request.client else "desconocida"

def _decodificar(token: str):
    """Decodifica y valida el token. Devuelve el payload o None."""
    try:
        payload = jwt.decode(token, _clave_jwt(), algorithms=[settings.ALGORITHM])
    except jwt.InvalidTokenError:
        return None
    # SOLO se aceptan access tokens. Un mfa_token (type "mfa") no debe
    # poder usarse como Bearer: anularía el MFA.
    if payload.get("type") != "access":
        return None
    return payload

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = _decodificar(token)
    if payload is None:
        raise credentials_exception
    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    if not user.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario desactivado",
        )
    return user

def get_current_user_optional(
    token: str | None = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
) -> User | None:
    """Igual que get_current_user pero devuelve None sin token o token inválido."""
    if not token:
        return None
    payload = _decodificar(token)
    if payload is None:
        return None
    username: str = payload.get("sub")
    if username is None:
        return None
    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.activo:
        return None
    return user

def require_role(*roles: str):
    def verifier(current_user: User = Depends(get_current_user)):
        if current_user.rol not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para realizar esta acción",
            )
        return current_user
    return verifier