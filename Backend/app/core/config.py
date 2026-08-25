import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "FreshSense AI Platform"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "CHANGE_THIS_SECRET_KEY_IN_PRODUCTION"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # MongoDB Cloud Atlas Credentials
    MONGODB_URI: str = os.getenv(
        "MONGODB_URI",
        "ENV_MONGODB_URI_PLACEHOLDER"
    )
    DATABASE_NAME: str = os.getenv("DATABASE_NAME", "freshsense_db")

    # Real Gmail SMTP Email Delivery Configuration
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", 587))
    SMTP_USER: str = os.getenv("SMTP_USER", "your-email@example.com")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "YOUR_SMTP_APP_PASSWORD")
    EMAILS_FROM_EMAIL: str = os.getenv("EMAILS_FROM_EMAIL", "your-email@example.com")
    EMAILS_FROM_NAME: str = os.getenv("EMAILS_FROM_NAME", "FreshSense AI Platform")

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
