from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Groq
    groq_api_key: str = ""

    # Hindsight
    hindsight_base_url: str = ""
    hindsight_api_key: str = ""

    # Memory bank
    hindsight_bank_id: str = "contentos-demo"

    # App
    app_env: str = "development"
    cors_origins: list[str] = ["http://localhost:3000"]

    # cascadeflow model config
    cascade_drafter_model: str = "llama-3.1-8b-instant"
    cascade_verifier_model: str = "llama-3.3-70b-versatile"


@lru_cache
def get_settings() -> Settings:
    return Settings()
