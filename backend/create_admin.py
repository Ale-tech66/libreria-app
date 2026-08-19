"""
Crea el usuario administrador inicial (SOLO si no existe).

Uso:
    ADMIN_USERNAME=admin ADMIN_PASSWORD=supersecreto python create_admin.py

Seguridad:
- Si el usuario YA existe, no se toca nada (no resetea contraseña ni borra
  el MFA en cada deploy). Para forzar un reset manual:
  FORCE_ADMIN_RESET=1 ADMIN_USERNAME=admin ADMIN_PASSWORD=nueva python create_admin.py

Requiere el .env con DATABASE_URL (o la variable de entorno ya exportada).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import Base, SessionLocal, engine
from app.core.security import get_password_hash
from app.models.user import User


def main():
    username = os.getenv("ADMIN_USERNAME", "admin")
    password = os.getenv("ADMIN_PASSWORD")
    if not password:
        print("ERROR: Define ADMIN_PASSWORD para crear el admin inicial.")
        sys.exit(1)
    if len(password) < 8:
        print("ERROR: ADMIN_PASSWORD debe tener al menos 8 caracteres.")
        sys.exit(1)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existe = db.query(User).filter(User.username == username).first()
        if existe:
            if os.getenv("FORCE_ADMIN_RESET") == "1":
                existe.hashed_password = get_password_hash(password)
                existe.rol = "admin"
                existe.activo = True
                existe.mfa_secret = None
                db.commit()
                print(
                    f"Usuario admin '{username}' actualizado "
                    "(contraseña y MFA reiniciados por FORCE_ADMIN_RESET)."
                )
            else:
                print(
                    f"El usuario admin '{username}' ya existe: no se modifica "
                    "(ADMIN_PASSWORD es de UN SOLO USO; el MFA se conserva)."
                )
            return
        db.add(User(
            username=username,
            hashed_password=get_password_hash(password),
            rol="admin",
            activo=True,
        ))
        db.commit()
        print(f"Usuario admin '{username}' creado correctamente.")
    finally:
        db.close()


if __name__ == "__main__":
    main()