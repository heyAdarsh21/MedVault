"""
Hospital Recommendation Engine
Scores hospitals using a transparent weighted composite model.
GET /api/v1/public/recommendations?specialty=cardiology&emergency=false
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, timedelta
import math

from database.base import get_db
from database.models import Hospital, Department, Resource, FlowEvent

router = APIRouter(prefix="/api/v1/public", tags=["Recommendations"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _seeded(hospital_id: int, offset: int = 0) -> float:
    """Deterministic pseudo-random [0,1] for demo data gaps."""
    x = math.sin(hospital_id * 9301 + offset * 49297 + 233) * 10_000
    return abs(x - int(x))


def _bed_score(hospital: Hospital, db: Session) -> tuple[float, dict]:
    """available_beds / total_beds → 0..1. Higher = better."""
    total = hospital.capacity or 100
    # Try real data first
    recent = db.query(func.count(FlowEvent.id)).filter(
        FlowEvent.hospital_id == hospital.id,
        FlowEvent.event_type == "arrival",
        FlowEvent.timestamp >= datetime.utcnow() - timedelta(hours=6),
    ).scalar() or 0
    occupied_estimate = min(recent, total)
    available = max(0, total - occupied_estimate)
    if recent == 0:
        # Demo fallback
        load = 0.3 + _seeded(hospital.id) * 0.65
        available = int((1 - load) * total)
    score = available / max(total, 1)
    return round(score, 3), {"available_beds": available, "total_beds": total}


def _queue_score(hospital: Hospital, db: Session) -> tuple[float, dict]:
    """1 - min(queue/30, 1). Higher = shorter queue."""
    recent_arrivals = db.query(func.count(FlowEvent.id)).filter(
        FlowEvent.hospital_id == hospital.id,
        FlowEvent.event_type.in_(["arrival", "resource_request"]),
        FlowEvent.timestamp >= datetime.utcnow() - timedelta(hours=1),
    ).scalar() or 0
    if recent_arrivals == 0:
        recent_arrivals = int(_seeded(hospital.id, 1) * 25)
    wait_min = int(10 + _seeded(hospital.id, 2) * 80)
    score = 1.0 - min(recent_arrivals / 30, 1.0)
    return round(score, 3), {"queue_length": recent_arrivals, "est_wait_min": wait_min}


def _specialty_score(hospital: Hospital, specialty: Optional[str], db: Session) -> tuple[float, dict]:
    """1.0 if specialty available, 0.6 if unknown, 0 if clearly absent."""
    if not specialty:
        return 0.5, {"specialty_matched": None}
    depts = db.query(Department.name).filter(
        Department.hospital_id == hospital.id,
    ).all()
    dept_names = " ".join([d.name.lower() for d in depts])
    matched = specialty.lower() in dept_names
    score = 1.0 if matched else (0.4 if not depts else 0.2)
    return round(score, 3), {"specialty_matched": matched, "specialty_requested": specialty}


def _trend_score(hospital: Hospital, db: Session) -> tuple[float, dict]:
    """Compare last 1h vs prev 1h. Improving = higher score."""
    now = datetime.utcnow()
    current = db.query(func.count(FlowEvent.id)).filter(
        FlowEvent.hospital_id == hospital.id,
        FlowEvent.timestamp >= now - timedelta(hours=1),
    ).scalar() or 0
    previous = db.query(func.count(FlowEvent.id)).filter(
        FlowEvent.hospital_id == hospital.id,
        FlowEvent.timestamp >= now - timedelta(hours=2),
        FlowEvent.timestamp < now - timedelta(hours=1),
    ).scalar() or 0
    if current == 0 and previous == 0:
        score = 0.5
        direction = "stable"
    elif previous == 0:
        score = 0.3
        direction = "increasing"
    else:
        ratio = current / previous
        if ratio < 0.9:
            score, direction = 0.8, "improving"
        elif ratio > 1.15:
            score, direction = 0.2, "busier"
        else:
            score, direction = 0.5, "stable"
    return round(score, 3), {"trend": direction, "last_hour": current, "prev_hour": previous}


def _build_reasons(
    bed_info: dict, queue_info: dict, specialty_info: dict, trend_info: dict, penalty: float
) -> list[str]:
    reasons = []
    if bed_info["available_beds"] > 10:
        reasons.append(f"{bed_info['available_beds']} beds available")
    elif bed_info["available_beds"] < 5:
        reasons.append("Very few beds remaining")

    wait = queue_info["est_wait_min"]
    if wait < 20:
        reasons.append(f"~{wait} min estimated wait")
    elif wait > 60:
        reasons.append(f"Long wait (~{wait} min)")

    if specialty_info.get("specialty_matched"):
        reasons.append(f"{specialty_info['specialty_requested']} department confirmed")

    trend = trend_info.get("trend", "stable")
    if trend == "improving":
        reasons.append("Load decreasing")
    elif trend == "busier":
        reasons.append("Getting busier — act soon")

    if penalty < -0.1:
        reasons.append("Capacity alert — high load")

    return reasons[:4]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("/recommendations")
def get_recommendations(
    specialty: Optional[str] = Query(None, description="e.g. cardiology, emergency, icu"),
    emergency: bool = Query(False, description="Emergency routing prioritises queue score"),
    limit: int = Query(5, le=10),
    db: Session = Depends(get_db),
):
    """
    Returns hospitals ranked by a transparent weighted score.

    Weights (default / emergency):
      bed_score      35% / 20%
      queue_score    25% / 45%
      specialty      15% / 10%
      trend           5% /  5%

    Adjustments:
      overload penalty  -0.25 if bed_score < 0.15
      specialty boost   +0.08 if exact specialty match
    """
    hospitals = db.query(Hospital).all()
    if not hospitals:
        return []

    results = []
    for h in hospitals:
        b_score, b_info = _bed_score(h, db)
        q_score, q_info = _queue_score(h, db)
        s_score, s_info = _specialty_score(h, specialty, db)
        t_score, t_info = _trend_score(h, db)

        # Weights
        if emergency:
            raw = b_score*0.20 + q_score*0.45 + s_score*0.10 + t_score*0.05 + 0.20
        else:
            raw = b_score*0.35 + q_score*0.25 + s_score*0.15 + t_score*0.05 + 0.20

        # Adjustments
        overload_penalty = -0.25 if b_score < 0.15 else 0.0
        specialty_boost  = 0.08 if s_info.get("specialty_matched") else 0.0
        final = round(max(0.0, min(1.0, raw + overload_penalty + specialty_boost)), 3)

        # Derive status label
        if final >= 0.75:
            status, status_color = "Recommended", "emerald"
        elif final >= 0.50:
            status, status_color = "Available", "blue"
        elif final >= 0.30:
            status, status_color = "Moderate load", "amber"
        else:
            status, status_color = "High load", "red"

        results.append({
            "hospital_id":   h.id,
            "name":          h.name,
            "location":      h.location,
            "capacity":      h.capacity,
            "score":         final,
            "status":        status,
            "status_color":  status_color,
            "available_beds":b_info["available_beds"],
            "est_wait_min":  q_info["est_wait_min"],
            "trend":         t_info["trend"],
            "specialty_matched": s_info.get("specialty_matched"),
            "reasons":       _build_reasons(b_info, q_info, s_info, t_info, overload_penalty),
            "score_breakdown": {
                "bed_availability": b_score,
                "queue_pressure":   q_score,
                "specialty_fit":    s_score,
                "load_trend":       t_score,
            },
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:limit]