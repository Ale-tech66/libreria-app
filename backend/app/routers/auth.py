from collections import defaultdict
from datetime import datetime, timedelta, timezone
from threading import Lock

import pyotp
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.audit import registrar
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, get_current_user_optional, require_role
from app.core.security import (
    create_access_token,
    create_mfa_token,
    generate_refresh_token,
    get_password_hash,
    hash_refresh_token,
    verify_password,
)
from app.models.organization import Organization
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas import (
    LoginResponse,
    MfaCodeRequest,
    MfaConfirmRequest,
    MfaRequired,
    MfaSetupOut,
    MfaVerifyRequest,
    RefreshRequest,
    Token,
    UserCreate,
    UserOut,
    UserUpdate,
)

router = APIRouter(prefix="/auth", tags=["Autenticación"])

# ─────────────────── Rate limiting básico (en memoria) ───────────────────
# Suficiente para una sola instancia. Para múltiples instancias usar Redis.

_MAX_ATTEMPTS = 5
_WINDOW = timedelta(minutes=5)
_lock = Lock()
_failed: dict[str, list[datetime]] = defaultdict(list)


def _check_rate_limit(username: str) -> None:
    now = datetime.now(timezone.utc)
    with _lock:
        attempts = [t for t in _failed[username] if now - t < _WINDOW]
        _failed[username] = attempts
        if len(attempts) >= _MAX_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiados intentos fallidos. Intenta de nuevo en unos minutos.",
            )


def _register_failure(username: str) -> None:
    with _lock:
        _failed[username].append(datetime.now(timezone.utc))


@router.post("/register", response_model=UserOut)
def register(
    user: UserCreate,
    db: Session = Depends(get_db),
    admin: User | None = Depends(get_current_user_optional),
):
    """Crea un usuario y, si es el primero, también su empresa (multiempresa).

    El PRIMER usuario registrado se convierte en administrador y su cuenta
    crea una organización independiente. A partir de ahí, solo los
    administradores pueden crear usuarios dentro de su propia empresa.
    """
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="El usuario ya existe")

    if db.query(User).count() == 0:
        # Bootstrap: crea la organización y el primer admin
        org = Organization(
            nombre=user.nombre_negocio or f"Negocio de {user.username}",
            tipo_negocio=user.tipo_negocio,
            propietario=user.username,
            correo=user.correo,
            telefono=user.telefono,
            pais=user.pais,
        )
        db.add(org)
        db.flush()
        rol = "admin"
        organization_id = org.id
        es_bootstrap = True
    else:
        if admin is None or admin.rol != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo un administrador puede crear usuarios. Contacta a tu administrador.",
            )
        rol = user.rol
        organization_id = admin.organization_id
        es_bootstrap = False

    new_user = User(
        organization_id=organization_id,
        username=user.username,
        hashed_password=get_password_hash(user.password),
        rol=rol,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    registrar(
        db,
        accion="registrar",
        recurso="usuario",
        recurso_id=new_user.id,
        detalle=f"Usuario '{new_user.username}' creado con rol {rol}"
        + (f" (empresa '{new_user.organizacion.nombre}')" if es_bootstrap else ""),
        usuario_id=new_user.id,
        username=new_user.username,
        organization_id=organization_id,
    )
    return new_user


@router.post("/login", response_model=LoginResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    _check_rate_limit(form_data.username)

    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        _register_failure(form_data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario desactivado",
        )

    # Si el usuario tiene MFA activado, primero hay que validar el código
    if user.mfa_secret:
        mfa_token = create_mfa_token({"sub": user.username, "type": "mfa"})
        return {
            "mfa_required": True,
            "mfa_token": mfa_token,
            "token_type": "bearer",
        }

    return _emitir_sesion(db, user, registrar_login=True)


@router.post("/mfa/confirm", response_model=Token)
def mfa_confirm(datos: MfaConfirmRequest, db: Session = Depends(get_db)):
    """Segundo paso del login con MFA: valida el código TOTP y entrega los tokens."""
    try:
        payload = jwt.decode(
            datos.mfa_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión MFA inválida o expirada",
        )
    if payload.get("type") != "mfa":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión MFA inválida",
        )

    user = db.query(User).filter(User.username == payload.get("sub")).first()
    if not user or not user.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario desactivado",
        )
    if not user.mfa_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA no está configurado para este usuario",
        )

    _check_mfa_rate_limit(user.id)
    if not _verificar_totp(user, datos.code):
        _register_mfa_failure(user.id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Código incorrecto",
        )

    return _emitir_sesion(db, user, registrar_login=True)


@router.post("/mfa/setup", response_model=MfaSetupOut)
def mfa_setup(
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    """Genera un secreto TOTP para la app de autenticación.

    IMPORTANTE: NO se guarda todavía. El secreto solo se persiste cuando
    /mfa/verify-setup confirma que el usuario lo escaneó (código válido),
    así nunca se queda bloqueado por activar sin completar.
    """
    secreto = pyotp.random_base32()
    totp = pyotp.TOTP(secreto)
    otpauth_url = totp.provisioning_uri(
        name=usuario.username, issuer_name="Librería App"
    )
    return {"otpauth_url": otpauth_url, "secret": secreto}


@router.post("/mfa/verify-setup")
def mfa_verify_setup(
    datos: MfaVerifyRequest,
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    """Confirma que el usuario escaneó el QR probando su código TOTP.

    El secreto viaja desde el dispositivo (lo generó /mfa/setup) y recién
    aquí, con un código válido, se guarda en la BD.
    """
    _check_mfa_rate_limit(usuario.id)
    if not pyotp.TOTP(datos.secret).verify(datos.code, valid_window=1):
        _register_mfa_failure(usuario.id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Código incorrecto",
        )
    usuario.mfa_secret = datos.secret
    db.commit()
    registrar(
        db,
        accion="editar",
        recurso="usuario",
        recurso_id=usuario.id,
        detalle=f"MFA habilitado para '{usuario.username}'",
        usuario_id=usuario.id,
        username=usuario.username,
        organization_id=usuario.organization_id,
    )
    return {"ok": True}


@router.post("/mfa/disable")
def mfa_disable(
    datos: MfaCodeRequest,
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    """Desactiva el MFA validando primero el código actual."""
    if not usuario.mfa_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA no está configurado",
        )
    _check_mfa_rate_limit(usuario.id)
    if not _verificar_totp(usuario, datos.code):
        _register_mfa_failure(usuario.id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Código incorrecto",
        )
    usuario.mfa_secret = None
    db.commit()
    registrar(
        db,
        accion="editar",
        recurso="usuario",
        recurso_id=usuario.id,
        detalle=f"MFA deshabilitado para '{usuario.username}'",
        usuario_id=usuario.id,
        username=usuario.username,
        organization_id=usuario.organization_id,
    )
    return {"ok": True}


def _verificar_totp(user: User, code: str) -> bool:
    return pyotp.TOTP(user.mfa_secret).verify(code.strip(), valid_window=1)


# Rate limiting específico para códigos MFA
_MFA_MAX_ATTEMPTS = 5
_mfa_failed: dict[int, list[datetime]] = defaultdict(list)
_mfa_lock = Lock()


def _check_mfa_rate_limit(user_id: int) -> None:
    now = datetime.now(timezone.utc)
    with _mfa_lock:
        attempts = [t for t in _mfa_failed[user_id] if now - t < _WINDOW]
        _mfa_failed[user_id] = attempts
        if len(attempts) >= _MFA_MAX_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiados intentos de código. Intenta de nuevo en unos minutos.",
            )


def _register_mfa_failure(user_id: int) -> None:
    with _mfa_lock:
        _mfa_failed[user_id].append(datetime.now(timezone.utc))


def _emitir_sesion(db: Session, user: User, registrar_login: bool) -> dict:
    """Crea el par access/refresh y devuelve la respuesta del login."""
    access_token = create_access_token(data={"sub": user.username, "rol": user.rol})
    refresh_token = _emitir_refresh_token(db, user)
    if registrar_login:
        registrar(
            db,
            accion="login",
            recurso="sesion",
            detalle=f"Inicio de sesión de '{user.username}'",
            usuario_id=user.id,
            username=user.username,
            organization_id=user.organization_id,
        )
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


def _emitir_refresh_token(db: Session, user: User) -> str:
    """Crea un refresh token opaco (30 días) y guarda solo su hash."""
    token = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(token),
            expires_at=datetime.now(timezone.utc)
            + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    db.commit()
    return token


@router.post("/refresh", response_model=Token)
def refresh(refresh_request: RefreshRequest, db: Session = Depends(get_db)):
    """Renueva el par de tokens con rotación: el token usado queda invalidado."""
    token_hash = hash_refresh_token(refresh_request.refresh_token)
    stored = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash)
        .first()
    )
    if not stored or stored.revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión inválida o ya utilizada",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if stored.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión expiró, inicia sesión de nuevo",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == stored.user_id).first()
    if not user or not user.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario desactivado",
        )

    # Rotación: se revoca el token usado y se emite uno nuevo
    stored.revoked = True
    db.commit()
    access_token = create_access_token(data={"sub": user.username, "rol": user.rol})
    refresh_token = _emitir_refresh_token(db, user)
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


@router.post("/logout")
def logout(refresh_request: RefreshRequest, db: Session = Depends(get_db)):
    """Revoca el refresh token: la sesión queda invalidada."""
    token_hash = hash_refresh_token(refresh_request.refresh_token)
    stored = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash)
        .first()
    )
    if stored:
        stored.revoked = True
        db.commit()
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    """Devuelve los datos del usuario autenticado (valida el token)."""
    return current_user


# ─────────────────── Gestión de usuarios (solo admin) ───────────────────


@router.get("/users", response_model=list[UserOut])
def listar_usuarios(
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Lista los usuarios de la propia empresa."""
    return (
        db.query(User)
        .filter(User.organization_id == admin.organization_id)
        .order_by(User.username.asc())
        .all()
    )


@router.put("/users/{user_id}", response_model=UserOut)
def actualizar_usuario(
    user_id: int,
    update: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Actualiza rol, estado o contraseña de un usuario de la propia empresa."""
    usuario = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.organization_id == admin.organization_id,
        )
        .first()
    )
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if usuario.id == admin.id and update.activo is False:
        raise HTTPException(
            status_code=400, detail="No puedes desactivar tu propia cuenta"
        )

    if update.rol is not None:
        usuario.rol = update.rol
    if update.activo is not None:
        usuario.activo = update.activo
    if update.password is not None:
        usuario.hashed_password = get_password_hash(update.password)

    db.commit()
    db.refresh(usuario)
    cambios = []
    if update.rol is not None:
        cambios.append(f"rol={update.rol}")
    if update.activo is not None:
        cambios.append(f"activo={update.activo}")
    if update.password is not None:
        cambios.append("contraseña cambiada")
    registrar(
        db,
        accion="editar",
        recurso="usuario",
        recurso_id=usuario.id,
        detalle=f"Usuario '{usuario.username}': {', '.join(cambios)}",
        usuario_id=admin.id,
        username=admin.username,
        organization_id=admin.organization_id,
    )
    return usuario