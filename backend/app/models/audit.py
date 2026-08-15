from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, nullable=True)  # None = acción del sistema
    username = Column(String(50), nullable=True)
    accion = Column(String(50), nullable=False)  # login, crear, editar, desactivar, vender...
    recurso = Column(String(50), nullable=False)  # usuario, producto, venta
    recurso_id = Column(Integer, nullable=True)
    detalle = Column(Text, nullable=True)
    fecha = Column(DateTime, default=datetime.now, nullable=False)