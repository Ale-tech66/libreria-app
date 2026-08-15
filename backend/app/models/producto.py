from sqlalchemy import Boolean, Column, ForeignKey, Integer, Numeric, String, UniqueConstraint

from app.core.database import Base


class Producto(Base):
    __tablename__ = "productos"
    __table_args__ = (
        UniqueConstraint("organization_id", "codigo_barras", name="ix_productos_org_codigo"),
    )

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(
        Integer, ForeignKey("organizations.id"), nullable=False, index=True
    )
    codigo_barras = Column(String(50), index=True, nullable=False)
    nombre = Column(String(200), nullable=False)
    autor = Column(String(150), nullable=True) # Para libros
    editorial = Column(String(100), nullable=True)
    precio_venta = Column(Numeric(10, 2), nullable=False)
    stock = Column(Integer, default=0)
    unidades_por_caja = Column(Integer, default=1)
    foto = Column(String(255), nullable=True) # Nombre del archivo subido
    activo = Column(Boolean, default=True)    # Soft delete