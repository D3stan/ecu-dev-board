"""EcuRegistry — ECU registration and lookup.

Raises HTTP 409 on duplicate serial, HTTP 404 on missing ECU.
Used by REST route handlers (per-request, injected via Depends).
"""
from __future__ import annotations

import uuid

from fastapi import HTTPException, status

from app.domain.ecu import Ecu
from app.services.database import DatabaseService


class EcuRegistry:
    def __init__(self, db: DatabaseService) -> None:
        self._db = db

    async def register_ecu(self, serial_number: str, hardware_revision: str) -> Ecu:
        existing = await self._db.get_ecu_by_serial(serial_number)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"ECU with serial '{serial_number}' is already registered.",
            )
        return await self._db.save_ecu(serial_number, hardware_revision)

    async def get_ecu(self, ecu_id: uuid.UUID) -> Ecu:
        ecu = await self._db.get_ecu_by_id(ecu_id)
        if ecu is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"ECU {ecu_id} not found.",
            )
        return ecu

    async def get_ecu_by_serial(self, serial_number: str) -> Ecu:
        ecu = await self._db.get_ecu_by_serial(serial_number)
        if ecu is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"ECU with serial '{serial_number}' not found.",
            )
        return ecu

    async def get_ecu_by_serial_number(self, serial_number: str) -> Ecu | None:
        """Silent version — returns None instead of raising 404. Used by bridge-resume endpoint."""
        return await self._db.get_ecu_by_serial(serial_number)

    async def resolve_or_create_by_hwid(
        self,
        hwid: str,
        hardware_revision: str | None = None,
    ) -> Ecu:
        """
        Look up an ECU by its HWID (serial_number). Creates it if not found.
        Idempotent — repeated calls with the same HWID return the same row.
        """
        ecu = await self._db.get_ecu_by_serial(hwid)
        if ecu is not None:
            return ecu
        return await self._db.save_ecu(
            serial_number=hwid,
            hardware_revision=hardware_revision or "unknown",
        )
