from tests.conftest import auth

PRODUCTO = {
    "codigo_barras": "9781234567890",
    "nombre": "Don Quijote",
    "autor": "Cervantes",
    "precio_venta": 25.00,
    "stock": 5,
}


class TestAislamientoProductos:
    def test_organizaciones_no_ven_productos_ajenos(self, client, crear_usuario, crear_org):
        org_a = crear_org(nombre="Librería A")
        org_b = crear_org(nombre="Librería B")
        admin_a = crear_usuario("adminA", "123456", "admin", org=org_a)
        admin_b = crear_usuario("adminB", "123456", "admin", org=org_b)
        token_a = client.post(
            "/auth/login", data={"username": "adminA", "password": "123456"}
        ).json()["access_token"]
        token_b = client.post(
            "/auth/login", data={"username": "adminB", "password": "123456"}
        ).json()["access_token"]

        client.post("/productos/", headers=auth(token_a), json=PRODUCTO)
        client.post(
            "/productos/",
            headers=auth(token_b),
            json={**PRODUCTO, "codigo_barras": "0000000000002"},
        )

        items_a = client.get("/productos/", headers=auth(token_a)).json()
        items_b = client.get("/productos/", headers=auth(token_b)).json()
        assert items_a["total"] == 1
        assert items_b["total"] == 1

    def test_mismo_codigo_de_barras_en_distintas_orgs(self, client, crear_usuario, crear_org):
        org_a = crear_org(nombre="A")
        org_b = crear_org(nombre="B")
        admin_a = crear_usuario("xA", "123456", "admin", org=org_a)
        admin_b = crear_usuario("xB", "123456", "admin", org=org_b)
        token_a = client.post(
            "/auth/login", data={"username": "xA", "password": "123456"}
        ).json()["access_token"]
        token_b = client.post(
            "/auth/login", data={"username": "xB", "password": "123456"}
        ).json()["access_token"]

        assert client.post(
            "/productos/", headers=auth(token_a), json=PRODUCTO
        ).status_code == 200
        assert client.post(
            "/productos/", headers=auth(token_b), json=PRODUCTO
        ).status_code == 200

    def test_buscar_producto_ajeno_da_404(self, client, crear_usuario, crear_org):
        org_a = crear_org(nombre="A")
        org_b = crear_org(nombre="B")
        admin_a = crear_usuario("yA", "123456", "admin", org=org_a)
        admin_b = crear_usuario("yB", "123456", "admin", org=org_b)
        token_a = client.post(
            "/auth/login", data={"username": "yA", "password": "123456"}
        ).json()["access_token"]
        token_b = client.post(
            "/auth/login", data={"username": "yB", "password": "123456"}
        ).json()["access_token"]

        client.post("/productos/", headers=auth(token_a), json=PRODUCTO)
        response = client.get(
            f"/productos/{PRODUCTO['codigo_barras']}", headers=auth(token_b)
        )
        assert response.status_code == 404


class TestAislamientoVentas:
    def test_reporte_solo_ventas_de_su_org(self, client, crear_usuario, crear_org):
        org_a = crear_org(nombre="A")
        org_b = crear_org(nombre="B")
        admin_a = crear_usuario("zA", "123456", "admin", org=org_a)
        admin_b = crear_usuario("zB", "123456", "admin", org=org_b)
        token_a = client.post(
            "/auth/login", data={"username": "zA", "password": "123456"}
        ).json()["access_token"]
        token_b = client.post(
            "/auth/login", data={"username": "zB", "password": "123456"}
        ).json()["access_token"]

        producto_a = client.post(
            "/productos/", headers=auth(token_a), json=PRODUCTO
        ).json()
        client.post(
            "/productos/",
            headers=auth(token_b),
            json={**PRODUCTO, "codigo_barras": "1111111111111"},
        )

        client.post(
            "/ventas/",
            headers=auth(token_a),
            json={
                "metodo_pago": "efectivo",
                "detalles": [{"producto_id": producto_a["id"], "cantidad": 1}],
            },
        )

        reporte_a = client.get("/ventas/reporte", headers=auth(token_a)).json()
        reporte_b = client.get("/ventas/reporte", headers=auth(token_b)).json()
        assert reporte_a["total_ventas"] == 1
        assert reporte_b["total_ventas"] == 0

    def test_no_puede_vender_producto_de_otra_org(self, client, crear_usuario, crear_org):
        org_a = crear_org(nombre="A")
        org_b = crear_org(nombre="B")
        admin_a = crear_usuario("wA", "123456", "admin", org=org_a)
        admin_b = crear_usuario("wB", "123456", "admin", org=org_b)
        token_a = client.post(
            "/auth/login", data={"username": "wA", "password": "123456"}
        ).json()["access_token"]
        token_b = client.post(
            "/auth/login", data={"username": "wB", "password": "123456"}
        ).json()["access_token"]

        producto_a = client.post(
            "/productos/", headers=auth(token_a), json=PRODUCTO
        ).json()
        response = client.post(
            "/ventas/",
            headers=auth(token_b),
            json={
                "metodo_pago": "efectivo",
                "detalles": [{"producto_id": producto_a["id"], "cantidad": 1}],
            },
        )
        assert response.status_code == 404


class TestAislamientoUsuarios:
    def test_admin_solo_ve_sus_usuarios(self, client, crear_usuario, crear_org):
        org_a = crear_org(nombre="A")
        org_b = crear_org(nombre="B")
        admin_a = crear_usuario("uA", "123456", "admin", org=org_a)
        admin_b = crear_usuario("uB", "123456", "admin", org=org_b)
        crear_usuario("empleadoA", "123456", "ventas", org=org_a)
        token_a = client.post(
            "/auth/login", data={"username": "uA", "password": "123456"}
        ).json()["access_token"]

        usuarios = client.get("/auth/users", headers=auth(token_a)).json()
        assert {u["username"] for u in usuarios} == {"uA", "empleadoA"}

    def test_no_puede_editar_usuario_de_otra_org(self, client, crear_usuario, crear_org):
        org_a = crear_org(nombre="A")
        org_b = crear_org(nombre="B")
        admin_a = crear_usuario("vA", "123456", "admin", org=org_a)
        admin_b = crear_usuario("vB", "123456", "admin", org=org_b)
        token_a = client.post(
            "/auth/login", data={"username": "vA", "password": "123456"}
        ).json()["access_token"]

        response = client.put(
            f"/auth/users/{admin_b.id}",
            headers=auth(token_a),
            json={"rol": "ventas"},
        )
        assert response.status_code == 404


class TestRegistroEmpresa:
    def test_primer_usuario_crea_org_con_datos(self, client):
        response = client.post(
            "/auth/register",
            json={
                "username": "dueno",
                "password": "123456",
                "rol": "ventas",
                "nombre_negocio": "La Feria del Libro",
                "tipo_negocio": "libreria",
                "correo": "dueno@feria.com",
                "pais": "México",
            },
        )
        assert response.status_code == 200
        assert response.json()["rol"] == "admin"
        assert response.json()["organizacion"] == "La Feria del Libro"

    def test_registro_con_admin_usa_org_del_admin(self, client, admin_token):
        client.post(
            "/auth/register",
            headers=auth(admin_token),
            json={
                "username": "empleado",
                "password": "123456",
                "rol": "ventas",
                "nombre_negocio": "Otra Empresa",
            },
        )
        response = client.get("/auth/users", headers=auth(admin_token))
        assert {u["username"] for u in response.json()} == {"admin", "empleado"}


class TestAislamientoAuditoria:
    def test_auditoria_solo_muestra_su_org(self, client, crear_usuario, crear_org):
        org_a = crear_org(nombre="A")
        org_b = crear_org(nombre="B")
        admin_a = crear_usuario("tA", "123456", "admin", org=org_a)
        admin_b = crear_usuario("tB", "123456", "admin", org=org_b)
        token_a = client.post(
            "/auth/login", data={"username": "tA", "password": "123456"}
        ).json()["access_token"]
        token_b = client.post(
            "/auth/login", data={"username": "tB", "password": "123456"}
        ).json()["access_token"]
        client.post("/productos/", headers=auth(token_a), json=PRODUCTO)

        logs_a = client.get("/auditoria/", headers=auth(token_a)).json()
        logs_b = client.get("/auditoria/", headers=auth(token_b)).json()
        assert any(l["accion"] == "crear" for l in logs_a["items"])
        assert all(l["accion"] != "crear" for l in logs_b["items"])