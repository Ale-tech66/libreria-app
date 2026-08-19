from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# Pool endurecido: pre-ping (detecta conexiones muertas tras un reinicio de
# Postgres), reciclado cada 30 min y timeout de conexión para no colgarse.
_pool_kwargs = {}
if settings.DATABASE_URL.startswith("postgres"):
    _pool_kwargs = {
        "pool_pre_ping": True,
        "pool_recycle": 1800,
        "pool_size": 5,
        "max_overflow": 10,
        "connect_args": {"connect_timeout": 10},
    }

engine = create_engine(settings.DATABASE_URL, **_pool_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependencia para obtener la sesión de la BD
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()