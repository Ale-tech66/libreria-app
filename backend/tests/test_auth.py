from tests.conftest import auth


class TestRegistro:
    def test_register_primer_usuario_es_admin(self, client):
        response = client.post(
            "/auth/register",
            json={"username": "fundador", "password": "123456", "rol": "ventas"},
        )
        assert response.status_code == 200
        assert response.json()["rol"] == "admin"

    def test_register_requiere_admin_si_hay_usuarios(self, client, crear_usuario):
        crear_usuario("existente", "123456", "ventas")
        response = client.post(
            "/auth/register",
            json={"username": "hacker", "password": "123456", "rol": "admin"},
        )
        assert response.status_code == 403

    def test_register_con_admin(self, client, admin_token):
        response = client.post(
            "/auth/register",
            headers=auth(admin_token),
            json={"username": "nuevo", "password": "123456", "rol": "ventas"},
        )
        assert response.status_code == 200
        assert response.json()["rol"] == "ventas"

    def test_register_rol_invalido(self, client, admin_token):
        response = client.post(
            "/auth/register",
            headers=auth(admin_token),
            json={"username": "x", "password": "123456", "rol": "superadmin"},
        )
        assert response.status_code == 422

    def test_register_ventas_no_puede(self, client, ventas_token):
        response = client.post(
            "/auth/register",
            headers=auth(ventas_token),
            json={"username": "otro", "password": "123456", "rol": "admin"},
        )
        assert response.status_code == 403

    def test_usuario_duplicado(self, client, admin_token):
        client.post(
            "/auth/register",
            headers=auth(admin_token),
            json={"username": "dup", "password": "123456", "rol": "ventas"},
        )
        response = client.post(
            "/auth/register",
            headers=auth(admin_token),
            json={"username": "dup", "password": "123456", "rol": "ventas"},
        )
        assert response.status_code == 400


class TestLogin:
    def test_login_ok(self, client, crear_usuario):
        crear_usuario("usuario1", "123456", "ventas")
        response = client.post(
            "/auth/login", data={"username": "usuario1", "password": "123456"}
        )
        assert response.status_code == 200
        assert "access_token" in response.json()

    def test_login_incorrecto(self, client):
        response = client.post(
            "/auth/login", data={"username": "nadie", "password": "mala"}
        )
        assert response.status_code == 401

    def test_login_rate_limit(self, client):
        for _ in range(5):
            client.post("/auth/login", data={"username": "brute", "password": "x"})
        response = client.post(
            "/auth/login", data={"username": "brute", "password": "x"}
        )
        assert response.status_code == 429

    def test_login_usuario_desactivado(self, client, crear_usuario):
        crear_usuario("inactivo", "123456", "ventas", activo=False)
        response = client.post(
            "/auth/login", data={"username": "inactivo", "password": "123456"}
        )
        assert response.status_code == 403


class TestMe:
    def test_me_ok(self, client, admin_token):
        response = client.get("/auth/me", headers=auth(admin_token))
        assert response.status_code == 200
        assert response.json()["username"] == "admin"
        assert response.json()["rol"] == "admin"

    def test_me_sin_token(self, client):
        assert client.get("/auth/me").status_code == 401

    def test_me_token_invalido(self, client):
        response = client.get("/auth/me", headers=auth("token.falso.123"))
        assert response.status_code == 401

    def test_me_usuario_desactivado(self, client, crear_usuario):
        from app.core.security import create_access_token

        crear_usuario("borrado", "123456", "ventas", activo=False)
        token = create_access_token(data={"sub": "borrado", "rol": "ventas"})
        response = client.get("/auth/me", headers=auth(token))
        assert response.status_code == 403