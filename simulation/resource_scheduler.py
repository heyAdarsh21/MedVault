"""SimPy scheduling primitives for MEDVAULT patient flow simulation."""
from __future__ import annotations

from typing import Dict, Iterable, List, Optional

import simpy

from sqlalchemy.orm import Session

from database.models import Department, Resource
from domain.schemas import EventType
from .event_emitter import EventEmitter
from .patient_generator import (
    determine_patient_path,
    get_department_time,
    get_service_time,
)


def build_resource_map(env: simpy.Environment, resources: Iterable[Resource]) -> Dict[int, simpy.Resource]:
    """Create a SimPy Resource for each DB resource row."""
    mapping: Dict[int, simpy.Resource] = {}
    for resource in resources:
        mapping[resource.id] = simpy.Resource(env, capacity=resource.capacity)
    return mapping


def patient_process(
    env: simpy.Environment,
    db: Session,
    hospital_id: int,
    departments: List[Department],
    all_resources: List[Resource],
    resource_map: Dict[int, simpy.Resource],
    emitter: EventEmitter,
    patient_id: str,
) -> None: # type: ignore
    """Simulate a single patient's journey through the hospital."""
    # ARRIVAL
    emitter.emit(
        sim_time=env.now,
        event_type=EventType.ARRIVAL,
        patient_id=patient_id,
        metadata={"sim_time": env.now},
    )

    path = determine_patient_path(departments)
    for i, dept in enumerate(path):
        dept_id = dept["id"]
        dept_name = dept["name"]

        # Enter department
        emitter.emit(
            sim_time=env.now,
            event_type=EventType.TRANSFER,
            department_id=dept_id,
            patient_id=patient_id,
            metadata={"action": "enter", "sim_time": env.now},
        )

        dept_resources = [r for r in all_resources if r.department_id == dept_id]

        for resource in dept_resources:
            simpy_resource = resource_map.get(resource.id)
            if not simpy_resource:
                continue

            with simpy_resource.request() as req:
                emitter.emit(
                    sim_time=env.now,
                    event_type=EventType.RESOURCE_REQUEST,
                    department_id=dept_id,
                    resource_id=resource.id,
                    patient_id=patient_id,
                    metadata={"sim_time": env.now},
                )
                yield req

                service_time = get_service_time(dept_name, resource.resource_type)
                yield env.timeout(service_time)

                emitter.emit(
                    sim_time=env.now,
                    event_type=EventType.RESOURCE_RELEASE,
                    department_id=dept_id,
                    resource_id=resource.id,
                    patient_id=patient_id,
                    metadata={"sim_time": env.now},
                )

        dept_time = get_department_time(dept_name)
        yield env.timeout(dept_time)

        if i < len(path) - 1:
            emitter.emit(
                sim_time=env.now,
                event_type=EventType.TRANSFER,
                department_id=dept_id,
                patient_id=patient_id,
                metadata={"action": "leave", "sim_time": env.now},
            )

    # DEPARTURE
    emitter.emit(
        sim_time=env.now,
        event_type=EventType.DEPARTURE,
        patient_id=patient_id,
        metadata={"sim_time": env.now},
    )

