"""Bottleneck Engine - Finds where time is lost using Pandas and NumPy."""
import pandas as pd
import numpy as np
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from database.models import FlowEvent, Department
from domain.schemas import BottleneckAnalysis, BottleneckSeverity


class BottleneckEngine:
    """Finds where time is lost in the healthcare system."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def calculate_delays(self, hospital_id: Optional[int] = None,
                        department_id: Optional[int] = None,
                        start_time: Optional[datetime] = None,
                        end_time: Optional[datetime] = None) -> pd.DataFrame:
        """
        Calculate delays between consecutive events.
        delay = next_event_time - current_event_time
        """
        query = self.db.query(FlowEvent)
        
        if hospital_id:
            query = query.filter(FlowEvent.hospital_id == hospital_id)
        if department_id:
            query = query.filter(FlowEvent.department_id == department_id)
        if start_time:
            query = query.filter(FlowEvent.timestamp >= start_time)
        if end_time:
            query = query.filter(FlowEvent.timestamp <= end_time)
        
        events = query.order_by(FlowEvent.timestamp).all()
        
        if len(events) < 2:
            return pd.DataFrame()
        
        # Convert to DataFrame
        df = pd.DataFrame([{
            'id': e.id,
            'event_type': e.event_type,
            'timestamp': e.timestamp,
            'hospital_id': e.hospital_id,
            'department_id': e.department_id,
            'patient_id': e.patient_id
        } for e in events])
        
        # Group by patient to calculate delays within patient journey
        delays = []
        
        for patient_id, patient_events in df.groupby('patient_id'):
            patient_events = patient_events.sort_values('timestamp').reset_index(drop=True)
            
            for i in range(len(patient_events) - 1):
                current = patient_events.iloc[i]
                next_event = patient_events.iloc[i + 1]
                
                delay_seconds = (next_event['timestamp'] - current['timestamp']).total_seconds()
                
                delays.append({
                    'patient_id': patient_id,
                    'department_id': current['department_id'],
                    'delay_seconds': delay_seconds,
                    'from_event_type': current['event_type'],
                    'to_event_type': next_event['event_type'],
                    'timestamp': current['timestamp']
                })
        
        return pd.DataFrame(delays)
    
    def _classify_severity(self, average_delay_seconds: float) -> BottleneckSeverity:
        """Map average delay to a severity band.

        Thresholds are intentionally simple and can be tuned later:
        - < 15 minutes  → LOW
        - < 60 minutes  → MEDIUM
        - ≥ 60 minutes  → CRITICAL
        """
        minutes = average_delay_seconds / 60.0
        if minutes < 15:
            return BottleneckSeverity.LOW
        if minutes < 60:
            return BottleneckSeverity.MEDIUM
        return BottleneckSeverity.CRITICAL

    def analyze_bottlenecks(self, hospital_id: Optional[int] = None,
                           start_time: Optional[datetime] = None,
                           end_time: Optional[datetime] = None) -> List[BottleneckAnalysis]:
        """
        Analyze bottlenecks by department.
        Returns departments sorted by average delay.
        """
        delays_df = self.calculate_delays(hospital_id=hospital_id,
                                         start_time=start_time,
                                         end_time=end_time)
        
        if delays_df.empty:
            return []
        
        # Group by department
        results = []
        
        for dept_id, dept_delays in delays_df.groupby('department_id'):
            if dept_id is None:
                continue
            
            delay_values = dept_delays['delay_seconds'].values
            
            # Get department name
            dept = self.db.query(Department).filter(Department.id == dept_id).first()
            dept_name = dept.name if dept else f"Department_{dept_id}"
            
            # Calculate statistics
            avg_delay = float(np.mean(delay_values))
            max_delay = float(np.max(delay_values))
            delay_count = len(delay_values)
            percentile_95 = float(np.percentile(delay_values, 95))
            percentile_99 = float(np.percentile(delay_values, 99))
            severity = self._classify_severity(avg_delay)
            
            results.append(BottleneckAnalysis(
                department_id=dept_id,
                department_name=dept_name,
                average_delay=avg_delay,
                max_delay=max_delay,
                delay_count=delay_count,
                percentile_95=percentile_95,
                percentile_99=percentile_99,
                severity=severity,
            ))
        
        # Sort by average delay (descending)
        results.sort(key=lambda x: x.average_delay, reverse=True)
        
        return results
    
    def find_worst_bottleneck(self, hospital_id: Optional[int] = None,
                             start_time: Optional[datetime] = None,
                             end_time: Optional[datetime] = None) -> Optional[BottleneckAnalysis]:
        """Find the single worst bottleneck."""
        bottlenecks = self.analyze_bottlenecks(hospital_id, start_time, end_time)
        return bottlenecks[0] if bottlenecks else None
    
    def get_delay_distribution(self, department_id: int,
                              start_time: Optional[datetime] = None,
                              end_time: Optional[datetime] = None) -> dict:
        """
        Get delay distribution statistics for a department.
        Returns histogram-ready data.
        """
        delays_df = self.calculate_delays(department_id=department_id,
                                         start_time=start_time,
                                         end_time=end_time)
        
        if delays_df.empty:
            return {
                'bins': [],
                'counts': [],
                'mean': 0.0,
                'std': 0.0,
                'median': 0.0
            }
        
        delay_values = delays_df['delay_seconds'].values
        
        # Create histogram
        counts, bins = np.histogram(delay_values, bins=20)
        
        return {
            'bins': bins.tolist(),
            'counts': counts.tolist(),
            'mean': float(np.mean(delay_values)),
            'std': float(np.std(delay_values)),
            'median': float(np.median(delay_values)),
            'min': float(np.min(delay_values)),
            'max': float(np.max(delay_values))
        }
    
    def detect_threshold_violations(self, hospital_id: int, threshold_seconds: float = 3600,
                                   start_time: Optional[datetime] = None,
                                   end_time: Optional[datetime] = None) -> pd.DataFrame:
        """
        Detect delays that exceed a threshold.
        Useful for alerting and monitoring.
        """
        delays_df = self.calculate_delays(hospital_id=hospital_id,
                                         start_time=start_time,
                                         end_time=end_time)
        
        if delays_df.empty:
            return pd.DataFrame()
        
        violations = delays_df[delays_df['delay_seconds'] > threshold_seconds]
        return violations.sort_values('delay_seconds', ascending=False)
