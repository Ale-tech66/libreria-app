from sqlalchemy import Column, Integer, String, Numeric
from app.core.database import Base

class Producto(Base):
    __tablename__ = "productos"

    id = Column(Integer, primary_key=True, index=True)
    codigo_barras = Column(String(50), unique=True, index=True, nullable=False)
    nombre = Column(String(200), nullable=False)
    autor = Column(String(150), nullable=True) # Para libros
    editorial = Column(String(100), nullable=True)
    precio_venta = Column(Numeric(10, 2), nullable=False)
    stock = Column(Integer, default=0)
    unidades_por_caja = Column(Integer, default=1)
    