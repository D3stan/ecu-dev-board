"""WebSocket telemetry ingestion handler.

Endpoint: /ws/v1/telemetry

Protocol (v2 — chunked):
  - Client bridge connects and sends IngestEnvelope JSON frames:
      {
        "run_id": "<uuid>",
        "hwid": "<serial>",          # optional — validated if present
        "ecu_run_id": "<hex16>",     # optional — used for dedup across reconnects
        "stream_generation": N,      # monotonic counter reset on bridge restart
        "chunk": [
          { "batch_seq": N, "frame": { <ECU ecu.telemetry.v1 frame> } },
          ...
        ]
      }
  - Server validates, enqueues the entire chunk to RunManager.
  - Server responds with a persisted ack ONLY after the DB transaction commits:
      {
        "status": "persisted",
        "run_id": "...",
        "stream_generation": N,
        "committed_through_sequence": N
      }
  - Client MUST wait for the ack before sending the next chunk.
    This provides end-to-end backpressure: if the queue is full or DB is slow,
    the client bridge is naturally rate-limited.

Backward compat (v1):
  - Old clients that send { "run_id": "...", "batch": { ... } } are still handled
    transparently via IngestEnvelope.compat_single_batch validator.

WS disconnect does NOT end the run — the run stays active so the bridge can
reconnect and resume using GET /api/runs/active?hwid=<serial>.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from fastapi import WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.domain.telemetry import IngestEnvelope
from app.services.run_manager import RunManager

logger = logging.getLogger(__name__)


async def telemetry_ws_handler(websocket: WebSocket, run_manager: RunManager) -> None:
    await websocket.accept()
    client = websocket.client
    logger.info("WebSocket connection opened from %s", client)

    try:
        while True:
            # Receive next message (blocks until client sends one)
            raw = await websocket.receive_text()

            # Parse and validate
            try:
                data = json.loads(raw)
                envelope = IngestEnvelope.model_validate(data)
            except (json.JSONDecodeError, ValidationError) as exc:
                logger.warning("Invalid telemetry envelope from %s: %s", client, exc)
                await websocket.send_json({
                    "status": "error",
                    "detail": f"parse_error: {exc}",
                    "committed_through_sequence": 0,
                    "stream_generation": 0,
                    "run_id": "",
                })
                continue

            run_id = envelope.run_id

            # Verify the run is active
            active_run = run_manager.get_active_run(run_id)
            if active_run is None:
                logger.warning(
                    "Chunk received for unknown/inactive run %s from %s", run_id, client
                )
                await websocket.send_json({
                    "status": "error",
                    "detail": f"Run {run_id} is not active. Start a run first.",
                    "committed_through_sequence": 0,
                    "stream_generation": envelope.stream_generation,
                    "run_id": str(run_id),
                })
                continue

            # HWID validation — if the client supplies hwid, ensure it matches the active run
            if envelope.hwid and active_run.ecu_serial != envelope.hwid:
                logger.warning(
                    "HWID mismatch for run %s: expected %s, got %s",
                    run_id, active_run.ecu_serial, envelope.hwid,
                )
                await websocket.send_json({
                    "status": "error",
                    "detail": "hwid_mismatch",
                    "committed_through_sequence": 0,
                    "stream_generation": envelope.stream_generation,
                    "run_id": str(run_id),
                })
                continue

            # Enqueue the entire chunk and await ack (blocks if queue is full — backpressure)
            try:
                received_at = datetime.now(tz=timezone.utc)
                committed_seq = await run_manager.process_chunk(
                    run_id=run_id,
                    chunk=envelope.chunk,
                    ecu_run_id=envelope.ecu_run_id,
                    stream_generation=envelope.stream_generation,
                    received_at=received_at,
                )
            except ValueError as exc:
                logger.warning("process_chunk rejected chunk: %s", exc)
                await websocket.send_json({
                    "status": "error",
                    "detail": str(exc),
                    "committed_through_sequence": 0,
                    "stream_generation": envelope.stream_generation,
                    "run_id": str(run_id),
                })
                continue
            except Exception as exc:
                logger.exception("Writer failed for run %s: %s", run_id, exc)
                await websocket.send_json({
                    "status": "error",
                    "detail": "Internal write failure. Chunk not persisted.",
                    "committed_through_sequence": 0,
                    "stream_generation": envelope.stream_generation,
                    "run_id": str(run_id),
                })
                continue

            # Send ack only after successful DB commit
            if envelope.single_batch:
                await websocket.send_json({
                    "status": "persisted",
                    "run_id": str(run_id),
                    "batch_seq": committed_seq,
                    "t_us": envelope.chunk[0].frame.t_us,
                })
            else:
                await websocket.send_json({
                    "status": "persisted",
                    "run_id": str(run_id),
                    "stream_generation": envelope.stream_generation,
                    "committed_through_sequence": committed_seq,
                })

    except WebSocketDisconnect:
        # Client disconnected — do NOT end the run. It may reconnect.
        logger.info(
            "WebSocket connection closed by client %s — run stays active for reconnect", client
        )
    except Exception as exc:
        logger.exception("Unexpected error in WebSocket handler: %s", exc)
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
