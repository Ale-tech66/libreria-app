"""ventas id_local (dedup atomico) y ip en auditoria

Revision ID: 9f3a6c21d8e4
Revises: 73530ad5ffcd
Create Date: 2026-08-18 23:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f3a6c21d8e4'
down_revision: Union[str, Sequence[str], None] = '73530ad5ffcd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Idempotencia de ventas: el id del cliente es único por organización,
    # así la BD impide cobrar dos veces aunque el reintento llegue en
    # paralelo o tras un reinicio del servidor.
    op.add_column("ventas", sa.Column("id_local", sa.String(length=100), nullable=True))
    op.create_index("ix_ventas_id_local", "ventas", ["id_local"])
    op.create_index(
        "uq_ventas_org_id_local",
        "ventas",
        ["organization_id", "id_local"],
        unique=True,
        postgresql_where=sa.text("id_local IS NOT NULL"),
    )

    # IP del actor en el registro de auditoría (trazabilidad de accesos)
    op.add_column("audit_logs", sa.Column("ip", sa.String(length=45), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("audit_logs", "ip")
    op.drop_index("uq_ventas_org_id_local", table_name="ventas")
    op.drop_index("ix_ventas_id_local", table_name="ventas")
    op.drop_column("ventas", "id_local")