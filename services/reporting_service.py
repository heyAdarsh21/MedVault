"""Service layer for higher‑level reporting / dashboards."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from .analytics_service import AnalyticsService


class ReportingService:
    """Aggregates analytics into dashboard‑ready structures."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self._analytics = AnalyticsService(db)

    def get_system_dashboard(
        self,
        hospital_id: int,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Return a compact dashboard DTO for the main landing page."""
        bottlenecks = self._analytics.analyze_bottlenecks(
            hospital_id=hospital_id,
            start_time=start_time,
            end_time=end_time,
        )
        capacity = self._analytics.analyze_capacity(
            hospital_id=hospital_id,
            department_id=None,
            start_time=start_time,
            end_time=end_time,
        )
        flow = self._analytics.analyze_flow(
            hospital_id=hospital_id,
            start_time=start_time,
            end_time=end_time,
        )

        # Minimal but useful structure; frontend can decorate further.
        return {
            "hospital_id": hospital_id,
            "critical_path": flow.critical_path,
            "total_flow_time": flow.total_flow_time,
            "efficiency_score": flow.efficiency_score,
            "bottlenecks": bottlenecks,
            "capacity": capacity,
        }

