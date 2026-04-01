"""Initial schema

Revision ID: 001
Revises: 
Create Date: 2026-01-26

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create hospitals table
    op.create_table(
        'hospitals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('location', sa.String(length=255), nullable=False),
        sa.Column('capacity', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_hospitals_id'), 'hospitals', ['id'], unique=False)
    op.create_index(op.f('ix_hospitals_name'), 'hospitals', ['name'], unique=False)
    
    # Create departments table
    op.create_table(
        'departments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('hospital_id', sa.Integer(), nullable=False),
        sa.Column('capacity', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_departments_id'), 'departments', ['id'], unique=False)
    op.create_index(op.f('ix_departments_hospital_id'), 'departments', ['hospital_id'], unique=False)
    
    # Create resources table
    op.create_table(
        'resources',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('department_id', sa.Integer(), nullable=False),
        sa.Column('capacity', sa.Integer(), nullable=False),
        sa.Column('resource_type', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_resources_id'), 'resources', ['id'], unique=False)
    op.create_index(op.f('ix_resources_department_id'), 'resources', ['department_id'], unique=False)
    
    # Create flow_events table (THE GROUND TRUTH)
    op.create_table(
        'flow_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('hospital_id', sa.Integer(), nullable=False),
        sa.Column('department_id', sa.Integer(), nullable=True),
        sa.Column('resource_id', sa.Integer(), nullable=True),
        sa.Column('patient_id', sa.String(length=100), nullable=True),
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ),
        sa.ForeignKeyConstraint(['resource_id'], ['resources.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_flow_events_id'), 'flow_events', ['id'], unique=False)
    op.create_index(op.f('ix_flow_events_event_type'), 'flow_events', ['event_type'], unique=False)
    op.create_index(op.f('ix_flow_events_timestamp'), 'flow_events', ['timestamp'], unique=False)
    op.create_index(op.f('ix_flow_events_hospital_id'), 'flow_events', ['hospital_id'], unique=False)
    op.create_index(op.f('ix_flow_events_department_id'), 'flow_events', ['department_id'], unique=False)
    op.create_index(op.f('ix_flow_events_resource_id'), 'flow_events', ['resource_id'], unique=False)
    op.create_index(op.f('ix_flow_events_patient_id'), 'flow_events', ['patient_id'], unique=False)
    
    # Create metrics_cache table
    op.create_table(
        'metrics_cache',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('metric_name', sa.String(length=100), nullable=False),
        sa.Column('hospital_id', sa.Integer(), nullable=True),
        sa.Column('department_id', sa.Integer(), nullable=True),
        sa.Column('resource_id', sa.Integer(), nullable=True),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('computed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ),
        sa.ForeignKeyConstraint(['resource_id'], ['resources.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_metrics_cache_id'), 'metrics_cache', ['id'], unique=False)
    op.create_index(op.f('ix_metrics_cache_metric_name'), 'metrics_cache', ['metric_name'], unique=False)
    op.create_index(op.f('ix_metrics_cache_hospital_id'), 'metrics_cache', ['hospital_id'], unique=False)
    op.create_index(op.f('ix_metrics_cache_department_id'), 'metrics_cache', ['department_id'], unique=False)
    op.create_index(op.f('ix_metrics_cache_resource_id'), 'metrics_cache', ['resource_id'], unique=False)
    op.create_index(op.f('ix_metrics_cache_computed_at'), 'metrics_cache', ['computed_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_metrics_cache_computed_at'), table_name='metrics_cache')
    op.drop_index(op.f('ix_metrics_cache_resource_id'), table_name='metrics_cache')
    op.drop_index(op.f('ix_metrics_cache_department_id'), table_name='metrics_cache')
    op.drop_index(op.f('ix_metrics_cache_hospital_id'), table_name='metrics_cache')
    op.drop_index(op.f('ix_metrics_cache_metric_name'), table_name='metrics_cache')
    op.drop_index(op.f('ix_metrics_cache_id'), table_name='metrics_cache')
    op.drop_table('metrics_cache')
    
    op.drop_index(op.f('ix_flow_events_patient_id'), table_name='flow_events')
    op.drop_index(op.f('ix_flow_events_resource_id'), table_name='flow_events')
    op.drop_index(op.f('ix_flow_events_department_id'), table_name='flow_events')
    op.drop_index(op.f('ix_flow_events_hospital_id'), table_name='flow_events')
    op.drop_index(op.f('ix_flow_events_timestamp'), table_name='flow_events')
    op.drop_index(op.f('ix_flow_events_event_type'), table_name='flow_events')
    op.drop_index(op.f('ix_flow_events_id'), table_name='flow_events')
    op.drop_table('flow_events')
    
    op.drop_index(op.f('ix_resources_department_id'), table_name='resources')
    op.drop_index(op.f('ix_resources_id'), table_name='resources')
    op.drop_table('resources')
    
    op.drop_index(op.f('ix_departments_hospital_id'), table_name='departments')
    op.drop_index(op.f('ix_departments_id'), table_name='departments')
    op.drop_table('departments')
    
    op.drop_index(op.f('ix_hospitals_name'), table_name='hospitals')
    op.drop_index(op.f('ix_hospitals_id'), table_name='hospitals')
    op.drop_table('hospitals')
