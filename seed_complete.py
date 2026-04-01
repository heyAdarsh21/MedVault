"""
seed_complete.py — MedVault Complete Database Seeder
====================================================
Creates all necessary data for a fully functional demo:
  - 8 realistic Indian hospitals with DISTINCT operational profiles
  - 7 departments per hospital (ER, ICU, General Ward, Radiology, Cardiology, Surgery, Maternity)
  - Resources per department (beds, staff, equipment)
  - Beds for patient booking system
  - Doctors with appointment schedules
  - 14 days of flow events (differentiated load per hospital)
  - Default admin and staff users

Run:  python seed_complete.py
"""

import sys
import random
import uuid
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parent))

from database.base import SessionLocal, engine, Base
from database.models import Hospital, Department, Resource, FlowEvent, User, MetricCache
from database.patient_models import Bed, BedBooking, Doctor, Appointment, AmbulanceRequest
from core.security import hash_password

random.seed(42)

# ═══════════════════════════════════════════════════════════════════════════════
# Hospital Data — 8 Real Indian Hospitals with UNIQUE profiles
# ═══════════════════════════════════════════════════════════════════════════════

HOSPITALS = [
    {
        "name": "AIIMS New Delhi",
        "location": "Ansari Nagar, New Delhi",
        "capacity": 2500,
        "profile": {
            "type": "high_volume_tertiary",
            "events_per_day": 110,
            "bottleneck_dept": "Emergency Room",        # ER is always swamped
            "bottleneck_severity": 2.5,                 # multiplier on delays
            "wait_range": (3, 12),                      # moderate waits
            "resource_hold_range": (25, 100),            # moderate resource usage
            "departure_range": (40, 150),
            "bed_availability": 0.75,                    # 75% available
            "peak_hour_boost": 1.4,                      # big evening surge
        },
    },
    {
        "name": "Fortis Memorial Research Inst.",
        "location": "Sector 44, Gurgaon, Haryana",
        "capacity": 1000,
        "profile": {
            "type": "premium_private",
            "events_per_day": 45,
            "bottleneck_dept": None,                     # no bottlenecks — premium
            "bottleneck_severity": 1.0,
            "wait_range": (1, 5),                        # very short waits
            "resource_hold_range": (15, 50),              # quick turnaround
            "departure_range": (20, 70),
            "bed_availability": 0.92,                     # mostly available
            "peak_hour_boost": 1.1,
        },
    },
    {
        "name": "Apollo Hospitals Chennai",
        "location": "Greams Road, Chennai",
        "capacity": 700,
        "profile": {
            "type": "balanced_corporate",
            "events_per_day": 55,
            "bottleneck_dept": "Radiology",               # imaging backlog
            "bottleneck_severity": 1.8,
            "wait_range": (3, 10),
            "resource_hold_range": (20, 75),
            "departure_range": (30, 100),
            "bed_availability": 0.82,
            "peak_hour_boost": 1.2,
        },
    },
    {
        "name": "Medanta – The Medicity",
        "location": "CH Baktawar Singh Rd, Gurgaon",
        "capacity": 1250,
        "profile": {
            "type": "specialist_heavy",
            "events_per_day": 60,
            "bottleneck_dept": "Surgery",                 # surgery is overbooked
            "bottleneck_severity": 2.0,
            "wait_range": (2, 8),
            "resource_hold_range": (30, 120),             # long surgery holds
            "departure_range": (40, 160),
            "bed_availability": 0.78,
            "peak_hour_boost": 1.15,
        },
    },
    {
        "name": "CMC Vellore",
        "location": "Ida Scudder Rd, Vellore, TN",
        "capacity": 2700,
        "profile": {
            "type": "high_volume_teaching",
            "events_per_day": 95,
            "bottleneck_dept": "General Ward",             # ward is congested
            "bottleneck_severity": 1.6,
            "wait_range": (4, 14),                         # longer waits
            "resource_hold_range": (25, 90),
            "departure_range": (35, 130),
            "bed_availability": 0.70,                      # lower availability
            "peak_hour_boost": 1.3,
        },
    },
    {
        "name": "Tata Memorial Hospital Mumbai",
        "location": "Dr. E Borges Rd, Parel, Mumbai",
        "capacity": 600,
        "profile": {
            "type": "specialized_oncology",
            "events_per_day": 35,
            "bottleneck_dept": "Radiology",                # imaging is critical for oncology
            "bottleneck_severity": 2.2,
            "wait_range": (5, 18),                          # long waits due to specialized care
            "resource_hold_range": (40, 180),                # long treatment holds
            "departure_range": (60, 240),
            "bed_availability": 0.60,                        # often full
            "peak_hour_boost": 1.05,
        },
    },
    {
        "name": "Safdarjung Hospital New Delhi",
        "location": "Safdarjung Enclave, New Delhi",
        "capacity": 1600,
        "profile": {
            "type": "overloaded_government",
            "events_per_day": 130,                           # highest volume
            "bottleneck_dept": "Emergency Room",
            "bottleneck_severity": 3.0,                      # severe ER bottleneck
            "wait_range": (8, 30),                            # very long waits
            "resource_hold_range": (20, 80),
            "departure_range": (30, 120),
            "bed_availability": 0.45,                         # often at capacity
            "peak_hour_boost": 1.5,                           # massive evening surge
        },
    },
    {
        "name": "NIMHANS Bangalore",
        "location": "Hosur Road, Bangalore",
        "capacity": 895,
        "profile": {
            "type": "specialized_neuro",
            "events_per_day": 40,
            "bottleneck_dept": "Intensive Care Unit",          # ICU demand for neuro
            "bottleneck_severity": 1.9,
            "wait_range": (4, 12),
            "resource_hold_range": (30, 140),                  # long neuro holds
            "departure_range": (50, 180),
            "bed_availability": 0.72,
            "peak_hour_boost": 1.1,
        },
    },
]

DEPARTMENTS = [
    {"name": "Emergency Room",      "capacity": 50,  "resources": [
        ("ER Bed",          "bed",       30),
        ("ER Staff",        "staff",     15),
        ("ER Monitors",     "equipment", 10),
    ]},
    {"name": "Intensive Care Unit", "capacity": 20,  "resources": [
        ("ICU Bed",         "bed",       15),
        ("ICU Staff",       "staff",     10),
        ("Ventilator",      "equipment",  8),
    ]},
    {"name": "General Ward",        "capacity": 100, "resources": [
        ("Ward Bed",        "bed",       80),
        ("Ward Staff",      "staff",     25),
    ]},
    {"name": "Radiology",           "capacity": 15,  "resources": [
        ("Imaging Suite",   "equipment",  6),
        ("Radiology Staff", "staff",      8),
    ]},
    {"name": "Cardiology",          "capacity": 25,  "resources": [
        ("Cardiac Bed",     "bed",       20),
        ("Cardiology Staff","staff",     12),
    ]},
    {"name": "Surgery",             "capacity": 12,  "resources": [
        ("Operating Theatre","equipment", 4),
        ("Surgery Staff",   "staff",     16),
    ]},
    {"name": "Maternity",           "capacity": 30,  "resources": [
        ("Maternity Bed",   "bed",       25),
        ("Maternity Staff", "staff",     14),
    ]},
]

# Bed types to create per hospital for patient services
BED_TYPES_PER_HOSPITAL = [
    ("general",     "General Ward",       40),
    ("icu",         "ICU",                10),
    ("emergency",   "Emergency Room",     15),
    ("maternity",   "Maternity Wing",     12),
    ("paediatric",  "Paediatrics Ward",    8),
]

# Doctor names and specialties
DOCTOR_DATA = [
    ("Dr. Arun Sharma",      "General Medicine",   "MBBS, MD",           "Mon,Tue,Wed,Thu,Fri"),
    ("Dr. Priya Mehta",      "Cardiology",         "MBBS, DM Cardio",   "Mon,Wed,Fri"),
    ("Dr. Rajesh Singh",     "Orthopaedics",       "MBBS, MS Ortho",    "Tue,Thu,Sat"),
    ("Dr. Kavita Reddy",     "Neurology",          "MBBS, DM Neuro",    "Mon,Tue,Thu"),
    ("Dr. Vikram Patel",     "Surgery",            "MBBS, MS Surgery",  "Wed,Thu,Fri"),
    ("Dr. Ananya Iyer",      "Paediatrics",        "MBBS, DCH",         "Mon,Tue,Wed,Thu,Fri"),
    ("Dr. Suresh Kumar",     "Radiology",          "MBBS, MD Radio",    "Mon,Wed,Fri,Sat"),
    ("Dr. Deepa Nair",       "Obstetrics & Gynae", "MBBS, MS OBG",      "Tue,Wed,Thu"),
    ("Dr. Mohammed Ali",     "Emergency Medicine", "MBBS, MD EM",       "Mon,Tue,Wed,Thu,Fri,Sat"),
    ("Dr. Sneha Joshi",      "Dermatology",        "MBBS, MD Derm",     "Mon,Wed,Fri"),
    ("Dr. Ramesh Gupta",     "ENT",                "MBBS, MS ENT",      "Tue,Thu,Sat"),
    ("Dr. Pooja Verma",      "Psychiatry",         "MBBS, MD Psych",    "Mon,Tue,Thu,Fri"),
]

EVENT_TYPES = ["arrival", "resource_request", "resource_release", "transfer", "wait_start", "wait_end", "departure"]


# ═══════════════════════════════════════════════════════════════════════════════
# Seeder
# ═══════════════════════════════════════════════════════════════════════════════

def seed():
    db = SessionLocal()
    try:
        print("🏥 MedVault Complete Seeder (Differentiated Profiles)")
        print("=" * 60)

        # ── Create tables ────────────────────────────────────────────
        print("\n📋 Creating database tables...")
        Base.metadata.create_all(bind=engine)
        print("   ✓ Tables ready")

        # ── Clean existing data (order matters for FK constraints) ────
        print("\n🧹 Cleaning existing data...")
        for model in [BedBooking, Appointment, AmbulanceRequest, MetricCache]:
            try:
                db.query(model).delete()
            except Exception:
                db.rollback()
        db.flush()
        for model in [FlowEvent, Resource, Department, Bed, Doctor]:
            db.query(model).delete()
        db.flush()
        db.query(Hospital).delete()
        db.flush()
        print("   ✓ Old data removed")

        # ── Create users ─────────────────────────────────────────────
        print("\n👤 Creating users...")
        default_users = [
            {"username": "admin",   "password": "admin123",   "role": "admin"},
            {"username": "staff",   "password": "staff123",   "role": "analyst"},
            {"username": "viewer",  "password": "viewer123",  "role": "viewer"},
            {"username": "patient1","password": "patient123", "role": "patient"},
        ]
        for u in default_users:
            existing = db.query(User).filter(User.username == u["username"]).first()
            if not existing:
                db.add(User(
                    username=u["username"],
                    hashed_password=hash_password(u["password"]),
                    role=u["role"],
                    is_active=True,
                ))
                print(f"   ✓ Created user: {u['username']} / {u['password']} (role: {u['role']})")
            else:
                print(f"   → User '{u['username']}' already exists, skipping")
        db.flush()

        # ── Create hospitals ─────────────────────────────────────────
        print("\n🏥 Creating hospitals...")
        hospital_objects = []
        hospital_profiles = []
        for h_data in HOSPITALS:
            profile = h_data.pop("profile")
            h = Hospital(**h_data)
            db.add(h)
            db.flush()
            hospital_objects.append(h)
            hospital_profiles.append(profile)
            h_data["profile"] = profile  # put it back
            print(f"   ✓ {h.name} (ID: {h.id}, {h.capacity} beds, profile: {profile['type']})")

        # ── Create departments + resources per hospital ──────────────
        print("\n🏬 Creating departments and resources...")
        all_dept_resources = {}  # hospital_id -> [(dept, [resources])]

        for idx, hospital in enumerate(hospital_objects):
            scale = hospital.capacity / 1000

            created_depts = []
            for dept_def in DEPARTMENTS:
                scaled_cap = max(5, int(dept_def["capacity"] * scale))
                dept = Department(
                    name=dept_def["name"],
                    hospital_id=hospital.id,
                    capacity=scaled_cap,
                )
                db.add(dept)
                db.flush()

                dept_resources = []
                for res_name, res_type, res_cap in dept_def["resources"]:
                    scaled_res = max(2, int(res_cap * scale))
                    res = Resource(
                        name=res_name,
                        department_id=dept.id,
                        capacity=scaled_res,
                        resource_type=res_type,
                    )
                    db.add(res)
                    db.flush()
                    dept_resources.append(res)

                created_depts.append((dept, dept_resources))

            all_dept_resources[hospital.id] = created_depts
            dept_count = len(created_depts)
            res_count = sum(len(r) for _, r in created_depts)
            print(f"   ✓ {hospital.name}: {dept_count} depts, {res_count} resources")

        # ── Create beds for patient services ─────────────────────────
        print("\n🛏️ Creating beds for patient services...")
        for idx, hospital in enumerate(hospital_objects):
            profile = hospital_profiles[idx]
            scale = hospital.capacity / 1000
            bed_count = 0
            for bed_type, ward_name, base_count in BED_TYPES_PER_HOSPITAL:
                count = max(3, int(base_count * scale))
                for b_num in range(1, count + 1):
                    is_avail = random.random() < profile["bed_availability"]
                    db.add(Bed(
                        hospital_id=hospital.id,
                        ward=ward_name,
                        bed_number=f"{ward_name[:3].upper()}-{b_num:03d}",
                        bed_type=bed_type,
                        is_available=is_avail,
                    ))
                    bed_count += 1
            db.flush()
            avail_pct = int(profile["bed_availability"] * 100)
            print(f"   ✓ {hospital.name}: {bed_count} beds (~{avail_pct}% available)")

        # ── Create doctors ───────────────────────────────────────────
        print("\n👨‍⚕️ Creating doctors...")
        for hospital in hospital_objects:
            doc_count = 0
            for name, specialty, qual, avail_days in DOCTOR_DATA:
                start_h = random.choice([9, 10])
                end_h = random.choice([16, 17, 18])
                fee = round(random.uniform(300, 2000), 0)
                slot_dur = random.choice([15, 20, 30])

                db.add(Doctor(
                    hospital_id=hospital.id,
                    name=name,
                    specialty=specialty,
                    qualification=qual,
                    available_days=avail_days,
                    start_time=f"{start_h:02d}:00",
                    end_time=f"{end_h:02d}:00",
                    fee=fee,
                    slot_duration_min=slot_dur,
                    max_patients=20,
                ))
                doc_count += 1
            db.flush()
            print(f"   ✓ {hospital.name}: {doc_count} doctors")

        # ── Generate flow events with DIFFERENTIATED profiles ────────
        print("\n📊 Generating flow events (14 days, differentiated)...")
        now = datetime.utcnow()

        for idx, hospital in enumerate(hospital_objects):
            profile = hospital_profiles[idx]
            depts_data = all_dept_resources[hospital.id]
            total_events = 0

            # Find the bottleneck department if specified
            bottleneck_dept_id = None
            for dept, _ in depts_data:
                if dept.name == profile["bottleneck_dept"]:
                    bottleneck_dept_id = dept.id
                    break

            wait_lo, wait_hi = profile["wait_range"]
            hold_lo, hold_hi = profile["resource_hold_range"]
            depart_lo, depart_hi = profile["departure_range"]
            bottleneck_mult = profile["bottleneck_severity"]

            for day_offset in range(14):
                day_start = now - timedelta(days=14 - day_offset)
                day_of_week = day_start.weekday()
                weekend_mult = 1.2 if day_of_week in [5, 6] else 1.0

                # More recent days get a slight trend factor
                recency_factor = 0.85 + (day_offset / 14) * 0.3  # 0.85→1.15

                n_patients = int(
                    profile["events_per_day"]
                    * weekend_mult
                    * recency_factor
                    * (0.85 + random.random() * 0.3)
                )

                for _ in range(n_patients):
                    patient_id = f"H{hospital.id}-P{uuid.uuid4().hex[:6]}"
                    # Random path through 1-3 departments
                    n_depts = min(random.randint(1, 3), len(depts_data))
                    path_depts = random.sample(depts_data, k=n_depts)

                    # Peak hours: 10am-2pm and 5pm-9pm get boosted
                    hour = random.random() * 22
                    is_peak = (10 <= hour <= 14) or (17 <= hour <= 21)
                    peak_mult = profile["peak_hour_boost"] if is_peak else 1.0

                    t = day_start + timedelta(hours=hour)

                    for dept, dept_resources in path_depts:
                        res = random.choice(dept_resources) if dept_resources else None

                        # Apply bottleneck multiplier to the bottleneck department
                        is_bottleneck = (dept.id == bottleneck_dept_id)
                        dept_mult = bottleneck_mult if is_bottleneck else 1.0

                        # Differentiated event timing based on profile
                        w_lo = int(wait_lo * dept_mult * peak_mult)
                        w_hi = int(wait_hi * dept_mult * peak_mult)
                        h_lo = int(hold_lo * dept_mult)
                        h_hi = int(hold_hi * dept_mult)
                        d_lo = int(depart_lo * dept_mult)
                        d_hi = int(depart_hi * dept_mult)

                        events_seq = [
                            ("arrival",          0),
                            ("wait_start",       random.randint(max(1, w_lo), max(2, w_hi))),
                            ("resource_request",  random.randint(max(2, w_hi), max(3, w_hi + 10))),
                            ("resource_release",  random.randint(max(5, h_lo), max(6, h_hi))),
                            ("wait_end",          random.randint(max(6, h_lo + 2), max(7, h_hi + 5))),
                            ("departure",         random.randint(max(10, d_lo), max(11, d_hi))),
                        ]
                        for evt_type, offset_min in events_seq:
                            db.add(FlowEvent(
                                event_type=evt_type,
                                timestamp=t + timedelta(minutes=offset_min),
                                hospital_id=hospital.id,
                                department_id=dept.id,
                                resource_id=res.id if res else None,
                                patient_id=patient_id,
                                event_metadata={"seeded": True, "profile": profile["type"]},
                            ))
                            total_events += 1
                        t += timedelta(minutes=random.randint(20, 120))

            db.flush()
            print(f"   ✓ {hospital.name}: {total_events:,} events"
                  f"  [profile: {profile['type']}, bottleneck: {profile['bottleneck_dept'] or 'none'}]")

        # ── Final commit ─────────────────────────────────────────────
        db.commit()
        print("\n" + "=" * 60)
        print("✅ SEEDING COMPLETE!")
        print("=" * 60)

        # Summary
        print(f"\n📌 Summary:")
        print(f"   Hospitals:    {db.query(Hospital).count()}")
        print(f"   Departments:  {db.query(Department).count()}")
        print(f"   Resources:    {db.query(Resource).count()}")
        print(f"   Flow Events:  {db.query(FlowEvent).count()}")
        print(f"   Beds:         {db.query(Bed).count()}")
        print(f"   Doctors:      {db.query(Doctor).count()}")
        print(f"   Users:        {db.query(User).count()}")
        print(f"\n🔑 Login credentials:")
        for u in default_users:
            print(f"   {u['username']:12s} / {u['password']:12s}  (role: {u['role']})")

        print(f"\n📊 Hospital profiles:")
        for i, h in enumerate(hospital_objects):
            p = hospital_profiles[i]
            print(f"   {h.name:40s}  {p['type']:25s}  bed_avail={int(p['bed_availability']*100)}%  bottleneck={p['bottleneck_dept'] or 'none'}")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
