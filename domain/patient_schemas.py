"""
Pydantic schemas for patient services.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


# ── Beds ─────────────────────────────────────────────────────────────────────

class BedOut(BaseModel):
    id:           int
    ward:         str
    bed_number:   str
    bed_type:     str
    is_available: bool

    class Config:
        from_attributes = True


class BedBookingCreate(BaseModel):
    bed_id:         int
    hospital_id:    int
    patient_name:   str = Field(..., min_length=2)
    patient_phone:  str = Field(..., min_length=7)
    patient_age:    Optional[int] = None
    reason:         Optional[str] = None


class BedBookingOut(BaseModel):
    reference:    str
    bed_id:       int
    patient_name: str
    status:       str
    booked_at:    datetime

    class Config:
        from_attributes = True


# ── Doctors ───────────────────────────────────────────────────────────────────

class DoctorOut(BaseModel):
    id:             int
    name:           str
    specialty:      str
    qualification:  Optional[str]
    available_days: str
    start_time:     str
    end_time:       str
    fee:            float
    slot_duration_min: int

    class Config:
        from_attributes = True


class TimeSlot(BaseModel):
    time:      str       # HH:MM
    available: bool


class AppointmentCreate(BaseModel):
    doctor_id:        int
    hospital_id:      int
    patient_name:     str = Field(..., min_length=2)
    patient_phone:    str = Field(..., min_length=7)
    patient_age:      Optional[int] = None
    symptoms:         Optional[str] = None
    appointment_date: str           # YYYY-MM-DD
    appointment_time: str           # HH:MM


class AppointmentOut(BaseModel):
    reference:        str
    doctor_id:        int
    patient_name:     str
    appointment_date: str
    appointment_time: str
    status:           str
    booked_at:        datetime

    class Config:
        from_attributes = True


# ── Ambulance ─────────────────────────────────────────────────────────────────

class AmbulanceRequestCreate(BaseModel):
    hospital_id:    int
    patient_name:   str = Field(..., min_length=2)
    patient_phone:  str = Field(..., min_length=7)
    pickup_address: str = Field(..., min_length=5)
    emergency_type: str = "medical"
    priority:       str = "high"
    notes:          Optional[str] = None


class AmbulanceRequestOut(BaseModel):
    reference:      str
    patient_name:   str
    pickup_address: str
    emergency_type: str
    priority:       str
    status:         str
    eta_minutes:    Optional[int]
    requested_at:   datetime

    class Config:
        from_attributes = True


# ── Booking Status ────────────────────────────────────────────────────────────

class BookingStatusOut(BaseModel):
    reference:   str
    type:        str   # "bed" | "appointment" | "ambulance"
    status:      str
    patient_name:str
    detail:      dict