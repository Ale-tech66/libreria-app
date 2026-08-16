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


class TestSoftDelete:
    def test_desactivar_producto(self, client, admin_token):
        producto = crear_producto(client, admin_token)
        response = client.delete(
            f"/productos/{producto['id']}", headers=auth(admin_token)
        )
        assert response.status_code == 200
        assert response.json()["activo"] is False

    def test_desactivado_no_aparece_en_lista(self, client, admin_token):
        producto = crear_producto(client, admin_token)
        client.delete(f"/productos/{producto['id']}", headers=auth(admin_token))
        data = client.get("/productos/", headers=auth(admin_token)).json()
        assert data["total"] == 0

    def test_desactivado_con_incluir_inactivos(self, client, admin_token):
        producto = crear_producto(client, admin_token)
        client.delete(f"/productos/{producto['id']}", headers=auth(admin_token))
        data = client.get(
            "/productos/?incluir_inactivos=true", headers=auth(admin_token)
        ).json()
        assert data["total"] == 1
        assert data["items"][0]["activo"] is False

    def test_reactivar_con_put(self, client, admin_token):
        producto = crear_producto(client, admin_token)
        client.delete(f"/productos/{producto['id']}", headers=auth(admin_token))
        response = client.put(
            f"/productos/{producto['id']}",
            headers=auth(admin_token),
            json={**PRODUCTO, "activo": True},
        )
        assert response.status_code == 200
        assert response.json()["activo"] is True

    def test_venta_de_producto_inactivo_rechazada(self, client, admin_token, ventas_token):
        producto = crear_producto(client, admin_token)
        client.delete(f"/productos/{producto['id']}", headers=auth(admin_token))
        response = client.post(
            "/ventas/",
            headers=auth(ventas_token),
            json={"detalles": [{"producto_id": producto["id"], "cantidad": 1}]},
        )
        assert response.status_code == 400

    def test_ventas_no_ven_inactivos(self, client, admin_token, ventas_token):
        producto = crear_producto(client, admin_token)
        client.delete(f"/productos/{producto['id']}", headers=auth(admin_token))
        data = client.get("/productos/", headers=auth(ventas_token)).json()
        assert data["total"] == 0

    def test_borrar_requiere_permiso(self, client, admin_token, ventas_token):
        producto = crear_producto(client, admin_token)
        response = client.delete(
            f"/productos/{producto['id']}", headers=auth(ventas_token)
        )
        assert response.status_code == 403


class TestFoto:
    def _sin_cloudinary(self, monkeypatch):
        from app.core import config

        monkeypatch.setattr(config.settings, "CLOUDINARY_CLOUD_NAME", "")
        monkeypatch.setattr(config.settings, "CLOUDINARY_UPLOAD_PRESET", "")
        monkeypatch.setattr(config.settings, "R2_ACCOUNT_ID", "")
        monkeypatch.setattr(config.settings, "R2_BUCKET", "")

    def test_subir_foto(self, client, admin_token, monkeypatch):
        self._sin_cloudinary(monkeypatch)
        producto = crear_producto(client, admin_token)
        response = client.post(
            f"/productos/{producto['id']}/foto",
            headers=auth(admin_token),
            files={"archivo": ("portada.png", b"\x89PNG\r\n\x1a\nfake", "image/png")},
        )
        assert response.status_code == 200
        assert response.json()["foto"] == f"producto_{producto['id']}.png"

    def test_tipo_no_permitido(self, client, admin_token):
        producto = crear_producto(client, admin_token)
        response = client.post(
            f"/productos/{producto['id']}/foto",
            headers=auth(admin_token),
            files={"archivo": ("malo.txt", b"texto", "text/plain")},
        )
        assert response.status_code == 400

    def test_archivo_demasiado_grande(self, client, admin_token):
        producto = crear_producto(client, admin_token)
        response = client.post(
            f"/productos/{producto['id']}/foto",
            headers=auth(admin_token),
            files={"archivo": ("grande.png", b"x" * (6 * 1024 * 1024), "image/png")},
        )
        assert response.status_code == 400

    def test_foto_requiere_permiso(self, client, admin_token, ventas_token):
        producto = crear_producto(client, admin_token)
        response = client.post(
            f"/productos/{producto['id']}/foto",
            headers=auth(ventas_token),
            files={"archivo": ("a.png", b"x", "image/png")},
        )
        assert response.status_code == 403


class TestFotoCloudinary:
    URL_FALSA = "https://res.cloudinary.com/nube-test/image/upload/v1/productos/producto_1.png"

    def _activar(self, monkeypatch):
        from app.core import config

        monkeypatch.setattr(config.settings, "CLOUDINARY_CLOUD_NAME", "nube-test")
        monkeypatch.setattr(config.settings, "CLOUDINARY_API_KEY", "123")
        monkeypatch.setattr(config.settings, "CLOUDINARY_API_SECRET", "abc")
        monkeypatch.setattr(config.settings, "CLOUDINARY_UPLOAD_PRESET", "")

    def _activar_preset(self, monkeypatch):
        from app.core import config

        monkeypatch.setattr(config.settings, "CLOUDINARY_CLOUD_NAME", "nube-test")
        monkeypatch.setattr(config.settings, "CLOUDINARY_UPLOAD_PRESET", "libreria-preset")
        monkeypatch.setattr(config.settings, "CLOUDINARY_API_KEY", "")
        monkeypatch.setattr(config.settings, "CLOUDINARY_API_SECRET", "")

    def _fake_post(self, monkeypatch, respuestas):
        import app.routers.productos as mod

        llamadas = []

        class Respuesta:
            status_code = 200
            text = ""

            def json(self):
                return respuestas.pop(0)

        def post_falso(url, **kwargs):
            llamadas.append({"url": url, "data": kwargs.get("data", {})})
            return Respuesta()

        monkeypatch.setattr(mod.requests, "post", post_falso)
        return llamadas

    def test_subir_foto_cloudinary(self, client, admin_token, monkeypatch):
        self._activar(monkeypatch)
        llamadas = self._fake_post(monkeypatch, [{"secure_url": self.URL_FALSA}])
        producto = crear_producto(client, admin_token)
        response = client.post(
            f"/productos/{producto['id']}/foto",
            headers=auth(admin_token),
            files={"archivo": ("a.png", b"\x89PNG\r\n\x1a\nfake", "image/png")},
        )
        assert response.status_code == 200
        assert response.json()["foto"] == self.URL_FALSA
        assert "api.cloudinary.com" in llamadas[0]["url"]
        assert "signature" in llamadas[0]["data"]
        assert "timestamp" in llamadas[0]["data"]

    def test_subir_foto_preset_sin_firma(self, client, admin_token, monkeypatch):
        """Con upload preset sin firmar no se envían firma ni api_key."""
        self._activar_preset(monkeypatch)
        llamadas = self._fake_post(monkeypatch, [{"secure_url": self.URL_FALSA}])
        producto = crear_producto(client, admin_token)
        response = client.post(
            f"/productos/{producto['id']}/foto",
            headers=auth(admin_token),
            files={"archivo": ("a.png", b"\x89PNG\r\n\x1a\nfake", "image/png")},
        )
        assert response.status_code == 200
        assert response.json()["foto"] == self.URL_FALSA
        data = llamadas[0]["data"]
        assert data["upload_preset"] == "libreria-preset"
        assert "signature" not in data
        assert "api_key" not in data

    def test_reemplazar_foto_borra_anterior(self, client, admin_token, monkeypatch):
        self._activar(monkeypatch)
        llamadas = self._fake_post(
            monkeypatch,
            [{"secure_url": self.URL_FALSA}, {"secure_url": self.URL_FALSA + "2"}],
        )
        producto = crear_producto(client, admin_token)
        for i in range(2):
            response = client.post(
                f"/productos/{producto['id']}/foto",
                headers=auth(admin_token),
                files={"archivo": (f"a{i}.png", b"\x89PNG\r\n\x1a\nfake", "image/png")},
            )
            assert response.status_code == 200
        assert llamadas[1]["url"].endswith("/auto/upload")
        assert llamadas[2]["url"].endswith("/image/destroy")
        assert "public_id" in llamadas[2]["data"]
        assert llamadas[2]["data"]["public_id"] == "productos/producto_1.png"