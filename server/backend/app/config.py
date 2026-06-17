from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql+asyncpg://ecu:ecu_password@localhost:5432/ecudb"

    @field_validator("database_url", mode="before")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if isinstance(v, str):
            if v.startswith("postgresql://"):
                return v.replace("postgresql://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+asyncpg://", 1)
        return v
    redis_url: str = "redis://localhost:6379/0"
    log_level: str = "info"

    # Bounded queue for the telemetry writer task.
    # When full, the WebSocket handler blocks (backpressure).
    ingest_queue_size: int = 512

    # Redis TTL for the latest ECU state cache (seconds).
    # After this window the state is considered stale/offline.
    state_cache_ttl: int = 300


settings = Settings()
