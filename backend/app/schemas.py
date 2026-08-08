from pydantic import BaseModel
from typing import Optional

class UserCreate(BaseModel):
    username: str
    password: str
    rol: str = "ventas" # Por defecto es ventas, pero puede ser admin o inventario

class UserOut(BaseModel):
    id: int
    username: str
    rol: str
    activo: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str