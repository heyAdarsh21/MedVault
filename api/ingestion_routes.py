from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Union

from database.base import get_db
from database.models import FlowEvent
from domain.schemas import FlowEventCreate

router = APIRouter(
    prefix="/api/v1/ingestion",
    tags=["Data Ingestion"]
)


@router.post("/events", response_model=dict)
def ingest_events(
    events: Union[List[FlowEventCreate], FlowEventCreate],
    db: Session = Depends(get_db),
):
    """Ingest one or more flow events. Accepts a single event or a list."""
    # Normalize to list
    if isinstance(events, FlowEventCreate):
        event_list = [events]
    else:
        event_list = events

    created = 0
    for e in event_list:
        fe = FlowEvent(
            event_type=e.event_type,
            timestamp=e.timestamp,
            hospital_id=e.hospital_id,
            department_id=e.department_id,
            resource_id=e.resource_id,
            patient_id=e.patient_id,
            event_metadata=e.event_metadata,
        )
        db.add(fe)
        created += 1

    db.commit()

    return {
        "status": "success",
        "events_ingested": created,
    }
