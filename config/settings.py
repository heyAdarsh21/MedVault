"""Application settings for MEDVAULT."""
from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    """
    Application configuration.
    All values can be overridden via environment variables or .env file.
    """

    # ── Database ──────────────────────────────────────────────────────────
    database_url: str = "postgresql://postgres:postgres@localhost/medvault"

    # ── API metadata ──────────────────────────────────────────────────────
    api_title: str = "MEDVAULT API"
    api_version: str = "1.0.0"
    api_prefix: str = "/api/v1"

    # ── Environment ───────────────────────────────────────────────────────
    # Set to "production" to enable strict CORS and disable debug docs.
    environment: str = "development"

    # ── CORS ──────────────────────────────────────────────────────────────
    # Comma-separated list of allowed origins.
    # In development, defaults to ["*"].
    # In production, set this explicitly: CORS_ORIGINS=https://app.medvault.io
    cors_origins: List[str] = ["*"]

    # ── Logging ───────────────────────────────────────────────────────────
    log_level: str = "INFO"

    # ── Simulation ────────────────────────────────────────────────────────
    default_simulation_duration: int = 1000
    default_patient_arrival_rate: float = 0.1

    # ── Auth / JWT ────────────────────────────────────────────────────────
    jwt_secret_key: str = "CHANGE_ME_IN_ENV"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60

    # ── Legacy role passwords (kept for backward compat) ──────────────────
    admin_password: Optional[str] = None
    analyst_password: Optional[str] = None
    viewer_password: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()