"""users correo y codigos de verificacion

Revision ID: 73530ad5ffcd
Revises: b15e18387d10
Create Date: 2026-08-15 21:39:18.677696

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '73530ad5ffcd'
down_revision: Union[str, Sequence[str], None] = 'b15e18387d10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("users", sa.Column("correo", sa.String(length=200), nullable=True))
    op.add_column("users", sa.Column("codigo_verificacion", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("codigo_expira", sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "codigo_expira")
    op.drop_column("users", "codigo_verificacion")
    op.drop_column("users", "correo")
