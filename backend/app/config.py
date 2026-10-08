"""
Application settings loaded from environment variables / the backend `.env` file.

Never hard-code secrets in source code: everything sensitive is injected here.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Food Freshness Monitoring Platform"
    API_VERSION: str = "1.0.0"

    # PostgreSQL connection string (SQLAlchemy format), e.g.
    # postgresql+psycopg2://postgres:secret@localhost:5432/food_freshness_db
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/food_freshness_db"

    # JWT configuration
    SECRET_KEY: str = "change_me_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # CORS: comma-separated list of allowed frontend origins
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        """Split the CORS_ORIGINS env var into a clean list for FastAPI CORSMiddleware."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cache settings so the .env file is parsed only once per process."""
    return Settings()


settings = get_settings()
