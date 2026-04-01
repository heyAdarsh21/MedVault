"""Script to initialize sample data for MEDVAULT."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from database.base import SessionLocal
from database.models import Hospital, Department, Resource

def init_sample_data():
    """Create sample hospitals, departments, and resources."""
    db = SessionLocal()
    
    try:
        # Create sample hospital
        hospital = Hospital(
            name="City General Hospital",
            location="Downtown",
            capacity=500
        )
        db.add(hospital)
        db.commit()
        db.refresh(hospital)
        
        print(f"Created hospital: {hospital.name} (ID: {hospital.id})")
        
        # Create departments
        er_dept = Department(
            name="Emergency Room",
            hospital_id=hospital.id,
            capacity=50
        )
        db.add(er_dept)
        
        icu_dept = Department(
            name="Intensive Care Unit",
            hospital_id=hospital.id,
            capacity=20
        )
        db.add(icu_dept)
        
        ward_dept = Department(
            name="General Ward",
            hospital_id=hospital.id,
            capacity=100
        )
        db.add(ward_dept)
        
        db.commit()
        
        # Refresh to get IDs
        db.refresh(er_dept)
        db.refresh(icu_dept)
        db.refresh(ward_dept)
        
        print(f"Created departments: ER (ID: {er_dept.id}), ICU (ID: {icu_dept.id}), Ward (ID: {ward_dept.id})")
        
        # Create resources for ER
        er_bed = Resource(
            name="ER Bed",
            department_id=er_dept.id,
            capacity=30,
            resource_type="bed"
        )
        db.add(er_bed)
        
        er_equipment = Resource(
            name="ER Equipment",
            department_id=er_dept.id,
            capacity=10,
            resource_type="equipment"
        )
        db.add(er_equipment)
        
        er_staff = Resource(
            name="ER Staff",
            department_id=er_dept.id,
            capacity=15,
            resource_type="staff"
        )
        db.add(er_staff)
        
        # Create resources for ICU
        icu_bed = Resource(
            name="ICU Bed",
            department_id=icu_dept.id,
            capacity=15,
            resource_type="bed"
        )
        db.add(icu_bed)
        
        icu_equipment = Resource(
            name="ICU Equipment",
            department_id=icu_dept.id,
            capacity=8,
            resource_type="equipment"
        )
        db.add(icu_equipment)
        
        icu_staff = Resource(
            name="ICU Staff",
            department_id=icu_dept.id,
            capacity=10,
            resource_type="staff"
        )
        db.add(icu_staff)
        
        # Create resources for Ward
        ward_bed = Resource(
            name="Ward Bed",
            department_id=ward_dept.id,
            capacity=80,
            resource_type="bed"
        )
        db.add(ward_bed)
        
        ward_staff = Resource(
            name="Ward Staff",
            department_id=ward_dept.id,
            capacity=25,
            resource_type="staff"
        )
        db.add(ward_staff)
        
        db.commit()
        
        print("Sample data initialized successfully!")
        print(f"\nHospital ID: {hospital.id}")
        print("You can now run simulations using this hospital.")
        
    except Exception as e:
        db.rollback()
        print(f"Error initializing sample data: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_sample_data()
