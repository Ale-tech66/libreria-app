"""settings tabla

Revision ID: b15e18387d10
Revises: fb73926791f8
Create Date: 2026-08-15 20:01:43.234406

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b15e18387d10'
down_revision: Union[str, Sequence[str], None] = 'fb73926791f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "organization_id",
            sa.Integer(),
            sa.ForeignKey("organizations.id"),
            nullable=False,
        ),
        sa.Column("clave", sa.String(length=100), nullable=False),
        sa.Column("valor", sa.String(length=2000), nullable=False),
        sa.UniqueConstraint("organization_id", "clave", name="uq_settings_org_clave"),
    )
    op.create_index("ix_settings_id", "settings", ["id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_settings_id", table_name="settings")
    op.drop_table("settings")
