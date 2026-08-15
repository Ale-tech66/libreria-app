"""productos activo not null con default

Revision ID: e34ea81cc575
Revises: a10499b448a0
Create Date: 2026-08-15 11:20:06.914288

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e34ea81cc575'
down_revision: Union[str, Sequence[str], None] = 'a10499b448a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("UPDATE productos SET activo = true WHERE activo IS NULL")
    op.alter_column(
        "productos",
        "activo",
        existing_type=sa.Boolean(),
        nullable=False,
        server_default=sa.text("true"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        "productos",
        "activo",
        existing_type=sa.Boolean(),
        nullable=True,
        server_default=None,
    )
