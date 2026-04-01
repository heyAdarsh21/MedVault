"""
Public patient services API — no authentication required.
Prefix: /api/v1/public/services

Endpoints:
  GET  /beds?hospital_id=              List available beds
  POST /beds/book                      Book a bed
  GET  /doctors?hospital_id=           List doctors at hospital
  GET  /doctors/{doctor_id}/slots      Available appointment slots for a date
  POST /appointments/book              Book an appointment
  POST /ambulance/request              Request an ambulance
  GET  /booking/{reference}            Check any booking status
"""
from __future__ import annotations

import random
from datetime import datetime, date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database.base import get_db
from database.patient_models import (
    Bed, BedBooking, Doctor, Appointment, AmbulanceRequest
)
from domain.patient_schemas import (
    BedOut, BedBookingCreate, BedBookingOut,
    DoctorOut, TimeSlot,
    AppointmentCreate, AppointmentOut,
    AmbulanceRequestCreate, AmbulanceRequestOut,
    BookingStatusOut,
)

router = APIRouter(prefix="/api/v1/public/services", tags=["Patient Services"])


# ─────────────────────────────────────────────────────────────────────────────
# BEDS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/beds", response_model=List[BedOut], summary="List available beds")
def list_available_beds(
    hospital_id: int = Query(..., description="Hospital ID"),
    bed_type: Optional[str] = Query(None, description="Filter by type: general|icu|emergency|maternity|paediatric"),
    db: Session = Depends(get_db),
):
    q = db.query(Bed).filter(Bed.hospital_id == hospital_id, Bed.is_available == True)
    if bed_type:
        q = q.filter(Bed.bed_type == bed_type)
    return q.all()


@router.post("/beds/book", response_model=BedBookingOut, summary="Book a bed")
def book_bed(payload: BedBookingCreate, db: Session = Depends(get_db)):
    bed = db.query(Bed).filter(Bed.id == payload.bed_id, Bed.is_available == True).first()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found or already occupied")

    # Mark bed unavailable
    bed.is_available = False

    booking = BedBooking(
        bed_id=payload.bed_id,
        hospital_id=payload.hospital_id,
        patient_name=payload.patient_name,
        patient_phone=payload.patient_phone,
        patient_age=payload.patient_age,
        reason=payload.reason,
        status="confirmed",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


# ─────────────────────────────────────────────────────────────────────────────
# DOCTORS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/doctors", response_model=List[DoctorOut], summary="List doctors at a hospital")
def list_doctors(
    hospital_id: int = Query(...),
    specialty: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Doctor).filter(Doctor.hospital_id == hospital_id)
    if specialty:
        q = q.filter(Doctor.specialty.ilike(f"%{specialty}%"))
    return q.all()


@router.get("/doctors/{doctor_id}/slots", response_model=List[TimeSlot], summary="Available slots")
def get_slots(
    doctor_id: int,
    date_str: str = Query(..., alias="date", description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    # Check day availability
    try:
        appt_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    if appt_date < date.today():
        raise HTTPException(status_code=400, detail="Cannot book slots in the past")

    day_name = appt_date.strftime("%a")  # Mon, Tue, etc.
    available_days = [d.strip() for d in doctor.available_days.split(",")]
    if day_name not in available_days:
        return []  # Doctor not available this day

    # Generate slots
    booked_times = {
        a.appointment_time
        for a in db.query(Appointment).filter(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date == date_str,
            Appointment.status != "cancelled",
        ).all()
    }

    slots: List[TimeSlot] = []
    start_h, start_m = map(int, doctor.start_time.split(":"))
    end_h, end_m     = map(int, doctor.end_time.split(":"))
    current = datetime(2000, 1, 1, start_h, start_m)
    end     = datetime(2000, 1, 1, end_h, end_m)
    delta   = timedelta(minutes=doctor.slot_duration_min)

    while current < end:
        t = current.strftime("%H:%M")
        slots.append(TimeSlot(time=t, available=t not in booked_times))
        current += delta

    return slots


# ─────────────────────────────────────────────────────────────────────────────
# APPOINTMENTS
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/appointments/book", response_model=AppointmentOut, summary="Book appointment")
def book_appointment(payload: AppointmentCreate, db: Session = Depends(get_db)):
    doctor = db.query(Doctor).filter(Doctor.id == payload.doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    # Check slot not already taken
    conflict = db.query(Appointment).filter(
        Appointment.doctor_id == payload.doctor_id,
        Appointment.appointment_date == payload.appointment_date,
        Appointment.appointment_time == payload.appointment_time,
        Appointment.status != "cancelled",
    ).first()
    if conflict:
        raise HTTPException(status_code=409, detail="This time slot is already booked")

    appt = Appointment(
        doctor_id=payload.doctor_id,
        hospital_id=payload.hospital_id,
        patient_name=payload.patient_name,
        patient_phone=payload.patient_phone,
        patient_age=payload.patient_age,
        symptoms=payload.symptoms,
        appointment_date=payload.appointment_date,
        appointment_time=payload.appointment_time,
        status="confirmed",
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return appt


# ─────────────────────────────────────────────────────────────────────────────
# AMBULANCE
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/ambulance/request", response_model=AmbulanceRequestOut, summary="Request ambulance")
def request_ambulance(payload: AmbulanceRequestCreate, db: Session = Depends(get_db)):
    eta = random.randint(8, 20) if payload.priority == "critical" else random.randint(15, 35)

    req = AmbulanceRequest(
        hospital_id=payload.hospital_id,
        patient_name=payload.patient_name,
        patient_phone=payload.patient_phone,
        pickup_address=payload.pickup_address,
        emergency_type=payload.emergency_type,
        priority=payload.priority,
        notes=payload.notes,
        status="dispatched",
        eta_minutes=eta,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


# ─────────────────────────────────────────────────────────────────────────────
# BOOKING STATUS LOOKUP
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/booking/{reference}", response_model=BookingStatusOut, summary="Check booking status")
def get_booking_status(reference: str, db: Session = Depends(get_db)):
    ref = reference.upper()

    bed_booking = db.query(BedBooking).filter(BedBooking.reference == ref).first()
    if bed_booking:
        return BookingStatusOut(
            reference=ref, type="bed",
            status=bed_booking.status,
            patient_name=bed_booking.patient_name,
            detail={"reason": bed_booking.reason, "booked_at": str(bed_booking.booked_at)},
        )

    appt = db.query(Appointment).filter(Appointment.reference == ref).first()
    if appt:
        return BookingStatusOut(
            reference=ref, type="appointment",
            status=appt.status,
            patient_name=appt.patient_name,
            detail={"date": appt.appointment_date, "time": appt.appointment_time, "symptoms": appt.symptoms},
        )

    amb = db.query(AmbulanceRequest).filter(AmbulanceRequest.reference == ref).first()
    if amb:
        return BookingStatusOut(
            reference=ref, type="ambulance",
            status=amb.status,
            patient_name=amb.patient_name,
            detail={"eta_minutes": amb.eta_minutes, "priority": amb.priority, "address": amb.pickup_address},
        )

    raise HTTPException(status_code=404, detail="Booking reference not found")