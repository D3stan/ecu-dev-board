"""RunManager — lifecycle management and telemetry ingestion.

Design:
  - PostgreSQL is the authoritative source for run state.
  - An in-process dict (_active_runs) caches active runs for fast look-up.
  - A bounded asyncio.Queue carries batches from the WebSocket handler to the
    background writer task. When full the WebSocket handler blocks naturally
    (backpressure — no silent drops).
  - The writer task commits each batch to TimescaleDB and updates Redis.
  - Each batch is acked to the WebSocket handler only after DB commit, via an
    asyncio.Future passed through the queue.
  - On startup, all DB-active runs are marked interrupted so duplicate run IDs
    are never reused after a restart.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from app.config import settings
from app.db.session import AsyncSessionLocal
from app.domain.run import ActiveRun
from app.domain.telemetry import ChunkEntry, EcuTelemetryBatch
from app.services.cache import CacheService
from app.services.database import PostgreSQLService

logger = logging.getLogger(__name__)

# Queue item for a single legacy batch: (run_id, batch, server_received_at, batch_seq, ack_future)
_QueueItem = tuple[uuid.UUID, EcuTelemetryBatch, datetime, int, "asyncio.Future[dict]"]

# Queue item for a chunk: (run_id, chunk, ecu_run_id, server_received_at, stream_generation, ack_future)
_ChunkQueueItem = tuple[uuid.UUID, list[ChunkEntry], str | None, datetime, int, "asyncio.Future[int]"]


class RunManager:
    def __init__(self, cache: CacheService) -> None:
        self._cache = cache
        self._active_runs: dict[uuid.UUID, ActiveRun] = {}
        self._queue: asyncio.Queue[_QueueItem] = asyncio.Queue(
            maxsize=settings.ingest_queue_size
        )
        self._writer_task: asyncio.Task | None = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Called once on application startup."""
        async with AsyncSessionLocal() as session:
            db = PostgreSQLService(session)
            interrupted = await db.mark_interrupted_runs()
        if interrupted:
            logger.warning(
                "Marked %d previously active run(s) as interrupted on startup.", len(interrupted)
            )
        self._writer_task = asyncio.create_task(
            self._writer_loop(), name="telemetry-writer"
        )
        logger.info("RunManager started.")

    async def stop(self) -> None:
        """Called once on application shutdown."""
        if self._writer_task:
            self._writer_task.cancel()
            try:
                await self._writer_task
            except asyncio.CancelledError:
                pass
        logger.info("RunManager stopped.")

    # ------------------------------------------------------------------
    # Run lifecycle
    # ------------------------------------------------------------------

    async def start_run(
        self,
        ecu_id: uuid.UUID,
        ecu_serial: str,
        firmware_version: str | None = None,
        map_version: str | None = None,
    ) -> uuid.UUID:
        async with AsyncSessionLocal() as session:
            db = PostgreSQLService(session)
            run_id = await db.create_run(ecu_id, firmware_version, map_version)

        active = ActiveRun(
            run_id=run_id,
            ecu_id=ecu_id,
            ecu_serial=ecu_serial,
            started_at=datetime.now(tz=timezone.utc),
            firmware_version=firmware_version,
            map_version=map_version,
        )
        self._active_runs[run_id] = active
        logger.info("Started run %s for ECU %s (serial=%s)", run_id, ecu_id, ecu_serial)
        return run_id

    async def end_run(self, run_id: uuid.UUID) -> None:
        async with AsyncSessionLocal() as session:
            db = PostgreSQLService(session)
            # Verify the run exists in DB (may not be in _active_runs after restart)
            run_model = await db.get_run(run_id)
            if run_model is None:
                from fastapi import HTTPException, status
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Run {run_id} not found.",
                )
            await db.end_run(run_id)

        self._active_runs.pop(run_id, None)
        logger.info("Ended run %s", run_id)

    def get_active_run(self, run_id: uuid.UUID) -> ActiveRun | None:
        return self._active_runs.get(run_id)

    # ------------------------------------------------------------------
    # Batch ingestion (called by WebSocket handler)
    # ------------------------------------------------------------------

    async def process_batch(
        self,
        run_id: uuid.UUID,
        batch: EcuTelemetryBatch,
    ) -> dict:
        """
        Enqueue a telemetry batch for persistence and await DB commit ack.

        Blocks if the queue is full — this is the backpressure mechanism.
        The caller (WebSocket handler) must not read the next message until
        this coroutine returns (i.e., the previous batch has been committed).
        """
        run = self._active_runs.get(run_id)
        if run is None:
            raise ValueError(f"No active run with id={run_id}.")

        run.batch_count += 1
        batch_seq = run.batch_count
        received_at = datetime.now(tz=timezone.utc)

        loop = asyncio.get_running_loop()
        ack_future: asyncio.Future[dict] = loop.create_future()

        # Blocks until there is space — natural backpressure
        await self._queue.put((run_id, batch, received_at, batch_seq, ack_future))

        # Await writer confirmation (after DB commit)
        return await ack_future

    async def process_chunk(
        self,
        run_id: uuid.UUID,
        chunk: list[ChunkEntry],
        ecu_run_id: str | None,
        stream_generation: int,
        received_at: datetime,
    ) -> int:
        """
        Process an entire upload chunk atomically.
        Returns committed_through_sequence (max batch_seq in chunk).

        Blocks if the queue is full — natural backpressure.
        """
        run = self._active_runs.get(run_id)
        if run is None:
            raise ValueError(f"No active run with id={run_id}.")

        max_seq = max(entry.batch_seq for entry in chunk)

        loop = asyncio.get_running_loop()
        ack_future: asyncio.Future[int] = loop.create_future()

        # Sentinel marker distinguishes chunk items from legacy batch items in the queue
        await self._queue.put((
            run_id, chunk, ecu_run_id, received_at, stream_generation, ack_future  # type: ignore[arg-type]
        ))

        committed_seq: int = await ack_future
        run.last_committed_sequence = committed_seq
        return committed_seq

    # ------------------------------------------------------------------
    # Background writer loop
    # ------------------------------------------------------------------

    async def _writer_loop(self) -> None:
        logger.info("Telemetry writer task started.")
        while True:
            try:
                item = await self._queue.get()
            except asyncio.CancelledError:
                logger.info("Telemetry writer task stopping.")
                break

            try:
                # Detect item type by length: chunk items have 6 elements, legacy have 5
                if len(item) == 6:
                    # Chunk path
                    run_id, chunk, ecu_run_id, received_at, stream_generation, ack_future = item  # type: ignore[misc]
                    async with AsyncSessionLocal() as session:
                        db = PostgreSQLService(session)
                        await db.insert_telemetry_chunk(run_id, ecu_run_id, chunk, received_at)

                    max_seq = max(entry.batch_seq for entry in chunk)  # type: ignore[union-attr]

                    # Best-effort Redis update using last frame in chunk
                    run = self._active_runs.get(run_id)
                    if run is not None and chunk:  # type: ignore[union-attr]
                        last_frame = chunk[-1].frame  # type: ignore[index]
                        state_payload: dict[str, Any] = {
                            "state": last_frame.state.model_dump(),
                            "ecu_collected_at_us": last_frame.t_us,
                            "server_received_at": received_at.isoformat(),
                            "run_id": str(run_id),
                        }
                        try:
                            await self._cache.set_latest_state(
                                run.ecu_serial, state_payload, settings.state_cache_ttl
                            )
                        except Exception as cache_exc:
                            logger.warning("Redis update failed (non-fatal): %s", cache_exc)

                    ack_future.set_result(max_seq)  # type: ignore[union-attr]

                else:
                    # Legacy single-batch path
                    run_id, batch, received_at, batch_seq, ack_future = item  # type: ignore[misc]
                    async with AsyncSessionLocal() as session:
                        db = PostgreSQLService(session)
                        await db.insert_telemetry_batch(run_id, batch, received_at, batch_seq)

                    run = self._active_runs.get(run_id)
                    if run is not None:
                        state_payload = {
                            "state": batch.state.model_dump(),  # type: ignore[union-attr]
                            "ecu_collected_at_us": batch.t_us,  # type: ignore[union-attr]
                            "server_received_at": received_at.isoformat(),
                            "run_id": str(run_id),
                        }
                        try:
                            await self._cache.set_latest_state(
                                run.ecu_serial, state_payload, settings.state_cache_ttl
                            )
                        except Exception as cache_exc:
                            logger.warning("Redis update failed (non-fatal): %s", cache_exc)

                    ack_future.set_result(  # type: ignore[union-attr]
                        {
                            "status": "persisted",
                            "run_id": str(run_id),
                            "batch_seq": batch_seq,  # type: ignore[union-attr]
                            "t_us": batch.t_us,  # type: ignore[union-attr]
                        }
                    )

            except asyncio.CancelledError:
                if not ack_future.done():  # type: ignore[union-attr]
                    ack_future.cancel()  # type: ignore[union-attr]
                logger.info("Telemetry writer task stopping during batch.")
                break
            except Exception as exc:
                logger.exception("Writer failed for queue item: %s", exc)
                if not ack_future.done():  # type: ignore[union-attr]
                    ack_future.set_exception(exc)  # type: ignore[union-attr]
            finally:
                self._queue.task_done()
