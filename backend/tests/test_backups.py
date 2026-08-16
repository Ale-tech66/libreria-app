import gzip
import json

from app.core.backups import generar_backup, restaurar_backup
from tests.test_ventas import auth, crear_producto


def _backup(client, token):
    return client.get("/backups/descargar", headers=auth(token))


class TestDescargarRespaldo:
    def test_solo_admin(self, client, admin_token, ventas_token, crear_usuario, org_principal):
        crear_usuario("inv_back", "123456", "inventario", org=org_principal)
        token_inv = client.post(
            "/auth/login", data={"username": "inv_back", "password": "123456"}
        ).json()["access_token"]
        assert _backup(client, ventas_token).status_code == 403
        assert _backup(client, token_inv).status_code == 403

    def test_respaldo_incluye_datos(self, client, admin_token):
        crear_producto(client, admin_token, stock=3)
        response = _backup(client, admin_token)
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/gzip"
        datos = json.loads(gzip.decompress(response.content))
        assert datos["app"] == "libreria-app"
        assert len(datos["tablas"]["productos"]) == 1
        assert datos["tablas"]["productos"][0]["stock"] == 3
        assert datos["tablas"]["users"][0]["username"] == "admin"


class TestConfigTelegram:
    def test_guardar_configuracion(self, client, admin_token):
        response = client.put(
            "/backups/telegram",
            headers=auth(admin_token),
            json={"bot_token": "123456:ABC", "chat_id": "987654:Juan"},
        )
        assert response.status_code == 200
        assert response.json()["chat_id"] == "987654:Juan"

        estado = client.get("/backups/telegram", headers=auth(admin_token)).json()
        assert estado["bot_token_guardado"] is True
        assert estado["bot_token_sufijo"] == "...:ABC"
        assert estado["chat_id"] == "987654:Juan"

    def test_sin_chat_id_busca_deteccion(self, client, admin_token):
        response = client.put(
            "/backups/telegram",
            headers=auth(admin_token),
            json={"bot_token": "token-invalido"},
        )
        # El token no es real: se rechaza pidiendo el /start
        assert response.status_code == 400
        assert "Envía /start" in response.json()["detail"]

    def test_probar_sin_configurar(self, client, admin_token):
        response = client.post("/backups/telegram/probar", headers=auth(admin_token))
        assert response.status_code == 400

    def test_aislamiento_entre_orgs(self, client, crear_usuario, crear_org, admin_token):
        org_b = crear_org(nombre="Org B")
        admin_b = crear_usuario("admin_b", "123456", "admin", org=org_b)
        token_b = client.post(
            "/auth/login", data={"username": "admin_b", "password": "123456"}
        ).json()["access_token"]

        client.put(
            "/backups/telegram",
            headers=auth(token_b),
            json={"bot_token": "111:BBB", "chat_id": "111:Pedro"},
        )
        estado_a = client.get("/backups/telegram", headers=auth(admin_token)).json()
        assert estado_a["bot_token_guardado"] is False
        estado_b = client.get("/backups/telegram", headers=auth(token_b)).json()
        assert estado_b["chat_id"] == "111:Pedro"


class TestRestaurarBackup:
    def test_ida_y_vuelta(self, db_session):
        """generar_backup -> restaurar_backup en BD limpia debe ser idéntico."""
        from app.models.organization import Organization
        from app.models.producto import Producto
        from app.models.user import User

        org = Organization(nombre="Librería Ida y Vuelta")
        db_session.add(org)
        db_session.commit()

        from app.core.security import get_password_hash

        usuario = User(
            username="dueno",
            hashed_password=get_password_hash("123456"),
            rol="admin",
            organization_id=org.id,
        )
        db_session.add(usuario)
        producto = Producto(
            codigo_barras="7777777777777",
            nombre="Libro de Prueba",
            precio_venta=19.99,
            stock=4,
            organization_id=org.id,
        )
        db_session.add(producto)
        db_session.commit()

        contenido = generar_backup(db_session)

        # Borra todo y restaura
        from sqlalchemy import delete

        from app.core.database import Base

        for tabla in reversed(Base.metadata.sorted_tables):
            db_session.execute(delete(tabla))
        db_session.commit()

        restauradas = restaurar_backup(db_session, contenido)
        assert restauradas["organizations"] == 1
        assert restauradas["users"] == 1
        assert restauradas["productos"] == 1

        org2 = db_session.query(Organization).first()
        prod2 = db_session.query(Producto).first()
        assert org2.nombre == "Librería Ida y Vuelta"
        assert prod2.codigo_barras == "7777777777777"
        assert float(prod2.precio_venta) == 19.99
        assert prod2.stock == 4
        assert prod2.organization_id == org2.id

    def test_respaldo_invalido(self, db_session):
        from app.core.backups import restaurar_backup

        import pytest

        with pytest.raises(ValueError):
            restaurar_backup(db_session, gzip.compress(b'{"app":"otro","version":1}'))