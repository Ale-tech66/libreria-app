"""
Crea el usuario administrador inicial.

Uso:
    ADMIN_USERNAME=admin ADMIN_PASSWORD=supersecreto python create_admin.py

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
    if len(password) < 6:
        print("ERROR: ADMIN_PASSWORD debe tener al menos 6 caracteres.")
        sys.exit(1)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existe = db.query(User).filter(User.username == username).first()
        if existe:
            print(f"El usuario '{username}' ya existe. Nada que hacer.")
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