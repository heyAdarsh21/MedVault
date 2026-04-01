"""
Analytics Service - Orchestrates analytical engines for MEDVAULT.

All computations are delegated to the appropriate engine classes.
No analytics logic lives here - this is purely a coordination layer.
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session

from engines.flow_engine import FlowEngine
from engines.bottleneck_engine import BottleneckEngine
from engines.capacity_engine import CapacityEngine

from domain.schemas import (
    FlowAnalysis,
    BottleneckAnalysis,
    CapacityAnalysis,
)


class AnalyticsService:
    """Coordination layer: routes analytics requests to the correct engine."""

    def __init__(self, db: Session):
        self.db = db
        self._flow_engine = FlowEngine(db)
        self._bottleneck_engine = BottleneckEngine(db)
        self._capacity_engine = CapacityEngine(db)

    # ─────────────────────────────────────────────────────────────────────────
    # FLOW
    # ─────────────────────────────────────────────────────────────────────────

    def analyze_flow(
        self,
        hospital_id: int,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> FlowAnalysis:
        """Full flow graph analysis including critical path and efficiency score."""
        return self._flow_engine.analyze_flow(
            hospital_id=hospital_id,
            start_time=start_time,
            end_time=end_time,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # BOTTLENECKS
    # ─────────────────────────────────────────────────────────────────────────

    def analyze_bottlenecks(
        self,
        hospital_id: Optional[int] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[BottleneckAnalysis]:
        """
        Real time-based bottleneck analysis via BottleneckEngine.
        Severity is derived from actual inter-event delay in seconds.
        """
        return self._bottleneck_engine.analyze_bottlenecks(
            hospital_id=hospital_id,
            start_time=start_time,
            end_time=end_time,
        )

    def get_worst_bottleneck(
        self,
        hospital_id: Optional[int] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> Optional[BottleneckAnalysis]:
        """Return the single worst bottleneck department, or None."""
        return self._bottleneck_engine.find_worst_bottleneck(
            hospital_id=hospital_id,
            start_time=start_time,
            end_time=end_time,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # CAPACITY
    # ─────────────────────────────────────────────────────────────────────────

    def analyze_capacity(
        self,
        hospital_id: Optional[int] = None,
        department_id: Optional[int] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[CapacityAnalysis]:
        """
        Real utilization analysis from actual resource_request / resource_release events.
        """
        return self._capacity_engine.analyze_capacity(
            hospital_id=hospital_id,
            department_id=department_id,
            start_time=start_time,
            end_time=end_time,
        )

    def get_overloads(
        self,
        hospital_id: Optional[int] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[CapacityAnalysis]:
        """Return only resources whose peak demand met or exceeded their capacity."""
        return self._capacity_engine.detect_overloads(
            hospital_id=hospital_id,
            start_time=start_time,
            end_time=end_time,
        )