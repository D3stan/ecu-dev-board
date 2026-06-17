"""FastAPI application factory — DigitalTwinApp.

Startup:
  1. Create RedisCacheService (singleton, stored on app.state).
  2. Create RunManager (singleton, stored on app.state).
  3. Start RunManager (marks interrupted runs, starts writer task).

Shutdown:
  1. Stop RunManager (cancels writer task).
  2. Close Redis connection.

Routes:
  GET  /health
  POST /api/ecus
  GET  /api/ecus/{ecu_id}
  GET  /api/ecus/{ecu_id}/state
  POST /api/runs/start
  POST /api/runs/{run_id}/end
  GET  /api/runs/{run_id}/telemetry
  WS   /ws/v1/telemetry
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import ecus, health, runs
from app.services.cache import RedisCacheService
from app.services.run_manager import RunManager
from app.websocket.telemetry_ws import telemetry_ws_handler

logging.basicConfig(level=settings.log_level.upper())
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ---- Startup ----
    logger.info("Starting ECU Digital Twin server.")
    cache = RedisCacheService.from_url(settings.redis_url)
    run_manager = RunManager(cache=cache)
    app.state.cache = cache
    app.state.run_manager = run_manager
    await run_manager.start()
    logger.info("Server ready.")
    yield
    # ---- Shutdown ----
    logger.info("Shutting down ECU Digital Twin server.")
    await run_manager.stop()
    await cache.close()
    logger.info("Server shut down cleanly.")


app = FastAPI(
    title="ECU Digital Twin Server",
    description=(
        "Persistent digital-twin backend for registered physical ECUs. "
        "Stores ECU identity, firmware/map/config history, recorded engine runs, "
        "and telemetry. Supports run replay and future alternative-map evaluation."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST routers
app.include_router(health.router)
app.include_router(ecus.router)
app.include_router(runs.router)


# WebSocket endpoint
@app.websocket("/ws/v1/telemetry")
async def ws_telemetry(websocket: WebSocket) -> None:
    run_manager: RunManager = websocket.app.state.run_manager
    await telemetry_ws_handler(websocket, run_manager)
