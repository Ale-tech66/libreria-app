from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def registrar(
    db: Session,
    accion: str,
    recurso: str,
    recurso_id: int | None = None,
    detalle: str | None = None,
    usuario_id: int | None = None,
    username: str | None = None,
    organization_id: int | None = None,
) -> AuditLog:
    """Registra una acción crítica en el log de auditoría."""
    entrada = AuditLog(
        organization_id=organization_id,
        usuario_id=usuario_id,
        username=username,
        accion=accion,
        recurso=recurso,
        recurso_id=recurso_id,
        detalle=detalle,
    )
    db.add(entrada)
    db.commit()
    return entrada