from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    mysql_user: str = "root"
    mysql_password: str = ""
    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_database: str = "foodfreshness"
    cors_origins: str = "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://127.0.0.1:5173,http://127.0.0.1:5174"
    secret_key: str = "freshguard-local-development-secret-change-if-needed"
    token_expire_minutes: int = 1440

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    @property
    def database_url(self):
        from urllib.parse import quote_plus
        password = quote_plus(self.mysql_password)
        return f"mysql+pymysql://{self.mysql_user}:{password}@{self.mysql_host}:{self.mysql_port}/{self.mysql_database}"

settings = Settings()
