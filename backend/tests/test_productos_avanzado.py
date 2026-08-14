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
    def test_subir_foto(self, client, admin_token):
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