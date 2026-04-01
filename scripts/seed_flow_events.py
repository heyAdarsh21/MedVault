"""
Seed FlowEvent data for MEDVAULT (correct department transitions).
"""
import sys
from pathlib import Path
from datetime import datetime, timedelta
import uuid
import random

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from database.base import SessionLocal
from database.models import Hospital, Department, Resource, FlowEvent


def seed_flow_events():
    db = SessionLocal()

    hospital = db.query(Hospital).first()
    departments = db.query(Department).all()
    resources = db.query(Resource).all()

    if not hospital or not departments or not resources:
        print("❌ Run init_sample_data.py first")
        return

    now = datetime.utcnow()
    PATIENT_COUNT = 40

    for _ in range(PATIENT_COUNT):
        patient_id = str(uuid.uuid4())

        # Choose a realistic path: ER → ICU → Ward (or subsets)
        path = random.sample(departments, k=random.randint(2, 3))

        current_time = now - timedelta(minutes=random.randint(60, 300))

        for dept in path:
            dept_resources = [r for r in resources if r.department_id == dept.id]
            if not dept_resources:
                continue

            res = random.choice(dept_resources)

            events = [
                ("arrival", current_time),
                ("wait_start", current_time + timedelta(minutes=2)),
                ("resource_request", current_time + timedelta(minutes=5)),
                ("resource_release", current_time + timedelta(minutes=20)),
                ("wait_end", current_time + timedelta(minutes=22)),
            ]

            for event_type, ts in events:
                db.add(
                    FlowEvent(
                        event_type=event_type,
                        timestamp=ts,
                        hospital_id=hospital.id,
                        department_id=dept.id,
                        resource_id=res.id,
                        patient_id=patient_id,
                        event_metadata={
                            "seeded": True
                        },
                    )
                )

            # Departure from this department
            db.add(
                FlowEvent(
                    event_type="departure",
                    timestamp=current_time + timedelta(minutes=30),
                    hospital_id=hospital.id,
                    department_id=dept.id,
                    resource_id=res.id,
                    patient_id=patient_id,
                    event_metadata={
                        "seeded": True
                    },
                )
            )

            # Move time forward before entering next department
            current_time += timedelta(minutes=35)

    db.commit()
    db.close()
    print("✅ Clean, consistent flow events seeded successfully.")


if __name__ == "__main__":
    seed_flow_events()
