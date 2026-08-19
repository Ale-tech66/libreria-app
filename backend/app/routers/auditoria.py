from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas import AuditLogOut, Paginated

router = APIRouter(
    prefix="/auditoria",
    tags=["Auditoría"],
    dependencies=[Depends(require_role("admin"))],
)


@router.get("/", response_model=Paginated[AuditLogOut])
def listar_auditoria(
    page: int = Query(default=1, ge=1, le=1000),
    page_size: int = Query(default=50, ge=1, le=200),
    recurso: str | None = Query(default=None, description="Filtra por tipo: usuario, producto, venta, sesion"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Registro de acciones críticas: quién, cuándo y qué hizo."""
    query = db.query(AuditLog).filter(
        AuditLog.organization_id == admin.organization_id
    )
    if recurso:
        query = query.filter(AuditLog.recurso == recurso)

    total = query.count()
    registros = (
        query.order_by(AuditLog.fecha.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total": total, "page": page, "page_size": page_size, "items": registros}