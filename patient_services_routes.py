"""
Public patient services — no auth required.
Place at: patient_services_routes.py  (same level as main.py)
"""
from __future__ import annotations
import random
from datetime import datetime, date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from database.base import get_db
from database.patient_models import Bed, BedBooking, Doctor, Appointment, AmbulanceRequest
from database.models import Hospital

router = APIRouter(prefix="/api/v1/public/services", tags=["Patient Services"])


# ── Inline Pydantic schemas (avoids separate file/import issues) ──────────────

class BedOut(BaseModel):
    id: int; ward: str; bed_number: str; bed_type: str; is_available: bool
    class Config: from_attributes = True

class BedBookingCreate(BaseModel):
    bed_id: int; hospital_id: int
    patient_name: str = Field(..., min_length=2)
    patient_phone: str = Field(..., min_length=7)
    patient_age: Optional[int] = None
    reason: Optional[str] = None

class BedBookingOut(BaseModel):
    reference: str; bed_id: int; patient_name: str; status: str; booked_at: datetime
    class Config: from_attributes = True

class DoctorOut(BaseModel):
    id: int; name: str; specialty: str; qualification: Optional[str]
    available_days: str; start_time: str; end_time: str
    fee: float; slot_duration_min: int
    class Config: from_attributes = True

class TimeSlot(BaseModel):
    time: str; available: bool

class AppointmentCreate(BaseModel):
    doctor_id: int; hospital_id: int
    patient_name: str  = Field(..., min_length=2)
    patient_phone: str = Field(..., min_length=7)
    patient_age: Optional[int] = None
    symptoms: Optional[str] = None
    appointment_date: str
    appointment_time: str

class AppointmentOut(BaseModel):
    reference: str; doctor_id: int; patient_name: str
    appointment_date: str; appointment_time: str; status: str; booked_at: datetime
    class Config: from_attributes = True

class AmbulanceCreate(BaseModel):
    hospital_id: int
    patient_name: str  = Field(..., min_length=2)
    patient_phone: str = Field(..., min_length=7)
    pickup_address: str = Field(..., min_length=5)
    emergency_type: str = "medical"
    priority: str = "high"
    notes: Optional[str] = None

class AmbulanceOut(BaseModel):
    reference: str; patient_name: str; pickup_address: str
    emergency_type: str; priority: str; status: str
    eta_minutes: Optional[int]; requested_at: datetime
    class Config: from_attributes = True

class BookingStatusOut(BaseModel):
    reference: str; type: str; status: str; patient_name: str; detail: dict


# ── BEDS ──────────────────────────────────────────────────────────────────────

@router.get("/beds", response_model=List[BedOut])
def list_available_beds(
    hospital_id: int = Query(...),
    bed_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Bed).filter(Bed.hospital_id == hospital_id, Bed.is_available == True)
    if bed_type:
        q = q.filter(Bed.bed_type == bed_type)
    return q.all()


@router.post("/beds/book", response_model=BedBookingOut)
def book_bed(payload: BedBookingCreate, db: Session = Depends(get_db)):
    bed = db.query(Bed).filter(Bed.id == payload.bed_id, Bed.is_available == True).first()
    if not bed:
        raise HTTPException(404, "Bed not found or already occupied")
    bed.is_available = False
    booking = BedBooking(
        bed_id=payload.bed_id, hospital_id=payload.hospital_id,
        patient_name=payload.patient_name, patient_phone=payload.patient_phone,
        patient_age=payload.patient_age, reason=payload.reason, status="confirmed",
    )
    db.add(booking); db.commit(); db.refresh(booking)
    return booking


# ── DOCTORS ───────────────────────────────────────────────────────────────────

@router.get("/doctors", response_model=List[DoctorOut])
def list_doctors(
    hospital_id: int = Query(...),
    specialty: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Doctor).filter(Doctor.hospital_id == hospital_id)
    if specialty:
        q = q.filter(Doctor.specialty.ilike(f"%{specialty}%"))
    return q.all()


@router.get("/doctors/{doctor_id}/slots", response_model=List[TimeSlot])
def get_slots(
    doctor_id: int,
    date: str = Query(..., description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(404, "Doctor not found")
    try:
        appt_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Invalid date. Use YYYY-MM-DD")
    if appt_date < datetime.today().date():
        raise HTTPException(400, "Cannot book past dates")

    day_name = appt_date.strftime("%a")
    if day_name not in [d.strip() for d in doctor.available_days.split(",")]:
        return []

    booked = {
        a.appointment_time
        for a in db.query(Appointment).filter(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date == date,
            Appointment.status != "cancelled",
        ).all()
    }

    slots, current = [], datetime(2000, 1, 1, *map(int, doctor.start_time.split(":")))
    end   = datetime(2000, 1, 1, *map(int, doctor.end_time.split(":")))
    delta = timedelta(minutes=doctor.slot_duration_min)
    while current < end:
        t = current.strftime("%H:%M")
        slots.append(TimeSlot(time=t, available=t not in booked))
        current += delta
    return slots


# ── APPOINTMENTS ──────────────────────────────────────────────────────────────

@router.post("/appointments/book", response_model=AppointmentOut)
def book_appointment(payload: AppointmentCreate, db: Session = Depends(get_db)):
    if not db.query(Doctor).filter(Doctor.id == payload.doctor_id).first():
        raise HTTPException(404, "Doctor not found")
    conflict = db.query(Appointment).filter(
        Appointment.doctor_id == payload.doctor_id,
        Appointment.appointment_date == payload.appointment_date,
        Appointment.appointment_time == payload.appointment_time,
        Appointment.status != "cancelled",
    ).first()
    if conflict:
        raise HTTPException(409, "Time slot already booked")
    appt = Appointment(
        doctor_id=payload.doctor_id, hospital_id=payload.hospital_id,
        patient_name=payload.patient_name, patient_phone=payload.patient_phone,
        patient_age=payload.patient_age, symptoms=payload.symptoms,
        appointment_date=payload.appointment_date, appointment_time=payload.appointment_time,
        status="confirmed",
    )
    db.add(appt); db.commit(); db.refresh(appt)
    return appt


# ── AMBULANCE ─────────────────────────────────────────────────────────────────

@router.post("/ambulance/request", response_model=AmbulanceOut)
def request_ambulance(payload: AmbulanceCreate, db: Session = Depends(get_db)):
    eta = random.randint(5, 15) if payload.priority == "critical" else random.randint(15, 30)
    req = AmbulanceRequest(
        hospital_id=payload.hospital_id,
        patient_name=payload.patient_name, patient_phone=payload.patient_phone,
        pickup_address=payload.pickup_address, emergency_type=payload.emergency_type,
        priority=payload.priority, notes=payload.notes,
        status="dispatched", eta_minutes=eta,
    )
    db.add(req); db.commit(); db.refresh(req)
    return req


# ── STATUS LOOKUP ─────────────────────────────────────────────────────────────

@router.get("/booking/{reference}", response_model=BookingStatusOut)
def get_booking_status(reference: str, db: Session = Depends(get_db)):
    ref = reference.upper()
    b = db.query(BedBooking).filter(BedBooking.reference == ref).first()
    if b:
        return BookingStatusOut(reference=ref, type="bed", status=b.status,
            patient_name=b.patient_name, detail={"reason": b.reason, "booked_at": str(b.booked_at)})
    a = db.query(Appointment).filter(Appointment.reference == ref).first()
    if a:
        return BookingStatusOut(reference=ref, type="appointment", status=a.status,
            patient_name=a.patient_name, detail={"date": a.appointment_date, "time": a.appointment_time})
    am = db.query(AmbulanceRequest).filter(AmbulanceRequest.reference == ref).first()
    if am:
        return BookingStatusOut(reference=ref, type="ambulance", status=am.status,
            patient_name=am.patient_name, detail={"eta_minutes": am.eta_minutes, "priority": am.priority})
    raise HTTPException(404, "Reference not found")