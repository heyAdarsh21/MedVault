"""
MASTER_SEEDER.py  — Run this ONCE before starting uvicorn.

Creates:
  • 6 realistic hospitals with Indian-style names
  • 7 departments per hospital (ER, ICU, Ward, Radiology, Cardiology, Surgery, Maternity)
  • Resources per department (beds, staff, equipment)
  • 30 days of realistic flow events with hourly variation
  • 60 beds per hospital (various types)
  • 8 doctors per hospital (various specialties)

Usage:
  python MASTER_SEEDER.py

Wipes all existing data first for a clean slate.
"""
import sys, random, uuid
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parent))

from database.base import SessionLocal, engine, Base
from database.models import Hospital, Department, Resource, FlowEvent

# ── ensure tables exist ──────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

random.seed(2024)

# ── Real hospital data ────────────────────────────────────────────────────────
HOSPITALS = [
    {"name": "Adarsh Megacity Hospital",     "location": "Connaught Place, Delhi",    "capacity": 850},
    {"name": "Apollo Institute of Medicine", "location": "Banjara Hills, Hyderabad",  "capacity": 620},
    {"name": "Fortis Memorial Research",     "location": "Gurugram, Haryana",         "capacity": 510},
    {"name": "Max Super Speciality Centre",  "location": "Saket, New Delhi",          "capacity": 450},
    {"name": "Manipal District Hospital",    "location": "Old Airport Rd, Bengaluru", "capacity": 320},
    {"name": "Rural Primary Health Centre",  "location": "Rampur, Uttar Pradesh",     "capacity": 90},
]

# ── Department definitions ────────────────────────────────────────────────────
DEPARTMENTS = [
    {"name": "Emergency Room",      "capacity": 60,  "res": [("ER Bed", "bed", 40), ("Crash Cart", "equipment", 6), ("ER Nurse", "staff", 18), ("Triage Station", "equipment", 10)]},
    {"name": "Intensive Care Unit", "capacity": 30,  "res": [("ICU Bed", "bed", 24), ("Ventilator", "equipment", 12), ("ICU Nurse", "staff", 14), ("Monitor", "equipment", 24)]},
    {"name": "General Ward",        "capacity": 150, "res": [("Ward Bed", "bed", 120), ("Ward Nurse", "staff", 30), ("Infusion Pump", "equipment", 60)]},
    {"name": "Radiology",           "capacity": 20,  "res": [("MRI Scanner", "equipment", 2), ("CT Scanner", "equipment", 2), ("X-Ray Unit", "equipment", 4), ("Radiologist", "staff", 6)]},
    {"name": "Cardiology",          "capacity": 35,  "res": [("Cardiac Bed", "bed", 28), ("ECG Machine", "equipment", 10), ("Cardiologist", "staff", 8), ("Cath Lab", "equipment", 2)]},
    {"name": "Surgery",             "capacity": 20,  "res": [("Operating Theatre", "equipment", 5), ("Surgeon", "staff", 10), ("Anaesthetist", "staff", 8), ("Recovery Bed", "bed", 20)]},
    {"name": "Maternity",           "capacity": 40,  "res": [("Maternity Bed", "bed", 32), ("Delivery Suite", "equipment", 6), ("Midwife", "staff", 16), ("NICU Incubator", "equipment", 8)]},
]

# ── Doctor data ───────────────────────────────────────────────────────────────
DOCTORS_POOL = [
    ("Dr. Arun Sharma",      "General Medicine",   700),
    ("Dr. Priya Mehta",      "Cardiology",         2000),
    ("Dr. Rajan Iyer",       "Orthopaedics",       1500),
    ("Dr. Sunita Rao",       "Obstetrics",         1200),
    ("Dr. Vikram Singh",     "Neurology",          2500),
    ("Dr. Asha Gupta",       "Paediatrics",        900),
    ("Dr. Mohammed Ali",     "Surgery",            1800),
    ("Dr. Kavitha Nair",     "Radiology",          1100),
    ("Dr. Deepak Patel",     "Emergency Medicine", 600),
    ("Dr. Sonal Joshi",      "Pulmonology",        1400),
    ("Dr. Harish Kumar",     "Nephrology",         1600),
    ("Dr. Lalitha Devi",     "Oncology",           2200),
    ("Dr. Rajesh Verma",     "Endocrinology",      1300),
    ("Dr. Nandita Bose",     "Dermatology",        800),
    ("Dr. Suresh Menon",     "Gastroenterology",   1700),
    ("Dr. Pooja Agarwal",    "Psychiatry",         1000),
]

# ── Hourly arrival weights (0=midnight, 8=8am, 18=6pm peak) ──────────────────
HOURLY_WEIGHTS = [
    0.2, 0.1, 0.1, 0.1, 0.15, 0.25, 0.5, 0.8,   # 00-07
    1.0, 1.3, 1.5, 1.6, 1.4, 1.3, 1.2, 1.3,      # 08-15
    1.5, 1.8, 2.0, 1.9, 1.6, 1.2, 0.8, 0.4,      # 16-23
]

# ── Hospital load scale (big hospitals get more events) ───────────────────────
HOSPITAL_DAILY_PATIENTS = [180, 140, 110, 100, 65, 22]


def make_patient_journey(hospital_id, depts, resources_by_dept, base_time, patient_id):
    """Generate a realistic sequence of FlowEvents for one patient."""
    events = []
    # Always start at ER, then random path
    er = next((d for d in depts if "Emergency" in d.name), depts[0])
    path = [er]
    # 40% chance of ICU, 70% chance of ward
    icu = next((d for d in depts if "Intensive" in d.name), None)
    ward = next((d for d in depts if "General Ward" in d.name), None)
    other = [d for d in depts if d not in (er, icu, ward)]

    if random.random() < 0.4 and icu:
        path.append(icu)
    if random.random() < 0.7 and ward:
        path.append(ward)
    if random.random() < 0.3 and other:
        path.append(random.choice(other))

    t = base_time
    for dept in path:
        res_list = resources_by_dept.get(dept.id, [])
        res = random.choice(res_list) if res_list else None

        stay_minutes = {
            "Emergency Room": random.randint(30, 240),
            "Intensive Care Unit": random.randint(360, 1440),
            "General Ward": random.randint(240, 720),
        }.get(dept.name, random.randint(20, 120))

        seq = [
            ("arrival",          0),
            ("wait_start",       random.randint(1, 5)),
            ("resource_request", random.randint(5, 20)),
            ("wait_end",         random.randint(8, 25)),
            ("resource_release", stay_minutes - random.randint(5, 15)),
            ("departure",        stay_minutes),
        ]
        for evt, offset in seq:
            events.append(FlowEvent(
                event_type=evt,
                timestamp=t + timedelta(minutes=max(0, offset)),
                hospital_id=hospital_id,
                department_id=dept.id,
                resource_id=res.id if res else None,
                patient_id=patient_id,
                event_metadata={"seeded": True, "dept": dept.name},
            ))
        t += timedelta(minutes=stay_minutes + random.randint(10, 30))
    return events


def seed():
    db = SessionLocal()
    now = datetime.utcnow()

    print("=" * 55)
    print("  MEDVAULT — MASTER DATA SEEDER")
    print("=" * 55)

    # ── Wipe everything ───────────────────────────────────────
    print("\n[1/5] Clearing existing data…")
    db.query(FlowEvent).delete()
    db.query(Resource).delete()
    db.query(Department).delete()
    db.query(Hospital).delete()
    db.commit()
    print("      Done.")

    # ── Create hospitals ──────────────────────────────────────
    print("\n[2/5] Creating hospitals…")
    created_hospitals = []
    for h_def in HOSPITALS:
        h = Hospital(name=h_def["name"], location=h_def["location"], capacity=h_def["capacity"])
        db.add(h)
        db.flush()
        created_hospitals.append(h)
        print(f"      ✓ {h.name} (ID {h.id})")
    db.commit()

    # ── Create departments + resources ─────────────────────────
    print("\n[3/5] Creating departments & resources…")
    dept_map = {}      # hospital_id → [Department]
    res_map  = {}      # dept_id → [Resource]

    for h in created_hospitals:
        dept_map[h.id] = []
        # Scale capacity by hospital size
        scale = h.capacity / 500
        for d_def in DEPARTMENTS:
            dept = Department(
                name=d_def["name"],
                hospital_id=h.id,
                capacity=max(5, int(d_def["capacity"] * scale)),
            )
            db.add(dept); db.flush()
            dept_map[h.id].append(dept)
            res_map[dept.id] = []
            for res_name, res_type, res_cap in d_def["res"]:
                cap = max(1, int(res_cap * scale))
                r = Resource(name=res_name, department_id=dept.id, capacity=cap, resource_type=res_type)
                db.add(r); db.flush()
                res_map[dept.id].append(r)
    db.commit()
    print("      Done.")

    # ── Generate flow events (30 days) ────────────────────────
    print("\n[4/5] Generating 30 days of flow events…")
    total_events = 0
    for h_idx, h in enumerate(created_hospitals):
        depts = dept_map[h.id]
        daily_patients = HOSPITAL_DAILY_PATIENTS[h_idx]
        h_events = []

        for day in range(30):
            day_start = now - timedelta(days=30 - day)
            # Weekends are 20% busier
            is_weekend = day_start.weekday() >= 5
            n_patients = int(daily_patients * (1.2 if is_weekend else 1.0) * (0.85 + random.random() * 0.30))

            # Distribute patients across hours using realistic weights
            total_weight = sum(HOURLY_WEIGHTS)
            for _ in range(n_patients):
                # Pick arrival hour based on weights
                rand_val = random.random() * total_weight
                cumulative = 0
                arrival_hour = 8
                for hr, w in enumerate(HOURLY_WEIGHTS):
                    cumulative += w
                    if rand_val <= cumulative:
                        arrival_hour = hr
                        break

                arrival_time = day_start.replace(hour=arrival_hour, minute=0, second=0) + timedelta(minutes=random.randint(0, 59))
                patient_id = f"H{h.id}-{uuid.uuid4().hex[:8]}"
                h_events.extend(make_patient_journey(h.id, depts, res_map, arrival_time, patient_id))

        # Bulk insert
        db.bulk_save_objects(h_events)
        db.commit()
        total_events += len(h_events)
        print(f"      ✓ {h.name}: {len(h_events):,} events ({daily_patients} pts/day)")

    print(f"\n      Total: {total_events:,} flow events generated.")

    # ── Try to seed beds/doctors if patient models exist ──────
    print("\n[5/5] Seeding patient service data (beds & doctors)…")
    try:
        from database.patient_models import Bed, Doctor
        bed_types = ["general_ward", "icu", "private", "hdu", "maternity", "paediatric"]
        ward_names = ["Ward A", "Ward B", "Ward C", "ICU Wing", "Private Wing", "Maternity Wing"]

        for h in created_hospitals:
            scale = max(0.1, h.capacity / 500)
            for bed_type in bed_types:
                n = max(2, int({"icu": 15, "private": 20, "hdu": 10, "maternity": 18, "paediatric": 12, "general_ward": 60}.get(bed_type, 20) * scale))
                for i in range(n):
                    status = random.choices(["available", "occupied", "maintenance"], weights=[50, 40, 10])[0]
                    db.add(Bed(
                        hospital_id=h.id, bed_type=bed_type,
                        ward=random.choice(ward_names), status=status,
                        floor=random.randint(1, 5), room_number=f"{random.randint(1, 20):03d}{chr(65 + i % 4)}",
                    ))

            # 8 doctors per hospital
            doc_sample = random.sample(DOCTORS_POOL, min(8, len(DOCTORS_POOL)))
            for name, spec, fee in doc_sample:
                db.add(Doctor(
                    hospital_id=h.id, name=name, specialty=spec,
                    consultation_fee=fee, experience_years=random.randint(5, 30),
                    available_days="Mon,Tue,Wed,Thu,Fri", is_available=True,
                ))
        db.commit()
        print("      ✓ Beds and doctors seeded.")
    except ImportError:
        print("      ⚠ patient_models not found — run create_patient_tables.py first, then re-run this seeder.")
    except Exception as ex:
        db.rollback()
        print(f"      ⚠ Patient service seeding skipped: {ex}")

    db.close()
    print("\n" + "=" * 55)
    print("  SEEDING COMPLETE")
    print("=" * 55)

    # Summary
    db2 = SessionLocal()
    for h in db2.query(Hospital).all():
        ec = db2.query(FlowEvent).filter(FlowEvent.hospital_id == h.id).count()
        dc = db2.query(Department).filter(Department.hospital_id == h.id).count()
        print(f"  {h.name[:38]:<38} {dc} depts  {ec:>6,} events")
    db2.close()
    print()


if __name__ == "__main__":
    seed()