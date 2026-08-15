from tests.conftest import auth


class TestAuditoria:
    def test_login_registra_auditoria(self, client, crear_usuario):
        crear_usuario("auditor", "123456", "ventas")
        client.post("/auth/login", data={"username": "auditor", "password": "123456"})

        admin = crear_usuario("adminx", "123456", "admin")
        token = client.post(
            "/auth/login", data={"username": "adminx", "password": "123456"}
        ).json()["access_token"]
        response = client.get("/auditoria/", headers=auth(token))
        assert response.status_code == 200
        acciones = [r["accion"] for r in response.json()["items"]]
        assert "login" in acciones

    def test_crear_producto_registra_auditoria(self, client, admin_token):
        client.post(
            "/productos/",
            headers=auth(admin_token),
            json={
                "codigo_barras": "999000111",
                "nombre": "Auditado",
                "precio_venta": 10.0,
                "stock": 5,
            },
        )
        response = client.get("/auditoria/", headers=auth(admin_token))
        assert response.status_code == 200
        assert any(
            r["accion"] == "crear" and r["recurso"] == "producto"
            for r in response.json()["items"]
        )

    def test_venta_registra_auditoria(self, client, admin_token):
        client.post(
            "/productos/",
            headers=auth(admin_token),
            json={
                "codigo_barras": "999000222",
                "nombre": "Auditado venta",
                "precio_venta": 5.0,
                "stock": 10,
            },
        )
        client.post(
            "/ventas/",
            headers=auth(admin_token),
            json={"metodo_pago": "efectivo", "detalles": [{"producto_id": 1, "cantidad": 2}]},
        )
        response = client.get("/auditoria/", headers=auth(admin_token))
        assert response.status_code == 200
        assert any(
            r["accion"] == "vender" and r["recurso"] == "venta"
            for r in response.json()["items"]
        )

    def test_auditoria_solo_admin(self, client, ventas_token):
        response = client.get("/auditoria/", headers=auth(ventas_token))
        assert response.status_code == 403

    def test_auditoria_filtro_por_recurso(self, client, admin_token):
        client.get("/auditoria/?recurso=usuario", headers=auth(admin_token))
        response = client.get("/auditoria/?recurso=venta", headers=auth(admin_token))
        assert response.status_code == 200
        assert all(r["recurso"] == "venta" for r in response.json()["items"])