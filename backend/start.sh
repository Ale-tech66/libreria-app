#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#source "$SCRIPT_DIR/venv/bin/activate"
export DOTENV_PATH="$SCRIPT_DIR/.env"

# ─────────────────────────────────────────────────────────────────────────────
# Migraciones seguras: detecta si la BD ya tiene tablas creadas a mano
# (sin registro de alembic) y marca el estado correcto antes de migrar.
# ─────────────────────────────────────────────────────────────────────────────
python - <<'EOF'
import os
import subprocess
import sys

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect

load_dotenv(os.environ.get("DOTENV_PATH", ".env"))

url = os.environ.get("DATABASE_URL")
if not url:
    raise SystemExit("DATABASE_URL no está definida (revisa .env)")

engine = create_engine(url, connect_args={"connect_timeout": 10})
insp = inspect(engine)

tiene_version = insp.has_table("alembic_version")
tiene_productos = insp.has_table("productos")
tiene_foto = tiene_productos and "foto" in [c["name"] for c in insp.get_columns("productos")]

BASE = "0400b0515d57"
HEAD = "399f6da28835"
PREV = "a10499b448a0"

def run(*args):
    subprocess.run([sys.executable, "-m", "alembic", *args], check=True)

if tiene_version:
    print("→ BD con control de migraciones; aplicando pendientes.")
    run("upgrade", "head")
elif tiene_productos and tiene_foto:
    print("→ BD preexistente ya actualizada (foto/activo presentes); marcando previa y aplicando pendientes.")
    run("stamp", PREV)
    run("upgrade", "head")
elif tiene_productos:
    print("→ BD preexistente; marcando base y aplicando migraciones nuevas.")
    run("stamp", BASE)
    run("upgrade", "head")
else:
    print("→ BD nueva; creando esquema completo.")
    run("upgrade", "head")
EOF

# ─────────────────────────────────────────────────────────────────────────────
# Admin inicial: si ADMIN_PASSWORD está definida, crea el usuario admin
# (no hace nada si ya existe). Definir ADMIN_PASSWORD en el dashboard de Render.
# ─────────────────────────────────────────────────────────────────────────────
if [ -n "$ADMIN_PASSWORD" ]; then
    echo "→ Creando admin inicial si no existe..."
    python create_admin.py
else
    echo "→ ADMIN_PASSWORD no definida: no se crea admin inicial."
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"