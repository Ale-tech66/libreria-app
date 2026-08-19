import asyncio
import base64
import gzip
import hashlib
import json
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

import requests
from cryptography.fernet import Fernet
from sqlalchemy import DateTime, delete, select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import Base, SessionLocal
from app.models.setting import Setting

logger = logging.getLogger("libreria")

# Orden por dependencias de llaves foráneas (padres primero)
ORDEN_TABLAS = [
    "organizations",
    "users",
    "productos",
    "ventas",
    "ventas_detalles",
    "refresh_tokens",
    "settings",
    "audit_logs",
    "alembic_version",
]

BACKUP_VERSION = 2

# Columnas que NUNCA se vuelcan en un respaldo: hashes de contraseñas,
# secretos MFA y tokens de bots. Si un respaldo se filtra, no compromete
# la autenticación de nadie (los usuarios restaurados deben resetear su
# contraseña y volver a configurar MFA).
COLUMNAS_SENSIBLES = {"hashed_password", "mfa_secret", "telegram_bot_token"}


def _clave_fernet() -> bytes:
    """Deriva la clave de cifrado del respaldo desde SECRET_KEY."""
    return base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest())


def _hash_irrecuperable() -> str:
    """Hash bcrypt de una contraseña aleatoria: nadie puede iniciar sesión
    con ella (el usuario debe resetear su contraseña tras un restore)."""
    from app.core.security import get_password_hash

    return get_password_hash(base64.urlsafe_b64encode(__import__("secrets").token_bytes(32)).decode())


def cifrar_respaldo(contenido: bytes) -> bytes:
    """Cifra el respaldo gzip con Fernet (AES): sin SECRET_KEY es ilegible."""
    return Fernet(_clave_fernet()).encrypt(contenido)


def descifrar_respaldo(contenido: bytes) -> bytes:
    """Descifra un respaldo cifrado con cifrar_respaldo."""
    return Fernet(_clave_fernet()).decrypt(contenido)


def _serializar(valor: Any) -> Any:
    if isinstance(valor, datetime):
        return valor.isoformat()
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, (bytes, bytearray, memoryview)):
        return base64.b64encode(bytes(valor)).decode("ascii")
    return valor


def generar_backup(db: Session, organization_id: int | None = None) -> bytes:
    """Respaldo de la BD como JSON comprimido (gzip).

    Si `organization_id` se pasa, el respaldo incluye SOLO los datos de esa
    organización (usuarios, productos, ventas, settings, auditoría...).
    Sin el filtro se vuelca todo (uso exclusivo para operación del servidor).
    """
    org_ids = [organization_id] if organization_id is not None else None

    tablas = Base.metadata.tables
    nombres = [
        n for n in ORDEN_TABLAS if n in tablas
    ] + [n for n in sorted(tablas) if n not in ORDEN_TABLAS]

    # Índices de filas permitidas por tabla (respetando dependencias)
    ids_ventas: list[int] = []
    ids_usuarios: list[int] = []

    contenido: dict[str, Any] = {
        "app": "libreria-app",
        "version": BACKUP_VERSION,
        "generado": datetime.utcnow().isoformat(),
        "tablas": {},
    }
    for nombre in nombres:
        tabla = tablas[nombre]
        stmt = select(tabla)
        if org_ids is not None:
            if "organization_id" in tabla.c:
                stmt = stmt.where(tabla.c.organization_id.in_(org_ids))
            elif nombre == "organizations":
                # La tabla de organizaciones es global: solo la propia org
                stmt = stmt.where(tabla.c.id.in_(org_ids))
            elif nombre == "ventas_detalles" and ids_ventas:
                stmt = stmt.where(tabla.c.venta_id.in_(ids_ventas))
            elif nombre == "refresh_tokens" and ids_usuarios:
                stmt = stmt.where(tabla.c.user_id.in_(ids_usuarios))
            elif nombre == "alembic_version":
                pass  # metadatos del esquema, sin datos sensibles
            elif nombre not in ("organizations", "users", "productos", "ventas", "ventas_detalles", "refresh_tokens", "settings", "audit_logs"):
                stmt = stmt.where(text("1 = 0"))  # tabla desconocida: nada
        filas = db.execute(stmt).mappings().all()
        contenido["tablas"][nombre] = [
            {
                k: _serializar(v)
                for k, v in fila.items()
                if k not in COLUMNAS_SENSIBLES
            }
            for fila in filas
        ]
        if nombre == "ventas":
            ids_ventas = [f["id"] for f in contenido["tablas"][nombre]]
        elif nombre == "users":
            ids_usuarios = [f["id"] for f in contenido["tablas"][nombre]]
    return cifrar_respaldo(
        gzip.compress(json.dumps(contenido, ensure_ascii=False).encode("utf-8"))
    )


def restaurar_backup(db: Session, contenido: bytes) -> dict[str, int]:
    """Vacía las tablas y las rellena desde un respaldo.

    Acepta respaldos cifrados (los generados desde esta versión) y sin
    cifrar (generados antes del cifrado). Las columnas sensibles que no
    viajan en el respaldo se reemplazan por valores neutros: los usuarios
    restaurados deben resetear su contraseña (hash irrecuperable) y
    reconfigurar MFA.
    Devuelve la cantidad de filas restauradas por tabla.
    """
    try:
        datos = json.loads(gzip.decompress(contenido))
    except (OSError, EOFError):
        datos = json.loads(gzip.decompress(descifrar_respaldo(contenido)))
    if datos.get("app") != "libreria-app" or datos.get("version") != BACKUP_VERSION:
        raise ValueError("El archivo no es un respaldo válido de Librería App")

    tablas = Base.metadata.tables
    nombres = [n for n in ORDEN_TABLAS if n in tablas] + [
        n for n in sorted(tablas) if n not in ORDEN_TABLAS
    ]

    # Vacía hijos antes que padres
    for nombre in reversed(nombres):
        db.execute(delete(tablas[nombre]))

    restauradas: dict[str, int] = {}
    for nombre in nombres:
        tabla = tablas[nombre]
        filas = datos["tablas"].get(nombre, [])
        columnas = {c.name: c for c in tabla.c}
        for fila in filas:
            valores = {}
            for clave, valor in fila.items():
                col = columnas.get(clave)
                if (
                    isinstance(valor, str)
                    and col is not None
                    and isinstance(col.type, DateTime)
                ):
                    valores[clave] = datetime.fromisoformat(valor)
                else:
                    valores[clave] = valor
            if nombre == "users":
                # El respaldo no trae credenciales: se restaura con un hash
                # irrecuperable (el admin debe resetear la contraseña) y MFA off
                if "hashed_password" not in valores:
                    valores["hashed_password"] = _hash_irrecuperable()
                valores.setdefault("mfa_secret", None)
            db.execute(tabla.insert().values(**valores))
        restauradas[nombre] = len(filas)

    # Reposiciona las secuencias (Postgres) para no chocar con el id máximo
    if db.bind.dialect.name == "postgresql":
        for nombre, filas in restauradas.items():
            if filas == 0:
                continue
            secuencia = db.execute(
                text(f"SELECT pg_get_serial_sequence('{nombre}', 'id')")
            ).scalar()
            if secuencia:
                db.execute(
                    text(
                        f"SELECT setval(:secuencia, COALESCE(MAX(id), 1), MAX(id) IS NOT NULL)"
                        f" FROM {nombre}"
                    ).bindparams(secuencia=secuencia)
                )
    db.commit()
    return restauradas


def _obtener_setting(db: Session, organization_id: int, clave: str) -> str | None:
    setting = (
        db.query(Setting)
        .filter(
            Setting.organization_id == organization_id,
            Setting.clave == clave,
        )
        .first()
    )
    return setting.valor if setting else None


def _guardar_setting(db: Session, organization_id: int, clave: str, valor: str) -> None:
    setting = (
        db.query(Setting)
        .filter(
            Setting.organization_id == organization_id,
            Setting.clave == clave,
        )
        .first()
    )
    if setting:
        setting.valor = valor
    else:
        db.add(
            Setting(
                organization_id=organization_id,
                clave=clave,
                valor=valor,
            )
        )
    db.commit()


def detectar_chat_id(bot_token: str) -> str | None:
    """Busca el chat más reciente del bot (tras que el dueño le envíe /start).

    Si hay MÁS de un chat distinto, devuelve None: auto-apuntar al último
    podría enviar el respaldo (con datos de la empresa) a un tercero que
    interactuó con el bot. En ese caso el dueño debe escribir el chat_id
    manualmente.
    """
    try:
        respuesta = requests.get(
            f"https://api.telegram.org/bot{bot_token}/getUpdates",
            params={"timeout": 2, "limit": 10},
            timeout=10,
        ).json()
    except requests.RequestException:
        return None
    if not respuesta.get("ok"):
        return None
    chats: dict[int, str] = {}
    for update in respuesta.get("result", []):
        mensaje = update.get("message") or {}
        chat = mensaje.get("chat") or {}
        if chat.get("id"):
            chats[chat["id"]] = chat.get("first_name") or chat.get("username") or str(chat["id"])
    if len(chats) != 1:
        return None
    # Solo el id numérico (sin el nombre, que podía romper el parseo)
    return str(next(iter(chats.keys())))


def enviar_telegram(bot_token: str, chat_id: str, texto: str, documento: bytes | None = None, nombre: str = "") -> None:
    """Envía un mensaje (y opcionalmente un documento) vía bot de Telegram."""
    url = f"https://api.telegram.org/bot{bot_token}/"
    if documento is not None:
        respuesta = requests.post(
            url + "sendDocument",
            data={"chat_id": chat_id, "caption": texto},
            files={"document": (nombre, documento, "application/gzip")},
            timeout=60,
        )
    else:
        respuesta = requests.post(
            url + "sendMessage",
            data={"chat_id": chat_id, "text": texto},
            timeout=30,
        )
    datos = respuesta.json()
    if not datos.get("ok"):
        raise RuntimeError(
            f"Telegram rechazó el envío: {datos.get('description', 'error desconocido')}"
        )


async def _respaldar_todas_las_orgs() -> None:
    """Genera un respaldo y lo envía a cada organización con Telegram configurado."""

    def _trabajo() -> int:
        db = SessionLocal()
        try:
            conteos = db.execute(
                select(Setting.organization_id).filter(Setting.clave == "telegram_bot_token").distinct()
            ).scalars().all()
            for org_id in conteos:
                bot_token = _obtener_setting(db, org_id, "telegram_bot_token")
                chat_guardado = _obtener_setting(db, org_id, "telegram_chat_id")
                if not bot_token or not chat_guardado:
                    continue
                chat_id = chat_guardado.split(":", 1)[0]
                contenido = generar_backup(db, org_id)
                nombre = f"respaldo-{datetime.utcnow():%Y%m%d-%H%M}.json.gz"
                try:
                    enviar_telegram(
                        bot_token,
                        chat_id,
                        f"📦 Respaldo automático de Librería App ({nombre})",
                        contenido,
                        nombre,
                    )
                    logger.info("Respaldo enviado a la organización %s", org_id)
                except Exception as e:  # noqa: BLE001
                    logger.warning("Fallo al enviar respaldo a org %s: %s", org_id, e)
            return len(conteos)
        finally:
            db.close()

    await asyncio.to_thread(_trabajo)


def _segundos_hasta_las_04_utc() -> float:
    ahora = datetime.utcnow()
    proxima = (ahora + timedelta(days=1)).replace(hour=4, minute=0, second=0, microsecond=0)
    return max(60.0, (proxima - ahora).total_seconds())


async def planificador_respaldos() -> None:
    """Bucle diario: respaldo a las 04:00 UTC (23:00 en Colombia)."""
    while True:
        await asyncio.sleep(_segundos_hasta_las_04_utc())
        try:
            await _respaldar_todas_las_orgs()
        except Exception as e:  # noqa: BLE001
            logger.exception("Fallo en el planificador de respaldos: %s", e)