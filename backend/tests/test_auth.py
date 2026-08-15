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


class TestMfa:
    def _setup_mfa(self, client, admin_token):
        """Activa MFA para el admin y devuelve el TOTP."""
        import pyotp

        response = client.post("/auth/mfa/setup", headers=auth(admin_token))
        assert response.status_code == 200
        data = response.json()
        assert "otpauth_url" in data
        assert "secret" in data
        return pyotp.TOTP(data["secret"])

    def test_login_sin_mfa_normal(self, client, crear_usuario):
        crear_usuario("sinmfa", "123456", "ventas")
        response = client.post(
            "/auth/login", data={"username": "sinmfa", "password": "123456"}
        )
        assert response.status_code == 200
        assert "access_token" in response.json()
        assert "mfa_required" not in response.json()

    def test_login_con_mfa_pide_codigo(self, client, admin_token):
        self._setup_mfa(client, admin_token)
        response = client.post(
            "/auth/login", data={"username": "admin", "password": "admin123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["mfa_required"] is True
        assert "mfa_token" in data
        assert "access_token" not in data

    def test_confirm_mfa_entrega_tokens(self, client, admin_token):
        totp = self._setup_mfa(client, admin_token)
        login = client.post(
            "/auth/login", data={"username": "admin", "password": "admin123"}
        ).json()
        response = client.post(
            "/auth/mfa/confirm",
            json={"mfa_token": login["mfa_token"], "code": totp.now()},
        )
        assert response.status_code == 200
        assert "access_token" in response.json()
        assert "refresh_token" in response.json()

    def test_confirm_mfa_codigo_incorrecto(self, client, admin_token):
        totp = self._setup_mfa(client, admin_token)
        login = client.post(
            "/auth/login", data={"username": "admin", "password": "admin123"}
        ).json()
        codigo_mal = "000000" if totp.now() != "000000" else "111111"
        response = client.post(
            "/auth/mfa/confirm",
            json={"mfa_token": login["mfa_token"], "code": codigo_mal},
        )
        assert response.status_code == 401

    def test_confirm_mfa_token_invalido(self, client):
        response = client.post(
            "/auth/mfa/confirm", json={"mfa_token": "token.falso.123", "code": "123456"}
        )
        assert response.status_code == 401

    def test_disable_mfa(self, client, admin_token):
        totp = self._setup_mfa(client, admin_token)
        response = client.post(
            "/auth/mfa/disable",
            headers=auth(admin_token),
            json={"code": totp.now()},
        )
        assert response.status_code == 200
        # Ya no pide código al hacer login
        login = client.post(
            "/auth/login", data={"username": "admin", "password": "admin123"}
        ).json()
        assert "access_token" in login

    def test_disable_mfa_codigo_incorrecto(self, client, admin_token):
        totp = self._setup_mfa(client, admin_token)
        codigo_mal = "000000" if totp.now() != "000000" else "111111"
        response = client.post(
            "/auth/mfa/disable",
            headers=auth(admin_token),
            json={"code": codigo_mal},
        )
        assert response.status_code == 401
        # MFA sigue activo
        login = client.post(
            "/auth/login", data={"username": "admin", "password": "admin123"}
        ).json()
        assert login["mfa_required"] is True

    def test_verify_setup_valida_codigo(self, client, admin_token):
        totp = self._setup_mfa(client, admin_token)
        response = client.post(
            "/auth/mfa/verify-setup",
            headers=auth(admin_token),
            json={"code": totp.now()},
        )
        assert response.status_code == 200
        assert response.json()["ok"] is True

    def test_verify_setup_sin_mfa(self, client, admin_token):
        response = client.post(
            "/auth/mfa/verify-setup",
            headers=auth(admin_token),
            json={"code": "123456"},
        )
        assert response.status_code == 400


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