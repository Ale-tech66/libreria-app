import pytest

import app.routers.auth as auth_mod
from app.core import email as email_mod


def _correos_enviados(monkeypatch):
    """Simula el envío de correo y captura los códigos generados."""
    enviados: list[dict] = []

    def fake_enviar_codigo(destinatario, asunto, cuerpo_antes_codigo):
        codigo = email_mod.generar_codigo()
        hash_codigo, vigencia = email_mod.hash_codigo(codigo), email_mod.CODIGO_MINUTOS_VALIDO * 60
        from datetime import timedelta

        vigencia = timedelta(minutes=email_mod.CODIGO_MINUTOS_VALIDO)
        enviados.append({"para": destinatario, "asunto": asunto, "codigo": codigo})
        return hash_codigo, vigencia

    monkeypatch.setattr(email_mod, "enviar_codigo", fake_enviar_codigo)
    monkeypatch.setattr(email_mod, "correo_configurado", lambda: True)
    monkeypatch.setattr(auth_mod, "correo_configurado", lambda: True)
    monkeypatch.setattr(auth_mod, "enviar_codigo", fake_enviar_codigo)
    return enviados


def _registrar_bootstrap(client, **extra):
    payload = {
        "username": "duena",
        "password": "123456",
        "correo": "duena@tienda.com",
        "nombre_negocio": "Tienda de la Dueña",
        **extra,
    }
    return client.post("/auth/register", json=payload)


class TestBrevo:
    def test_correo_configurado_con_solo_brevo(self, monkeypatch):
        from app.core import config

        monkeypatch.setattr(config.settings, "BREVO_API_KEY", "clave-brevo")
        monkeypatch.setattr(config.settings, "SMTP_HOST", "")
        monkeypatch.setattr(config.settings, "SMTP_USER", "")
        monkeypatch.setattr(config.settings, "SMTP_PASSWORD", "")
        assert email_mod.correo_configurado() is True

    def test_envia_via_api_brevo(self, monkeypatch):
        from app.core import config

        monkeypatch.setattr(config.settings, "BREVO_API_KEY", "clave-brevo")
        monkeypatch.setattr(config.settings, "SMTP_HOST", "")
        monkeypatch.setattr(config.settings, "SMTP_USER", "gestion.app2000@gmail.com")
        monkeypatch.setattr(config.settings, "SMTP_FROM", "gestion.app2000@gmail.com")

        llamadas: dict = {}

        class Respuesta:
            status_code = 201
            text = "ok"

        def post_falso(url, **kwargs):
            llamadas["url"] = url
            llamadas["headers"] = kwargs.get("headers", {})
            llamadas["json"] = kwargs.get("json", {})
            return Respuesta()

        monkeypatch.setattr("requests.post", post_falso)
        email_mod.enviar_correo("a@b.com", "Asunto", "Cuerpo")
        assert llamadas["url"] == "https://api.brevo.com/v3/smtp/email"
        assert llamadas["headers"]["api-key"] == "clave-brevo"
        assert llamadas["json"]["to"] == [{"email": "a@b.com"}]
        assert llamadas["json"]["subject"] == "Asunto"

    def test_brevo_rechaza_con_runtimeerror(self, monkeypatch):
        from app.core import config

        monkeypatch.setattr(config.settings, "BREVO_API_KEY", "clave-mala")
        monkeypatch.setattr(config.settings, "SMTP_HOST", "")

        class Respuesta:
            status_code = 401
            text = '{"message":"bad key"}'

        monkeypatch.setattr("requests.post", lambda url, **kw: Respuesta())
        with pytest.raises(RuntimeError):
            email_mod.enviar_correo("a@b.com", "Asunto", "Cuerpo")


class TestVerificacionCorreo:
    def test_registro_sin_correo_configurado_queda_activo(self, client):
        """Sin correo (aunque SMTP exista) la app funciona igual que antes."""
        response = _registrar_bootstrap(client, correo=None)
        assert response.status_code == 200
        data = response.json()
        assert data["activo"] is True
        assert data["requiere_verificacion"] is False

    def test_registro_sin_smtp_no_exige_codigo_aunque_haya_correo(self, client, monkeypatch):
        """Sin SMTP configurado, registrar con correo no bloquea la cuenta."""
        monkeypatch.setattr(auth_mod, "correo_configurado", lambda: False)
        monkeypatch.setattr(email_mod, "correo_configurado", lambda: False)
        response = _registrar_bootstrap(client)
        data = response.json()
        assert data["activo"] is True
        assert data["requiere_verificacion"] is False

    def test_registro_con_smtp_requiere_codigo(self, client, monkeypatch):
        _correos_enviados(monkeypatch)
        response = _registrar_bootstrap(client)
        data = response.json()
        assert data["activo"] is False
        assert data["requiere_verificacion"] is True
        assert "código" in data["mensaje"].lower()

        # Sin verificar no puede iniciar sesión
        login = client.post(
            "/auth/login", data={"username": "duena", "password": "123456"}
        )
        assert login.status_code == 403
        assert "Verifica tu correo" in login.json()["detail"]

    def test_codigo_incorrecto(self, client, monkeypatch):
        _correos_enviados(monkeypatch)
        _registrar_bootstrap(client)
        response = client.post(
            "/auth/verificar-codigo",
            json={"username": "duena", "code": "000000"},
        )
        assert response.status_code == 401

    def test_codigo_correcto_activa_y_puede_loguear(self, client, monkeypatch):
        enviados = _correos_enviados(monkeypatch)
        _registrar_bootstrap(client)
        codigo = enviados[-1]["codigo"]

        response = client.post(
            "/auth/verificar-codigo",
            json={"username": "duena", "code": codigo},
        )
        assert response.status_code == 200
        assert response.json()["ok"] is True

        login = client.post(
            "/auth/login", data={"username": "duena", "password": "123456"}
        )
        assert login.status_code == 200
        assert "access_token" in login.json()

    def test_codigo_expirado(self, client, monkeypatch, db_session):
        _correos_enviados(monkeypatch)
        _registrar_bootstrap(client)

        from datetime import datetime, timedelta

        from app.models.user import User

        user = db_session.query(User).filter(User.username == "duena").first()
        user.codigo_expira = datetime.utcnow() - timedelta(minutes=1)
        db_session.commit()

        response = client.post(
            "/auth/verificar-codigo",
            json={"username": "duena", "code": "123456"},
        )
        assert response.status_code == 400
        assert "expiró" in response.json()["detail"]

    def test_reenviar_codigo(self, client, monkeypatch):
        enviados = _correos_enviados(monkeypatch)
        _registrar_bootstrap(client)
        primer_codigo = enviados[-1]["codigo"]

        response = client.post(
            "/auth/reenviar-codigo", json={"username": "duena"}
        )
        assert response.status_code == 200
        nuevo_codigo = enviados[-1]["codigo"]
        assert nuevo_codigo != primer_codigo

        verificar = client.post(
            "/auth/verificar-codigo",
            json={"username": "duena", "code": nuevo_codigo},
        )
        assert verificar.status_code == 200


class TestRecuperarPassword:
    def test_recuperar_envia_codigo_y_cambia_password(self, client, monkeypatch):
        enviados = _correos_enviados(monkeypatch)
        response = _registrar_bootstrap(client, username="cliente", correo="cliente@tienda.com")
        assert response.status_code == 200
        # El bootstrap con correo exige verificación: la completamos
        assert response.json()["requiere_verificacion"] is True
        verificar = client.post(
            "/auth/verificar-codigo",
            json={"username": "cliente", "code": enviados[-1]["codigo"]},
        )
        assert verificar.status_code == 200

        # Le cambian la contraseña "por accidente"... no: la olvidó
        recuperar = client.post("/auth/recuperar", json={"username": "cliente"})
        assert recuperar.status_code == 200
        codigo = enviados[-1]["codigo"]

        # Código incorrecto
        mal = client.post(
            "/auth/recuperar-confirmar",
            json={"username": "cliente", "code": "999999", "nueva_password": "nueva123"},
        )
        assert mal.status_code == 401

        # Código correcto
        ok = client.post(
            "/auth/recuperar-confirmar",
            json={"username": "cliente", "code": codigo, "nueva_password": "nueva123"},
        )
        assert ok.status_code == 200

        # La contraseña vieja ya no sirve, la nueva sí
        vieja = client.post(
            "/auth/login", data={"username": "cliente", "password": "123456"}
        )
        assert vieja.status_code == 401
        nueva = client.post(
            "/auth/login", data={"username": "cliente", "password": "nueva123"}
        )
        assert nueva.status_code == 200

    def test_recuperar_usuario_sin_correo_responde_ok(self, client):
        """Anti-enumeración: no se revela si el usuario tiene correo."""
        response = _registrar_bootstrap(client, username="sincorreo", correo=None)
        assert response.status_code == 200
        recuperar = client.post("/auth/recuperar", json={"username": "sincorreo"})
        assert recuperar.status_code == 200
        assert recuperar.json() == {"ok": True}

    def test_recuperar_usuario_inexistente_responde_ok(self, client):
        """Anti-enumeración: un usuario inexistente da la misma respuesta."""
        response = client.post("/auth/recuperar", json={"username": "fantasma"})
        assert response.status_code == 200
        assert response.json() == {"ok": True}

    def test_recuperar_sin_smtp_dice_no_configurado(self, client, monkeypatch):
        _registrar_bootstrap(client, username="sinmail", correo="x@y.com")
        monkeypatch.setattr(auth_mod, "correo_configurado", lambda: False)
        monkeypatch.setattr(email_mod, "correo_configurado", lambda: False)

        def no_envia(*args, **kwargs):
            raise RuntimeError("El envío de correo no está configurado en el servidor (SMTP)")

        monkeypatch.setattr(auth_mod, "enviar_codigo", no_envia)
        response = client.post("/auth/recuperar", json={"username": "sinmail"})
        assert response.status_code == 503
        assert "No se pudo enviar el correo" in response.json()["detail"]