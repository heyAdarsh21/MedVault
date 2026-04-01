"""FastAPI endpoints for MEDVAULT."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from database.base import get_db
from database.models import Hospital, Department, Resource, FlowEvent

from domain.schemas import (
    Hospital as HospitalSchema,
    HospitalCreate,
    Department as DepartmentSchema,
    DepartmentCreate,
    Resource as ResourceSchema,
    ResourceCreate,
    FlowEvent as FlowEventSchema,
    FlowEventCreate,
    FlowAnalysis,
    BottleneckAnalysis,
    CapacityAnalysis,
)

from engines.flow_engine import FlowEngine
from engines.bottleneck_engine import BottleneckEngine
from engines.capacity_engine import CapacityEngine
from simulation.patient_flow_simulator import simulate_hospital_flow

router = APIRouter()


# =========================
# Hospitals
# =========================
@router.post("/hospitals", response_model=HospitalSchema)
def create_hospital(hospital: HospitalCreate, db: Session = Depends(get_db)):
    db_hospital = Hospital(**hospital.dict())
    db.add(db_hospital)
    db.commit()
    db.refresh(db_hospital)
    return db_hospital


@router.get("/hospitals", response_model=List[HospitalSchema])
def list_hospitals(db: Session = Depends(get_db)):
    return db.query(Hospital).all()


@router.get("/hospitals/{hospital_id}", response_model=HospitalSchema)
def get_hospital(hospital_id: int, db: Session = Depends(get_db)):
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    return hospital


# =========================
# Departments
# =========================
@router.post("/departments", response_model=DepartmentSchema)
def create_department(department: DepartmentCreate, db: Session = Depends(get_db)):
    db_department = Department(**department.dict())
    db.add(db_department)
    db.commit()
    db.refresh(db_department)
    return db_department


@router.get("/departments", response_model=List[DepartmentSchema])
def list_departments(
    hospital_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Department)
    if hospital_id:
        query = query.filter(Department.hospital_id == hospital_id)
    return query.all()


# =========================
# Resources
# =========================
@router.post("/resources", response_model=ResourceSchema)
def create_resource(resource: ResourceCreate, db: Session = Depends(get_db)):
    db_resource = Resource(**resource.dict())
    db.add(db_resource)
    db.commit()
    db.refresh(db_resource)
    return db_resource


@router.get("/resources", response_model=List[ResourceSchema])
def list_resources(
    department_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Resource)
    if department_id:
        query = query.filter(Resource.department_id == department_id)
    return query.all()


# =========================
# Flow Events (FIXED)
# =========================
@router.post("/flow-events", response_model=FlowEventSchema)
def create_flow_event(
    event: FlowEventCreate,
    db: Session = Depends(get_db),
):
    db_event = FlowEvent(**event.dict())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


@router.get("/flow-events", response_model=List[FlowEventSchema])
def list_flow_events(
    hospital_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    limit: int = Query(1000, le=10000),
    db: Session = Depends(get_db),
):
    query = db.query(FlowEvent)

    if hospital_id:
        query = query.filter(FlowEvent.hospital_id == hospital_id)
    if department_id:
        query = query.filter(FlowEvent.department_id == department_id)
    if start_time:
        query = query.filter(FlowEvent.timestamp >= start_time)
    if end_time:
        query = query.filter(FlowEvent.timestamp <= end_time)

    return query.order_by(FlowEvent.timestamp.desc()).limit(limit).all()


# =========================
# Analytics
# =========================
@router.get("/analytics/flow/{hospital_id}", response_model=FlowAnalysis)
def analyze_flow(
    hospital_id: int,
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
):
    engine = FlowEngine(db)
    return engine.analyze_flow(hospital_id, start_time, end_time)


@router.get("/analytics/bottlenecks", response_model=List[BottleneckAnalysis])
def analyze_bottlenecks(
    hospital_id: Optional[int] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
):
    engine = BottleneckEngine(db)
    return engine.analyze_bottlenecks(hospital_id, start_time, end_time)


@router.get("/analytics/capacity", response_model=List[CapacityAnalysis])
def analyze_capacity(
    hospital_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
):
    engine = CapacityEngine(db)
    return engine.analyze_capacity(
        hospital_id, department_id, start_time, end_time
    )


@router.get("/analytics/overloads", response_model=List[CapacityAnalysis])
def get_overloads(
    hospital_id: Optional[int] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
):
    engine = CapacityEngine(db)
    return engine.detect_overloads(hospital_id, start_time, end_time)


# =========================
# Simulation
# =========================
@router.post("/simulation/run")
def run_simulation(
    hospital_id: int,
    duration: int = Query(1000),
    arrival_rate: float = Query(0.1),
    seed: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    try:
        events_count = simulate_hospital_flow(
            db, hospital_id, duration, arrival_rate, seed
        )
        return {
            "status": "success",
            "hospital_id": hospital_id,
            "events_logged": events_count,
            "duration": duration,
            "arrival_rate": arrival_rate,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
