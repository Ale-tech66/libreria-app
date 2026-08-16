import asyncio
import base64
import gzip
import json
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

import requests
from sqlalchemy import DateTime, delete, select, text
from sqlalchemy.orm import Session

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

BACKUP_VERSION = 1


def _serializar(valor: Any) -> Any:
    if isinstance(valor, datetime):
        return valor.isoformat()
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, (bytes, bytearray, memoryview)):
        return base64.b64encode(bytes(valor)).decode("ascii")
    return valor


def generar_backup(db: Session) -> bytes:
    """Respaldo completo de la BD como JSON comprimido (gzip).

    Restaurable con restaurar_backup() o el script restore_backup.py.
    """
    tablas = Base.metadata.tables
    nombres = [
        n for n in ORDEN_TABLAS if n in tablas
    ] + [n for n in sorted(tablas) if n not in ORDEN_TABLAS]

    contenido: dict[str, Any] = {
        "app": "libreria-app",
        "version": BACKUP_VERSION,
        "generado": datetime.utcnow().isoformat(),
        "tablas": {},
    }
    for nombre in nombres:
        filas = db.execute(select(tablas[nombre])).mappings().all()
        contenido["tablas"][nombre] = [
            {k: _serializar(v) for k, v in fila.items()} for fila in filas
        ]
    return gzip.compress(json.dumps(contenido, ensure_ascii=False).encode("utf-8"))


def restaurar_backup(db: Session, contenido: bytes) -> dict[str, int]:
    """Vacía las tablas y las rellena desde un respaldo.

    Devuelve la cantidad de filas restauradas por tabla.
    """
    datos = json.loads(gzip.decompress(contenido))
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
    """Busca el chat más reciente del bot (tras que el dueño le envíe /start)."""
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
    if not chats:
        return None
    chat_id = list(chats.keys())[-1]
    return f"{chat_id}:{chats[chat_id]}"


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
        raise RuntimeError(f"Telegram rechazó el envío: {datos.get('description', 'error desconocido')}")


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
                contenido = generar_backup(db)
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