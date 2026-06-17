"""Domain models for Telemetry.

Field names and shapes match the ECU JSON output produced by
telemetry_json_serializer.cpp (schema: ecu.telemetry.v1).

The IngestEnvelope is the server-side wrapper added by the client bridge
before forwarding ECU frames to /ws/v1/telemetry.
"""
from __future__ import annotations

from typing import Annotated, List, Literal, Optional, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


# ---------------------------------------------------------------------------
# Common health metadata — attached to every state sub-object
# ---------------------------------------------------------------------------

class TelemetryMeta(BaseModel):
    acquired_at_us: int   # ECU monotonic µs of raw sensor acquisition
    seq: int              # per-sensor sequence; gaps indicate missed readings
    valid: bool           # usable by engine-control logic
    health: str           # "Uninitialized"|"Stabilizing"|"Valid"|"Degraded"|"Stale"|"Failed"|"Disabled"
    quality: str          # "Unknown"|"Good"|"Suspect"|"Bad"
    fault_bits: int       # uint64 bitmask; bit positions = SensorFault enum


# ---------------------------------------------------------------------------
# State sub-objects
# ---------------------------------------------------------------------------

class TpsTelemetryState(BaseModel):
    permille: int          # 0–1000 throttle opening
    pct: float             # permille / 10.0 (convenience, added by serializer)
    fallback_permille: int
    fallback_used: bool
    meta: TelemetryMeta


class EngineSpeedTelemetryState(BaseModel):
    rpm: float
    period_us: float
    accel_rpm_per_s: float
    synchronized: bool
    crank_reference_trusted: bool
    revolution_id: int
    reference_at_us: int   # ECU monotonic µs of crank reference
    meta: TelemetryMeta


class ThermalTelemetryState(BaseModel):
    c: float               # degrees Celsius
    rate_c_per_s: float
    max_c: float
    state: str             # ThermalState enum string
    request: str           # ThermalRequestLevel enum string (sensor-side only)
    meta: TelemetryMeta


class QuickShifterTelemetryState(BaseModel):
    active: bool
    armed: bool
    meta: TelemetryMeta


class MapSwitchTelemetryState(BaseModel):
    request: str           # "Primary"|"Secondary" (physical switch only)
    meta: TelemetryMeta


class KnockTelemetryState(BaseModel):
    revolution_id: int
    pickup_edge_at_us: int
    window_opened_at_us: int
    window_closed_at_us: int
    read_at_us: int
    raw_integrator_count: int
    background_estimate: float
    normalized_index: float
    candidate_knock: bool
    valid: bool
    health: str
    quality: str
    fault_bits: int
    rpm: float
    tps_permille: int
    ignition_angle_deg: float
    config_generation: int


class TelemetryStateFrame(BaseModel):
    """Latest sensor state snapshot — replaceable; consumers may drop older frames."""
    tps: TpsTelemetryState
    rpm: EngineSpeedTelemetryState
    egt: ThermalTelemetryState
    water: ThermalTelemetryState
    quick_shifter: QuickShifterTelemetryState
    map_switch: MapSwitchTelemetryState
    knock: Optional[KnockTelemetryState] = None  # null when no knock measurement yet


# ---------------------------------------------------------------------------
# Overflow / transport counters
# ---------------------------------------------------------------------------

class TelemetryOverflowCounters(BaseModel):
    """Source queue overflow counters from SensorDataStore — NOT WebSocket drops."""
    quick_shift_events: int = 0
    map_switch_events: int = 0
    knock_measurements: int = 0
    fault_events: int = 0


class TelemetryTransportCounters(BaseModel):
    """ECU-side WebSocket transport counters (accumulated since connection open)."""
    sent_frames: int = 0
    dropped_frames: int = 0
    send_errors: int = 0


# ---------------------------------------------------------------------------
# Event frames (discriminated union by "kind")
# ---------------------------------------------------------------------------

class QuickShiftTelemetryEvent(BaseModel):
    kind: Literal["QuickShiftRequest"]
    at_us: int             # occurred_at (common sort key)
    active: bool
    activated_at_us: int
    released_at_us: int
    duration_us: int
    meta: TelemetryMeta


class MapSwitchTelemetryEvent(BaseModel):
    kind: Literal["MapSwitchChange"]
    at_us: int
    request: str           # "Primary"|"Secondary"
    meta: TelemetryMeta


class FaultTelemetryEvent(BaseModel):
    kind: Literal["FaultTransition"]
    at_us: int
    fault: str             # SensorFault enum string
    health: str
    first_at_us: int
    last_at_us: int
    count: int


TelemetryEventFrame = Annotated[
    Union[QuickShiftTelemetryEvent, MapSwitchTelemetryEvent, FaultTelemetryEvent],
    Field(discriminator="kind"),
]


# ---------------------------------------------------------------------------
# ECU batch frame (ecu.telemetry.v1)
# ---------------------------------------------------------------------------

class EcuTelemetryBatch(BaseModel):
    """Matches the JSON frame produced by telemetry_json_serializer.cpp."""

    model_config = ConfigDict(populate_by_name=True)

    type: Literal["telemetry"]
    schema_id: str = Field(alias="schema")  # "ecu.telemetry.v1"
    t_us: int              # ECU monotonic µs — authoritative for ordering/replay
    gen: int               # EngineInputSnapshot::generation
    state: TelemetryStateFrame
    events: List[TelemetryEventFrame] = []
    overflow: TelemetryOverflowCounters = Field(default_factory=TelemetryOverflowCounters)
    transport: TelemetryTransportCounters = Field(default_factory=TelemetryTransportCounters)


# ---------------------------------------------------------------------------
# Server-side WebSocket envelope (added by the client bridge)
# ---------------------------------------------------------------------------

class ChunkEntry(BaseModel):
    """A single ECU telemetry batch within an upload chunk."""
    batch_seq: int
    frame: EcuTelemetryBatch


class IngestEnvelope(BaseModel):
    """
    Envelope sent by the browser bridge over WS /ws/v1/telemetry.

    Supports both chunked uploads (chunk: list[ChunkEntry]) and the legacy
    single-batch format (batch: EcuTelemetryBatch) for backward compatibility.
    """
    run_id: UUID
    hwid: Optional[str] = None
    ecu_run_id: Optional[str] = None
    stream_generation: int = 0
    chunk: list[ChunkEntry]

    # Backward compat: if old clients send a single `batch` field,
    # wrap it in a chunk automatically
    @model_validator(mode="before")
    @classmethod
    def compat_single_batch(cls, data):
        if isinstance(data, dict) and "batch" in data and "chunk" not in data:
            batch = data.pop("batch")
            data["chunk"] = [{"batch_seq": 0, "frame": batch}]
        return data


class IngestAck(BaseModel):
    status: str  # "persisted" | "error"
    run_id: str
    stream_generation: int
    committed_through_sequence: int
    detail: Optional[str] = None
