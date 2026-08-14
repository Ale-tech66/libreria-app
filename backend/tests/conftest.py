import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.main import app
from app.models import user, producto, venta  # noqa: F401  (registra los modelos)
from app.models.user import User

# Por defecto SQLite en memoria; en CI se usa Postgres real (TEST_DATABASE_URL)
TEST_DB = os.environ.get("TEST_DATABASE_URL", "sqlite://")


@pytest.fixture
def db_engine():
    kwargs = {}
    if TEST_DB.startswith("sqlite"):
        kwargs = {"connect_args": {"check_same_thread": False}, "poolclass": StaticPool}
    engine = create_engine(TEST_DB, **kwargs)
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(db_engine):
    TestingSession = sessionmaker(
        autocommit=False, autoflush=False, bind=db_engine
    )
    session = TestingSession()
    yield session
    session.close()


@pytest.fixture
def client(db_engine):
    TestingSession = sessionmaker(
        autocommit=False, autoflush=False, bind=db_engine
    )

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def crear_usuario(db_session):
    """Factory que crea usuarios directamente en BD."""

    def _crear(
        username: str,
        password: str = "123456",
        rol: str = "ventas",
        activo: bool = True,
    ):
        usuario = User(
            username=username,
            hashed_password=get_password_hash(password),
            rol=rol,
            activo=activo,
        )
        db_session.add(usuario)
        db_session.commit()
        return usuario

    return _crear


@pytest.fixture
def admin_token(client, crear_usuario):
    crear_usuario("admin", "admin123", "admin")
    response = client.post("/auth/login", data={"username": "admin", "password": "admin123"})
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture
def ventas_token(client, crear_usuario):
    crear_usuario("vendedor", "123456", "ventas")
    response = client.post("/auth/login", data={"username": "vendedor", "password": "123456"})
    assert response.status_code == 200
    return response.json()["access_token"]


def auth(token: str):
    return {"Authorization": f"Bearer {token}"}