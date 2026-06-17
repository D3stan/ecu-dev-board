"""SQLAlchemy ORM models.

Tables:
  ecus                 — registered physical ECUs
  firmware_revisions   — firmware version history per ECU
  engine_maps          — map version history per ECU
  configurations       — configuration history per ECU
  runs                 — recorded engine runs
  telemetry_states     — TimescaleDB hypertable, one row per TelemetryBatch
  telemetry_events     — TimescaleDB hypertable, one row per TelemetryEventFrame
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


# ---------------------------------------------------------------------------
# ECU and history tables
# ---------------------------------------------------------------------------

class EcuModel(Base):
    __tablename__ = "ecus"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    serial_number: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    hardware_revision: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    runs: Mapped[list["RunModel"]] = relationship("RunModel", back_populates="ecu")
    firmware_revisions: Mapped[list["FirmwareRevisionModel"]] = relationship(
        "FirmwareRevisionModel", back_populates="ecu"
    )
    engine_maps: Mapped[list["EngineMapModel"]] = relationship(
        "EngineMapModel", back_populates="ecu"
    )
    configurations: Mapped[list["ConfigurationModel"]] = relationship(
        "ConfigurationModel", back_populates="ecu"
    )


class FirmwareRevisionModel(Base):
    __tablename__ = "firmware_revisions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    ecu_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecus.id"), nullable=False
    )
    version: Mapped[str] = mapped_column(String(128), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    ecu: Mapped[EcuModel] = relationship("EcuModel", back_populates="firmware_revisions")


class EngineMapModel(Base):
    __tablename__ = "engine_maps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    ecu_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecus.id"), nullable=False
    )
    version: Mapped[str] = mapped_column(String(128), nullable=False)
    map_type: Mapped[str] = mapped_column(String(64), nullable=False, server_default="ignition")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    ecu: Mapped[EcuModel] = relationship("EcuModel", back_populates="engine_maps")


class ConfigurationModel(Base):
    __tablename__ = "configurations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    ecu_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecus.id"), nullable=False
    )
    version: Mapped[str] = mapped_column(String(128), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    ecu: Mapped[EcuModel] = relationship("EcuModel", back_populates="configurations")


# ---------------------------------------------------------------------------
# Runs
# ---------------------------------------------------------------------------

class RunModel(Base):
    __tablename__ = "runs"
    __table_args__ = (
        Index("ix_runs_ecu_id", "ecu_id"),
        Index("ix_runs_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    ecu_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ecus.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        Enum("active", "ended", "interrupted", name="run_status"),
        nullable=False,
        server_default="active",
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    firmware_version: Mapped[str | None] = mapped_column(String(128), nullable=True)
    map_version: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # Updated by writer task after each committed batch
    heartbeat: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_committed_sequence: Mapped[int] = mapped_column(
        BigInteger, nullable=False, server_default="0"
    )
    batch_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    ecu: Mapped[EcuModel] = relationship("EcuModel", back_populates="runs")
    telemetry_states: Mapped[list["TelemetryStateModel"]] = relationship(
        "TelemetryStateModel", back_populates="run"
    )
    telemetry_events: Mapped[list["TelemetryEventModel"]] = relationship(
        "TelemetryEventModel", back_populates="run"
    )


# ---------------------------------------------------------------------------
# Telemetry (TimescaleDB hypertables)
# ---------------------------------------------------------------------------

class TelemetryStateModel(Base):
    """One row per TelemetryBatch received.

    Hypertable partition key: server_received_at (wall-clock UTC).
    ECU monotonic µs are preserved in ecu_collected_at_us and are authoritative
    for ordering, replay, and timing analysis.
    """

    __tablename__ = "telemetry_states"
    __table_args__ = (Index("ix_telemetry_states_run_id", "run_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("runs.id"), nullable=False
    )
    # Wall-clock UTC timestamp added by the server — used as TimescaleDB partition key.
    # Must be part of composite primary key to allow TimescaleDB hypertable partitioning.
    server_received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, nullable=False
    )
    # ECU monotonic µs (esp_timer_get_time()) — authoritative for ordering and replay.
    ecu_collected_at_us: Mapped[int] = mapped_column(BigInteger, nullable=False)
    snapshot_generation: Mapped[int] = mapped_column(Integer, nullable=False)
    state_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    overflow_json: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=text("'{}'"))
    batch_seq: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default="0")
    # Added by migration 001_ecu_run_dedup — used for deduplication of chunk retransmits
    ecu_run_id: Mapped[str | None] = mapped_column(String(16), nullable=True)

    run: Mapped[RunModel] = relationship("RunModel", back_populates="telemetry_states")



class TelemetryEventModel(Base):
    """One row per TelemetryEventFrame received.

    Hypertable partition key: server_received_at (wall-clock UTC).
    occurred_at_us is the ECU monotonic µs (authoritative for ordering).
    """

    __tablename__ = "telemetry_events"
    __table_args__ = (Index("ix_telemetry_events_run_id", "run_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("runs.id"), nullable=False
    )
    # Must be part of composite primary key to allow TimescaleDB hypertable partitioning.
    server_received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, nullable=False
    )
    occurred_at_us: Mapped[int] = mapped_column(BigInteger, nullable=False)
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSONB, nullable=False)

    run: Mapped[RunModel] = relationship("RunModel", back_populates="telemetry_events")
