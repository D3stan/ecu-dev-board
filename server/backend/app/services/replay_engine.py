"""ReplayEngine — recorded playback and alternative-map evaluation stubs.

Stage 1/2 implementation:
  - replay_run() streams persisted state frames from the database.
  - simulate_with_alternative_map() returns a clear not_implemented result.
    It MUST NOT produce mocked simulation results.
"""
from __future__ import annotations

import logging
import uuid
from typing import AsyncGenerator

from app.db.models import TelemetryStateModel
from app.db.session import AsyncSessionLocal
from app.services.database import PostgreSQLService

logger = logging.getLogger(__name__)


class ReplayEngine:
    async def replay_run(
        self, run_id: uuid.UUID, limit: int = 5000
    ) -> AsyncGenerator[TelemetryStateModel, None]:
        """Yield persisted TelemetryStateModel rows in ECU timestamp order."""
        async with AsyncSessionLocal() as session:
            db = PostgreSQLService(session)
            states = await db.get_telemetry_history(run_id, limit=limit)
        for state in states:
            yield state

    async def simulate_with_alternative_map(
        self, run_id: uuid.UUID, alt_map: dict
    ) -> dict:
        """
        Alternative-map evaluation — NOT YET IMPLEMENTED.

        Returns a clear not_implemented result. No mocked data is returned.
        The real evaluator will recalculate ECU command outputs (e.g. ignition
        advance) using recorded inputs and a versioned copy of the ECU map
        algorithm. It will NOT predict RPM, torque, knock, temperature, or
        combustion behavior.
        """
        logger.info(
            "simulate_with_alternative_map called for run %s — returning not_implemented.", run_id
        )
        return {
            "status": "not_implemented",
            "run_id": str(run_id),
            "detail": (
                "Alternative-map evaluation is not available in this version. "
                "It will be implemented in a future release."
            ),
        }
