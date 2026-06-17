"""Add ecu_run_id and batch_seq to telemetry_states for deduplication

Revision ID: 001_ecu_run_dedup
Revises: 0001
Create Date: 2026-06-17
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '001_ecu_run_dedup'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('telemetry_states',
        sa.Column('ecu_run_id', sa.String(16), nullable=True))
    # Partial unique index for deduplication — only when both fields are set.
    # batch_seq already exists from the initial migration, so we only add the
    # new column and the composite index here.
    op.create_index(
        'ix_telemetry_states_run_ecu_batch',
        'telemetry_states',
        ['run_id', 'ecu_run_id', 'batch_seq'],
        unique=True,
        postgresql_where=sa.text('ecu_run_id IS NOT NULL AND batch_seq IS NOT NULL')
    )


def downgrade() -> None:
    op.drop_index('ix_telemetry_states_run_ecu_batch', table_name='telemetry_states')
    op.drop_column('telemetry_states', 'ecu_run_id')
