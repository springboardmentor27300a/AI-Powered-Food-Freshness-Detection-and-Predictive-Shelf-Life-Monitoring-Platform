import os
from pathlib import Path
from urllib.parse import quote_plus, urlsplit

from dotenv import load_dotenv, dotenv_values

# ============================================================
# BASE PATHS
# ============================================================

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent

# ============================================================
# ENVIRONMENT CONFIGURATION
# Use backend/.env as the primary configuration file.
# ============================================================

ENV_FILE = BACKEND_DIR / ".env"

if not ENV_FILE.exists():
    raise FileNotFoundError(
        f"Backend environment file not found: {ENV_FILE}"
    )

# Load backend/.env and override previously defined variables.
load_dotenv(dotenv_path=ENV_FILE, override=True)

# Read the file's values directly when configuration-source
# accuracy matters, especially for the MongoDB connection URI.
_env_values = dotenv_values(ENV_FILE)


def _get_env(name: str, default: str = "") -> str:
    """Read a setting from backend/.env, then fall back to the process environment."""
    value = _env_values.get(name)

    if value is None or not str(value).strip():
        value = os.getenv(name, default)

    return str(value).strip().strip("\"'")


# ============================================================
# MONGODB URI VALIDATION
# ============================================================

def _get_mongo_uri() -> str:
    """Load MongoDB URI directly from backend/.env."""

    env_file = BACKEND_DIR / ".env"
    env_values = dotenv_values(env_file)

    uri = env_values.get("MONGO_URI")

    if not uri:
        raise ValueError(
            f"MONGO_URI is missing from {env_file}"
        )

    uri = str(uri).strip().strip("\"'")

    if uri.startswith("MONGO_URI="):
        uri = uri[len("MONGO_URI="):].strip().strip("\"'")

    if "<" in uri or ">" in uri:
        raise ValueError(
            "The MONGO_URI in backend/.env still contains "
            "placeholder brackets. Edit and save that file, "
            "replacing placeholder credentials with actual values."
        )

    if uri.count("@") != 1:
        raise ValueError(
            "MONGO_URI must contain exactly one '@' separator. "
            "Check the connection string in backend/.env."
        )

    if not uri.startswith(("mongodb://", "mongodb+srv://")):
        raise ValueError("Invalid MongoDB URI scheme.")

    return uri

# ============================================================
# APPLICATION SETTINGS
# ============================================================

class Settings:
    PROJECT_NAME: str = "Food Freshness Monitoring Platform"
    PROJECT_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"

    # Environment
    ENVIRONMENT: str = _get_env("ENVIRONMENT", "development")
    DEBUG: bool = _get_env("DEBUG", "True").lower() in (
        "true",
        "1",
        "yes",
    )

    # Server
    HOST: str = _get_env("HOST", "127.0.0.1")
    PORT: int = int(_get_env("PORT", "9000"))

    # MongoDB
    MONGO_URI: str = _get_mongo_uri()
    DATABASE_NAME: str = _get_env(
        "DATABASE_NAME",
        "food_freshness_db",
    )

    # JWT Authentication
    JWT_SECRET: str = _get_env(
        "JWT_SECRET",
        "change_this_secret_in_backend_env",
    )
    JWT_ALGORITHM: str = _get_env("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        _get_env("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")
    )

    # Paths
    UPLOAD_DIR: Path = PROJECT_ROOT / "uploads"
    FRONTEND_DIR: Path = PROJECT_ROOT / "frontend"
    DATASETS_DIR: Path = PROJECT_ROOT / "datasets"


# ============================================================
# INITIALIZE SETTINGS
# ============================================================

settings = Settings()

# Ensure required directories exist.
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.DATASETS_DIR.mkdir(parents=True, exist_ok=True)