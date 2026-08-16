from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint

from app.core.database import Base


class Setting(Base):
    """Configuración por organización (ej. Telegram para respaldos)."""

    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    clave = Column(String(100), nullable=False)
    valor = Column(String(2000), nullable=False)

    __table_args__ = (
        UniqueConstraint("organization_id", "clave", name="uq_settings_org_clave"),
    )