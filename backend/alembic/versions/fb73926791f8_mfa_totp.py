"""mfa totp

Revision ID: fb73926791f8
Revises: 399f6da28835
Create Date: 2026-08-15 18:02:32.499746

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fb73926791f8'
down_revision: Union[str, Sequence[str], None] = '399f6da28835'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("users", sa.Column("mfa_secret", sa.String(length=32), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "mfa_secret")
