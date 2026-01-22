from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    secret_key: str = "dev-secret-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    cors_allow_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]

    create_default_admin: bool = False
    default_admin_username: str = "admin"
    default_admin_password: str = "admin"


settings = Settings()
