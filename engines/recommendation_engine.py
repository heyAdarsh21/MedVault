"""
Recommendation Engine - Rule-based operational recommendations for MEDVAULT.

Generates actionable, prioritized recommendations based on:
  - Bottleneck analysis
  - Capacity analysis
  - Anomaly alerts
  - System health KPIs
"""

from __future__ import annotations

from typing import List

from domain.schemas import (
    AnomalyAlert,
    AnomalySeverity,
    BottleneckAnalysis,
    BottleneckSeverity,
    CapacityAnalysis,
    Recommendation,
    RecommendationCategory,
    RecommendationPriority,
)


class RecommendationEngine:
    """Converts analytics outputs into actionable, human-readable recommendations."""

    def generate(
        self,
        bottlenecks: List[BottleneckAnalysis],
        capacity: List[CapacityAnalysis],
        anomalies: List[AnomalyAlert],
        kpis: dict,
    ) -> List[Recommendation]:
        """Run all rule sets and return a prioritized, deduplicated list."""
        recs: List[Recommendation] = []

        recs.extend(self._from_bottlenecks(bottlenecks))
        recs.extend(self._from_capacity(capacity))
        recs.extend(self._from_anomalies(anomalies))
        recs.extend(self._from_kpis(kpis))

        # Deduplicate by title
        seen = set()
        unique = []
        for r in recs:
            if r.title not in seen:
                seen.add(r.title)
                unique.append(r)

        # Sort: CRITICAL → HIGH → MEDIUM → LOW
        order = {
            RecommendationPriority.CRITICAL: 0,
            RecommendationPriority.HIGH: 1,
            RecommendationPriority.MEDIUM: 2,
            RecommendationPriority.LOW: 3,
        }
        unique.sort(key=lambda r: order.get(r.priority, 99))
        return unique

    # ─────────────────────────────────────────────────────────────────────────
    # RULE SETS
    # ─────────────────────────────────────────────────────────────────────────

    def _from_bottlenecks(
        self, bottlenecks: List[BottleneckAnalysis]
    ) -> List[Recommendation]:
        recs = []
        for b in bottlenecks:
            avg_min = b.average_delay / 60

            if b.severity == BottleneckSeverity.CRITICAL:
                recs.append(
                    Recommendation(
                        priority=RecommendationPriority.CRITICAL,
                        category=RecommendationCategory.FLOW,
                        title=f"Critical delay in {b.department_name}",
                        description=(
                            f"{b.department_name} has a critical average patient delay "
                            f"of {avg_min:.0f} minutes across {b.delay_count} events. "
                            f"95th percentile is {b.percentile_95/60:.0f} minutes."
                        ),
                        affected_entity=b.department_name,
                        metric_value=round(avg_min, 1),
                        action=(
                            f"Immediately review staffing and resource allocation "
                            f"in {b.department_name}. Consider patient diversion "
                            f"for non-urgent cases."
                        ),
                    )
                )
            elif b.severity == BottleneckSeverity.MEDIUM:
                recs.append(
                    Recommendation(
                        priority=RecommendationPriority.HIGH,
                        category=RecommendationCategory.FLOW,
                        title=f"Elevated wait times in {b.department_name}",
                        description=(
                            f"{b.department_name} average delay is {avg_min:.0f} min "
                            f"with {b.delay_count} recorded delays."
                        ),
                        affected_entity=b.department_name,
                        metric_value=round(avg_min, 1),
                        action=(
                            f"Schedule a capacity review for {b.department_name}. "
                            f"Consider process optimisation or additional resource allocation."
                        ),
                    )
                )
        return recs

    def _from_capacity(
        self, capacity: List[CapacityAnalysis]
    ) -> List[Recommendation]:
        recs = []

        overloaded = [c for c in capacity if c.is_overloaded]
        near_capacity = [c for c in capacity if not c.is_overloaded and c.utilization >= 0.85]

        for c in overloaded:
            recs.append(
                Recommendation(
                    priority=RecommendationPriority.CRITICAL,
                    category=RecommendationCategory.CAPACITY,
                    title=f"{c.resource_name} is overloaded",
                    description=(
                        f"{c.resource_name} peak demand ({c.demand:.0f}) "
                        f"has met or exceeded its capacity ({c.capacity:.0f}). "
                        f"Service degradation is occurring."
                    ),
                    affected_entity=c.resource_name,
                    metric_value=round(c.utilization * 100, 1),
                    action=(
                        f"Immediately expand {c.resource_name} capacity or "
                        f"redistribute patient load. Consider escalation protocol."
                    ),
                )
            )

        for c in near_capacity:
            recs.append(
                Recommendation(
                    priority=RecommendationPriority.HIGH,
                    category=RecommendationCategory.CAPACITY,
                    title=f"{c.resource_name} approaching capacity",
                    description=(
                        f"{c.resource_name} is at {c.utilization*100:.0f}% utilization "
                        f"(demand {c.demand:.0f} / capacity {c.capacity:.0f})."
                    ),
                    affected_entity=c.resource_name,
                    metric_value=round(c.utilization * 100, 1),
                    action=(
                        f"Plan capacity expansion for {c.resource_name} "
                        f"before it reaches overload."
                    ),
                )
            )

        # Underutilised resources (< 20%) — rebalancing opportunity
        underused = [c for c in capacity if c.utilization < 0.20 and c.capacity > 1]
        if len(underused) >= 2:
            names = ", ".join(c.resource_name for c in underused[:3])
            recs.append(
                Recommendation(
                    priority=RecommendationPriority.MEDIUM,
                    category=RecommendationCategory.STAFFING,
                    title="Underutilised resources identified",
                    description=(
                        f"{len(underused)} resources are below 20% utilization "
                        f"({names}{'...' if len(underused) > 3 else ''}). "
                        f"Staff or capacity could be redistributed."
                    ),
                    action=(
                        "Review staffing models. Consider redeploying "
                        "capacity to higher-demand areas."
                    ),
                )
            )

        return recs

    def _from_anomalies(self, anomalies: List[AnomalyAlert]) -> List[Recommendation]:
        recs = []

        for a in anomalies:
            if a.severity in (AnomalySeverity.CRITICAL, AnomalySeverity.HIGH):
                if a.metric == "delay":
                    recs.append(
                        Recommendation(
                            priority=RecommendationPriority.HIGH,
                            category=RecommendationCategory.FLOW,
                            title=f"Anomalous delay spike in {a.department_name}",
                            description=(
                                f"{a.department_name} delays are {a.deviation_pct:.0f}% "
                                f"above 7-day baseline (Z={a.z_score:.1f}). "
                                f"This is statistically unusual."
                            ),
                            affected_entity=a.department_name,
                            metric_value=a.current_value / 60,  # minutes
                            action=(
                                f"Investigate root cause in {a.department_name}. "
                                f"Check for staffing gaps, equipment issues, or "
                                f"unusual patient mix."
                            ),
                        )
                    )

                elif a.metric == "volume":
                    recs.append(
                        Recommendation(
                            priority=RecommendationPriority.HIGH,
                            category=RecommendationCategory.CAPACITY,
                            title=f"Volume surge in {a.department_name}",
                            description=(
                                f"{a.department_name} is handling {a.current_value:.0f} events "
                                f"vs baseline {a.baseline_value:.0f} "
                                f"(+{a.deviation_pct:.0f}%)."
                            ),
                            affected_entity=a.department_name,
                            metric_value=a.current_value,
                            action=(
                                f"Activate surge protocols for {a.department_name}. "
                                f"Ensure adequate staffing and bed availability."
                            ),
                        )
                    )

                elif a.metric == "utilization":
                    recs.append(
                        Recommendation(
                            priority=(
                                RecommendationPriority.CRITICAL
                                if a.severity == AnomalySeverity.CRITICAL
                                else RecommendationPriority.HIGH
                            ),
                            category=RecommendationCategory.CAPACITY,
                            title=f"Utilization surge: {a.department_name}",
                            description=(
                                f"Resource utilization in {a.department_name} is "
                                f"{a.current_value*100:.1f}%, significantly above "
                                f"baseline {a.baseline_value*100:.1f}%."
                            ),
                            affected_entity=a.department_name,
                            metric_value=a.current_value * 100,
                            action=(
                                "Review resource allocation. If trend continues, "
                                "escalate to capacity management team."
                            ),
                        )
                    )
        return recs

    def _from_kpis(self, kpis: dict) -> List[Recommendation]:
        recs = []
        strain = kpis.get("strain_index", 0.0)
        efficiency = kpis.get("efficiency", 1.0)
        stability = kpis.get("stability", 1.0)
        throughput = kpis.get("throughput", 0.0)

        if strain >= 0.7:
            recs.append(
                Recommendation(
                    priority=RecommendationPriority.CRITICAL,
                    category=RecommendationCategory.SYSTEM,
                    title="System at critical strain",
                    description=(
                        f"Overall system strain index is {strain:.2f} (threshold: 0.7). "
                        f"The hospital is operating under severe pressure across "
                        f"multiple dimensions."
                    ),
                    metric_value=strain,
                    action=(
                        "Activate hospital-wide surge response. Consider diverting "
                        "non-emergency admissions and escalating to hospital leadership."
                    ),
                )
            )
        elif strain >= 0.4:
            recs.append(
                Recommendation(
                    priority=RecommendationPriority.MEDIUM,
                    category=RecommendationCategory.SYSTEM,
                    title="Elevated system strain",
                    description=(
                        f"System strain index is {strain:.2f}. "
                        f"Moderate pressure across capacity and flow metrics."
                    ),
                    metric_value=strain,
                    action=(
                        "Monitor closely. Review department-level bottlenecks "
                        "and prepare contingency staffing."
                    ),
                )
            )

        if efficiency < 0.4:
            recs.append(
                Recommendation(
                    priority=RecommendationPriority.HIGH,
                    category=RecommendationCategory.ROUTING,
                    title="Low patient flow efficiency",
                    description=(
                        f"Flow efficiency score is {efficiency:.2f}. "
                        f"Patient pathways are fragmented or excessively long."
                    ),
                    metric_value=efficiency,
                    action=(
                        "Review patient routing protocols. Identify redundant "
                        "transfer steps and streamline care pathways."
                    ),
                )
            )

        if stability < 0.3:
            recs.append(
                Recommendation(
                    priority=RecommendationPriority.MEDIUM,
                    category=RecommendationCategory.ROUTING,
                    title="Unstable patient flow patterns",
                    description=(
                        f"Flow stability score is {stability:.2f}. "
                        f"Patient routing is inconsistent and unpredictable."
                    ),
                    metric_value=stability,
                    action=(
                        "Standardise patient pathways with clinical protocols. "
                        "Reduce ad-hoc transfers between departments."
                    ),
                )
            )

        if throughput == 0.0:
            recs.append(
                Recommendation(
                    priority=RecommendationPriority.LOW,
                    category=RecommendationCategory.SYSTEM,
                    title="No recent patient activity detected",
                    description=(
                        "No flow events in the last 24 hours. "
                        "This may indicate a data ingestion issue."
                    ),
                    action=(
                        "Verify that the data ingestion pipeline is active "
                        "and connected to source systems."
                    ),
                )
            )

        return recs