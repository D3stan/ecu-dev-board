"""ECU REST endpoints.

POST /api/ecus           — register a new ECU (serial must be unique)
GET  /api/ecus/{ecu_id}  — get ECU details
GET  /api/ecus/{ecu_id}/state — latest known state (Redis cache → DB fallback)
"""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.services.cache import CacheService
from app.services.database import PostgreSQLService
from app.services.ecu_registry import EcuRegistry

router = APIRouter(prefix="/api/ecus", tags=["ecus"])


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class RegisterEcuRequest(BaseModel):
    serial_number: str
    hardware_revision: str


class EcuResponse(BaseModel):
    id: uuid.UUID
    serial_number: str
    hardware_revision: str
    created_at: datetime


class LatestStateResponse(BaseModel):
    ecu_id: uuid.UUID
    serial_number: str
    state: dict | None
    """None when no state has ever been received or the cache TTL has expired."""
    cached: bool
    """True when state was served from Redis; False when absent."""


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------

def _db_service(session: AsyncSession = Depends(get_session)) -> PostgreSQLService:
    return PostgreSQLService(session)


def _registry(db: PostgreSQLService = Depends(_db_service)) -> EcuRegistry:
    return EcuRegistry(db)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("", status_code=status.HTTP_201_CREATED, response_model=EcuResponse)
async def register_ecu(
    body: RegisterEcuRequest,
    registry: EcuRegistry = Depends(_registry),
) -> EcuResponse:
    ecu = await registry.register_ecu(body.serial_number, body.hardware_revision)
    return EcuResponse(
        id=ecu.id,
        serial_number=ecu.serial_number,
        hardware_revision=ecu.hardware_revision,
        created_at=ecu.created_at,
    )


@router.get("", response_model=list[EcuResponse])
async def list_ecus(
    db: PostgreSQLService = Depends(_db_service),
) -> list[EcuResponse]:
    ecus = await db.get_all_ecus()
    return [
        EcuResponse(
            id=ecu.id,
            serial_number=ecu.serial_number,
            hardware_revision=ecu.hardware_revision,
            created_at=ecu.created_at,
        )
        for ecu in ecus
    ]


@router.get("/{ecu_id}", response_model=EcuResponse)
async def get_ecu(
    ecu_id: uuid.UUID,
    registry: EcuRegistry = Depends(_registry),
) -> EcuResponse:
    ecu = await registry.get_ecu(ecu_id)
    return EcuResponse(
        id=ecu.id,
        serial_number=ecu.serial_number,
        hardware_revision=ecu.hardware_revision,
        created_at=ecu.created_at,
    )


@router.get("/{ecu_id}/state", response_model=LatestStateResponse)
async def get_latest_state(
    ecu_id: uuid.UUID,
    request: Request,
    registry: EcuRegistry = Depends(_registry),
) -> LatestStateResponse:
    ecu = await registry.get_ecu(ecu_id)
    cache: CacheService = request.app.state.cache
    state = await cache.get_latest_state(ecu.serial_number)
    return LatestStateResponse(
        ecu_id=ecu.id,
        serial_number=ecu.serial_number,
        state=state,
        cached=state is not None,
    )
