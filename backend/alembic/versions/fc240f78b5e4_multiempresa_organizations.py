"""multiempresa organizations

Revision ID: fc240f78b5e4
Revises: a086dbc115e9
Create Date: 2026-08-15 16:50:39.927723

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fc240f78b5e4'
down_revision: Union[str, Sequence[str], None] = 'a086dbc115e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nombre", sa.String(length=200), nullable=False),
        sa.Column("tipo_negocio", sa.String(length=50), nullable=True),
        sa.Column("propietario", sa.String(length=200), nullable=True),
        sa.Column("correo", sa.String(length=200), nullable=True),
        sa.Column("telefono", sa.String(length=50), nullable=True),
        sa.Column("pais", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_organizations_id", "organizations", ["id"])

    # Organización por defecto para los datos existentes
    op.execute(
        "INSERT INTO organizations (nombre, tipo_negocio, propietario, created_at) "
        "VALUES ('Mi Negocio', 'libreria', 'admin', now())"
    )

    op.add_column("users", sa.Column("organization_id", sa.Integer(), nullable=True))
    op.add_column("productos", sa.Column("organization_id", sa.Integer(), nullable=True))
    op.add_column("ventas", sa.Column("organization_id", sa.Integer(), nullable=True))
    op.add_column("audit_logs", sa.Column("organization_id", sa.Integer(), nullable=True))

    op.execute("UPDATE users SET organization_id = 1 WHERE organization_id IS NULL")
    op.execute("UPDATE productos SET organization_id = 1 WHERE organization_id IS NULL")
    op.execute("UPDATE ventas SET organization_id = 1 WHERE organization_id IS NULL")
    op.execute("UPDATE audit_logs SET organization_id = 1 WHERE organization_id IS NULL")

    op.alter_column("users", "organization_id", existing_type=sa.Integer(), nullable=False)
    op.alter_column("productos", "organization_id", existing_type=sa.Integer(), nullable=False)
    op.alter_column("ventas", "organization_id", existing_type=sa.Integer(), nullable=False)
    op.alter_column("audit_logs", "organization_id", existing_type=sa.Integer(), nullable=False)

    op.create_index("ix_users_organization_id", "users", ["organization_id"])
    op.create_index("ix_productos_organization_id", "productos", ["organization_id"])
    op.create_index("ix_ventas_organization_id", "ventas", ["organization_id"])
    op.create_index("ix_audit_logs_organization_id", "audit_logs", ["organization_id"])

    # El código de barras deja de ser único global: pasa a ser único por empresa
    op.drop_index("ix_productos_codigo_barras", table_name="productos")
    op.create_index(
        "ix_productos_org_codigo",
        "productos",
        ["organization_id", "codigo_barras"],
        unique=True,
    )

    op.create_foreign_key("fk_users_org", "users", "organizations", ["organization_id"], ["id"])
    op.create_foreign_key("fk_productos_org", "productos", "organizations", ["organization_id"], ["id"])
    op.create_foreign_key("fk_ventas_org", "ventas", "organizations", ["organization_id"], ["id"])
    op.create_foreign_key("fk_audit_org", "audit_logs", "organizations", ["organization_id"], ["id"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("fk_audit_org", "audit_logs", type_="foreignkey")
    op.drop_constraint("fk_ventas_org", "ventas", type_="foreignkey")
    op.drop_constraint("fk_productos_org", "productos", type_="foreignkey")
    op.drop_constraint("fk_users_org", "users", type_="foreignkey")
    op.drop_index("ix_audit_logs_organization_id", table_name="audit_logs")
    op.drop_index("ix_ventas_organization_id", table_name="ventas")
    op.drop_index("ix_productos_organization_id", table_name="productos")
    op.drop_index("ix_users_organization_id", table_name="users")
    op.drop_column("audit_logs", "organization_id")
    op.drop_column("ventas", "organization_id")
    op.drop_column("productos", "organization_id")
    op.drop_column("users", "organization_id")
    op.drop_table("organizations")
