# 📚 Librería App

Aplicación de gestión completa para librería: **inventario con fotos**, **punto de venta con escáner de códigos de barras**, **historial de ventas**, **reportes**, **gestión de usuarios** y **8 temas visuales personalizables**.

- **Backend**: FastAPI + SQLAlchemy + PostgreSQL (con migraciones Alembic) — Python 3.11+
- **Frontend**: Expo SDK 54 (React Native) + TypeScript
- **CI**: GitHub Actions con Postgres 16 · **65 tests** automatizados

## ✨ Funcionalidades

| Área | Descripción |
| --- | --- |
| 🔐 Autenticación | JWT, 3 roles (`admin`, `inventario`, `ventas`), registro restringido a admin, rate-limit en login (5 fallos / 5 min) |
| 👥 Usuarios | Crear usuarios, cambiar rol, resetear contraseña, activar/desactivar cuentas (un admin no puede desactivarse a sí mismo) |
| 📦 Inventario | Alta/edición con foto (multimedia ≤5 MB), búsqueda, paginación, alertas de **stock bajo**, soft-delete (desactivar/reactivar) |
| 🛒 Punto de venta | Escáner de códigos, carrito, 4 métodos de pago (`efectivo`, `tarjeta`, `transferencia`, `yape`), **precio siempre del servidor**, control de stock con bloqueo de fila (`SELECT ... FOR UPDATE`) |
| 📊 Reportes | Ventas e ingresos de los últimos 7 días, gráfico por día y top de productos más vendidos |
| 🧾 Historial | Ventas paginadas con detalle (productos, cantidades, método de pago) |
| 🎨 Temas | **8 estilos**: Aurora, Glass, Liquid, Spatial, Clay, Minimal, Neumorph y Skeuomorph — con animaciones (Reanimated), blur y gradientes |

## 🚀 Puesta en marcha

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements-dev.txt

cp .env.example .env        # edita DATABASE_URL, SECRET_KEY, ALGORITHM
alembic upgrade head        # crea/esquema actualizado

# Crea el primer admin (obligatorio: /auth/register exige rol admin)
ADMIN_USERNAME=admin ADMIN_PASSWORD=cambia_esta_clave python create_admin.py

uvicorn app.main:app --reload
```

La API queda en `http://localhost:8000` con documentación interactiva en `/docs`.

> **Despliegue en Render**: build `pip install -r requirements.txt`, start `bash start.sh` (aplica migraciones y arranca uvicorn). Si la BD ya tiene las tablas creadas manualmente, usa `alembic stamp head` en lugar de `upgrade head`.

### Variables de entorno

| Variable | Descripción |
| --- | --- |
| `DATABASE_URL` | URL de la base de datos (`postgresql://...` o `sqlite:///...` para desarrollo) |
| `SECRET_KEY` | Clave para firmar JWT. **Única y larga en producción** |
| `ALGORITHM` | Algoritmo JWT (`HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Expiración del token en minutos |
| `UPLOAD_DIR` | Carpeta de fotos de productos (default: `uploads`) |

### Frontend

```bash
cd frontend
npm install
npx expo start
```

La URL de la API se configura en `app.json` → `extra.apiUrl` (respaldo en `src/api/client.ts`). Si el token expira, la app cierra la sesión automáticamente y vuelve al login.

### Verificación

```bash
# Backend (tests)
cd backend && venv/bin/python -m pytest

# Frontend (tipos y lint)
cd frontend && npx tsc --noEmit && npm run lint
```

## 🧱 Arquitectura

```
backend/
  app/
    core/       # Config, BD, seguridad, dependencias
    models/     # SQLAlchemy (users, productos, ventas + detalles)
    routers/    # Endpoints (auth, productos, ventas)
    main.py     # App FastAPI (monta /uploads)
  alembic/      # Migraciones de esquema
  tests/        # 65 tests (auth, usuarios, productos, ventas, reportes)
  create_admin.py
frontend/
  src/
    api/        # Cliente HTTP por dominio (auth, productos, ventas, usuarios, reportes)
    hooks/      # Lógica de estado (useAuth, useProductos, useCarrito)
    types/      # Tipos compartidos (sin `any`)
    design/     # Sistema de temas (8 estilos) + componentes temáticos
    app/        # Pantallas (expo-router): login, inventario, usuarios, reportes, ajustes
    components/ # Modales (punto de venta, historial, producto, escáner)
```

**Regla de oro**: la lógica de negocio vive en `api/` y `hooks/`, nunca en los componentes de UI. Los permisos se validan en el backend, no solo en la interfaz.

## 👥 Roles

| Rol | Permisos |
| --- | --- |
| `admin` | Todo: usuarios, inventario, ventas, historial, reportes |
| `inventario` | Crear/editar/desactivar productos, ver inventario |
| `ventas` | Punto de venta (no modifica inventario, no ve historial ni reportes) |

## 🖥️ Capturas

_(Agrega aquí capturas de la app con distintos temas.)_

## 📄 Licencia

MIT © 2026