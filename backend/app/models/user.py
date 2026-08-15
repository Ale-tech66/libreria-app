from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(
        Integer, ForeignKey("organizations.id"), nullable=False, index=True
    )
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    rol = Column(String(20), nullable=False, default="ventas")  # admin, inventario, ventas
    activo = Column(Boolean, default=True)
    mfa_secret = Column(String(32), nullable=True)  # secreto TOTP (null = sin MFA)

    organizacion = relationship("Organization", back_populates="usuarios")

    @property
    def mfa_activo(self) -> bool:
        return self.mfa_secret is not None