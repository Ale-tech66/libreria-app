from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(200), nullable=False)
    tipo_negocio = Column(String(50), nullable=True)
    propietario = Column(String(200), nullable=True)
    correo = Column(String(200), nullable=True)
    telefono = Column(String(50), nullable=True)
    pais = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.now, nullable=False)

    usuarios = relationship("User", back_populates="organizacion")