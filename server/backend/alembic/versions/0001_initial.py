"""Initial database schema.

Revision ID: 0001
Revises:
Create Date: 2026-06-17

Creates all tables, enables the TimescaleDB extension, and promotes
telemetry_states and telemetry_events to hypertables partitioned by
server_received_at (wall-clock UTC, added by the server).

ECU monotonic µs timestamps are preserved separately as BigInteger columns
and remain authoritative for ordering, replay, and timing analysis.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable TimescaleDB extension (idempotent)
    op.execute("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;")

    # run_status enum
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'run_status') THEN
                CREATE TYPE run_status AS ENUM ('active', 'ended', 'interrupted');
            END IF;
        END
        $$;
    """)
    run_status = sa.Enum("active", "ended", "interrupted", name="run_status", create_type=False)

    # ------------------------------------------------------------------
    # ecus
    # ------------------------------------------------------------------
    op.create_table(
        "ecus",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("serial_number", sa.String(128), nullable=False, unique=True),
        sa.Column("hardware_revision", sa.String(64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # ------------------------------------------------------------------
    # firmware_revisions
    # ------------------------------------------------------------------
    op.create_table(
        "firmware_revisions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("ecu_id", UUID(as_uuid=True), sa.ForeignKey("ecus.id"), nullable=False),
        sa.Column("version", sa.String(128), nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # ------------------------------------------------------------------
    # engine_maps
    # ------------------------------------------------------------------
    op.create_table(
        "engine_maps",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("ecu_id", UUID(as_uuid=True), sa.ForeignKey("ecus.id"), nullable=False),
        sa.Column("version", sa.String(128), nullable=False),
        sa.Column("map_type", sa.String(64), nullable=False, server_default="ignition"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # ------------------------------------------------------------------
    # configurations
    # ------------------------------------------------------------------
    op.create_table(
        "configurations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("ecu_id", UUID(as_uuid=True), sa.ForeignKey("ecus.id"), nullable=False),
        sa.Column("version", sa.String(128), nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # ------------------------------------------------------------------
    # runs
    # ------------------------------------------------------------------
    op.create_table(
        "runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("ecu_id", UUID(as_uuid=True), sa.ForeignKey("ecus.id"), nullable=False),
        sa.Column("status", run_status, nullable=False, server_default="active"),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("firmware_version", sa.String(128), nullable=True),
        sa.Column("map_version", sa.String(128), nullable=True),
        sa.Column("heartbeat", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_committed_sequence", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("batch_count", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_runs_ecu_id", "runs", ["ecu_id"])
    op.create_index("ix_runs_status", "runs", ["status"])

    # ------------------------------------------------------------------
    # telemetry_states  →  TimescaleDB hypertable
    # ------------------------------------------------------------------
    op.create_table(
        "telemetry_states",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("run_id", UUID(as_uuid=True), sa.ForeignKey("runs.id"), nullable=False),
        # Partition key: wall-clock UTC timestamp added by the server.
        sa.Column("server_received_at", sa.DateTime(timezone=True), primary_key=True, nullable=False),
        # ECU monotonic µs — authoritative for ordering, replay, revolution association.
        sa.Column("ecu_collected_at_us", sa.BigInteger, nullable=False),
        sa.Column("snapshot_generation", sa.Integer, nullable=False),
        sa.Column("state_json", JSONB, nullable=False),
        sa.Column("overflow_json", JSONB, nullable=False, server_default="'{}'"),
        sa.Column("batch_seq", sa.BigInteger, nullable=False, server_default="0"),
    )
    op.create_index("ix_telemetry_states_run_id", "telemetry_states", ["run_id"])
    op.execute(
        "SELECT create_hypertable('telemetry_states', 'server_received_at');"
    )

    # ------------------------------------------------------------------
    # telemetry_events  →  TimescaleDB hypertable
    # ------------------------------------------------------------------
    op.create_table(
        "telemetry_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("run_id", UUID(as_uuid=True), sa.ForeignKey("runs.id"), nullable=False),
        sa.Column("server_received_at", sa.DateTime(timezone=True), primary_key=True, nullable=False),
        # ECU monotonic µs of the event (authoritative for ordering).
        sa.Column("occurred_at_us", sa.BigInteger, nullable=False),
        sa.Column("kind", sa.String(64), nullable=False),
        sa.Column("payload_json", JSONB, nullable=False),
    )
    op.create_index("ix_telemetry_events_run_id", "telemetry_events", ["run_id"])
    op.execute(
        "SELECT create_hypertable('telemetry_events', 'server_received_at');"
    )


def downgrade() -> None:
    op.drop_table("telemetry_events")
    op.drop_table("telemetry_states")
    op.drop_index("ix_runs_status", table_name="runs")
    op.drop_index("ix_runs_ecu_id", table_name="runs")
    op.drop_table("runs")
    op.drop_table("configurations")
    op.drop_table("engine_maps")
    op.drop_table("firmware_revisions")
    op.drop_table("ecus")
    op.execute("DROP TYPE IF EXISTS run_status;")
