"""
Patient services models — add to database/models.py (append to end of file)
OR keep as a separate file: database/patient_models.py
"""
import uuid
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.base import Base


def _ref():
    return uuid.uuid4().hex[:8].upper()


class Bed(Base):
    __tablename__ = "beds"

    id           = Column(Integer, primary_key=True, index=True)
    hospital_id  = Column(Integer, ForeignKey("hospitals.id"), nullable=False, index=True)
    ward         = Column(String(120), nullable=False)
    bed_number   = Column(String(20),  nullable=False)
    bed_type     = Column(SAEnum("general","icu","emergency","maternity","paediatric", name="bed_type_enum"), nullable=False, default="general")
    is_available = Column(Boolean, default=True, nullable=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    bookings = relationship("BedBooking", back_populates="bed")


class BedBooking(Base):
    __tablename__ = "bed_bookings"

    id             = Column(Integer, primary_key=True, index=True)
    reference      = Column(String(8), unique=True, nullable=False, default=_ref)
    bed_id         = Column(Integer, ForeignKey("beds.id"), nullable=False)
    hospital_id    = Column(Integer, ForeignKey("hospitals.id"), nullable=False, index=True)
    patient_name   = Column(String(200), nullable=False)
    patient_phone  = Column(String(20),  nullable=False)
    patient_age    = Column(Integer, nullable=True)
    reason         = Column(Text, nullable=True)
    status         = Column(SAEnum("pending","confirmed","cancelled", name="bed_booking_status_enum"), default="confirmed", nullable=False)
    booked_at      = Column(DateTime(timezone=True), server_default=func.now())

    bed = relationship("Bed", back_populates="bookings")


class Doctor(Base):
    __tablename__ = "doctors"

    id                = Column(Integer, primary_key=True, index=True)
    hospital_id       = Column(Integer, ForeignKey("hospitals.id"), nullable=False, index=True)
    name              = Column(String(200), nullable=False)
    specialty         = Column(String(120), nullable=False)
    qualification     = Column(String(120), nullable=True)
    available_days    = Column(String(100), nullable=False)   # "Mon,Tue,Wed"
    slot_duration_min = Column(Integer, default=15)
    start_time        = Column(String(5),  default="09:00")
    end_time          = Column(String(5),  default="17:00")
    max_patients      = Column(Integer, default=20)
    fee               = Column(Float,   default=0.0)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    appointments = relationship("Appointment", back_populates="doctor")


class Appointment(Base):
    __tablename__ = "appointments"

    id               = Column(Integer, primary_key=True, index=True)
    reference        = Column(String(8), unique=True, nullable=False, default=_ref)
    doctor_id        = Column(Integer, ForeignKey("doctors.id"), nullable=False)
    hospital_id      = Column(Integer, ForeignKey("hospitals.id"), nullable=False, index=True)
    patient_name     = Column(String(200), nullable=False)
    patient_phone    = Column(String(20),  nullable=False)
    patient_age      = Column(Integer, nullable=True)
    symptoms         = Column(Text, nullable=True)
    appointment_date = Column(String(10), nullable=False)
    appointment_time = Column(String(5),  nullable=False)
    status           = Column(SAEnum("pending","confirmed","cancelled","completed", name="appt_status_enum"), default="confirmed", nullable=False)
    booked_at        = Column(DateTime(timezone=True), server_default=func.now())

    doctor = relationship("Doctor", back_populates="appointments")


class AmbulanceRequest(Base):
    __tablename__ = "ambulance_requests"

    id             = Column(Integer, primary_key=True, index=True)
    reference      = Column(String(8), unique=True, nullable=False, default=_ref)
    hospital_id    = Column(Integer, ForeignKey("hospitals.id"), nullable=False, index=True)
    patient_name   = Column(String(200), nullable=False)
    patient_phone  = Column(String(20),  nullable=False)
    pickup_address = Column(Text, nullable=False)
    emergency_type = Column(SAEnum("medical","trauma","cardiac","maternity","other", name="emergency_type_enum"), default="medical", nullable=False)
    priority       = Column(SAEnum("critical","high","normal", name="ambulance_priority_enum"), default="high", nullable=False)
    notes          = Column(Text, nullable=True)
    status         = Column(SAEnum("dispatched","en_route","arrived","cancelled", name="ambulance_status_enum"), default="dispatched", nullable=False)
    eta_minutes    = Column(Integer, nullable=True)
    requested_at   = Column(DateTime(timezone=True), server_default=func.now())


class PatientProfile(Base):
    """Extended patient profile linked to auth User."""
    __tablename__ = "patient_profiles"

    id                   = Column(Integer, primary_key=True, index=True)
    user_id              = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    full_name            = Column(String(200), nullable=False)
    date_of_birth        = Column(String(10), nullable=True)   # YYYY-MM-DD
    gender               = Column(String(20), nullable=True)
    blood_group          = Column(String(5),  nullable=True)
    phone                = Column(String(20), nullable=False)
    email                = Column(String(200), nullable=True)
    address              = Column(Text, nullable=True)
    emergency_name       = Column(String(200), nullable=True)
    emergency_phone      = Column(String(20),  nullable=True)
    emergency_relation   = Column(String(100), nullable=True)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())