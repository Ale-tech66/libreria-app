from collections import defaultdict
from datetime import datetime, timedelta, timezone
from threading import Lock

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.audit import registrar
from app.core.database import get_db
from app.core.deps import get_current_user, get_current_user_optional, require_role
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from app.schemas import Token, UserCreate, UserOut, UserUpdate

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
    """Crea un usuario.

    El PRIMER usuario registrado se convierte en administrador (bootstrap).
    A partir de ahí, solo los administradores pueden crear usuarios:
    los empleados inician sesión con la cuenta que su admin les creó.
    """
    if db.query(User).count() == 0:
        rol = "admin"
    else:
        if admin is None or admin.rol != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo un administrador puede crear usuarios. Contacta a tu administrador.",
            )
        rol = user.rol

    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="El usuario ya existe")

    new_user = User(
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
        + ("" if admin else " (primer usuario: admin automático)"),
        usuario_id=new_user.id,
        username=new_user.username,
    )
    return new_user


@router.post("/login", response_model=Token)
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

    access_token = create_access_token(data={"sub": user.username, "rol": user.rol})
    registrar(
        db,
        accion="login",
        recurso="sesion",
        detalle=f"Inicio de sesión de '{user.username}'",
        usuario_id=user.id,
        username=user.username,
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    """Devuelve los datos del usuario autenticado (valida el token)."""
    return current_user


# ─────────────────── Gestión de usuarios (solo admin) ───────────────────


@router.get("/users", response_model=list[UserOut])
def listar_usuarios(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """Lista todos los usuarios."""
    return db.query(User).order_by(User.username.asc()).all()


@router.put("/users/{user_id}", response_model=UserOut)
def actualizar_usuario(
    user_id: int,
    update: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Actualiza rol, estado o contraseña de un usuario."""
    usuario = db.query(User).filter(User.id == user_id).first()
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
    )
    return usuario