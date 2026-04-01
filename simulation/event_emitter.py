"""Event emission utilities for the MEDVAULT simulation engine.

Translates SimPy simulation time into persisted FlowEvent rows.
All timestamps are naive UTC to match the database column type
(timestamp without time zone).
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, Optional

from sqlalchemy.orm import Session

from database.models import FlowEvent
from domain.schemas import EventType


class EventEmitter:
    """Append-only FlowEvent writer with a fixed base wall-clock time."""

    def __init__(
        self,
        db: Session,
        hospital_id: int,
        base_time: Optional[datetime] = None,
    ) -> None:
        self.db = db
        self.hospital_id = hospital_id
        # Naive UTC — must stay naive to match FlowEvent.timestamp column type.
        # Using timezone-aware datetimes here causes PostgreSQL comparison
        # failures when querying events by time window after the simulation.
        self.base_time = base_time or datetime.utcnow()
        self._events_buffer: list = []

    def _to_timestamp(self, sim_time_seconds: float) -> datetime:
        return self.base_time + timedelta(seconds=sim_time_seconds)

    def emit(
        self,
        sim_time: float,
        event_type: EventType,
        department_id: Optional[int] = None,
        resource_id: Optional[int] = None,
        patient_id: Optional[str] = None,
        metadata: Optional[Dict] = None,
    ) -> None:
        """Stage a FlowEvent to be persisted at commit time."""
        event = FlowEvent(
            event_type=event_type.value,
            timestamp=self._to_timestamp(sim_time),
            hospital_id=self.hospital_id,
            department_id=department_id,
            resource_id=resource_id,
            patient_id=patient_id,
            event_metadata=metadata or {},  # FIX: was 'metadata', column is 'event_metadata'
        )
        self.db.add(event)
        self._events_buffer.append(event)

    @property
    def events_staged(self) -> int:
        """Number of events staged in the current run."""
        return len(self._events_buffer)