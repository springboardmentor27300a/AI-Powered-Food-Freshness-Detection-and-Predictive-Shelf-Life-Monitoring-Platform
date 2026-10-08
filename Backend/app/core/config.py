import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "FreshSense AI Platform"
    API_V1_STR: str = "/api"

    # JWT Authentication — must be set via environment variable
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # MongoDB Cloud Atlas — must be set via environment variable
    MONGODB_URI: str
    DATABASE_NAME: str = "freshsense_db"

    # SMTP Email Delivery — must be set via environment variable
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str
    SMTP_PASSWORD: str
    EMAILS_FROM_EMAIL: str
    EMAILS_FROM_NAME: str = "FreshSense AI Platform"

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
