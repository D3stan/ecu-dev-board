"""Run domain model — tracks the lifecycle of a recorded engine run."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class RunStatus(StrEnum):
    ACTIVE = "active"
    ENDED = "ended"
    INTERRUPTED = "interrupted"


@dataclass
class ActiveRun:
    """In-process representation of an active run (authoritative source is PostgreSQL)."""
    run_id: UUID
    ecu_id: UUID
    ecu_serial: str       # needed to update Redis latest-state cache
    started_at: datetime
    batch_count: int = 0
    firmware_version: str | None = None
    map_version: str | None = None
    last_committed_sequence: int = 0
