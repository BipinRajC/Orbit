from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Supabase — accepts SUPABASE_API_KEY or SUPABASE_SERVICE_ROLE_KEY
    supabase_url: str = ""
    supabase_api_key: str = ""
    supabase_service_role_key: str = ""

    @property
    def supabase_key(self) -> str:
        """Return whichever key is provided."""
        return self.supabase_service_role_key or self.supabase_api_key

    # Groq
    groq_api_key: str = ""

    # Hindsight
    hindsight_base_url: str = ""
    hindsight_api_key: str = ""

    # Memory bank
    hindsight_bank_id: str = "orbitos-demo"

    # App
    app_env: str = "development"
    cors_origins: list[str] = ["http://localhost:3000"]

    # cascadeflow model config
    cascade_drafter_model: str = "llama-3.1-8b-instant"
    cascade_verifier_model: str = "llama-3.3-70b-versatile"

    # Anthropic
    anthropic_api_key: str = ""

    # Clip storage
    clip_storage_path: str = "/app/clips"
    default_platforms: list[str] = ["instagram_reels", "youtube_shorts", "tiktok", "linkedin"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
