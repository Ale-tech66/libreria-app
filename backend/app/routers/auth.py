from collections import defaultdict
from datetime import datetime, timedelta, timezone
from threading import Lock

import pyotp
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.core.audit import registrar
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, get_current_user_optional, require_role
from app.core.email import (
    codigo_correcto,
    codigo_vencido,
    correo_configurado,
    enviar_codigo,
)
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
    CodigoVerificacionRequest,
    LoginResponse,
    MfaCodeRequest,
    MfaConfirmRequest,
    MfaRequired,
    MfaSetupOut,
    MfaVerifyRequest,
    RecuperarConfirmarRequest,
    RecuperarRequest,
    ReenviarCodigoRequest,
    RegistroOut,
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
_WINDOW = timedelta(minutes=15)
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


def _clear_failures(username: str) -> None:
    with _lock:
        _failed.pop(username, None)


# Límite por IP (login, registro y envío de códigos): frena el password
# spraying contra muchos usuarios y el abuso del envío de correos.
_MAX_IP_ATTEMPTS = 25
_ip_failed: dict[str, list[datetime]] = defaultdict(list)
_ip_lock = Lock()


def _ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "desconocida"


def _check_ip_rate_limit(request: Request) -> None:
    now = datetime.now(timezone.utc)
    ip = _ip(request)
    with _ip_lock:
        attempts = [t for t in _ip_failed[ip] if now - t < _WINDOW]
        _ip_failed[ip] = attempts
        if len(attempts) >= _MAX_IP_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiadas solicitudes desde esta conexión. Intenta de nuevo más tarde.",
            )


def _register_ip_attempt(request: Request) -> None:
    with _ip_lock:
        _ip_failed[_ip(request)].append(datetime.now(timezone.utc))


# Límite de intentos para códigos de 6 dígitos (verificación y recuperación):
# sin esto, un código de 10^6 combinaciones sería forzable por fuerza bruta.
_MAX_CODIGO_ATTEMPTS = 5
_codigo_failed: dict[str, list[datetime]] = defaultdict(list)
_codigo_lock = Lock()


def _check_codigo_rate_limit(username: str) -> None:
    now = datetime.now(timezone.utc)
    with _codigo_lock:
        attempts = [t for t in _codigo_failed[username] if now - t < _WINDOW]
        _codigo_failed[username] = attempts
        if len(attempts) >= _MAX_CODIGO_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiados intentos. Solicita un código nuevo más tarde.",
            )


def _register_codigo_attempt(username: str) -> None:
    with _codigo_lock:
        _codigo_failed[username].append(datetime.now(timezone.utc))


def _clear_codigo_failures(username: str) -> None:
    with _codigo_lock:
        _codigo_failed.pop(username, None)


@router.post("/register", response_model=RegistroOut)
def register(
    user: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: User | None = Depends(get_current_user_optional),
):
    """Crea un usuario y, si es el primero, también su empresa (multiempresa).

    El PRIMER usuario registrado se convierte en administrador y su cuenta
    crea una organización independiente. A partir de ahí, solo los
    administradores pueden crear usuarios dentro de su propia empresa.

    Si el correo está configurado en el servidor, la primera cuenta (la del
    dueño) se crea inactiva y recibe un código por correo para activarla.
    """
    _check_ip_rate_limit(request)
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="El usuario ya existe")

    # El bootstrap (primera organización) se serializa con un lock a nivel
    # de base de datos para evitar que dos registros concurrentes creen
    # organizaciones duplicadas y para que el "dueño" sea determinista.
    if db.query(User).count() == 0:
        if db.bind.dialect.name == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(7242026)"))
        if db.query(User).count() != 0:
            if admin is None or admin.rol != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Solo un administrador puede crear usuarios. Contacta a tu administrador.",
                )
            rol = user.rol
            organization_id = admin.organization_id
            es_bootstrap = False
        else:
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

    requiere_verificacion = (
        es_bootstrap
        and correo_configurado()
        and bool(user.correo)
    )

    new_user = User(
        organization_id=organization_id,
        username=user.username,
        hashed_password=get_password_hash(user.password),
        rol=rol,
        activo=not requiere_verificacion,
        correo=user.correo if es_bootstrap else None,
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

    if requiere_verificacion:
        hash_codigo, vigencia = enviar_codigo(
            user.correo,
            "Verifica tu cuenta de Librería App",
            f"Hola {new_user.username}, ya casi está. Verifica tu cuenta con este código:",
        )
        new_user.codigo_verificacion = hash_codigo
        new_user.codigo_expira = datetime.utcnow() + vigencia
        db.commit()
        respuesta = UserOut.model_validate(new_user).model_dump()
        respuesta["requiere_verificacion"] = True
        respuesta["mensaje"] = (
            "Te enviamos un código a tu correo. Revisa tu bandeja de entrada "
            "e ingrésalo para activar tu cuenta."
        )
        return respuesta
    return new_user


@router.post("/verificar-codigo")
def verificar_codigo(
    datos: CodigoVerificacionRequest,
    db: Session = Depends(get_db),
):
    """Activa la cuenta con el código recibido por correo."""
    _check_codigo_rate_limit(datos.username)
    user = db.query(User).filter(User.username == datos.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="No se pudo verificar la cuenta")
    if not user.codigo_verificacion:
        raise HTTPException(
            status_code=400,
            detail="No hay un código pendiente. Solicita uno nuevo.",
        )
    if codigo_vencido(user.codigo_expira):
        raise HTTPException(
            status_code=400,
            detail="El código expiró. Solicita uno nuevo.",
        )
    if not codigo_correcto(user.codigo_verificacion, datos.code):
        _register_codigo_attempt(datos.username)
        raise HTTPException(status_code=401, detail="Código incorrecto")

    _clear_codigo_failures(datos.username)
    user.activo = True
    user.codigo_verificacion = None
    user.codigo_expira = None
    db.commit()
    registrar(
        db,
        accion="verificar",
        recurso="usuario",
        recurso_id=user.id,
        detalle=f"Correo verificado para '{user.username}'",
        usuario_id=user.id,
        username=user.username,
        organization_id=user.organization_id,
    )
    return {"ok": True}


@router.post("/reenviar-codigo")
def reenviar_codigo(
    datos: ReenviarCodigoRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Regenera y reenvía el código de verificación."""
    _check_ip_rate_limit(request)
    _check_codigo_rate_limit(datos.username)
    user = db.query(User).filter(User.username == datos.username).first()
    if not user or user.activo or not user.correo:
        raise HTTPException(
            status_code=400,
            detail="No se pudo reenviar el código en este momento",
        )
    try:
        hash_codigo, vigencia = enviar_codigo(
            user.correo,
            "Nuevo código de verificación",
            f"Hola {user.username}, aquí tienes un código nuevo:",
        )
    except RuntimeError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo enviar el correo en este momento. Intenta más tarde.",
        ) from None
    _register_codigo_attempt(datos.username)
    user.codigo_verificacion = hash_codigo
    user.codigo_expira = datetime.utcnow() + vigencia
    db.commit()
    return {"ok": True}


class CorreoUpdateRequest(BaseModel):
    correo: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=6, max_length=72)


@router.put("/correo")
def actualizar_correo(
    datos: CorreoUpdateRequest,
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    """Guarda el correo del usuario (para verificación y recuperación).

    Requiere la contraseña actual: un token robado no debe poder secuestrar
    el correo de recuperación.
    """
    if "@" not in datos.correo:
        raise HTTPException(status_code=400, detail="El correo no es válido")
    if not verify_password(datos.password, usuario.hashed_password):
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")
    usuario.correo = datos.correo.strip()
    db.commit()
    return {"ok": True, "correo": usuario.correo}


@router.post("/recuperar")
def recuperar(
    datos: RecuperarRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Envía un código por correo para restablecer la contraseña.

    La respuesta es idéntica exista o no el usuario (evita enumerar cuentas).
    """
    _check_ip_rate_limit(request)
    _check_codigo_rate_limit(datos.username)
    user = db.query(User).filter(User.username == datos.username).first()
    if user and user.correo:
        try:
            hash_codigo, vigencia = enviar_codigo(
                user.correo,
                "Recupera tu contraseña de Librería App",
                f"Hola {user.username}, usa este código para restablecer tu contraseña:",
            )
        except RuntimeError:
            raise HTTPException(
                status_code=503,
                detail="No se pudo enviar el correo en este momento. Intenta más tarde.",
            ) from None
        _register_codigo_attempt(datos.username)
        user.codigo_verificacion = hash_codigo
        user.codigo_expira = datetime.utcnow() + vigencia
        db.commit()
    return {"ok": True}


@router.post("/recuperar-confirmar")
def recuperar_confirmar(
    datos: RecuperarConfirmarRequest,
    db: Session = Depends(get_db),
):
    """Valida el código y cambia la contraseña."""
    _check_codigo_rate_limit(datos.username)
    user = db.query(User).filter(User.username == datos.username).first()
    if not user or not user.codigo_verificacion:
        raise HTTPException(
            status_code=400,
            detail="No hay un código pendiente. Solicita uno nuevo.",
        )
    if codigo_vencido(user.codigo_expira):
        raise HTTPException(
            status_code=400,
            detail="El código expiró. Solicita uno nuevo.",
        )
    if not codigo_correcto(user.codigo_verificacion, datos.code):
        _register_codigo_attempt(datos.username)
        raise HTTPException(status_code=401, detail="Código incorrecto")

    _clear_codigo_failures(datos.username)
    user.hashed_password = get_password_hash(datos.nueva_password)
    user.codigo_verificacion = None
    user.codigo_expira = None
    db.commit()
    registrar(
        db,
        accion="editar",
        recurso="usuario",
        recurso_id=user.id,
        detalle=f"Contraseña restablecida para '{user.username}' (recuperación)",
        usuario_id=user.id,
        username=user.username,
        organization_id=user.organization_id,
    )
    return {"ok": True}


@router.post("/login", response_model=LoginResponse)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    _check_rate_limit(form_data.username)
    _check_ip_rate_limit(request)

    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        _register_failure(form_data.username)
        _register_ip_attempt(request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta no puede iniciar sesión. Verifica tu correo o contacta a tu administrador.",
        )
    _clear_failures(form_data.username)

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
    aquí, con un código válido, se guarda en la BD. Se exige la contraseña
    actual para que un token robado no pueda activar MFA y bloquear al dueño.
    """
    if not verify_password(datos.password, usuario.hashed_password):
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")
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
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión inválida o ya utilizada",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if stored.revoked:
        # Reuso de un token ya usado: posible robo. Se revoca TODA la
        # familia de sesiones del usuario (y él vuelve a iniciar sesión).
        db.query(RefreshToken).filter(RefreshToken.user_id == stored.user_id).update(
            {"revoked": True}
        )
        db.commit()
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
    """Cierra la sesión: revoca TODOS los refresh tokens del usuario."""
    token_hash = hash_refresh_token(refresh_request.refresh_token)
    stored = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == token_hash)
        .first()
    )
    if stored:
        db.query(RefreshToken).filter(RefreshToken.user_id == stored.user_id).update(
            {"revoked": True}
        )
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

    # Protección jerárquica: el administrador principal (el primer usuario
    # de la empresa) solo puede ser modificado por sí mismo, y solo él puede
    # modificar a otros administradores.
    owner_id = (
        db.query(func.min(User.id)).filter(User.organization_id == admin.organization_id).scalar()
    )
    if usuario.id == owner_id and admin.id != owner_id:
        raise HTTPException(
            status_code=403,
            detail="No puedes modificar al administrador principal",
        )
    if (
        usuario.id != admin.id
        and usuario.rol == "admin"
        and admin.id != owner_id
    ):
        raise HTTPException(
            status_code=403,
            detail="Solo el administrador principal puede modificar a otros administradores",
        )
    if usuario.id == admin.id and update.rol is not None and update.rol != "admin":
        raise HTTPException(
            status_code=400, detail="No puedes cambiar tu propio rol de administrador"
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