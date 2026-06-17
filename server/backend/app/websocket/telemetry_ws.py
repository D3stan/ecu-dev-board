"""WebSocket telemetry ingestion handler.

Endpoint: /ws/v1/telemetry

Protocol:
  - Client bridge connects and sends IngestEnvelope JSON frames:
      { "run_id": "<uuid>", "batch": { <ECU ecu.telemetry.v1 frame> } }
  - Server validates, enqueues to RunManager.
  - Server responds with a persisted ack ONLY after the DB transaction commits:
      { "status": "persisted", "run_id": "...", "batch_seq": N, "t_us": N }
  - Client MUST wait for the ack before sending the next batch.
    This provides end-to-end backpressure: if the queue is full or DB is slow,
    the client bridge is naturally rate-limited.

Telemetry is NEVER silently dropped. If the queue is full, this handler
blocks (does not read the next message) until space becomes available.
"""
from __future__ import annotations

import json
import logging

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
                await websocket.send_json({"status": "error", "detail": str(exc)})
                continue

            run_id = envelope.run_id
            batch = envelope.batch

            # Verify the run is active
            active_run = run_manager.get_active_run(run_id)
            if active_run is None:
                logger.warning(
                    "Batch received for unknown/inactive run %s from %s", run_id, client
                )
                await websocket.send_json(
                    {
                        "status": "error",
                        "detail": f"Run {run_id} is not active. Start a run first.",
                    }
                )
                continue

            # Enqueue and await ack (blocks if queue is full — backpressure)
            try:
                ack = await run_manager.process_batch(run_id, batch)
            except ValueError as exc:
                logger.warning("process_batch rejected batch: %s", exc)
                await websocket.send_json({"status": "error", "detail": str(exc)})
                continue
            except Exception as exc:
                logger.exception("Writer failed for run %s: %s", run_id, exc)
                await websocket.send_json(
                    {"status": "error", "detail": "Internal write failure. Batch not persisted."}
                )
                continue

            # Send ack only after successful DB commit
            await websocket.send_json(ack)

    except WebSocketDisconnect:
        logger.info("WebSocket connection closed by client %s", client)
    except Exception as exc:
        logger.exception("Unexpected error in WebSocket handler: %s", exc)
        try:
            await websocket.close(code=1011)
        except Exception:
            pass
