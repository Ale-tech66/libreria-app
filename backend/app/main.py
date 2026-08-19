import asyncio
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.backups import planificador_respaldos
from app.core.config import settings
from app.core.database import engine
from app.models import audit, user, producto, venta  # noqa: F401  (registra los modelos)
from app.routers import auth, auditoria, backups, productos, ventas

logger = logging.getLogger("libreria")

# El esquema se gestiona con Alembic: `alembic upgrade head`
# (ver start.sh). No usar Base.metadata.create_all en producción.


@asynccontextmanager
async def lifespan(app: FastAPI):
    tarea = asyncio.create_task(planificador_respaldos())
    yield
    tarea.cancel()
    engine.dispose()


app = FastAPI(
    title="Librería API",
    version="1.0.0",
    lifespan=lifespan,
    # En producción se oculta la documentación interactiva: expone toda la
    # superficie de ataque sin autenticación.
    docs_url=None if settings.ENVIRONMENT == "production" else "/docs",
    redoc_url=None if settings.ENVIRONMENT == "production" else "/redoc",
    openapi_url=None if settings.ENVIRONMENT == "production" else "/openapi.json",
)

# Middleware CORS: la app nativa (Expo) no aplica CORS; solo se permite el
# desarrollo web (Expo web) y "null" (origen del escritorio Electron empaquetado).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://localhost:19006",
        "null",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Solo responde al dominio real de la API (evita ataques de Host header)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=[
        "libreria-api-4lr3.onrender.com",
        "*.onrender.com",
        "localhost",
        "127.0.0.1",
        "testserver",
    ],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Headers de seguridad en TODAS las respuestas (API y panel web)."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Content-Security-Policy"] = "frame-ancestors 'none'"
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Registra cada petición con método, ruta, status y duración."""
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "%s %s -> %s (%.1f ms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Evita devolver tracebacks al cliente y deja registro del error."""
    logger.exception("Error no controlado en %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor"},
    )


app.include_router(auth.router)
app.include_router(auditoria.router)
app.include_router(productos.router)
app.include_router(ventas.router)
app.include_router(backups.router)

# Fotos de productos (acceso público de solo lectura)
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.get("/")
def read_root():
    if WEB_DIST.exists():
        return FileResponse(WEB_DIST / "index.html")
    return {"mensaje": "Bienvenido a la API de la Librería"}


# ─────────────────── Panel web (build estático de Expo) ───────────────────
# Si existe el build web en frontend/dist, se sirve en la raíz para que la
# app funcione también desde el navegador (misma URL que la API).

WEB_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if WEB_DIST.exists():
    app.mount("/", StaticFiles(directory=str(WEB_DIST), html=True), name="web")