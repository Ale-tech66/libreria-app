"""Restaura un respaldo de Librería App en la BD indicada por DATABASE_URL.

Uso:
    python restore_backup.py respaldo-YYYYMMDD-HHMM.json.gz [--yes]

ADVERTENCIA: vacía TODAS las tablas de la BD y las rellena con el respaldo.
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.backups import restaurar_backup
from app.models import audit, organization, producto, refresh_token, setting, user, venta  # noqa: F401


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    archivo = Path(sys.argv[1])
    if not archivo.exists():
        print(f"El archivo {archivo} no existe")
        sys.exit(1)

    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL no está definida (revisa .env)")
        sys.exit(1)

    if "--yes" not in sys.argv:
        respuesta = input(
            "Se VACIARÁN todas las tablas de la BD actual. ¿Continuar? (escribe SI): "
        )
        if respuesta.strip().upper() != "SI":
            print("Cancelado.")
            sys.exit(0)

    engine = create_engine(url, connect_args={"connect_timeout": 10})
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    try:
        restauradas = restaurar_backup(db, archivo.read_bytes())
        print("Respaldo restaurado correctamente:")
        for tabla, filas in restauradas.items():
            print(f"  {tabla}: {filas} filas")
    finally:
        db.close()
        engine.dispose()


if __name__ == "__main__":
    main()