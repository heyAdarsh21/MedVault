"""
Anomaly Engine - Statistical anomaly detection for MEDVAULT.

Detects:
  1. Delay anomalies  : department delays that deviate significantly from rolling baseline
  2. Volume spikes    : departments with sudden event volume increases
  3. Utilization surge: resources hitting unexpected high utilization

Uses Z-score for statistical deviation and IQR for outlier detection.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import List, Optional

import numpy as np
import pandas as pd
from sqlalchemy import func
from sqlalchemy.orm import Session

from database.models import FlowEvent, Department, Resource
from domain.schemas import AnomalyAlert, AnomalySeverity


# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

BASELINE_DAYS = 7           # Rolling baseline window (days before current window)
CURRENT_WINDOW_HOURS = 24   # Analysis window (current)
Z_THRESHOLD_MEDIUM = 1.5    # Z-score → MEDIUM anomaly
Z_THRESHOLD_HIGH = 2.0      # Z-score → HIGH anomaly
Z_THRESHOLD_CRITICAL = 3.0  # Z-score → CRITICAL anomaly
VOLUME_SPIKE_PCT = 0.5      # 50% above rolling avg → volume spike


class AnomalyEngine:
    """Statistical anomaly detection over hospital flow data."""

    def __init__(self, db: Session):
        self.db = db

    # ─────────────────────────────────────────────────────────────────────────
    # PUBLIC API
    # ─────────────────────────────────────────────────────────────────────────

    def detect_all(
        self,
        hospital_id: int,
        reference_time: Optional[datetime] = None,
    ) -> List[AnomalyAlert]:
        """Run all anomaly detectors and return a merged, deduplicated list."""
        alerts: List[AnomalyAlert] = []
        alerts.extend(self.detect_delay_anomalies(hospital_id, reference_time))
        alerts.extend(self.detect_volume_spikes(hospital_id, reference_time))
        alerts.extend(self.detect_utilization_surges(hospital_id, reference_time))

        # Sort: CRITICAL first
        severity_order = {
            AnomalySeverity.CRITICAL: 0,
            AnomalySeverity.HIGH: 1,
            AnomalySeverity.MEDIUM: 2,
            AnomalySeverity.LOW: 3,
        }
        alerts.sort(key=lambda a: severity_order.get(a.severity, 99))
        return alerts

    def detect_delay_anomalies(
        self,
        hospital_id: int,
        reference_time: Optional[datetime] = None,
    ) -> List[AnomalyAlert]:
        """
        Compare current-window avg delay per department against the rolling
        7-day baseline using Z-score.
        """
        now = reference_time or datetime.utcnow()
        current_start = now - timedelta(hours=CURRENT_WINDOW_HOURS)
        baseline_start = now - timedelta(days=BASELINE_DAYS + 1)
        baseline_end = current_start  # baseline ends where current begins

        departments = (
            self.db.query(Department)
            .filter(Department.hospital_id == hospital_id)
            .all()
        )

        alerts: List[AnomalyAlert] = []

        for dept in departments:
            current_delays = self._get_delays_for_department(
                dept.id, current_start, now
            )
            baseline_delays = self._get_delays_for_department(
                dept.id, baseline_start, baseline_end
            )

            if len(baseline_delays) < 5 or len(current_delays) < 2:
                continue  # insufficient data

            baseline_mean = float(np.mean(baseline_delays))
            baseline_std = float(np.std(baseline_delays))

            if baseline_std < 1.0:
                continue  # no variance in baseline, skip

            current_mean = float(np.mean(current_delays))
            z_score = (current_mean - baseline_mean) / baseline_std

            if abs(z_score) < Z_THRESHOLD_MEDIUM:
                continue  # within normal range

            severity = self._z_to_severity(z_score)
            deviation_pct = (
                ((current_mean - baseline_mean) / max(baseline_mean, 1)) * 100
            )

            alerts.append(
                AnomalyAlert(
                    department_id=dept.id,
                    department_name=dept.name,
                    metric="delay",
                    severity=severity,
                    current_value=round(current_mean, 2),
                    baseline_value=round(baseline_mean, 2),
                    z_score=round(z_score, 3),
                    deviation_pct=round(deviation_pct, 1),
                    message=(
                        f"{dept.name}: avg delay is "
                        f"{abs(deviation_pct):.0f}% "
                        f"{'above' if deviation_pct > 0 else 'below'} "
                        f"7-day baseline "
                        f"({current_mean/60:.1f} min vs "
                        f"{baseline_mean/60:.1f} min)."
                    ),
                    detected_at=now,
                )
            )

        return alerts

    def detect_volume_spikes(
        self,
        hospital_id: int,
        reference_time: Optional[datetime] = None,
    ) -> List[AnomalyAlert]:
        """
        Detect departments with event volumes significantly above rolling average.
        Uses a 7-day rolling mean and flags departments with >50% spike.
        """
        now = reference_time or datetime.utcnow()
        current_start = now - timedelta(hours=CURRENT_WINDOW_HOURS)
        baseline_start = now - timedelta(days=BASELINE_DAYS + 1)
        baseline_end = current_start

        departments = (
            self.db.query(Department)
            .filter(Department.hospital_id == hospital_id)
            .all()
        )

        alerts: List[AnomalyAlert] = []

        for dept in departments:
            # Current: events in last 24h
            current_count = (
                self.db.query(func.count(FlowEvent.id))
                .filter(
                    FlowEvent.department_id == dept.id,
                    FlowEvent.timestamp >= current_start,
                    FlowEvent.timestamp <= now,
                )
                .scalar()
                or 0
            )

            # Baseline: daily average over previous 7 days
            baseline_total = (
                self.db.query(func.count(FlowEvent.id))
                .filter(
                    FlowEvent.department_id == dept.id,
                    FlowEvent.timestamp >= baseline_start,
                    FlowEvent.timestamp <= baseline_end,
                )
                .scalar()
                or 0
            )

            baseline_daily_avg = baseline_total / BASELINE_DAYS

            if baseline_daily_avg < 5:
                continue  # too little history to judge

            spike_ratio = (current_count - baseline_daily_avg) / max(
                baseline_daily_avg, 1
            )

            if spike_ratio < VOLUME_SPIKE_PCT:
                continue  # not a spike

            deviation_pct = spike_ratio * 100
            z_score = spike_ratio / 0.5  # normalized: 100% spike ≈ z=2

            severity = self._z_to_severity(z_score)

            alerts.append(
                AnomalyAlert(
                    department_id=dept.id,
                    department_name=dept.name,
                    metric="volume",
                    severity=severity,
                    current_value=float(current_count),
                    baseline_value=round(baseline_daily_avg, 1),
                    z_score=round(z_score, 3),
                    deviation_pct=round(deviation_pct, 1),
                    message=(
                        f"{dept.name}: event volume is "
                        f"{deviation_pct:.0f}% above daily average "
                        f"({current_count} events vs "
                        f"{baseline_daily_avg:.0f} avg)."
                    ),
                    detected_at=now,
                )
            )

        return alerts

    def detect_utilization_surges(
        self,
        hospital_id: int,
        reference_time: Optional[datetime] = None,
    ) -> List[AnomalyAlert]:
        """
        Flag resources whose utilization in the current window exceeds their
        rolling 7-day utilization by a statistically significant margin.
        Uses same Z-score framework as delay anomalies.
        """
        now = reference_time or datetime.utcnow()
        current_start = now - timedelta(hours=CURRENT_WINDOW_HOURS)
        baseline_start = now - timedelta(days=BASELINE_DAYS + 1)
        baseline_end = current_start

        dept_ids = [
            d[0]
            for d in self.db.query(Department.id)
            .filter(Department.hospital_id == hospital_id)
            .all()
        ]
        resources = (
            self.db.query(Resource)
            .filter(Resource.department_id.in_(dept_ids))
            .all()
        )

        alerts: List[AnomalyAlert] = []

        for res in resources:
            current_util = self._resource_utilization_ratio(
                res.id, res.capacity, current_start, now
            )
            baseline_utils = self._resource_daily_utilizations(
                res.id, res.capacity, baseline_start, baseline_end, BASELINE_DAYS
            )

            if len(baseline_utils) < 3:
                continue

            baseline_mean = float(np.mean(baseline_utils))
            baseline_std = float(np.std(baseline_utils))

            if baseline_std < 0.01:
                continue

            z_score = (current_util - baseline_mean) / baseline_std

            if z_score < Z_THRESHOLD_HIGH:
                continue

            severity = self._z_to_severity(z_score)
            deviation_pct = (
                (current_util - baseline_mean) / max(baseline_mean, 0.01)
            ) * 100

            dept = (
                self.db.query(Department)
                .filter(Department.id == res.department_id)
                .first()
            )
            dept_name = dept.name if dept else "Unknown"

            alerts.append(
                AnomalyAlert(
                    department_id=res.department_id,
                    department_name=dept_name,
                    metric="utilization",
                    severity=severity,
                    current_value=round(current_util, 4),
                    baseline_value=round(baseline_mean, 4),
                    z_score=round(z_score, 3),
                    deviation_pct=round(deviation_pct, 1),
                    message=(
                        f"{res.name} ({dept_name}): utilization at "
                        f"{current_util*100:.1f}% vs "
                        f"baseline {baseline_mean*100:.1f}% "
                        f"(+{deviation_pct:.0f}%)."
                    ),
                    detected_at=now,
                )
            )

        return alerts

    # ─────────────────────────────────────────────────────────────────────────
    # TREND ANALYSIS
    # ─────────────────────────────────────────────────────────────────────────

    def compute_strain_trend(
        self,
        hospital_id: int,
        reference_time: Optional[datetime] = None,
        window_days: int = 7,
    ) -> dict:
        """
        Compute trend direction for system strain by comparing the most recent
        48h event volume to the prior 5-day average.

        Returns:
          direction: "improving" | "degrading" | "stable" | "insufficient_data"
          confidence: 0-1
          change_pct: % change
          current_avg: events/hour in recent window
          baseline_avg: events/hour in baseline
          data_points: number of days in baseline
        """
        from domain.schemas import TrendDirection, TrendSummary

        now = reference_time or datetime.utcnow()
        recent_start = now - timedelta(hours=48)
        prior_start = now - timedelta(days=window_days + 2)
        prior_end = recent_start

        recent_count = (
            self.db.query(func.count(FlowEvent.id))
            .filter(
                FlowEvent.hospital_id == hospital_id,
                FlowEvent.timestamp >= recent_start,
                FlowEvent.timestamp <= now,
            )
            .scalar()
            or 0
        )

        prior_count = (
            self.db.query(func.count(FlowEvent.id))
            .filter(
                FlowEvent.hospital_id == hospital_id,
                FlowEvent.timestamp >= prior_start,
                FlowEvent.timestamp <= prior_end,
            )
            .scalar()
            or 0
        )

        recent_rate = recent_count / 48.0  # events per hour
        prior_hours = (window_days) * 24.0
        prior_rate = prior_count / max(prior_hours, 1)

        if prior_rate < 1.0:
            return TrendSummary(
                direction=TrendDirection.INSUFFICIENT_DATA,
                confidence=0.0,
                change_pct=0.0,
                current_avg=round(recent_rate, 2),
                baseline_avg=round(prior_rate, 2),
                data_points=0,
            )

        change_pct = ((recent_rate - prior_rate) / max(prior_rate, 0.01)) * 100

        # Direction
        if abs(change_pct) < 10:
            direction = TrendDirection.STABLE
        elif change_pct > 0:
            direction = TrendDirection.DEGRADING  # more events/hour = more load
        else:
            direction = TrendDirection.IMPROVING

        # Confidence based on volume
        confidence = min(1.0, prior_count / 100)

        return TrendSummary(
            direction=direction,
            confidence=round(confidence, 3),
            change_pct=round(change_pct, 2),
            current_avg=round(recent_rate, 2),
            baseline_avg=round(prior_rate, 2),
            data_points=window_days,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # INTERNAL HELPERS
    # ─────────────────────────────────────────────────────────────────────────

    def _get_delays_for_department(
        self,
        department_id: int,
        start_time: datetime,
        end_time: datetime,
    ) -> List[float]:
        """Return list of inter-event delays (seconds) for a department window."""
        events = (
            self.db.query(FlowEvent)
            .filter(
                FlowEvent.department_id == department_id,
                FlowEvent.timestamp >= start_time,
                FlowEvent.timestamp <= end_time,
            )
            .order_by(FlowEvent.timestamp)
            .all()
        )

        if len(events) < 2:
            return []

        df = pd.DataFrame(
            [
                {
                    "timestamp": e.timestamp,
                    "patient_id": e.patient_id,
                }
                for e in events
            ]
        )

        delays = []
        for _, patient_df in df.groupby("patient_id"):
            patient_df = patient_df.sort_values("timestamp")
            ts = patient_df["timestamp"].tolist()
            for i in range(len(ts) - 1):
                delta = (ts[i + 1] - ts[i]).total_seconds()
                if delta > 0 and not math.isnan(delta) and not math.isinf(delta):
                    delays.append(delta)

        return delays

    def _resource_utilization_ratio(
        self,
        resource_id: int,
        capacity: int,
        start_time: datetime,
        end_time: datetime,
    ) -> float:
        """Peak demand / capacity in a time window."""
        events = (
            self.db.query(FlowEvent)
            .filter(
                FlowEvent.resource_id == resource_id,
                FlowEvent.timestamp >= start_time,
                FlowEvent.timestamp <= end_time,
            )
            .all()
        )
        if not events:
            return 0.0

        active = 0
        peak = 0
        for e in sorted(events, key=lambda x: x.timestamp):
            if e.event_type in ("resource_request", "arrival"):
                active += 1
                peak = max(peak, active)
            elif e.event_type in ("resource_release", "departure"):
                active = max(0, active - 1)

        return peak / max(capacity, 1)

    def _resource_daily_utilizations(
        self,
        resource_id: int,
        capacity: int,
        start_time: datetime,
        end_time: datetime,
        n_days: int,
    ) -> List[float]:
        """Return a list of daily utilization ratios for a resource."""
        ratios = []
        current = start_time
        step = timedelta(days=1)
        for _ in range(n_days):
            day_end = min(current + step, end_time)
            ratio = self._resource_utilization_ratio(
                resource_id, capacity, current, day_end
            )
            ratios.append(ratio)
            current = day_end
            if current >= end_time:
                break
        return ratios

    @staticmethod
    def _z_to_severity(z_score: float) -> AnomalySeverity:
        z = abs(z_score)
        if z >= Z_THRESHOLD_CRITICAL:
            return AnomalySeverity.CRITICAL
        elif z >= Z_THRESHOLD_HIGH:
            return AnomalySeverity.HIGH
        elif z >= Z_THRESHOLD_MEDIUM:
            return AnomalySeverity.MEDIUM
        return AnomalySeverity.LOW