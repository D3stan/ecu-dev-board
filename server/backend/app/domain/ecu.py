"""ECU entity — the persistent digital twin identity for a physical ECU."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID


@dataclass
class Ecu:
    id: UUID
    serial_number: str
    hardware_revision: str
    created_at: datetime
    # Latest known state from Redis (may be None if never seen or cache expired)
    latest_state_json: dict | None = None
    latest_state_observed_at: datetime | None = None
