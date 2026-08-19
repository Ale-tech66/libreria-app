from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    # Clave maestra: firma los códigos de verificación y cifra los respaldos.
    # Debe ser larga y aleatoria (mínimo 32 caracteres), p. ej. `secrets.token_urlsafe(64)`.
    SECRET_KEY: str = Field(min_length=32)
    # Clave OPCIONAL solo para firmar JWT (si se define, los tokens se firman
    # con ella y SECRET_KEY queda reservada para códigos y respaldos).
    JWT_SECRET_KEY: str | None = None
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    UPLOAD_DIR: str = "uploads"
    ENVIRONMENT: str = "development"  # development | production

    # Correo (SMTP). Vacíos = envío de correo desactivado.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    # Fotos en Cloudflare R2 (S3 compatible). Vacíos = fotos en disco local.
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET: str = ""
    R2_PUBLIC_URL: str = ""

    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUDINARY_UPLOAD_PRESET: str = ""

    BREVO_API_KEY: str = ""

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()