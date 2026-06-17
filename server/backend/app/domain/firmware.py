"""Firmware, map, and configuration revision domain objects."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass
class FirmwareRevision:
    id: UUID
    ecu_id: UUID
    version: str
    notes: str | None
    created_at: datetime


@dataclass
class EngineMap:
    id: UUID
    ecu_id: UUID
    version: str
    map_type: str
    notes: str | None
    created_at: datetime


@dataclass
class Configuration:
    id: UUID
    ecu_id: UUID
    version: str
    notes: str | None
    created_at: datetime
