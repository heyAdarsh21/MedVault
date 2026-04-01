"""
Simulation Service - Runs MEDVAULT simulations and returns rich outcome analytics.

After each simulation run, the service analyses the generated events to produce:
  - Patient count
  - Average wait time
  - Peak resource utilization
  - Worst bottleneck
  - Auto-generated human-readable insights
"""
from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from config.settings import settings
from simulation.patient_flow_simulator import simulate_hospital_flow
from simulation.scenarios import SCENARIOS, get_scenario
from engines.bottleneck_engine import BottleneckEngine
from engines.capacity_engine import CapacityEngine
from database.models import FlowEvent

from domain.schemas import SimulationOutcome, SimulationRunResponse


class SimulationService:
    """Coordinates simulation runs and returns analytics-rich outcome payloads."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def run_simulation(
        self,
        hospital_id: int,
        duration: Optional[int] = None,
        arrival_rate: Optional[float] = None,
        seed: Optional[int] = None,
        scenario_name: Optional[str] = None,
    ) -> SimulationRunResponse:
        """
        Run a simulation, then immediately analyse the generated event window.
        Returns a rich SimulationRunResponse with outcome metrics and insights.
        """
        # Resolve parameters
        if scenario_name:
            scenario = get_scenario(scenario_name)
            duration = duration or scenario.duration
            arrival_rate = arrival_rate or scenario.arrival_rate
            seed = seed if seed is not None else scenario.seed
        else:
            duration = duration or settings.default_simulation_duration
            arrival_rate = arrival_rate or settings.default_patient_arrival_rate

        # Snapshot time just before running, so we can query only sim events.
        # MUST use naive UTC (datetime.utcnow()) to match EventEmitter.base_time
        # which also uses utcnow(). Mixing aware/naive datetimes causes PostgreSQL
        # to miss all rows in the post-simulation query window.
        sim_start_wall = datetime.utcnow()

        events_count = simulate_hospital_flow(
            self.db,
            hospital_id=hospital_id,
            duration=duration,
            arrival_rate=arrival_rate,
            seed=seed,
        )

        sim_end_wall = datetime.utcnow()

        # Analyse the generated events
        outcome = self._analyse_outcome(
            hospital_id=hospital_id,
            events_count=events_count,
            duration=duration,
            arrival_rate=arrival_rate,
            scenario_name=scenario_name,
            sim_start=sim_start_wall,
            sim_end=sim_end_wall,
        )

        return SimulationRunResponse(
            status="success",
            hospital_id=hospital_id,
            outcome=outcome,
        )

    def list_scenarios(self) -> Dict[str, Dict[str, Any]]:
        """Return available scenarios and their parameters."""
        return {name: asdict(cfg) for name, cfg in SCENARIOS.items()}

    # ─────────────────────────────────────────────────────────────────────────
    # OUTCOME ANALYSIS
    # ─────────────────────────────────────────────────────────────────────────

    def _analyse_outcome(
        self,
        hospital_id: int,
        events_count: int,
        duration: int,
        arrival_rate: float,
        scenario_name: Optional[str],
        sim_start: datetime,
        sim_end: datetime,
    ) -> SimulationOutcome:
        """Compute outcome metrics from the events generated during the simulation."""

        # 1. Patient count (unique patient_ids in this simulation's wall-clock window)
        patients_simulated = self._count_unique_patients(
            hospital_id, sim_start, sim_end
        )

        # 2. Bottleneck analysis on the sim window
        b_engine = BottleneckEngine(self.db)
        bottlenecks = b_engine.analyze_bottlenecks(
            hospital_id=hospital_id,
            start_time=sim_start,
            end_time=sim_end,
        )

        avg_wait = 0.0
        worst_bottleneck_name: Optional[str] = None
        bottleneck_summary: List[Dict[str, Any]] = []

        if bottlenecks:
            avg_wait = float(bottlenecks[0].average_delay)  # sorted desc by delay
            worst_bottleneck_name = bottlenecks[0].department_name
            bottleneck_summary = [
                {
                    "department": b.department_name,
                    "avg_delay_min": round(b.average_delay / 60, 1),
                    "severity": b.severity.value,
                    "delay_count": b.delay_count,
                }
                for b in bottlenecks[:5]
            ]

        # 3. Capacity analysis on the sim window
        c_engine = CapacityEngine(self.db)
        capacity = c_engine.analyze_capacity(
            hospital_id=hospital_id,
            start_time=sim_start,
            end_time=sim_end,
        )

        peak_util = max((c.utilization for c in capacity), default=0.0)
        capacity_summary = [
            {
                "resource": c.resource_name,
                "utilization_pct": round(c.utilization * 100, 1),
                "demand": c.demand,
                "capacity": c.capacity,
                "overloaded": c.is_overloaded,
            }
            for c in capacity
        ]

        # 4. Auto-generate human-readable insights
        insights = self._generate_insights(
            patients_simulated=patients_simulated,
            avg_wait=avg_wait,
            peak_util=peak_util,
            bottlenecks=bottlenecks,
            capacity=capacity,
            events_count=events_count,
            duration=duration,
            arrival_rate=arrival_rate,
        )

        return SimulationOutcome(
            patients_simulated=patients_simulated,
            avg_wait_time_seconds=round(avg_wait, 1),
            peak_resource_utilization=round(peak_util, 4),
            worst_bottleneck=worst_bottleneck_name,
            events_logged=events_count,
            duration=duration,
            arrival_rate=arrival_rate,
            scenario=scenario_name,
            bottleneck_summary=bottleneck_summary,
            capacity_summary=capacity_summary,
            insights=insights,
        )

    def _count_unique_patients(
        self,
        hospital_id: int,
        start: datetime,
        end: datetime,
    ) -> int:
        """Count distinct patient IDs in the simulation window."""
        from sqlalchemy import func, distinct
        result = (
            self.db.query(func.count(distinct(FlowEvent.patient_id)))
            .filter(
                FlowEvent.hospital_id == hospital_id,
                FlowEvent.timestamp >= start,
                FlowEvent.timestamp <= end,
                FlowEvent.patient_id.isnot(None),
            )
            .scalar()
        )
        return result or 0

    def _generate_insights(
        self,
        patients_simulated: int,
        avg_wait: float,
        peak_util: float,
        bottlenecks,
        capacity,
        events_count: int,
        duration: int,
        arrival_rate: float,
    ) -> List[str]:
        """Generate auto-written English insights from simulation results."""
        insights: List[str] = []

        # Patient throughput
        if patients_simulated > 0:
            insights.append(
                f"Simulation processed {patients_simulated} unique patients "
                f"across {events_count} recorded events."
            )
        else:
            insights.append(
                "No patients were generated. Verify hospital structure (departments and resources) exists."
            )
            return insights

        # Wait time
        if avg_wait > 0:
            avg_min = avg_wait / 60
            if avg_min < 30:
                insights.append(
                    f"Average patient wait time is {avg_min:.0f} minutes — within acceptable range."
                )
            elif avg_min < 90:
                insights.append(
                    f"Average patient wait time is {avg_min:.0f} minutes — moderately elevated."
                )
            else:
                insights.append(
                    f"Average patient wait time is {avg_min:.0f} minutes — critically high. "
                    f"Immediate capacity review recommended."
                )

        # Resource utilization
        if peak_util >= 1.0:
            n_overloaded = sum(1 for c in capacity if c.is_overloaded)
            insights.append(
                f"Peak resource utilization reached 100%: {n_overloaded} resource(s) hit capacity limit. "
                f"Queuing and delays are expected."
            )
        elif peak_util >= 0.85:
            insights.append(
                f"Peak resource utilization at {peak_util*100:.0f}% — system is near capacity. "
                f"Minor demand spikes will cause overload."
            )
        elif peak_util > 0:
            insights.append(
                f"Peak resource utilization at {peak_util*100:.0f}% — system has available headroom."
            )

        # Bottlenecks
        from domain.schemas import BottleneckSeverity
        critical_bottlenecks = [
            b for b in bottlenecks if b.severity == BottleneckSeverity.CRITICAL
        ]
        if critical_bottlenecks:
            names = ", ".join(b.department_name for b in critical_bottlenecks)
            insights.append(
                f"Critical bottlenecks detected in: {names}. "
                f"These departments are causing the longest patient delays."
            )
        elif bottlenecks:
            insights.append(
                f"No critical bottlenecks detected. Highest delay in "
                f"{bottlenecks[0].department_name} "
                f"({bottlenecks[0].average_delay/60:.0f} min avg)."
            )

        # Under-utilised resources
        underused = [c for c in capacity if c.utilization < 0.2 and c.capacity > 0]
        if underused and len(underused) > 1:
            insights.append(
                f"{len(underused)} resource(s) are below 20% utilization — "
                f"potential for reallocation to busier areas."
            )

        return insights