"""DatabaseService ABC and PostgreSQLService implementation.

PostgreSQLService is instantiated per-request (injected via FastAPI Depends).
RunManager uses AsyncSessionLocal directly so it can manage its own session
lifetime inside the background writer task.
"""
from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import EcuModel, RunModel, TelemetryEventModel, TelemetryStateModel
from app.domain.ecu import Ecu
from app.domain.telemetry import EcuTelemetryBatch


class DatabaseService(ABC):
    @abstractmethod
    async def save_ecu(self, serial_number: str, hardware_revision: str) -> Ecu: ...

    @abstractmethod
    async def get_ecu_by_id(self, ecu_id: uuid.UUID) -> Ecu | None: ...

    @abstractmethod
    async def get_ecu_by_serial(self, serial_number: str) -> Ecu | None: ...

    @abstractmethod
    async def get_all_ecus(self) -> list[Ecu]: ...

    @abstractmethod
    async def get_all_runs(self, ecu_id: uuid.UUID | None = None) -> list[RunModel]: ...

    @abstractmethod
    async def create_run(
        self,
        ecu_id: uuid.UUID,
        firmware_version: str | None = None,
        map_version: str | None = None,
    ) -> uuid.UUID: ...

    @abstractmethod
    async def end_run(self, run_id: uuid.UUID) -> None: ...

    @abstractmethod
    async def mark_interrupted_runs(self) -> list[uuid.UUID]: ...

    @abstractmethod
    async def get_run(self, run_id: uuid.UUID) -> RunModel | None: ...

    @abstractmethod
    async def insert_telemetry_batch(
        self,
        run_id: uuid.UUID,
        batch: EcuTelemetryBatch,
        server_received_at: datetime,
        batch_seq: int,
    ) -> None: ...

    @abstractmethod
    async def get_telemetry_history(
        self,
        run_id: uuid.UUID,
        start: datetime | None = None,
        end: datetime | None = None,
        limit: int = 1000,
    ) -> list[TelemetryStateModel]: ...

    @abstractmethod
    async def insert_telemetry_chunk(
        self,
        run_id: uuid.UUID,
        ecu_run_id: str | None,
        chunk: list,  # list of ChunkEntry-like objects with .batch_seq and .frame
        received_at: datetime,
    ) -> None: ...

    @abstractmethod
    async def get_run_last_committed_seq(self, run_id: uuid.UUID) -> int | None: ...


class PostgreSQLService(DatabaseService):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ------------------------------------------------------------------
    # ECU
    # ------------------------------------------------------------------

    async def save_ecu(self, serial_number: str, hardware_revision: str) -> Ecu:
        model = EcuModel(serial_number=serial_number, hardware_revision=hardware_revision)
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return _ecu_from_model(model)

    async def get_ecu_by_id(self, ecu_id: uuid.UUID) -> Ecu | None:
        result = await self._session.execute(
            select(EcuModel).where(EcuModel.id == ecu_id)
        )
        model = result.scalar_one_or_none()
        return _ecu_from_model(model) if model else None

    async def get_ecu_by_serial(self, serial_number: str) -> Ecu | None:
        result = await self._session.execute(
            select(EcuModel).where(EcuModel.serial_number == serial_number)
        )
        model = result.scalar_one_or_none()
        return _ecu_from_model(model) if model else None

    async def get_all_ecus(self) -> list[Ecu]:
        result = await self._session.execute(
            select(EcuModel).order_by(EcuModel.created_at.desc())
        )
        models = result.scalars().all()
        return [_ecu_from_model(m) for m in models]

    async def get_all_runs(self, ecu_id: uuid.UUID | None = None) -> list[RunModel]:
        query = select(RunModel).order_by(RunModel.started_at.desc())
        if ecu_id:
            query = query.where(RunModel.ecu_id == ecu_id)
        result = await self._session.execute(query)
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # Runs
    # ------------------------------------------------------------------

    async def create_run(
        self,
        ecu_id: uuid.UUID,
        firmware_version: str | None = None,
        map_version: str | None = None,
    ) -> uuid.UUID:
        model = RunModel(
            ecu_id=ecu_id,
            status="active",
            firmware_version=firmware_version,
            map_version=map_version,
        )
        self._session.add(model)
        await self._session.commit()
        await self._session.refresh(model)
        return model.id

    async def end_run(self, run_id: uuid.UUID) -> None:
        await self._session.execute(
            update(RunModel)
            .where(RunModel.id == run_id)
            .values(status="ended", ended_at=datetime.now(tz=timezone.utc))
        )
        await self._session.commit()

    async def mark_interrupted_runs(self) -> list[uuid.UUID]:
        """On server startup: mark all DB-active runs as interrupted. Returns their IDs."""
        result = await self._session.execute(
            select(RunModel).where(RunModel.status == "active")
        )
        active = result.scalars().all()
        ids = [r.id for r in active]
        if ids:
            await self._session.execute(
                update(RunModel)
                .where(RunModel.status == "active")
                .values(status="interrupted")
            )
            await self._session.commit()
        return ids

    async def get_run(self, run_id: uuid.UUID) -> RunModel | None:
        result = await self._session.execute(
            select(RunModel).where(RunModel.id == run_id)
        )
        return result.scalar_one_or_none()

    # ------------------------------------------------------------------
    # Telemetry
    # ------------------------------------------------------------------

    async def insert_telemetry_batch(
        self,
        run_id: uuid.UUID,
        batch: EcuTelemetryBatch,
        server_received_at: datetime,
        batch_seq: int,
    ) -> None:
        # Persist state frame
        state_record = TelemetryStateModel(
            run_id=run_id,
            server_received_at=server_received_at,
            ecu_collected_at_us=batch.t_us,
            snapshot_generation=batch.gen,
            state_json=batch.state.model_dump(),
            overflow_json=batch.overflow.model_dump(),
            batch_seq=batch_seq,
        )
        self._session.add(state_record)

        # Persist each event frame
        for event in batch.events:
            event_record = TelemetryEventModel(
                run_id=run_id,
                server_received_at=server_received_at,
                occurred_at_us=event.at_us,
                kind=event.kind,
                payload_json=event.model_dump(),
            )
            self._session.add(event_record)

        # Update run heartbeat and counters
        await self._session.execute(
            update(RunModel)
            .where(RunModel.id == run_id)
            .values(
                heartbeat=server_received_at,
                batch_count=RunModel.batch_count + 1,
                last_committed_sequence=batch_seq,
            )
        )

        await self._session.commit()

    async def get_telemetry_history(
        self,
        run_id: uuid.UUID,
        start: datetime | None = None,
        end: datetime | None = None,
        limit: int = 1000,
    ) -> list[TelemetryStateModel]:
        query = select(TelemetryStateModel).where(TelemetryStateModel.run_id == run_id)
        if start:
            query = query.where(TelemetryStateModel.server_received_at >= start)
        if end:
            query = query.where(TelemetryStateModel.server_received_at <= end)
        query = query.order_by(TelemetryStateModel.ecu_collected_at_us).limit(limit)
        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def insert_telemetry_chunk(
        self,
        run_id: uuid.UUID,
        ecu_run_id: str | None,
        chunk: list,  # list of ChunkEntry-like objects with .batch_seq and .frame
        received_at: datetime,
    ) -> None:
        """
        Bulk insert all batches in a chunk within one transaction.
        Duplicate (run_id, ecu_run_id, batch_seq) combinations are filtered out
        programmatically before insertion to comply with TimescaleDB limitations on unique indexes.
        """
        if not chunk:
            return

        batch_seqs = [entry.batch_seq for entry in chunk]

        # Query existing batch_seqs for this run and ecu_run_id to prevent duplicates
        if ecu_run_id is not None:
            existing_result = await self._session.execute(
                select(TelemetryStateModel.batch_seq)
                .where(
                    TelemetryStateModel.run_id == run_id,
                    TelemetryStateModel.ecu_run_id == ecu_run_id,
                    TelemetryStateModel.batch_seq.in_(batch_seqs),
                )
            )
            existing_seqs = set(existing_result.scalars().all())
        else:
            existing_seqs = set()

        new_entries = [entry for entry in chunk if entry.batch_seq not in existing_seqs]

        # Insert new states and events
        for entry in new_entries:
            batch = entry.frame  # EcuTelemetryBatch

            state_record = TelemetryStateModel(
                run_id=run_id,
                ecu_run_id=ecu_run_id,
                server_received_at=received_at,
                ecu_collected_at_us=batch.t_us,
                snapshot_generation=batch.gen,
                state_json=batch.state.model_dump(),
                overflow_json=batch.overflow.model_dump(),
                batch_seq=entry.batch_seq,
            )
            self._session.add(state_record)

            # Insert event rows
            for event in (batch.events or []):
                event_record = TelemetryEventModel(
                    run_id=run_id,
                    server_received_at=received_at,
                    occurred_at_us=event.at_us,
                    kind=event.kind,
                    payload_json=event.model_dump(),
                )
                self._session.add(event_record)

        # Update run heartbeat and counters using the max batch_seq in the chunk
        # and only incrementing the batch_count by the number of new entries.
        max_seq = max(entry.batch_seq for entry in chunk)
        await self._session.execute(
            update(RunModel)
            .where(RunModel.id == run_id)
            .values(
                heartbeat=received_at,
                batch_count=RunModel.batch_count + len(new_entries),
                last_committed_sequence=max_seq,
            )
        )

        await self._session.commit()

    async def get_run_last_committed_seq(self, run_id: uuid.UUID) -> int | None:
        """Returns the highest batch_seq committed for a run, or None."""
        result = await self._session.execute(
            select(func.max(TelemetryStateModel.batch_seq))
            .where(TelemetryStateModel.run_id == run_id)
        )
        return result.scalar()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ecu_from_model(model: EcuModel) -> Ecu:
    return Ecu(
        id=model.id,
        serial_number=model.serial_number,
        hardware_revision=model.hardware_revision,
        created_at=model.created_at,
    )
