"""Capacity Engine - Determines system stress and utilization."""
import pandas as pd
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database.models import FlowEvent, Resource, Department
from domain.schemas import CapacityAnalysis


class CapacityEngine:
    """Determines system stress and resource utilization from real event data."""

    def __init__(self, db: Session):
        self.db = db

    def calculate_utilization(
        self,
        resource_id: int,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> Dict[str, float]:
        """
        Calculate resource utilization from actual request/release events.

        Returns a dict with:
          - utilization_ratio : peak_demand / capacity   (can exceed 1.0)
          - peak_demand       : max concurrent requests observed
          - capacity          : configured resource capacity
        """
        resource = self.db.query(Resource).filter(Resource.id == resource_id).first()
        if not resource:
            return {"utilization_ratio": 0.0, "peak_demand": 0.0, "capacity": 0.0}

        # Default window: last 24 hours
        if end_time is None and start_time is None:
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(hours=24)
        elif start_time is not None and end_time is None:
            end_time = start_time + timedelta(days=1)

        query = self.db.query(FlowEvent).filter(FlowEvent.resource_id == resource_id)
        if start_time:
            query = query.filter(FlowEvent.timestamp >= start_time)
        if end_time:
            query = query.filter(FlowEvent.timestamp <= end_time)

        events = query.all()

        if not events:
            return {
                "utilization_ratio": 0.0,
                "peak_demand": 0.0,
                "capacity": float(resource.capacity),
            }

        df = pd.DataFrame(
            [{"event_type": e.event_type, "timestamp": e.timestamp} for e in events]
        ).sort_values("timestamp")

        active = 0
        peak = 0
        for _, row in df.iterrows():
            if row["event_type"] in ("resource_request", "arrival"):
                active += 1
                peak = max(peak, active)
            elif row["event_type"] in ("resource_release", "departure"):
                active = max(0, active - 1)

        capacity = max(resource.capacity, 1)
        utilization_ratio = peak / capacity  # NOT capped — allows overload detection

        return {
            "utilization_ratio": round(utilization_ratio, 4),
            "peak_demand": float(peak),
            "capacity": float(resource.capacity),
        }

    def analyze_capacity(
        self,
        hospital_id: Optional[int] = None,
        department_id: Optional[int] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[CapacityAnalysis]:
        """
        Analyze capacity for all resources in scope.
        Utilization is computed from real event data (not fake heuristics).
        """
        query = self.db.query(Resource)

        if hospital_id:
            dept_ids = [
                d[0]
                for d in self.db.query(Department.id)
                .filter(Department.hospital_id == hospital_id)
                .all()
            ]
            query = query.filter(Resource.department_id.in_(dept_ids))
        elif department_id:
            query = query.filter(Resource.department_id == department_id)

        resources = query.all()
        results = []

        for resource in resources:
            metrics = self.calculate_utilization(resource.id, start_time, end_time)
            util_ratio = metrics["utilization_ratio"]

            results.append(
                CapacityAnalysis(
                    resource_id=resource.id,
                    resource_name=resource.name,
                    # Display-safe: cap at 1.0 for the UI gauge
                    utilization=round(min(util_ratio, 1.0), 4),
                    demand=metrics["peak_demand"],
                    capacity=metrics["capacity"],
                    # Overload = actual ratio >= 1.0 (demand meets or exceeds capacity)
                    is_overloaded=util_ratio >= 1.0,
                )
            )

        results.sort(key=lambda x: x.utilization, reverse=True)
        return results

    def detect_overloads(
        self,
        hospital_id: Optional[int] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[CapacityAnalysis]:
        """Return only resources that are overloaded (peak demand >= capacity)."""
        return [
            a
            for a in self.analyze_capacity(hospital_id, None, start_time, end_time)
            if a.is_overloaded
        ]

    def calculate_department_utilization(
        self,
        department_id: int,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> float:
        """Average utilization across all resources in a department."""
        resources = (
            self.db.query(Resource)
            .filter(Resource.department_id == department_id)
            .all()
        )
        if not resources:
            return 0.0

        ratios = [
            self.calculate_utilization(r.id, start_time, end_time)["utilization_ratio"]
            for r in resources
        ]
        return round(sum(ratios) / len(ratios), 4)

    def utilization_timeseries(
        self,
        resource_id: int,
        start_time: datetime,
        end_time: datetime,
        bucket_minutes: int = 60,
    ) -> List[Dict[str, Any]]:
        """
        Return coarse-grained utilization over time for a single resource.
        Each bucket contains peak utilization within that time window.
        """
        if bucket_minutes <= 0:
            bucket_minutes = 60

        resource = self.db.query(Resource).filter(Resource.id == resource_id).first()
        if not resource:
            return []

        capacity = max(resource.capacity, 1)

        query = (
            self.db.query(FlowEvent)
            .filter(FlowEvent.resource_id == resource_id)
            .filter(FlowEvent.timestamp >= start_time)
            .filter(FlowEvent.timestamp <= end_time)
        )
        events = query.all()

        if not events:
            return []

        df = pd.DataFrame(
            [{"timestamp": e.timestamp, "event_type": e.event_type} for e in events]
        ).sort_values("timestamp")

        bucket = timedelta(minutes=bucket_minutes)
        current_start = start_time
        points: List[Dict[str, Any]] = []

        while current_start < end_time:
            current_end = min(current_start + bucket, end_time)
            window = df[
                (df["timestamp"] >= current_start) & (df["timestamp"] < current_end)
            ]

            active = 0
            peak = 0
            for _, row in window.iterrows():
                if row["event_type"] in ("resource_request", "arrival"):
                    active += 1
                    peak = max(peak, active)
                elif row["event_type"] in ("resource_release", "departure"):
                    active = max(0, active - 1)

            points.append(
                {
                    "bucket_start": current_start.isoformat(),
                    "bucket_end": current_end.isoformat(),
                    "peak_demand": float(peak),
                    "capacity": float(capacity),
                    "peak_utilization": round(peak / capacity, 4),
                    "is_overloaded": peak >= capacity,
                }
            )
            current_start = current_end

        return points

    def hospital_utilization_timeseries(
        self,
        hospital_id: int,
        start_time: datetime,
        end_time: datetime,
        bucket_minutes: int = 60,
    ) -> List[Dict[str, Any]]:
        """
        Aggregate utilization timeseries across all resources in a hospital.
        Returns avg peak utilization per bucket.
        """
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

        if not resources:
            return []

        # Collect timeseries per resource
        all_series = [
            self.utilization_timeseries(r.id, start_time, end_time, bucket_minutes)
            for r in resources
        ]

        # Remove empty
        all_series = [s for s in all_series if s]
        if not all_series:
            return []

        # Merge: average across resources per bucket
        n_buckets = len(all_series[0])
        merged = []
        for i in range(n_buckets):
            bucket_vals = [s[i]["peak_utilization"] for s in all_series if i < len(s)]
            overloaded_count = sum(
                1 for s in all_series if i < len(s) and s[i]["is_overloaded"]
            )
            merged.append(
                {
                    "bucket_start": all_series[0][i]["bucket_start"],
                    "bucket_end": all_series[0][i]["bucket_end"],
                    "avg_utilization": round(
                        sum(bucket_vals) / len(bucket_vals), 4
                    )
                    if bucket_vals
                    else 0.0,
                    "overloaded_resource_count": overloaded_count,
                }
            )

        return merged