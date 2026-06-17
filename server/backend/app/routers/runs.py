"""Run REST endpoints.

POST /api/runs/start              — start a new recorded run
POST /api/runs/{run_id}/end       — end an active run
GET  /api/runs/{run_id}/telemetry — query persisted telemetry states
"""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.services.database import PostgreSQLService
from app.services.ecu_registry import EcuRegistry
from app.services.run_manager import RunManager

router = APIRouter(prefix="/api/runs", tags=["runs"])


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class StartRunRequest(BaseModel):
    ecu_id: uuid.UUID | None = None
    hwid: str | None = None
    hardware_revision: str | None = None
    firmware_version: str | None = None
    map_version: str | None = None

    @model_validator(mode="after")
    def check_identity(self) -> "StartRunRequest":
        if self.ecu_id is None and self.hwid is None:
            raise ValueError("Either ecu_id or hwid must be provided")
        return self


class StartRunResponse(BaseModel):
    run_id: uuid.UUID
    hwid: str | None = None
    ecu_id: uuid.UUID | None = None


class RunDetailResponse(BaseModel):
    id: uuid.UUID
    ecu_id: uuid.UUID
    status: str
    started_at: datetime
    ended_at: datetime | None = None
    firmware_version: str | None = None
    map_version: str | None = None
    heartbeat: datetime | None = None
    last_committed_sequence: int
    batch_count: int


class TelemetryStateEntry(BaseModel):
    id: uuid.UUID
    run_id: uuid.UUID
    server_received_at: datetime
    ecu_collected_at_us: int
    snapshot_generation: int
    state_json: dict
    overflow_json: dict
    batch_seq: int


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------

def _db_service(session: AsyncSession = Depends(get_session)) -> PostgreSQLService:
    return PostgreSQLService(session)


def _registry(db: PostgreSQLService = Depends(_db_service)) -> EcuRegistry:
    return EcuRegistry(db)


def _run_manager(request: Request) -> RunManager:
    return request.app.state.run_manager


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[RunDetailResponse])
async def list_runs(
    ecu_id: uuid.UUID | None = None,
    db: PostgreSQLService = Depends(_db_service),
) -> list[RunDetailResponse]:
    runs = await db.get_all_runs(ecu_id=ecu_id)
    return [
        RunDetailResponse(
            id=r.id,
            ecu_id=r.ecu_id,
            status=r.status,
            started_at=r.started_at,
            ended_at=r.ended_at,
            firmware_version=r.firmware_version,
            map_version=r.map_version,
            heartbeat=r.heartbeat,
            last_committed_sequence=r.last_committed_sequence,
            batch_count=r.batch_count,
        )
        for r in runs
    ]


@router.get("/active")
async def get_active_run_by_hwid(
    hwid: str,
    db: PostgreSQLService = Depends(_db_service),
    run_manager: RunManager = Depends(_run_manager),
) -> dict:
    """
    Returns the active run for a given HWID, or 404 if none.
    Used by the browser bridge to resume after reconnect.
    """
    ecu = await db.get_ecu_by_serial(hwid)
    if ecu is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ecu_not_found")

    # Find an active run for this ECU in the in-process cache
    active_run = next(
        (r for r in run_manager._active_runs.values() if r.ecu_id == ecu.id),
        None,
    )
    if active_run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="no_active_run")

    last_seq = await db.get_run_last_committed_seq(active_run.run_id)
    return {
        "run_id": str(active_run.run_id),
        "ecu_id": str(active_run.ecu_id),
        "hwid": hwid,
        "last_committed_sequence": last_seq or 0,
    }


@router.post("/start", status_code=status.HTTP_201_CREATED, response_model=StartRunResponse)
async def start_run(
    body: StartRunRequest,
    registry: EcuRegistry = Depends(_registry),
    run_manager: RunManager = Depends(_run_manager),
) -> StartRunResponse:
    # Resolve ECU by HWID (auto-create) or by UUID
    if body.hwid:
        ecu = await registry.resolve_or_create_by_hwid(
            body.hwid, body.hardware_revision
        )
    else:
        ecu = await registry.get_ecu(body.ecu_id)

    run_id = await run_manager.start_run(
        ecu_id=ecu.id,
        ecu_serial=ecu.serial_number,
        firmware_version=body.firmware_version,
        map_version=body.map_version,
    )
    return StartRunResponse(run_id=run_id, hwid=ecu.serial_number, ecu_id=ecu.id)


@router.post("/{run_id}/end", status_code=status.HTTP_200_OK)
async def end_run(
    run_id: uuid.UUID,
    run_manager: RunManager = Depends(_run_manager),
) -> dict:
    await run_manager.end_run(run_id)
    return {"status": "ended", "run_id": str(run_id)}


@router.get("/{run_id}/telemetry", response_model=list[TelemetryStateEntry])
async def get_telemetry(
    run_id: uuid.UUID,
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = 1000,
    db: PostgreSQLService = Depends(_db_service),
) -> list[TelemetryStateEntry]:
    # Verify run exists
    run_model = await db.get_run(run_id)
    if run_model is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run {run_id} not found.",
        )
    states = await db.get_telemetry_history(run_id, start=start, end=end, limit=limit)
    return [
        TelemetryStateEntry(
            id=s.id,
            run_id=s.run_id,
            server_received_at=s.server_received_at,
            ecu_collected_at_us=s.ecu_collected_at_us,
            snapshot_generation=s.snapshot_generation,
            state_json=s.state_json,
            overflow_json=s.overflow_json,
            batch_seq=s.batch_seq,
        )
        for s in states
    ]
