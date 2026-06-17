"""End-to-end integration tests for the ECU Digital Twin server.

This file runs inside the test-runner container (docker-compose.test.yml).
It simulates the full client-bridge + ECU flow as specified in the sequence
diagram in docs/architecture.md.

Environment variables (set by docker-compose.test.yml):
  BACKEND_URL     — e.g. http://backend:8000
  BACKEND_WS_URL  — e.g. ws://backend:8000/ws/v1/telemetry
"""
from __future__ import annotations

import asyncio
import json
import os
import time
import uuid

import httpx
import pytest
import pytest_asyncio
import websockets

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")
BACKEND_WS_URL = os.environ.get("BACKEND_WS_URL", "ws://localhost:8000/ws/v1/telemetry")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_telemetry_batch(t_us: int = 123_456_789, gen: int = 1) -> dict:
    """Build a minimal but valid ecu.telemetry.v1 batch JSON object."""
    meta = {
        "acquired_at_us": t_us - 1000,
        "seq": 1,
        "valid": True,
        "health": "Valid",
        "quality": "Good",
        "fault_bits": 0,
    }
    return {
        "type": "telemetry",
        "schema": "ecu.telemetry.v1",
        "t_us": t_us,
        "gen": gen,
        "state": {
            "tps": {
                "permille": 531,
                "pct": 53.1,
                "fallback_permille": 700,
                "fallback_used": False,
                "meta": meta,
            },
            "rpm": {
                "rpm": 4200.0,
                "period_us": 14285.7,
                "accel_rpm_per_s": 120.5,
                "synchronized": True,
                "crank_reference_trusted": True,
                "revolution_id": 1001,
                "reference_at_us": t_us - 5000,
                "meta": meta,
            },
            "egt": {
                "c": 520.3,
                "rate_c_per_s": 1.2,
                "max_c": 620.0,
                "state": "Normal",
                "request": "Normal",
                "meta": meta,
            },
            "water": {
                "c": 85.1,
                "rate_c_per_s": 0.1,
                "max_c": 92.0,
                "state": "Normal",
                "request": "Normal",
                "meta": meta,
            },
            "quick_shifter": {
                "active": False,
                "armed": True,
                "meta": meta,
            },
            "map_switch": {
                "request": "Primary",
                "meta": meta,
            },
            "knock": None,
        },
        "events": [],
        "overflow": {
            "quick_shift_events": 0,
            "map_switch_events": 0,
            "knock_measurements": 0,
            "fault_events": 0,
        },
        "transport": {
            "sent_frames": 1,
            "dropped_frames": 0,
            "send_errors": 0,
        },
    }


async def _wait_for_health(url: str, timeout: float = 60.0) -> None:
    """Poll /health until it returns 200 or timeout."""
    deadline = time.monotonic() + timeout
    async with httpx.AsyncClient() as client:
        while time.monotonic() < deadline:
            try:
                resp = await client.get(f"{url}/health", timeout=3.0)
                if resp.status_code == 200 and resp.json().get("status") == "ok":
                    return
            except Exception:
                pass
            await asyncio.sleep(1.0)
    raise TimeoutError(f"Backend at {url} did not become healthy within {timeout}s.")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_health() -> None:
    """Backend health check returns ok."""
    await _wait_for_health(BACKEND_URL)
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{BACKEND_URL}/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["db"] is True
    assert body["redis"] is True


@pytest.mark.asyncio
async def test_full_run_flow() -> None:
    """
    Full integration test following the sequence diagram in architecture.md:

      1. Register mock ECU
      2. Start a run
      3. Connect WebSocket and send a TelemetryBatch
      4. Receive persisted ack
      5. Verify latest state in Redis (via /api/ecus/{id}/state)
      6. Verify telemetry persisted in DB (via /api/runs/{run_id}/telemetry)
      7. End the run
    """
    await _wait_for_health(BACKEND_URL)

    hwid = f"esp32s3-{uuid.uuid4().hex[:12]}"

    async with httpx.AsyncClient(base_url=BACKEND_URL) as client:

        # ------------------------------------------------------------------
        # Step 1: Start a run by HWID. The server owns digital-twin creation.
        # ------------------------------------------------------------------
        resp = await client.post(
            "/api/runs/start",
            json={
                "hwid": hwid,
                "hardware_revision": "ESP32-S3FH4R2",
                "firmware_version": "fw-1.0.0",
                "map_version": "map-2.0.0",
            },
        )
        assert resp.status_code == 201, f"Run start failed: {resp.text}"
        started = resp.json()
        run_id = started["run_id"]
        ecu_id = started["ecu_id"]
        assert started["hwid"] == hwid

        # ------------------------------------------------------------------
        # Step 3: Connect WebSocket and send a TelemetryBatch
        # ------------------------------------------------------------------
        batch_payload = _make_telemetry_batch(t_us=123_456_789, gen=42)
        envelope = {"run_id": run_id, "hwid": hwid, "batch": batch_payload}

        async with websockets.connect(BACKEND_WS_URL) as ws:
            await ws.send(json.dumps(envelope))

            # ------------------------------------------------------------------
            # Step 4: Wait for persisted ack
            # ------------------------------------------------------------------
            raw_ack = await asyncio.wait_for(ws.recv(), timeout=10.0)
            ack = json.loads(raw_ack)
            assert ack["status"] == "persisted", f"Unexpected ack: {ack}"
            assert ack["run_id"] == run_id
            assert ack["t_us"] == 123_456_789
            assert ack["batch_seq"] == 1

        # ------------------------------------------------------------------
        # Step 5: Verify latest state from Redis
        # ------------------------------------------------------------------
        resp = await client.get(f"/api/ecus/{ecu_id}/state")
        assert resp.status_code == 200, f"State fetch failed: {resp.text}"
        state_body = resp.json()
        assert state_body["cached"] is True, "Expected state to be in Redis cache"
        assert state_body["state"] is not None
        assert "state" in state_body["state"]
        # TPS should match what we sent
        tps = state_body["state"]["state"]["tps"]
        assert tps["permille"] == 531

        # ------------------------------------------------------------------
        # Step 6: Verify DB persistence
        # ------------------------------------------------------------------
        resp = await client.get(f"/api/runs/{run_id}/telemetry")
        assert resp.status_code == 200, f"Telemetry fetch failed: {resp.text}"
        records = resp.json()
        assert len(records) >= 1, "Expected at least one persisted telemetry record"
        assert records[0]["ecu_collected_at_us"] == 123_456_789
        assert records[0]["snapshot_generation"] == 42

        # ------------------------------------------------------------------
        # Step 7: End the run
        # ------------------------------------------------------------------
        resp = await client.post(f"/api/runs/{run_id}/end")
        assert resp.status_code == 200, f"Run end failed: {resp.text}"
        assert resp.json()["status"] == "ended"


@pytest.mark.asyncio
async def test_repeated_hwid_run_start_reuses_existing_ecu() -> None:
    """Starting runs by the same HWID must not create duplicate ECU rows."""
    await _wait_for_health(BACKEND_URL)
    hwid = f"esp32s3-{uuid.uuid4().hex[:12]}"
    async with httpx.AsyncClient(base_url=BACKEND_URL) as client:
        first = await client.post(
            "/api/runs/start",
            json={"hwid": hwid, "hardware_revision": "ESP32-S3FH4R2"},
        )
        assert first.status_code == 201, first.text
        second = await client.post(
            "/api/runs/start",
            json={"hwid": hwid, "hardware_revision": "ESP32-S3FH4R2"},
        )
        assert second.status_code == 201, second.text
        assert second.json()["ecu_id"] == first.json()["ecu_id"]

        await client.post(f"/api/runs/{first.json()['run_id']}/end")
        await client.post(f"/api/runs/{second.json()['run_id']}/end")


@pytest.mark.asyncio
async def test_duplicate_serial_rejected() -> None:
    """Registering the same serial twice must return 409."""
    await _wait_for_health(BACKEND_URL)
    serial = f"SN-DUP-{uuid.uuid4().hex[:8].upper()}"
    async with httpx.AsyncClient(base_url=BACKEND_URL) as client:
        r1 = await client.post(
            "/api/ecus", json={"serial_number": serial, "hardware_revision": "HW-1"}
        )
        assert r1.status_code == 201
        r2 = await client.post(
            "/api/ecus", json={"serial_number": serial, "hardware_revision": "HW-1"}
        )
        assert r2.status_code == 409


@pytest.mark.asyncio
async def test_unknown_run_rejected_by_ws() -> None:
    """Sending a batch for an unknown run_id should return an error frame, not crash."""
    await _wait_for_health(BACKEND_URL)
    fake_run_id = str(uuid.uuid4())
    batch_payload = _make_telemetry_batch()
    envelope = {"run_id": fake_run_id, "batch": batch_payload}

    async with websockets.connect(BACKEND_WS_URL) as ws:
        await ws.send(json.dumps(envelope))
        raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
        resp = json.loads(raw)
        assert resp["status"] == "error"


@pytest.mark.asyncio
async def test_hwid_mismatch_rejected_by_ws() -> None:
    """A run started for one HWID must reject telemetry from another HWID."""
    await _wait_for_health(BACKEND_URL)
    hwid = f"esp32s3-{uuid.uuid4().hex[:12]}"
    async with httpx.AsyncClient(base_url=BACKEND_URL) as client:
        start = await client.post(
            "/api/runs/start",
            json={"hwid": hwid, "hardware_revision": "ESP32-S3FH4R2"},
        )
        assert start.status_code == 201, start.text
        run_id = start.json()["run_id"]

        envelope = {
            "run_id": run_id,
            "hwid": f"esp32s3-{uuid.uuid4().hex[:12]}",
            "batch": _make_telemetry_batch(),
        }
        async with websockets.connect(BACKEND_WS_URL) as ws:
            await ws.send(json.dumps(envelope))
            raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
            resp = json.loads(raw)
            assert resp["status"] == "error"
            assert resp["detail"] == "hwid_mismatch"

        await client.post(f"/api/runs/{run_id}/end")


@pytest.mark.asyncio
async def test_invalid_envelope_rejected() -> None:
    """Malformed JSON envelope should return an error frame, not crash the server."""
    await _wait_for_health(BACKEND_URL)
    async with websockets.connect(BACKEND_WS_URL) as ws:
        await ws.send('{"not_a_valid": "envelope"}')
        raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
        resp = json.loads(raw)
        assert resp["status"] == "error"


@pytest.mark.asyncio
async def test_list_ecus_and_runs() -> None:
    """Verify listing ECUs and runs (and filtering runs by ECU ID)."""
    await _wait_for_health(BACKEND_URL)
    async with httpx.AsyncClient(base_url=BACKEND_URL) as client:
        # Register a unique ECU
        serial = f"SN-LIST-{uuid.uuid4().hex[:8].upper()}"
        r1 = await client.post(
            "/api/ecus", json={"serial_number": serial, "hardware_revision": "HW-LIST-1"}
        )
        assert r1.status_code == 201
        ecu_id = r1.json()["id"]

        # Fetch ECU list and verify our new ECU is there
        r_ecus = await client.get("/api/ecus")
        assert r_ecus.status_code == 200
        ecus = r_ecus.json()
        assert any(e["serial_number"] == serial for e in ecus)

        # Start a run for this ECU
        r_start = await client.post(
            "/api/runs/start",
            json={"ecu_id": ecu_id, "firmware_version": "1.0.0-list", "map_version": "v1-list"}
        )
        assert r_start.status_code == 201
        run_id = r_start.json()["run_id"]

        # Fetch Runs list and verify our new run is there
        r_runs = await client.get("/api/runs")
        assert r_runs.status_code == 200
        runs = r_runs.json()
        assert any(r["id"] == run_id for r in runs)

        # Fetch Runs list filtered by ECU and verify
        r_runs_filtered = await client.get(f"/api/runs?ecu_id={ecu_id}")
        assert r_runs_filtered.status_code == 200
        runs_filtered = r_runs_filtered.json()
        assert len(runs_filtered) >= 1
        assert runs_filtered[0]["id"] == run_id

        # End the run
        r_end = await client.post(f"/api/runs/{run_id}/end")
        assert r_end.status_code == 200
