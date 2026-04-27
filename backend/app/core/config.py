from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="BOW_", extra="ignore")

    database_url: str = "sqlite:///./bow.db"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    env: str = "dev"
    seed_on_startup: bool = True


settings = Settings()
