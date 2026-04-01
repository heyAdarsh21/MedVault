"""
Pydantic schemas for MEDVAULT domain models.
"""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


# =========================
# Flow Events
# =========================

class EventType(str, Enum):
    ARRIVAL = "arrival"
    DEPARTURE = "departure"
    TRANSFER = "transfer"
    RESOURCE_REQUEST = "resource_request"
    RESOURCE_RELEASE = "resource_release"
    WAIT_START = "wait_start"
    WAIT_END = "wait_end"


class FlowEventCreate(BaseModel):
    event_type: EventType
    timestamp: datetime
    hospital_id: int
    department_id: Optional[int] = None
    resource_id: Optional[int] = None
    patient_id: Optional[str] = None
    event_metadata: Optional[dict] = None


class FlowEvent(BaseModel):
    id: int
    event_type: EventType
    timestamp: datetime
    hospital_id: int
    department_id: Optional[int] = None
    resource_id: Optional[int] = None
    patient_id: Optional[str] = None
    event_metadata: Optional[dict] = None

    class Config:
        from_attributes = True


# =========================
# Hospitals
# =========================

class HospitalCreate(BaseModel):
    name: str
    location: str
    capacity: Optional[int] = None


class Hospital(BaseModel):
    id: int
    name: str
    location: str
    capacity: Optional[int] = None

    class Config:
        from_attributes = True


# =========================
# Departments
# =========================

class DepartmentCreate(BaseModel):
    name: str
    hospital_id: int
    capacity: Optional[int] = None


class Department(BaseModel):
    id: int
    name: str
    hospital_id: int
    capacity: Optional[int] = None

    class Config:
        from_attributes = True


# =========================
# Resources
# =========================

class ResourceCreate(BaseModel):
    name: str
    department_id: int
    capacity: int
    resource_type: str


class Resource(BaseModel):
    id: int
    name: str
    department_id: int
    capacity: int
    resource_type: str

    class Config:
        from_attributes = True


# =========================
# Analytics
# =========================

class BottleneckSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    CRITICAL = "critical"


class BottleneckAnalysis(BaseModel):
    department_id: int
    department_name: str
    average_delay: float
    max_delay: float
    delay_count: int
    percentile_95: float
    percentile_99: float
    severity: BottleneckSeverity


class FlowAnalysis(BaseModel):
    hospital_id: int
    critical_path: List[int]
    total_flow_time: float
    bottleneck_departments: List[int]
    efficiency_score: float
    path_confidence: float
    graph_metadata: Optional[dict] = None


class CapacityAnalysis(BaseModel):
    resource_id: int
    resource_name: str
    utilization: float
    demand: float
    capacity: float
    is_overloaded: bool


# =========================
# Time-series
# =========================

class TrendPoint(BaseModel):
    bucket_start: datetime
    bucket_end: datetime
    value: float
    label: Optional[str] = None


class TrendDirection(str, Enum):
    IMPROVING = "improving"
    DEGRADING = "degrading"
    STABLE = "stable"
    INSUFFICIENT_DATA = "insufficient_data"


class TrendSummary(BaseModel):
    direction: TrendDirection
    confidence: float          # 0-1
    change_pct: float          # % change current vs baseline
    current_avg: float
    baseline_avg: float
    data_points: int


# =========================
# Anomaly Detection
# =========================

class AnomalySeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AnomalyAlert(BaseModel):
    department_id: Optional[int] = None
    department_name: str
    metric: str                # "delay", "volume", "utilization"
    severity: AnomalySeverity
    current_value: float
    baseline_value: float
    z_score: float
    deviation_pct: float       # how far above baseline in %
    message: str
    detected_at: datetime


# =========================
# Recommendations
# =========================

class RecommendationPriority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RecommendationCategory(str, Enum):
    CAPACITY = "capacity"
    FLOW = "flow"
    STAFFING = "staffing"
    ROUTING = "routing"
    SYSTEM = "system"


class Recommendation(BaseModel):
    priority: RecommendationPriority
    category: RecommendationCategory
    title: str
    description: str
    affected_entity: Optional[str] = None  # dept/resource name
    metric_value: Optional[float] = None   # supporting number
    action: Optional[str] = None           # concrete next step


# =========================
# System Health (Composite)
# =========================

class KPISet(BaseModel):
    efficiency: float
    strain_index: float
    risk_level: str
    throughput: float          # events/hour last 24h
    stability: float


class SystemHealthResponse(BaseModel):
    hospital_id: int
    computed_at: datetime
    kpis: KPISet
    graph_metadata: Dict[str, Any]
    bottlenecks: List[Dict[str, Any]]
    capacity_profile: List[Dict[str, Any]]
    anomalies: List[AnomalyAlert]
    recommendations: List[Recommendation]
    trend: TrendSummary


# =========================
# Simulation
# =========================

class SimulationRunRequest(BaseModel):
    hospital_id: int
    duration: Optional[int] = None
    arrival_rate: Optional[float] = None
    seed: Optional[int] = None
    scenario_name: Optional[str] = None


class SimulationOutcome(BaseModel):
    patients_simulated: int
    avg_wait_time_seconds: float
    peak_resource_utilization: float
    worst_bottleneck: Optional[str] = None
    events_logged: int
    duration: int
    arrival_rate: float
    scenario: Optional[str] = None
    bottleneck_summary: List[Dict[str, Any]]
    capacity_summary: List[Dict[str, Any]]
    insights: List[str]        # human-readable auto-generated observations


class SimulationRunResponse(BaseModel):
    status: str
    hospital_id: int
    outcome: SimulationOutcome


# =========================
# Auth
# =========================

class UserRole(str, Enum):
    ADMIN = "admin"
    ANALYST = "analyst"
    VIEWER = "viewer"
    PATIENT = "patient"
    STAFF = "staff"


class UserCreate(BaseModel):
    username: str
    password: str


class User(BaseModel):
    username: str
    role: UserRole


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    role: UserRole
    exp: int