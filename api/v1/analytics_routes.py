"""
Analytics endpoints for MEDVAULT API v1.

Endpoints:
  GET /analytics/flow/{hospital_id}                          — flow graph + critical path
  GET /analytics/bottlenecks                                 — all bottlenecks, time-based
  GET /analytics/bottlenecks/worst                           — single worst bottleneck
  GET /analytics/bottlenecks/delay-distribution              — histogram for one department
  GET /analytics/capacity                                    — real resource utilization
  GET /analytics/overloads                                   — resources at/over capacity
  GET /analytics/capacity/timeseries                         — utilization over time (1 resource)
  GET /analytics/capacity/hospital-timeseries/{hospital_id}  — aggregated utilization over time
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.v1.auth import get_current_user
from database.base import get_db
from domain.schemas import (
    BottleneckAnalysis,
    CapacityAnalysis,
    FlowAnalysis,
    User,
)
from engines.bottleneck_engine import BottleneckEngine
from engines.capacity_engine import CapacityEngine
from services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


# ─────────────────────────────────────────────────────────────────────────────
# Dependency
# ─────────────────────────────────────────────────────────────────────────────

def _svc(db: Session = Depends(get_db)) -> AnalyticsService:
    return AnalyticsService(db)


# ─────────────────────────────────────────────────────────────────────────────
# FLOW
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/flow/{hospital_id}",
    response_model=FlowAnalysis,
    summary="Patient flow graph analysis",
    description=(
        "Builds a directed graph of patient transitions between departments. "
        "Returns critical path, efficiency score, bottleneck departments, "
        "and graph metadata (nodes + edges with avg transition delay)."
    ),
)
def analyze_flow(
    hospital_id: int,
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    svc: AnalyticsService = Depends(_svc),
    current_user: User = Depends(get_current_user),
) -> FlowAnalysis:
    try:
        return svc.analyze_flow(hospital_id, start_time, end_time)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Flow analysis failed: {str(e)}",
        )


# ─────────────────────────────────────────────────────────────────────────────
# BOTTLENECKS
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/bottlenecks",
    response_model=List[BottleneckAnalysis],
    summary="Bottleneck analysis by department",
    description=(
        "Calculates per-patient inter-event delays grouped by department. "
        "Returns departments sorted by average delay (worst first). "
        "Severity: LOW (<15 min), MEDIUM (<60 min), CRITICAL (≥60 min)."
    ),
)
def analyze_bottlenecks(
    hospital_id: Optional[int] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    svc: AnalyticsService = Depends(_svc),
    current_user: User = Depends(get_current_user),
) -> List[BottleneckAnalysis]:
    try:
        return svc.analyze_bottlenecks(hospital_id, start_time, end_time)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bottleneck analysis failed: {str(e)}",
        )


@router.get(
    "/bottlenecks/worst",
    response_model=Optional[BottleneckAnalysis],
    summary="Single worst bottleneck",
    description="Returns the department with the highest average patient delay, or null if no data.",
)
def worst_bottleneck(
    hospital_id: Optional[int] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    svc: AnalyticsService = Depends(_svc),
    current_user: User = Depends(get_current_user),
) -> Optional[BottleneckAnalysis]:
    try:
        return svc.get_worst_bottleneck(hospital_id, start_time, end_time)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bottleneck analysis failed: {str(e)}",
        )


@router.get(
    "/bottlenecks/delay-distribution",
    response_model=Dict[str, Any],
    summary="Delay distribution histogram for a department",
    description=(
        "Returns histogram-ready data (bins + counts) and summary statistics "
        "(mean, std, median, min, max) for inter-event delays in a specific department. "
        "Useful for rendering distribution charts."
    ),
)
def delay_distribution(
    department_id: int = Query(..., description="Department ID to analyse"),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        engine = BottleneckEngine(db)
        return engine.get_delay_distribution(department_id, start_time, end_time)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Delay distribution failed: {str(e)}",
        )


# ─────────────────────────────────────────────────────────────────────────────
# CAPACITY
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/capacity",
    response_model=List[CapacityAnalysis],
    summary="Resource utilization analysis",
    description=(
        "Computes utilization from real resource_request / resource_release events. "
        "utilization = peak_concurrent_demand / configured_capacity. "
        "Sorted by utilization descending."
    ),
)
def analyze_capacity(
    hospital_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    svc: AnalyticsService = Depends(_svc),
    current_user: User = Depends(get_current_user),
) -> List[CapacityAnalysis]:
    try:
        return svc.analyze_capacity(hospital_id, department_id, start_time, end_time)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Capacity analysis failed: {str(e)}",
        )


@router.get(
    "/overloads",
    response_model=List[CapacityAnalysis],
    summary="Overloaded resources",
    description=(
        "Returns only resources whose peak demand met or exceeded their capacity "
        "(utilization ≥ 100%). These are confirmed service-degradation events."
    ),
)
def get_overloads(
    hospital_id: Optional[int] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    svc: AnalyticsService = Depends(_svc),
    current_user: User = Depends(get_current_user),
) -> List[CapacityAnalysis]:
    try:
        return svc.get_overloads(hospital_id, start_time, end_time)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Overload detection failed: {str(e)}",
        )


@router.get(
    "/capacity/timeseries",
    response_model=List[Dict[str, Any]],
    summary="Utilization over time for a single resource",
    description=(
        "Returns bucketed peak utilization for one resource over a time range. "
        "Default bucket size: 60 minutes. "
        "Each bucket includes: bucket_start, bucket_end, peak_demand, capacity, "
        "peak_utilization, is_overloaded."
    ),
)
def capacity_timeseries(
    resource_id: int = Query(..., description="Resource ID to analyse"),
    start_time: Optional[datetime] = Query(
        None, description="Start of window (default: 24h ago)"
    ),
    end_time: Optional[datetime] = Query(
        None, description="End of window (default: now)"
    ),
    bucket_minutes: int = Query(60, ge=5, le=1440, description="Bucket size in minutes"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    # Default window
    if end_time is None:
        end_time = datetime.now(tz=timezone.utc).replace(tzinfo=None)
    if start_time is None:
        start_time = end_time - timedelta(hours=24)

    try:
        engine = CapacityEngine(db)
        return engine.utilization_timeseries(
            resource_id=resource_id,
            start_time=start_time,
            end_time=end_time,
            bucket_minutes=bucket_minutes,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Timeseries computation failed: {str(e)}",
        )


@router.get(
    "/capacity/hospital-timeseries/{hospital_id}",
    response_model=List[Dict[str, Any]],
    summary="Aggregated utilization over time for an entire hospital",
    description=(
        "Returns bucketed average utilization across all resources in a hospital. "
        "Each bucket also reports how many resources were overloaded in that window. "
        "Ideal for dashboard trend charts."
    ),
)
def hospital_capacity_timeseries(
    hospital_id: int,
    start_time: Optional[datetime] = Query(
        None, description="Start of window (default: 24h ago)"
    ),
    end_time: Optional[datetime] = Query(
        None, description="End of window (default: now)"
    ),
    bucket_minutes: int = Query(60, ge=5, le=1440, description="Bucket size in minutes"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    if end_time is None:
        end_time = datetime.now(tz=timezone.utc).replace(tzinfo=None)
    if start_time is None:
        start_time = end_time - timedelta(hours=24)

    try:
        engine = CapacityEngine(db)
        return engine.hospital_utilization_timeseries(
            hospital_id=hospital_id,
            start_time=start_time,
            end_time=end_time,
            bucket_minutes=bucket_minutes,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Hospital timeseries failed: {str(e)}",
        )