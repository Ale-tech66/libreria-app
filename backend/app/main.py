from fastapi import FastAPI
from app.core.database import Base, engine
from app.models import user
from app.routers import auth
from fastapi.middleware.cors import CORSMiddleware

# Crea las tablas en la base de datos
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Librería API", version="1.0.0")

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Incluimos las rutas de autenticación
app.include_router(auth.router)

@app.get("/")
def read_root():
    return {"mensaje": "Bienvenido a la API de la Librería"}