"""
One-time script to create all patient service tables in PostgreSQL.
Run from your backend root: python create_patient_tables.py
"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from database.base import Base, engine

# Import ALL models so SQLAlchemy registers them before create_all
import database.models          # hospitals, users, departments, etc.
import database.patient_models  # beds, doctors, appointments, ambulance, patient_profiles

print("Creating patient service tables...")
Base.metadata.create_all(bind=engine)
print("Done. Tables created:")

from sqlalchemy import inspect
inspector = inspect(engine)
for table in sorted(inspector.get_table_names()):
    print(f"  ✓ {table}")