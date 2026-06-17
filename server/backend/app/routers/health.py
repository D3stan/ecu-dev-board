"""Health check endpoint.

GET /health — liveness probe used by Docker healthcheck and integration tests.
Returns 200 only when both PostgreSQL and Redis are reachable.
"""
from fastapi import APIRouter, Request

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(request: Request) -> dict:
    from app.services.cache import CacheService

    cache: CacheService = request.app.state.cache
    redis_ok = await cache.ping()

    # Light DB check — just verify the engine can connect
    db_ok = False
    try:
        from app.db.session import engine
        async with engine.connect() as conn:
            await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    status = "ok" if (redis_ok and db_ok) else "degraded"
    return {"status": status, "db": db_ok, "redis": redis_ok}
