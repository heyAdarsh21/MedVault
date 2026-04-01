from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session

from database.base import SessionLocal
from database.models import Hospital

from engines.flow_engine import FlowEngine
from engines.capacity_engine import CapacityEngine

router = APIRouter(prefix="/api/v1/public", tags=["Public Availability"])


def compute_availability(hospital_id: int):
    db: Session = SessionLocal()

    try:
        # --- FLOW ANALYSIS ---
        flow_engine = FlowEngine(db)
        flow_result = flow_engine.analyze_flow(hospital_id)

        efficiency = flow_result.efficiency_score  # float [0.25 – 0.9]

        # --- CAPACITY ANALYSIS ---
        capacity_engine = CapacityEngine(db)
        capacity_results = capacity_engine.analyze_capacity(hospital_id)

        if not capacity_results:
            avg_utilization = 0.0
            has_overload = False
        else:
            utilizations = [c.utilization for c in capacity_results]
            avg_utilization = sum(utilizations) / len(utilizations)
            has_overload = any(c.is_overloaded for c in capacity_results)

        overload_penalty = 0.3 if has_overload else 0.0

        # --- AVAILABILITY SCORE ---
        availability_score = (
            (1 - avg_utilization)
            * efficiency
            * (1 - overload_penalty)
            * 100
        )

        availability_score = max(0.0, min(100.0, availability_score))

        if availability_score >= 70:
            status = "AVAILABLE"
        elif availability_score >= 40:
            status = "LIMITED"
        else:
            status = "OVERLOADED"

        return round(availability_score, 2), status

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        db.close()


@router.get("/hospitals")
def list_hospitals():
    db = SessionLocal()
    hospitals = db.query(Hospital).all()
    db.close()

    return [
        {
            "id": h.id,
            "name": h.name,
            "location": h.location,
            "capacity": h.capacity,
        }
        for h in hospitals
    ]


@router.get("/hospitals/{hospital_id}/availability")
def hospital_availability(hospital_id: int):
    score, status = compute_availability(hospital_id)

    return {
        "hospital_id": hospital_id,
        "availability_score": score,
        "status": status,
    }
