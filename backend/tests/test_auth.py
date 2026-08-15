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


class TestRefreshToken:
    def _login(self, client, crear_usuario):
        crear_usuario("sesion", "123456", "ventas")
        response = client.post(
            "/auth/login", data={"username": "sesion", "password": "123456"}
        )
        assert response.status_code == 200
        return response.json()

    def test_login_incluye_refresh_token(self, client, crear_usuario):
        data = self._login(client, crear_usuario)
        assert "refresh_token" in data
        assert len(data["refresh_token"]) > 20

    def test_refresh_devuelve_nuevo_par(self, client, crear_usuario):
        data = self._login(client, crear_usuario)
        response = client.post("/auth/refresh", json={"refresh_token": data["refresh_token"]})
        assert response.status_code == 200
        nuevo = response.json()
        assert nuevo["refresh_token"] != data["refresh_token"]
        # El nuevo access token funciona
        me = client.get("/auth/me", headers=auth(nuevo["access_token"]))
        assert me.status_code == 200

    def test_refresh_con_rotacion_no_se_puede_reutilizar(self, client, crear_usuario):
        data = self._login(client, crear_usuario)
        assert client.post("/auth/refresh", json={"refresh_token": data["refresh_token"]}).status_code == 200
        # Reutilizar el mismo token ya rotado debe fallar
        assert client.post("/auth/refresh", json={"refresh_token": data["refresh_token"]}).status_code == 401

    def test_refresh_invalido(self, client):
        assert client.post("/auth/refresh", json={"refresh_token": "token.que.no.existe.123"}).status_code == 401

    def test_refresh_usuario_desactivado(self, client, crear_usuario, db_session):
        from datetime import datetime, timedelta, timezone

        from app.core.security import generate_refresh_token, hash_refresh_token
        from app.models.refresh_token import RefreshToken

        usuario = crear_usuario("desactivado", "123456", "ventas", activo=False)
        token = generate_refresh_token()
        db_session.add(
            RefreshToken(
                user_id=usuario.id,
                token_hash=hash_refresh_token(token),
                expires_at=datetime.now(timezone.utc) + timedelta(days=1),
            )
        )
        db_session.commit()
        response = client.post("/auth/refresh", json={"refresh_token": token})
        assert response.status_code == 403

    def test_logout_revoca_la_sesion(self, client, crear_usuario):
        data = self._login(client, crear_usuario)
        assert client.post("/auth/logout", json={"refresh_token": data["refresh_token"]}).status_code == 200
        # Tras el logout el refresh ya no sirve
        assert client.post("/auth/refresh", json={"refresh_token": data["refresh_token"]}).status_code == 401