"""rate limits y mfa tokens usados en BD

Revision ID: 5a1c0d2e7b9f
Revises: 9f3a6c21d8e4
Create Date: 2026-08-18 23:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5a1c0d2e7b9f'
down_revision: Union[str, Sequence[str], None] = '9f3a6c21d8e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Rate limiting persistente: sobrevive reinicios, el atacante no puede
    # reseteárselo reiniciando la app.
    op.create_table(
        "rate_limits",
        sa.Column("clave", sa.String(length=200), nullable=False),
        sa.Column("intentos", sa.Integer(), nullable=False),
        sa.Column("expira", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("clave"),
    )
    op.create_index("ix_rate_limits_expira", "rate_limits", ["expira"])

    # Anti-replay de mfa_token (jti de un solo uso), también persistente.
    op.create_table(
        "mfa_tokens_usados",
        sa.Column("jti", sa.String(length=32), nullable=False),
        sa.Column("expira", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("jti"),
    )
    op.create_index("ix_mfa_tokens_usados_expira", "mfa_tokens_usados", ["expira"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_mfa_tokens_usados_expira", table_name="mfa_tokens_usados")
    op.drop_table("mfa_tokens_usados")
    op.drop_index("ix_rate_limits_expira", table_name="rate_limits")
    op.drop_table("rate_limits")
