"""CacheService ABC and RedisCacheService implementation.

Latest ECU state is cached in Redis keyed by ECU serial number.
The TTL is configured via settings.state_cache_ttl.
When the key expires (ECU offline / silent), the state endpoint
reports the value as stale/absent rather than as current.
"""
from __future__ import annotations

import json
from abc import ABC, abstractmethod

import redis.asyncio as aioredis


class CacheService(ABC):
    @abstractmethod
    async def set_latest_state(self, serial: str, state_json: dict, ttl_seconds: int) -> None: ...

    @abstractmethod
    async def get_latest_state(self, serial: str) -> dict | None: ...

    @abstractmethod
    async def ping(self) -> bool: ...

    @abstractmethod
    async def close(self) -> None: ...


class RedisCacheService(CacheService):
    _KEY_PREFIX = "ecu:state:"

    def __init__(self, client: aioredis.Redis) -> None:
        self._client = client

    @classmethod
    def from_url(cls, url: str) -> "RedisCacheService":
        client = aioredis.from_url(url, decode_responses=True)
        return cls(client)

    def _key(self, serial: str) -> str:
        return f"{self._KEY_PREFIX}{serial}"

    async def set_latest_state(self, serial: str, state_json: dict, ttl_seconds: int) -> None:
        await self._client.setex(self._key(serial), ttl_seconds, json.dumps(state_json))

    async def get_latest_state(self, serial: str) -> dict | None:
        raw = await self._client.get(self._key(serial))
        return json.loads(raw) if raw is not None else None

    async def ping(self) -> bool:
        try:
            return bool(await self._client.ping())
        except Exception:
            return False

    async def close(self) -> None:
        await self._client.aclose()
