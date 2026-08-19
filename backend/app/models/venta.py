from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    DateTime,
    ForeignKey,
    Index,
    text,
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class Venta(Base):
    __tablename__ = "ventas"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(
        Integer, ForeignKey("organizations.id"), nullable=False, index=True
    )
    usuario_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    fecha = Column(DateTime, default=datetime.utcnow)
    total = Column(Numeric(10, 2), nullable=False)
    metodo_pago = Column(String(20), default="efectivo")
    # Id del cliente para deduplicar reintentos (offline y online). Único por
    # organización: la BD impide crear la misma venta dos veces, aunque dos
    # requests lleguen al mismo tiempo o el proceso se reinicie.
    id_local = Column(String(100), nullable=True, index=True)

    # Relación: Una venta tiene muchos detalles
    detalles = relationship("VentaDetalle", back_populates="venta", cascade="all, delete-orphan")
    vendedor = relationship("User", foreign_keys=[usuario_id])

    __table_args__ = (
        # Unicidad parcial: solo aplica cuando id_local existe (ventas locales)
        Index(
            "uq_ventas_org_id_local",
            "organization_id",
            "id_local",
            unique=True,
            postgresql_where=text("id_local IS NOT NULL"),
        ),
    )

class VentaDetalle(Base):
    __tablename__ = "venta_detalles"

    id = Column(Integer, primary_key=True, index=True)
    venta_id = Column(Integer, ForeignKey("ventas.id"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)
    cantidad = Column(Integer, nullable=False)
    precio_unitario = Column(Numeric(10, 2), nullable=False)
    
    # Relación inversa
    venta = relationship("Venta", back_populates="detalles")
    producto = relationship("Producto")