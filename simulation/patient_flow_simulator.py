"""SimPy-based discrete-event simulation for patient flow."""
from __future__ import annotations

import random
from typing import Optional

import simpy
from sqlalchemy.orm import Session

from database.models import Department, Hospital, Resource
from .event_emitter import EventEmitter
from .resource_scheduler import build_resource_map, patient_process


class PatientFlowSimulator:
    """Simulates patient flow through a hospital using SimPy.

    This class orchestrates the simulation by wiring together:
    - Hospital structure from the database (departments/resources)
    - An EventEmitter (append-only FlowEvents)
    - Patient generator & resource scheduler primitives
    """

    def __init__(self, db: Session, hospital_id: int) -> None:
        self.db = db
        self.hospital_id = hospital_id
        self.env: Optional[simpy.Environment] = None
        self._events_count: int = 0

        # Load hospital structure
        self.hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
        if not self.hospital:
            raise ValueError(f"Hospital {hospital_id} not found")

        self.departments = db.query(Department).filter(
            Department.hospital_id == hospital_id
        ).all()
        self.resources = []  # type: ignore[var-annotated]
        for dept in self.departments:
            dept_resources = db.query(Resource).filter(
                Resource.department_id == dept.id
            ).all()
            self.resources.extend(dept_resources)

    def run_simulation(
        self,
        duration: int = 1000,
        arrival_rate: float = 0.1,
        seed: Optional[int] = None,
    ) -> int:
        """Run the simulation and return number of FlowEvents persisted."""
        if seed is not None:
            random.seed(seed)

        self.env = simpy.Environment()
        emitter = EventEmitter(self.db, hospital_id=self.hospital_id)
        resource_map = build_resource_map(self.env, self.resources)

        patient_counter = {"value": 0}

        def patient_arrivals():
            while True:
                inter_arrival = random.expovariate(arrival_rate)
                yield self.env.timeout(inter_arrival)

                patient_id = f"PATIENT_{patient_counter['value']:06d}"
                patient_counter["value"] += 1

                self.env.process(
                    patient_process(
                        env=self.env,
                        db=self.db,
                        hospital_id=self.hospital_id,
                        departments=self.departments,
                        all_resources=self.resources,
                        resource_map=resource_map,
                        emitter=emitter,
                        patient_id=patient_id,
                    )
                )

        self.env.process(patient_arrivals())
        self.env.run(until=duration)

        # Persist all staged events
        self.db.commit()
        self._events_count = emitter.events_staged
        return self._events_count


def simulate_hospital_flow(
    db: Session,
    hospital_id: int,
    duration: int = 1000,
    arrival_rate: float = 0.1,
    seed: Optional[int] = None,
) -> int:
    """Convenience function to run a simulation."""
    simulator = PatientFlowSimulator(db, hospital_id)
    return simulator.run_simulation(duration=duration, arrival_rate=arrival_rate, seed=seed)

