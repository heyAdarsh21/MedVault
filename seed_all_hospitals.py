"""
seed_all_hospitals.py
Populates EVERY hospital in the database with:
- Departments (ER, ICU, General Ward, Radiology, Cardiology, Surgery, Maternity)
- Resources (beds, staff, equipment) per department
- Flow events over the past 14 days (realistic varied load per hospital)
- Bed/doctor records for patient services

Run: python seed_all_hospitals.py
"""
import sys, random, uuid
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parent))

from database.base import SessionLocal
from database.models import Hospital, Department, Resource, FlowEvent

random.seed(42)

DEPARTMENTS = [
    {"name": "Emergency Room",      "capacity": 50,  "resources": [("ER Bed", "bed", 30), ("ER Staff", "staff", 15), ("ER Equipment", "equipment", 10)]},
    {"name": "Intensive Care Unit", "capacity": 20,  "resources": [("ICU Bed", "bed", 15), ("ICU Staff", "staff", 10), ("Ventilator", "equipment", 8)]},
    {"name": "General Ward",        "capacity": 100, "resources": [("Ward Bed", "bed", 80), ("Ward Staff", "staff", 25)]},
    {"name": "Radiology",           "capacity": 15,  "resources": [("Imaging Suite", "equipment", 6), ("Radiology Staff", "staff", 8)]},
    {"name": "Cardiology",          "capacity": 25,  "resources": [("Cardiac Bed", "bed", 20), ("Cardiology Staff", "staff", 12)]},
    {"name": "Surgery",             "capacity": 12,  "resources": [("Operating Theatre", "equipment", 4), ("Surgery Staff", "staff", 16)]},
    {"name": "Maternity",           "capacity": 30,  "resources": [("Maternity Bed", "bed", 25), ("Maternity Staff", "staff", 14)]},
]

EVENT_TYPES = ["arrival", "resource_request", "resource_release", "transfer", "wait_start", "wait_end", "departure"]

# Each hospital gets different load profiles for realistic variation
LOAD_PROFILES = {
    0: {"events_per_day": 80,  "note": "high-volume urban"},
    1: {"events_per_day": 55,  "note": "mid-size"},
    2: {"events_per_day": 35,  "note": "district"},
    3: {"events_per_day": 18,  "note": "rural/small"},
    4: {"events_per_day": 65,  "note": "regional"},
    5: {"events_per_day": 45,  "note": "suburban"},
}


def seed_all():
    db = SessionLocal()
    try:
        hospitals = db.query(Hospital).all()
        if not hospitals:
            print("❌ No hospitals found. Run seed_hospitals.py first.")
            return

        print(f"Found {len(hospitals)} hospitals. Seeding all...")

        for idx, hospital in enumerate(hospitals):
            profile = LOAD_PROFILES.get(idx, LOAD_PROFILES[0])
            print(f"\n  [{idx+1}/{len(hospitals)}] {hospital.name} ({profile['note']})")

            # --- Remove old department/resource data for this hospital ---
            existing_depts = db.query(Department).filter(Department.hospital_id == hospital.id).all()
            for d in existing_depts:
                db.query(Resource).filter(Resource.department_id == d.id).delete()
                db.delete(d)
            db.flush()

            # --- Create departments + resources ---
            created_depts = []
            created_resources = []
            for dept_def in DEPARTMENTS:
                dept = Department(
                    name=dept_def["name"],
                    hospital_id=hospital.id,
                    capacity=dept_def["capacity"],
                )
                db.add(dept)
                db.flush()  # get id
                created_depts.append(dept)

                for res_name, res_type, res_cap in dept_def["resources"]:
                    res = Resource(
                        name=res_name,
                        department_id=dept.id,
                        capacity=res_cap,
                        resource_type=res_type,
                    )
                    db.add(res)
                    db.flush()
                    created_resources.append((dept, res))

            print(f"     ✓ {len(created_depts)} departments, {len(created_resources)} resources")

            # --- Generate flow events for 14 days ---
            # Remove old events
            db.query(FlowEvent).filter(FlowEvent.hospital_id == hospital.id).delete()
            db.flush()

            now = datetime.utcnow()
            events_per_day = profile["events_per_day"]
            # Vary load: weekend surges, weekday patterns, slight randomness per hospital
            total_events = 0

            for day_offset in range(14):
                day_start = now - timedelta(days=14 - day_offset)
                # Each day: simulate N patients arriving
                n_patients = int(events_per_day * (0.8 + random.random() * 0.4))
                for _ in range(n_patients):
                    patient_id = f"H{hospital.id}-P{uuid.uuid4().hex[:8]}"
                    # Random path through 1-3 departments
                    path_depts = random.sample(created_depts, k=min(random.randint(1, 3), len(created_depts)))
                    t = day_start + timedelta(hours=random.random() * 22)

                    for dept in path_depts:
                        dept_resources = [r for d, r in created_resources if d.id == dept.id]
                        res = random.choice(dept_resources) if dept_resources else None

                        dept_events = [
                            ("arrival",          0),
                            ("wait_start",       random.randint(2, 8)),
                            ("resource_request", random.randint(5, 15)),
                            ("resource_release", random.randint(20, 90)),
                            ("wait_end",         random.randint(22, 95)),
                            ("departure",        random.randint(30, 120)),
                        ]
                        for evt_type, offset_min in dept_events:
                            db.add(FlowEvent(
                                event_type=evt_type,
                                timestamp=t + timedelta(minutes=offset_min),
                                hospital_id=hospital.id,
                                department_id=dept.id,
                                resource_id=res.id if res else None,
                                patient_id=patient_id,
                                event_metadata={"seeded": True, "profile": profile["note"]},
                            ))
                            total_events += 1
                        t += timedelta(minutes=random.randint(30, 180))

            print(f"     ✓ {total_events} flow events over 14 days")

        db.commit()
        print("\n✅ All hospitals seeded successfully.")

        # Summary
        for h in hospitals:
            dept_count = db.query(Department).filter(Department.hospital_id == h.id).count()
            event_count = db.query(FlowEvent).filter(FlowEvent.hospital_id == h.id).count()
            print(f"   {h.name}: {dept_count} depts, {event_count} events")

    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_all()