from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    database_url: str
    # Security
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    # App
    app_name: str = "KuberOne Portfolio Tracker"
    debug: bool = False
    # CORS
    frontend_url: str = "http://localhost:5173"

    class Config:
        env_file = ".env"

settings = Settings()
