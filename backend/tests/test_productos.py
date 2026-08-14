from tests.conftest import auth

PRODUCTO = {
    "codigo_barras": "9781234567890",
    "nombre": "Don Quijote",
    "autor": "Cervantes",
    "precio_venta": 25.00,
    "stock": 5,
}


class TestCrearProducto:
    def test_crear_con_admin(self, client, admin_token):
        response = client.post("/productos/", headers=auth(admin_token), json=PRODUCTO)
        assert response.status_code == 200
        assert response.json()["stock"] == 5

    def test_crear_con_inventario(self, client, crear_usuario):
        crear_usuario("inventario1", "123456", "inventario")
        token = client.post(
            "/auth/login", data={"username": "inventario1", "password": "123456"}
        ).json()["access_token"]
        response = client.post("/productos/", headers=auth(token), json=PRODUCTO)
        assert response.status_code == 200

    def test_crear_con_ventas_prohibido(self, client, ventas_token):
        response = client.post("/productos/", headers=auth(ventas_token), json=PRODUCTO)
        assert response.status_code == 403

    def test_crear_sin_token(self, client):
        assert client.post("/productos/", json=PRODUCTO).status_code == 401

    def test_codigo_duplicado(self, client, admin_token):
        client.post("/productos/", headers=auth(admin_token), json=PRODUCTO)
        response = client.post("/productos/", headers=auth(admin_token), json=PRODUCTO)
        assert response.status_code == 400

    def test_precio_negativo_rechazado(self, client, admin_token):
        data = {**PRODUCTO, "precio_venta": -5}
        assert client.post("/productos/", headers=auth(admin_token), json=data).status_code == 422

    def test_stock_negativo_rechazado(self, client, admin_token):
        data = {**PRODUCTO, "stock": -1}
        assert client.post("/productos/", headers=auth(admin_token), json=data).status_code == 422


class TestListarProductos:
    def _crear(self, client, admin_token, codigo, nombre):
        client.post(
            "/productos/",
            headers=auth(admin_token),
            json={**PRODUCTO, "codigo_barras": codigo, "nombre": nombre},
        )

    def test_paginacion(self, client, admin_token):
        for i in range(5):
            self._crear(client, admin_token, f"BARRA{i}", f"Libro {i}")
        response = client.get("/productos/?page=1&page_size=2", headers=auth(admin_token))
        data = response.json()
        assert response.status_code == 200
        assert data["total"] == 5
        assert len(data["items"]) == 2
        assert data["page"] == 1

    def test_busqueda_por_nombre(self, client, admin_token):
        self._crear(client, admin_token, "A1", "El Principito")
        self._crear(client, admin_token, "B2", "Cien Años de Soledad")
        response = client.get("/productos/?q=principito", headers=auth(admin_token))
        items = response.json()["items"]
        assert len(items) == 1
        assert items[0]["nombre"] == "El Principito"

    def test_busqueda_por_codigo(self, client, admin_token):
        self._crear(client, admin_token, "9780000000001", "Algo")
        response = client.get("/productos/?q=9780000000001", headers=auth(admin_token))
        assert response.json()["total"] == 1

    def test_listar_cualquier_rol(self, client, ventas_token):
        response = client.get("/productos/", headers=auth(ventas_token))
        assert response.status_code == 200


class TestBuscarYActualizar:
    def test_buscar_por_codigo(self, client, admin_token):
        client.post("/productos/", headers=auth(admin_token), json=PRODUCTO)
        response = client.get(f"/productos/{PRODUCTO['codigo_barras']}", headers=auth(admin_token))
        assert response.status_code == 200
        assert response.json()["nombre"] == "Don Quijote"

    def test_buscar_inexistente(self, client, admin_token):
        response = client.get("/productos/000", headers=auth(admin_token))
        assert response.status_code == 404

    def test_actualizar(self, client, admin_token):
        creado = client.post(
            "/productos/", headers=auth(admin_token), json=PRODUCTO
        ).json()
        data = {**PRODUCTO, "nombre": "Don Quijote II", "stock": 10}
        response = client.put(
            f"/productos/{creado['id']}", headers=auth(admin_token), json=data
        )
        assert response.status_code == 200
        assert response.json()["nombre"] == "Don Quijote II"
        assert response.json()["stock"] == 10

    def test_actualizar_con_ventas_prohibido(self, client, admin_token, ventas_token):
        creado = client.post(
            "/productos/", headers=auth(admin_token), json=PRODUCTO
        ).json()
        response = client.put(
            f"/productos/{creado['id']}", headers=auth(ventas_token), json=PRODUCTO
        )
        assert response.status_code == 403

    def test_actualizar_inexistente(self, client, admin_token):
        response = client.put(
            "/productos/9999", headers=auth(admin_token), json=PRODUCTO
        )
        assert response.status_code == 404