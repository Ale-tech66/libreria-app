"""ventas usuario vendedor

Revision ID: 886786fb85c3
Revises: fc240f78b5e4
Create Date: 2026-08-15 17:29:46.216855

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '886786fb85c3'
down_revision: Union[str, Sequence[str], None] = 'fc240f78b5e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("ventas", sa.Column("usuario_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_ventas_usuario", "ventas", "users", ["usuario_id"], ["id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("fk_ventas_usuario", "ventas", type_="foreignkey")
    op.drop_column("ventas", "usuario_id")
