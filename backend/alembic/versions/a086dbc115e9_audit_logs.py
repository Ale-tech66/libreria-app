"""audit_logs

Revision ID: a086dbc115e9
Revises: e34ea81cc575
Create Date: 2026-08-15 16:32:01.267334

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a086dbc115e9'
down_revision: Union[str, Sequence[str], None] = 'e34ea81cc575'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("usuario_id", sa.Integer(), nullable=True),
        sa.Column("username", sa.String(length=50), nullable=True),
        sa.Column("accion", sa.String(length=50), nullable=False),
        sa.Column("recurso", sa.String(length=50), nullable=False),
        sa.Column("recurso_id", sa.Integer(), nullable=True),
        sa.Column("detalle", sa.Text(), nullable=True),
        sa.Column("fecha", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_audit_logs_id", "audit_logs", ["id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_audit_logs_id", table_name="audit_logs")
    op.drop_table("audit_logs")
