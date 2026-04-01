"""
Intelligence endpoints for MEDVAULT API v1.

Endpoints:
  GET /intelligence/system-health/{hospital_id}   — full composite health report
  GET /intelligence/anomalies/{hospital_id}        — active anomaly alerts
  GET /intelligence/recommendations/{hospital_id}  — actionable recommendations
  GET /intelligence/trend/{hospital_id}            — system strain trend direction
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from api.v1.auth import get_current_user
from database.base import get_db
from domain.schemas import (
    AnomalyAlert,
    Recommendation,
    SystemHealthResponse,
    TrendSummary,
    User,
)
from services.intelligence_service import IntelligenceService

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


def _svc(db: Session = Depends(get_db)) -> IntelligenceService:
    return IntelligenceService(db)


@router.get(
    "/system-health/{hospital_id}",
    response_model=SystemHealthResponse,
    summary="Full composite health report",
    description=(
        "Returns KPIs, anomaly alerts, prioritised recommendations, "
        "bottleneck summary, capacity profile, flow graph metadata, "
        "and trend direction. Primary dashboard endpoint."
    ),
)
def system_health(
    hospital_id: int,
    svc: IntelligenceService = Depends(_svc),
    current_user: User = Depends(get_current_user),
) -> SystemHealthResponse:
    try:
        return svc.get_system_health(hospital_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Intelligence computation failed: {str(e)}",
        )


@router.get(
    "/anomalies/{hospital_id}",
    response_model=List[AnomalyAlert],
    summary="Active anomaly alerts",
    description=(
        "Z-score anomaly detection over delay, volume, and utilization. "
        "Compares current 24h window to 7-day rolling baseline. "
        "Sorted by severity — CRITICAL first."
    ),
)
def get_anomalies(
    hospital_id: int,
    svc: IntelligenceService = Depends(_svc),
    current_user: User = Depends(get_current_user),
) -> List[AnomalyAlert]:
    try:
        return svc.get_anomalies(hospital_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Anomaly detection failed: {str(e)}",
        )


@router.get(
    "/recommendations/{hospital_id}",
    response_model=List[Recommendation],
    summary="Actionable operational recommendations",
    description=(
        "Prioritised recommendations derived from bottleneck severity, "
        "capacity overloads, anomaly alerts, and system KPIs. "
        "Each includes priority, category, description, and a concrete action step."
    ),
)
def get_recommendations(
    hospital_id: int,
    svc: IntelligenceService = Depends(_svc),
    current_user: User = Depends(get_current_user),
) -> List[Recommendation]:
    try:
        return svc.get_recommendations(hospital_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Recommendation generation failed: {str(e)}",
        )


@router.get(
    "/trend/{hospital_id}",
    response_model=TrendSummary,
    summary="System strain trend direction",
    description=(
        "Compares event throughput in the most recent 48 hours against "
        "the prior 5-day baseline. Returns direction "
        "(improving / degrading / stable / insufficient_data), "
        "confidence score, and percentage change."
    ),
)
def get_trend(
    hospital_id: int,
    svc: IntelligenceService = Depends(_svc),
    current_user: User = Depends(get_current_user),
) -> TrendSummary:
    try:
        return svc.get_trend(hospital_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Trend analysis failed: {str(e)}",
        )