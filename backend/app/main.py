import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import engine
from app.models import audit, user, producto, venta  # noqa: F401  (registra los modelos)
from app.routers import auth, auditoria, productos, ventas

logger = logging.getLogger("libreria")

# El esquema se gestiona con Alembic: `alembic upgrade head`
# (ver start.sh). No usar Base.metadata.create_all en producción.


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    engine.dispose()


app = FastAPI(
    title="Librería API",
    version="1.0.0",
    lifespan=lifespan,
)

# Middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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