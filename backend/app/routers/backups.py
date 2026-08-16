from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.backups import (
    _guardar_setting,
    _obtener_setting,
    detectar_chat_id,
    enviar_telegram,
    generar_backup,
)
from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User

router = APIRouter(
    prefix="/backups",
    tags=["Respaldo"],
    dependencies=[Depends(require_role("admin"))],
)


class TelegramConfig(BaseModel):
    bot_token: str = Field(min_length=1, max_length=200)
    chat_id: str | None = Field(default=None, max_length=100)


class TelegramEstado(BaseModel):
    bot_token_guardado: bool
    bot_token_sufijo: str | None = None
    chat_id: str | None = None


class TelegramResultado(BaseModel):
    ok: bool
    chat_id: str | None = None
    detalle: str


@router.get("/descargar")
def descargar_respaldo(
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    """Respaldo completo de la base de datos (gzip JSON). Solo admin."""
    contenido = generar_backup(db)
    nombre = f"respaldo-{datetime.utcnow():%Y%m%d-%H%M}.json.gz"
    return Response(
        content=contenido,
        media_type="application/gzip",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )


@router.get("/telegram", response_model=TelegramEstado)
def estado_telegram(
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    token = _obtener_setting(db, usuario.organization_id, "telegram_bot_token")
    chat = _obtener_setting(db, usuario.organization_id, "telegram_chat_id")
    return {
        "bot_token_guardado": bool(token),
        "bot_token_sufijo": f"...{token[-4:]}" if token else None,
        "chat_id": chat,
    }


@router.put("/telegram", response_model=TelegramResultado)
def configurar_telegram(
    config: TelegramConfig,
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    _guardar_setting(db, usuario.organization_id, "telegram_bot_token", config.bot_token.strip())

    if config.chat_id and config.chat_id.strip():
        chat = config.chat_id.strip()
        _guardar_setting(db, usuario.organization_id, "telegram_chat_id", chat)
        return {"ok": True, "chat_id": chat, "detalle": "Configuración guardada"}

    # Sin chat_id: se detecta solo tras enviar /start al bot
    chat = detectar_chat_id(config.bot_token.strip())
    if not chat:
        raise HTTPException(
            status_code=400,
            detail="No encontré el chat. Envía /start al bot en Telegram y vuelve a intentarlo.",
        )
    _guardar_setting(db, usuario.organization_id, "telegram_chat_id", chat)
    return {"ok": True, "chat_id": chat, "detalle": "Chat de Telegram conectado"}


@router.post("/telegram/probar", response_model=TelegramResultado)
def probar_telegram(
    db: Session = Depends(get_db),
    usuario: User = Depends(get_current_user),
):
    token = _obtener_setting(db, usuario.organization_id, "telegram_bot_token")
    chat_guardado = _obtener_setting(db, usuario.organization_id, "telegram_chat_id")
    if not token or not chat_guardado:
        raise HTTPException(
            status_code=400,
            detail="Primero configura el bot de Telegram en esta pantalla.",
        )
    chat_id = chat_guardado.split(":", 1)[0]
    try:
        enviar_telegram(token, chat_id, "✅ Conectado: recibirás el respaldo diario aquí.")
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"ok": True, "chat_id": chat_guardado, "detalle": "Mensaje de prueba enviado"}