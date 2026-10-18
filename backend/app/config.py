import os
import re
from pathlib import Path
from dotenv import load_dotenv

# Base paths
APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent

# Load .env file from root and backend directories
if (PROJECT_ROOT / ".env").exists():
    load_dotenv(dotenv_path=PROJECT_ROOT / ".env")
if (BACKEND_DIR / ".env").exists():
    load_dotenv(dotenv_path=BACKEND_DIR / ".env", override=True)


class Settings:
    PROJECT_NAME: str = "Food Freshness Monitoring Platform"
    PROJECT_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"

    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")

    # Server configuration
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # MongoDB configuration
    _raw_mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/").strip()
    if _raw_mongo_uri.startswith("MONGO_URI="):
        _raw_mongo_uri = _raw_mongo_uri[len("MONGO_URI="):].strip()
    _raw_mongo_uri = _raw_mongo_uri.strip("\"'")
    # Automatically strip accidental placeholder brackets like <username> or <password>
    _raw_mongo_uri = re.sub(r':<([^>@]+)>@', r':\1@', _raw_mongo_uri)
    _raw_mongo_uri = re.sub(r'//<([^>@:]+)>:', r'//\1:', _raw_mongo_uri)
    MONGO_URI: str = _raw_mongo_uri
    DATABASE_NAME: str = os.getenv("DATABASE_NAME", "food_freshness_db").strip().strip("\"'")

    # JWT Authentication
    JWT_SECRET: str = os.getenv(
        "JWT_SECRET", "super_secret_jwt_key_food_freshness_platform_2026_change_in_production"
    )
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")
    )  # 24 hours

    # Paths
    UPLOAD_DIR: Path = PROJECT_ROOT / "uploads"
    FRONTEND_DIR: Path = PROJECT_ROOT / "frontend"
    DATASETS_DIR: Path = PROJECT_ROOT / "datasets"


settings = Settings()

# Ensure directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.DATASETS_DIR.mkdir(parents=True, exist_ok=True)
