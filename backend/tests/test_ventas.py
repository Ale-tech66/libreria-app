from tests.conftest import auth

PRODUCTO = {
    "codigo_barras": "9781234567890",
    "nombre": "Don Quijote",
    "precio_venta": 25.00,
    "stock": 5,
}


def crear_producto(client, admin_token, **overrides):
    data = {**PRODUCTO, **overrides}
    response = client.post("/productos/", headers=auth(admin_token), json=data)
    assert response.status_code == 200
    return response.json()


class TestCrearVenta:
    def test_venta_con_precio_del_servidor(self, client, admin_token, ventas_token):
        producto = crear_producto(client, admin_token)
        response = client.post(
            "/ventas/",
            headers=auth(ventas_token),
            json={
                "metodo_pago": "efectivo",
                "detalles": [
                    # El cliente intenta manipular el precio (0.01)
                    {"producto_id": producto["id"], "cantidad": 2, "precio_unitario": 0.01}
                ],
            },
        )
        assert response.status_code == 200
        assert response.json()["total"] == 50.0  # 2 x 25.00
        assert response.json()["detalles"][0]["precio_unitario"] == 25.0
        assert response.json()["detalles"][0]["producto_nombre"] == "Don Quijote"

    def test_stock_descontado(self, client, admin_token, ventas_token):
        producto = crear_producto(client, admin_token)
        client.post(
            "/ventas/",
            headers=auth(ventas_token),
            json={"detalles": [{"producto_id": producto["id"], "cantidad": 2}]},
        )
        buscado = client.get(
            f"/productos/{producto['codigo_barras']}", headers=auth(admin_token)
        ).json()
        assert buscado["stock"] == 3

    def test_stock_insuficiente(self, client, admin_token, ventas_token):
        producto = crear_producto(client, admin_token, stock=1)
        response = client.post(
            "/ventas/",
            headers=auth(ventas_token),
            json={"detalles": [{"producto_id": producto["id"], "cantidad": 99}]},
        )
        assert response.status_code == 400
        # El stock no debe cambiar tras el fallo
        buscado = client.get(
            f"/productos/{producto['codigo_barras']}", headers=auth(admin_token)
        ).json()
        assert buscado["stock"] == 1

    def test_producto_inexistente(self, client, ventas_token):
        response = client.post(
            "/ventas/",
            headers=auth(ventas_token),
            json={"detalles": [{"producto_id": 9999, "cantidad": 1}]},
        )
        assert response.status_code == 404

    def test_cantidad_cero_rechazada(self, client, admin_token, ventas_token):
        producto = crear_producto(client, admin_token)
        response = client.post(
            "/ventas/",
            headers=auth(ventas_token),
            json={"detalles": [{"producto_id": producto["id"], "cantidad": 0}]},
        )
        assert response.status_code == 422

    def test_detalles_vacios_rechazados(self, client, ventas_token):
        response = client.post(
            "/ventas/", headers=auth(ventas_token), json={"detalles": []}
        )
        assert response.status_code == 422

    def test_venta_sin_token(self, client):
        assert client.post("/ventas/", json={"detalles": []}).status_code == 401


class TestRecibo:
    def test_recibo_con_datos_del_negocio(self, client, admin_token, ventas_token):
        producto = crear_producto(client, admin_token)
        venta = client.post(
            "/ventas/",
            headers=auth(ventas_token),
            json={"metodo_pago": "efectivo", "detalles": [{"producto_id": producto["id"], "cantidad": 2}]},
        ).json()
        response = client.get(f"/ventas/{venta['id']}/recibo", headers=auth(admin_token))
        assert response.status_code == 200
        data = response.json()
        assert data["negocio"]["nombre"] == "Librería Principal"
        assert data["vendedor"] == "vendedor"
        assert data["venta"]["id"] == venta["id"]
        assert data["venta"]["detalles"][0]["producto_nombre"] == "Don Quijote"

    def test_recibo_con_rol_ventas(self, client, admin_token, ventas_token):
        producto = crear_producto(client, admin_token)
        venta = client.post(
            "/ventas/",
            headers=auth(ventas_token),
            json={"detalles": [{"producto_id": producto["id"], "cantidad": 1}]},
        ).json()
        response = client.get(f"/ventas/{venta['id']}/recibo", headers=auth(ventas_token))
        assert response.status_code == 200

    def test_recibo_sin_token(self, client, admin_token):
        producto = crear_producto(client, admin_token)
        venta = client.post(
            "/ventas/", headers=auth(admin_token), json={"detalles": [{"producto_id": producto["id"], "cantidad": 1}]}
        ).json()
        assert client.get(f"/ventas/{venta['id']}/recibo").status_code == 401

    def test_recibo_inexistente(self, client, admin_token):
        assert client.get("/ventas/9999/recibo", headers=auth(admin_token)).status_code == 404

    def test_recibo_de_otra_org_prohibido(self, client, crear_usuario, crear_org, ventas_token):
        org_ajena = crear_org(nombre="Otra")
        admin_ajeno = crear_usuario("ajeno", "123456", "admin", org=org_ajena)
        token_ajeno = client.post(
            "/auth/login", data={"username": "ajeno", "password": "123456"}
        ).json()["access_token"]
        producto = client.post(
            "/productos/", headers=auth(token_ajeno), json={**PRODUCTO, "codigo_barras": "000999"}
        ).json()
        venta = client.post(
            "/ventas/", headers=auth(token_ajeno), json={"detalles": [{"producto_id": producto["id"], "cantidad": 1}]}
        ).json()
        # El vendedor de la empresa principal no puede ver el recibo de otra empresa
        response = client.get(f"/ventas/{venta['id']}/recibo", headers=auth(ventas_token))
        assert response.status_code == 404


class TestSyncOffline:
    def _sync(self, client, token, ventas):
        return client.post(
            "/ventas/offline-sync",
            headers=auth(token),
            json={"ventas": ventas},
        )

    def test_sincroniza_venta_y_descuenta_stock(self, client, admin_token):
        producto = crear_producto(client, admin_token, stock=10)
        response = self._sync(
            client,
            admin_token,
            [
                {
                    "id_local": "local-1",
                    "fecha": "2026-08-15T10:00:00",
                    "metodo_pago": "efectivo",
                    "detalles": [{"producto_id": producto["id"], "cantidad": 2}],
                }
            ],
        )
        assert response.status_code == 200
        resultado = response.json()["resultados"][0]
        assert resultado["id_local"] == "local-1"
        assert resultado["id_servidor"] is not None
        assert resultado["total"] == 50.0
        assert resultado["error"] is None
        # El stock se descontó y la venta quedó con la fecha original
        buscado = client.get(
            f"/productos/{producto['codigo_barras']}", headers=auth(admin_token)
        ).json()
        assert buscado["stock"] == 8
        recibo = client.get(
            f"/ventas/{resultado['id_servidor']}/recibo", headers=auth(admin_token)
        ).json()
        assert recibo["venta"]["fecha"].startswith("2026-08-15T10:00")

    def test_una_falla_no_bloquea_las_demas(self, client, admin_token):
        producto = crear_producto(client, admin_token, stock=1)
        response = self._sync(
            client,
            admin_token,
            [
                {
                    "id_local": "ok",
                    "fecha": "2026-08-15T10:00:00",
                    "metodo_pago": "efectivo",
                    "detalles": [{"producto_id": producto["id"], "cantidad": 1}],
                },
                {
                    "id_local": "falla-stock",
                    "fecha": "2026-08-15T10:05:00",
                    "metodo_pago": "efectivo",
                    "detalles": [{"producto_id": producto["id"], "cantidad": 99}],
                },
                {
                    "id_local": "falla-producto",
                    "fecha": "2026-08-15T10:06:00",
                    "metodo_pago": "efectivo",
                    "detalles": [{"producto_id": 99999, "cantidad": 1}],
                },
            ],
        )
        resultados = {r["id_local"]: r for r in response.json()["resultados"]}
        assert resultados["ok"]["id_servidor"] is not None
        assert "Stock insuficiente" in resultados["falla-stock"]["error"]
        assert resultados["falla-stock"]["id_servidor"] is None
        assert "no encontrado" in resultados["falla-producto"]["error"]

    def test_sin_token(self, client):
        response = self._sync(client, "", [])
        assert response.status_code == 401

    def test_rol_inventario_prohibido(self, client, crear_usuario, org_principal):
        crear_usuario("inventario2", "123456", "inventario", org=org_principal)
        token = client.post(
            "/auth/login", data={"username": "inventario2", "password": "123456"}
        ).json()["access_token"]
        response = client.post(
            "/ventas/offline-sync",
            headers=auth(token),
            json={"ventas": []},
        )
        assert response.status_code == 403

    def test_no_puede_sincronizar_producto_de_otra_org(self, client, crear_usuario, crear_org, admin_token):
        org_ajena = crear_org(nombre="Ajena")
        admin_ajeno = crear_usuario("ajeno2", "123456", "admin", org=org_ajena)
        token_ajeno = client.post(
            "/auth/login", data={"username": "ajeno2", "password": "123456"}
        ).json()["access_token"]
        producto_ajeno = client.post(
            "/productos/",
            headers=auth(token_ajeno),
            json={**PRODUCTO, "codigo_barras": "000777"},
        ).json()
        response = self._sync(
            client,
            admin_token,
            [
                {
                    "id_local": "x",
                    "fecha": "2026-08-15T10:00:00",
                    "metodo_pago": "efectivo",
                    "detalles": [{"producto_id": producto_ajeno["id"], "cantidad": 1}],
                }
            ],
        )
        assert "no encontrado" in response.json()["resultados"][0]["error"]


class TestHistorial:
    def test_historial_solo_admin(self, client, admin_token, ventas_token):
        client.get("/ventas/", headers=auth(ventas_token)).status_code == 403
        response = client.get("/ventas/", headers=auth(admin_token))
        assert response.status_code == 200

    def test_historial_con_detalles(self, client, admin_token, ventas_token):
        producto = crear_producto(client, admin_token)
        client.post(
            "/ventas/",
            headers=auth(ventas_token),
            json={"detalles": [{"producto_id": producto["id"], "cantidad": 1}]},
        )
        data = client.get("/ventas/", headers=auth(admin_token)).json()
        assert data["total"] == 1
        venta = data["items"][0]
        assert venta["detalles"][0]["producto_nombre"] == "Don Quijote"

    def test_historial_paginado(self, client, admin_token, ventas_token):
        producto = crear_producto(client, admin_token, stock=10)
        for _ in range(3):
            client.post(
                "/ventas/",
                headers=auth(ventas_token),
                json={"detalles": [{"producto_id": producto["id"], "cantidad": 1}]},
            )
        data = client.get("/ventas/?page=1&page_size=2", headers=auth(admin_token)).json()
        assert data["total"] == 3
        assert len(data["items"]) == 2