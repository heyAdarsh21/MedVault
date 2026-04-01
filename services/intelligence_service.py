"""
Intelligence Service - Composite operational intelligence for MEDVAULT.

Produces:
  - Real KPIs from actual engine data
  - Anomaly alerts via statistical analysis
  - Actionable recommendations via rule engine
  - Trend direction for system strain
"""

from datetime import datetime
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import func

from services.analytics_service import AnalyticsService
from engines.flow_engine import FlowEngine
from engines.anomaly_engine import AnomalyEngine
from engines.recommendation_engine import RecommendationEngine
from database.models import FlowEvent

from domain.schemas import (
    AnomalyAlert,
    KPISet,
    Recommendation,
    SystemHealthResponse,
    TrendSummary,
)


class IntelligenceService:
    """
    Composite Intelligence Layer.

    Aggregates engine outputs into a single, actionable system health picture.
    All KPI inputs come from real data — no synthetic calculations.
    """

    def __init__(self, db: Session):
        self.db = db
        self.analytics = AnalyticsService(db)
        self.flow_engine = FlowEngine(db)
        self.anomaly_engine = AnomalyEngine(db)
        self.recommendation_engine = RecommendationEngine()

    # ─────────────────────────────────────────────────────────────────────────
    # MAIN ENTRY
    # ─────────────────────────────────────────────────────────────────────────

    def get_system_health(self, hospital_id: int) -> SystemHealthResponse:
        """
        Full composite health report for a hospital.

        Runs all engines and synthesises results into a single payload.
        """
        now = datetime.utcnow()

        # --- Core analytics ---
        flow = self.analytics.analyze_flow(hospital_id)
        bottlenecks = self.analytics.analyze_bottlenecks(hospital_id)
        capacity = self.analytics.analyze_capacity(hospital_id)
        graph = self.flow_engine.build_flow_graph(hospital_id)

        # --- Derived KPIs ---
        strain = self._calculate_strain_index(flow, bottlenecks, capacity)
        stability = self._calculate_stability_index(graph)
        throughput = self._calculate_throughput(hospital_id)
        risk_level = self._derive_risk_level(strain)

        kpis = KPISet(
            efficiency=flow.efficiency_score,
            strain_index=strain,
            risk_level=risk_level,
            throughput=throughput,
            stability=stability,
        )

        # --- Intelligence layers ---
        anomalies = self.anomaly_engine.detect_all(hospital_id, now)
        trend = self.anomaly_engine.compute_strain_trend(hospital_id, now)
        recommendations = self.recommendation_engine.generate(
            bottlenecks=bottlenecks,
            capacity=capacity,
            anomalies=anomalies,
            kpis=kpis.dict(),
        )

        return SystemHealthResponse(
            hospital_id=hospital_id,
            computed_at=now,
            kpis=kpis,
            graph_metadata=flow.graph_metadata or {"nodes": [], "edges": []},
            bottlenecks=[
                {
                    "department_id": b.department_id,
                    "department": b.department_name,
                    "severity": b.severity.value,
                    "average_delay_min": round(b.average_delay / 60, 1),
                    "delay_count": b.delay_count,
                    "p95_min": round(b.percentile_95 / 60, 1),
                }
                for b in bottlenecks
            ],
            capacity_profile=[
                {
                    "resource_id": c.resource_id,
                    "resource": c.resource_name,
                    "utilization_pct": round(c.utilization * 100, 1),
                    "demand": c.demand,
                    "capacity": c.capacity,
                    "overloaded": c.is_overloaded,
                }
                for c in capacity
            ],
            anomalies=anomalies,
            recommendations=recommendations,
            trend=trend,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # INDIVIDUAL INTELLIGENCE ENDPOINTS
    # ─────────────────────────────────────────────────────────────────────────

    def get_anomalies(self, hospital_id: int) -> List[AnomalyAlert]:
        """Return current anomaly alerts for a hospital."""
        return self.anomaly_engine.detect_all(hospital_id)

    def get_recommendations(self, hospital_id: int) -> List[Recommendation]:
        """Return actionable recommendations for a hospital."""
        bottlenecks = self.analytics.analyze_bottlenecks(hospital_id)
        capacity = self.analytics.analyze_capacity(hospital_id)
        anomalies = self.anomaly_engine.detect_all(hospital_id)

        flow = self.analytics.analyze_flow(hospital_id)
        graph = self.flow_engine.build_flow_graph(hospital_id)
        strain = self._calculate_strain_index(flow, bottlenecks, capacity)
        stability = self._calculate_stability_index(graph)
        throughput = self._calculate_throughput(hospital_id)

        kpis = {
            "efficiency": flow.efficiency_score,
            "strain_index": strain,
            "risk_level": self._derive_risk_level(strain),
            "throughput": throughput,
            "stability": stability,
        }

        return self.recommendation_engine.generate(
            bottlenecks=bottlenecks,
            capacity=capacity,
            anomalies=anomalies,
            kpis=kpis,
        )

    def get_trend(self, hospital_id: int) -> TrendSummary:
        """Return strain trend direction for a hospital."""
        return self.anomaly_engine.compute_strain_trend(hospital_id)

    # ─────────────────────────────────────────────────────────────────────────
    # KPI CALCULATIONS
    # ─────────────────────────────────────────────────────────────────────────

    def _calculate_strain_index(self, flow, bottlenecks, capacity) -> float:
        """
        Composite strain = weighted average of:
          - Overload ratio     (40%): proportion of resources at capacity
          - Delay severity     (35%): normalised average delay vs 2-hour ceiling
          - Flow fragmentation (25%): 1 - efficiency score
        """
        n_capacity = len(capacity)
        overloaded_ratio = (
            sum(1 for c in capacity if c.is_overloaded) / max(n_capacity, 1)
        )

        if bottlenecks:
            avg_delay_sec = sum(b.average_delay for b in bottlenecks) / len(bottlenecks)
        else:
            avg_delay_sec = 0.0

        # Normalise against 2-hour max (7200 seconds)
        delay_norm = min(avg_delay_sec / 7200.0, 1.0)

        flow_fragmentation = 1.0 - flow.efficiency_score

        strain = (
            (overloaded_ratio * 0.40)
            + (delay_norm * 0.35)
            + (flow_fragmentation * 0.25)
        )
        return round(min(strain, 1.0), 3)

    def _calculate_stability_index(self, graph) -> float:
        """
        Flow graph density as a stability proxy.
        A well-connected graph = more predictable routing.
        Clamped to [0.1, 1.0].
        """
        nodes = graph.number_of_nodes()
        edges = graph.number_of_edges()

        if nodes == 0:
            return 0.1
        if nodes == 1:
            return 0.2

        max_edges = nodes * (nodes - 1)
        density = edges / max(max_edges, 1)
        return round(min(max(density * 2, 0.1), 1.0), 3)

    def _calculate_throughput(self, hospital_id: int) -> float:
        """Events per hour in the last 24 hours."""
        from datetime import timedelta
        last_24h = datetime.utcnow() - timedelta(hours=24)
        count = (
            self.db.query(func.count(FlowEvent.id))
            .filter(
                FlowEvent.hospital_id == hospital_id,
                FlowEvent.timestamp >= last_24h,
            )
            .scalar()
            or 0
        )
        return round(count / 24.0, 2)

    @staticmethod
    def _derive_risk_level(strain: float) -> str:
        if strain >= 0.7:
            return "CRITICAL"
        elif strain >= 0.4:
            return "MODERATE"
        return "LOW"