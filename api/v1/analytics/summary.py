from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database.base import get_db
from database.models import FlowEvent, Department, Resource

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"]
)

@router.get("/summary")
def analytics_summary(db: Session = Depends(get_db)):
    total_events = db.query(FlowEvent).count()
    departments = db.query(Department).count()
    resources = db.query(Resource).count()

    busiest = (
        db.query(Department.name, func.count(FlowEvent.id))
        .join(FlowEvent, FlowEvent.department_id == Department.id)
        .group_by(Department.name)
        .order_by(func.count(FlowEvent.id).desc())
        .first()
    )

    return {
        "total_events": total_events,
        "departments": departments,
        "resources": resources,
        "busiest_department": busiest[0] if busiest else None,
    }
