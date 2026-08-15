from tests.conftest import auth

ADMIN = {"username": "admin", "password": "admin123", "rol": "admin"}


class TestListarUsuarios:
    def test_lista_solo_admin(self, client, admin_token, ventas_token):
        assert client.get("/auth/users", headers=auth(ventas_token)).status_code == 403
        response = client.get("/auth/users", headers=auth(admin_token))
        assert response.status_code == 200
        nombres = [u["username"] for u in response.json()]
        assert "admin" in nombres

    def test_lista_sin_token(self, client):
        assert client.get("/auth/users").status_code == 401


class TestActualizarUsuario:
    def test_cambiar_rol(self, client, admin_token, crear_usuario, org_principal):
        usuario = crear_usuario("cambiante", "123456", "ventas", org=org_principal)
        response = client.put(
            f"/auth/users/{usuario.id}",
            headers=auth(admin_token),
            json={"rol": "inventario"},
        )
        assert response.status_code == 200
        assert response.json()["rol"] == "inventario"

    def test_desactivar(self, client, admin_token, crear_usuario, org_principal):
        usuario = crear_usuario("apagado", "123456", "ventas", org=org_principal)
        response = client.put(
            f"/auth/users/{usuario.id}",
            headers=auth(admin_token),
            json={"activo": False},
        )
        assert response.status_code == 200
        assert response.json()["activo"] is False

        # El usuario desactivado ya no puede iniciar sesión
        login = client.post(
            "/auth/login", data={"username": "apagado", "password": "123456"}
        )
        assert login.status_code == 403

    def test_cambiar_password(self, client, admin_token, crear_usuario, org_principal):
        usuario = crear_usuario("cambiapass", "123456", "ventas", org=org_principal)
        client.put(
            f"/auth/users/{usuario.id}",
            headers=auth(admin_token),
            json={"password": "nueva123"},
        )
        assert (
            client.post(
                "/auth/login", data={"username": "cambiapass", "password": "nueva123"}
            ).status_code
            == 200
        )
        assert (
            client.post(
                "/auth/login", data={"username": "cambiapass", "password": "123456"}
            ).status_code
            == 401
        )

    def test_no_autodesactivarse(self, client, admin_token):
        admin_id = client.get("/auth/me", headers=auth(admin_token)).json()["id"]
        response = client.put(
            f"/auth/users/{admin_id}",
            headers=auth(admin_token),
            json={"activo": False},
        )
        assert response.status_code == 400

    def test_no_admin_prohibido(self, client, ventas_token, crear_usuario, org_principal):
        usuario = crear_usuario("otro", "123456", "ventas", org=org_principal)
        response = client.put(
            f"/auth/users/{usuario.id}",
            headers=auth(ventas_token),
            json={"rol": "admin"},
        )
        assert response.status_code == 403

    def test_usuario_inexistente(self, client, admin_token):
        response = client.put(
            "/auth/users/9999", headers=auth(admin_token), json={"activo": False}
        )
        assert response.status_code == 404

    def test_password_corta_rechazada(self, client, admin_token, crear_usuario, org_principal):
        usuario = crear_usuario("passcorto", "123456", "ventas", org=org_principal)
        response = client.put(
            f"/auth/users/{usuario.id}",
            headers=auth(admin_token),
            json={"password": "123"},
        )
        assert response.status_code == 422