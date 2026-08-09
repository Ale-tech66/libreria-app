from fastapi import FastAPI
from app.core.database import Base, engine
from fastapi.middleware.cors import CORSMiddleware
from app.models import user, producto, venta # <-- Añadimos venta
from app.routers import auth, productos, ventas # <-- Añadimos ventas

# Crea las tablas en la base de datos
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Librería API", version="1.0.0")

# Middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(productos.router)
app.include_router(ventas.router) # <-- Añadimos esto

@app.get("/")
def read_root():
    return {"mensaje": "Bienvenido a la API de la Librería"}