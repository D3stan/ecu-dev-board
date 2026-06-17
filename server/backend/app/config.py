from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql+asyncpg://ecu:ecu_password@localhost:5432/ecudb"
    redis_url: str = "redis://localhost:6379/0"
    log_level: str = "info"

    # Bounded queue for the telemetry writer task.
    # When full, the WebSocket handler blocks (backpressure).
    ingest_queue_size: int = 512

    # Redis TTL for the latest ECU state cache (seconds).
    # After this window the state is considered stale/offline.
    state_cache_ttl: int = 300


settings = Settings()
