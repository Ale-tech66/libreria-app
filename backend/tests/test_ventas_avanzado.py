from datetime import date, datetime, timedelta

from tests.conftest import auth

PRODUCTO = {
    "codigo_barras": "9781234567890",
    "nombre": "Don Quijote",
    "precio_venta": 25.00,
    "stock": 50,
}


def crear_producto(client, admin_token):
    response = client.post("/productos/", headers=auth(admin_token), json=PRODUCTO)
    assert response.status_code == 200
    return response.json()


class TestMetodosPago:
    def test_metodo_valido(self, client, admin_token, ventas_token):
        producto = crear_producto(client, admin_token)
        for metodo in ["efectivo", "tarjeta", "transferencia", "yape"]:
            response = client.post(
                "/ventas/",
                headers=auth(ventas_token),
                json={
                    "metodo_pago": metodo,
                    "detalles": [{"producto_id": producto["id"], "cantidad": 1}],
                },
            )
            assert response.status_code == 200, metodo
            assert response.json()["metodo_pago"] == metodo

    def test_metodo_invalido_rechazado(self, client, admin_token, ventas_token):
        producto = crear_producto(client, admin_token)
        response = client.post(
            "/ventas/",
            headers=auth(ventas_token),
            json={
                "metodo_pago": "bitcoin",
                "detalles": [{"producto_id": producto["id"], "cantidad": 1}],
            },
        )
        assert response.status_code == 422


class TestReporte:
    def test_reporte_vacio(self, client, admin_token):
        response = client.get("/ventas/reporte", headers=auth(admin_token))
        assert response.status_code == 200
        data = response.json()
        assert data["total_ventas"] == 0
        assert data["ingresos_totales"] == 0.0
        assert len(data["por_dia"]) == 7
        assert data["top_productos"] == []

    def test_reporte_con_ventas(self, client, admin_token, ventas_token):
        producto = crear_producto(client, admin_token)
        client.post(
            "/ventas/",
            headers=auth(ventas_token),
            json={
                "metodo_pago": "tarjeta",
                "detalles": [{"producto_id": producto["id"], "cantidad": 2}],
            },
        )
        client.post(
            "/ventas/",
            headers=auth(ventas_token),
            json={
                "metodo_pago": "efectivo",
                "detalles": [{"producto_id": producto["id"], "cantidad": 1}],
            },
        )

        data = client.get("/ventas/reporte", headers=auth(admin_token)).json()
        assert data["total_ventas"] == 2
        assert data["ingresos_totales"] == 75.0  # 2x25 + 1x25
        assert data["por_dia"][-1]["fecha"] == datetime.utcnow().date().isoformat()
        assert data["por_dia"][-1]["cantidad"] == 2
        assert data["top_productos"][0]["producto_nombre"] == "Don Quijote"
        assert data["top_productos"][0]["cantidad"] == 3

    def test_reporte_solo_admin(self, client, ventas_token):
        assert client.get("/ventas/reporte", headers=auth(ventas_token)).status_code == 403

    def test_reporte_dias_personalizado(self, client, admin_token):
        data = client.get("/ventas/reporte?dias=30", headers=auth(admin_token)).json()
        assert len(data["por_dia"]) == 30