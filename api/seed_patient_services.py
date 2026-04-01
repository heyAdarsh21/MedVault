"""
Seed beds and doctors for all hospitals.
Run from your backend root: python seed_patient_services.py
"""
import sys, os
from pathlib import Path

# Add backend root to path (same trick as create_tables.py)
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from database.base import Base, engine, SessionLocal
from database.models import Hospital

# Register patient models so tables get created
from database.patient_models import Bed, BedBooking, Doctor, Appointment, AmbulanceRequest

print("Creating patient service tables...")
Base.metadata.create_all(bind=engine)
print("Tables ready.")

db = SessionLocal()

hospitals = db.query(Hospital).all()
if not hospitals:
    print("ERROR: No hospitals found. Run seed_hospitals.py first.")
    sys.exit(1)

print(f"Found {len(hospitals)} hospitals. Seeding...")

WARDS = [
    ("General Ward A",  "general",    10),
    ("General Ward B",  "general",    10),
    ("ICU",             "icu",         4),
    ("Emergency",       "emergency",   6),
    ("Maternity Ward",  "maternity",   5),
    ("Paediatric Ward", "paediatric",  5),
]

DOCTORS = [
    ("Dr. Aisha Kapoor",   "Cardiology",        "MBBS, MD, DM",  "Mon,Tue,Wed,Thu,Fri", "09:00","17:00", 500),
    ("Dr. Rajan Mehta",    "Neurology",         "MBBS, MD, DM",  "Mon,Wed,Fri",         "10:00","16:00", 600),
    ("Dr. Priya Sharma",   "General Medicine",  "MBBS, MD",      "Mon,Tue,Wed,Thu,Fri", "08:00","14:00", 300),
    ("Dr. Suresh Nair",    "Orthopaedics",      "MBBS, MS",      "Tue,Thu,Sat",         "09:00","15:00", 450),
    ("Dr. Fatima Qureshi", "Gynaecology",       "MBBS, MS",      "Mon,Wed,Fri,Sat",     "09:00","16:00", 400),
    ("Dr. Vikram Singh",   "Emergency",         "MBBS, DNB",     "Mon,Tue,Wed,Thu,Fri", "08:00","16:00", 350),
    ("Dr. Meera Iyer",     "Paediatrics",       "MBBS, MD",      "Mon,Tue,Thu,Fri",     "09:00","15:00", 400),
    ("Dr. Arjun Das",      "Dermatology",       "MBBS, DVD",     "Tue,Thu,Sat",         "10:00","17:00", 350),
]

for hospital in hospitals:
    existing = db.query(Bed).filter(Bed.hospital_id == hospital.id).count()
    if existing > 0:
        print(f"  {hospital.name}: already seeded, skipping")
        continue

    # Beds
    for ward_name, bed_type, count in WARDS:
        prefix = bed_type[0].upper()
        for i in range(1, count + 1):
            db.add(Bed(
                hospital_id=hospital.id,
                ward=ward_name,
                bed_number=f"{prefix}-{i:02d}",
                bed_type=bed_type,
                is_available=(i % 3 != 0),  # ~66% available
            ))

    # Doctors
    for (name, spec, qual, days, start, end, fee) in DOCTORS:
        db.add(Doctor(
            hospital_id=hospital.id,
            name=name, specialty=spec, qualification=qual,
            available_days=days, slot_duration_min=15,
            start_time=start, end_time=end,
            max_patients=20, fee=fee,
        ))

    print(f"  Seeded: {hospital.name}")

db.commit()
db.close()
print("All done. Now restart uvicorn.")