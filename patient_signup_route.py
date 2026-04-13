"""
Patient self-registration endpoint.
Place at: patient_signup_route.py  (same level as main.py)
Then add to main.py:
    from patient_signup_route import router as patient_signup_router
    app.include_router(patient_signup_router)
"""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from database.base import get_db
from database.models import User
from database.patient_models import PatientProfile
from core.security import hash_password
from core.jwt import create_access_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/public", tags=["Patient Auth"])


class PatientSignupRequest(BaseModel):
    # Auth
    username:       str = Field(..., min_length=3)
    password:       str = Field(..., min_length=6)
    # Personal
    full_name:      str = Field(..., min_length=2)
    date_of_birth:  Optional[str] = None              # YYYY-MM-DD (optional)
    gender:         str                               # male/female/other
    blood_group:    Optional[str] = None              # A+, B-, etc.
    phone:          str = Field(..., min_length=7)
    email:          Optional[str] = None
    address:        Optional[str] = None
    # Emergency
    emergency_name:  Optional[str] = None
    emergency_phone: Optional[str] = None
    emergency_relation: Optional[str] = None


class PatientSignupResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    role:         str = "patient"
    full_name:    str
    username:     str


@router.post("/patient/register", response_model=PatientSignupResponse)
def register_patient(payload: PatientSignupRequest, db: Session = Depends(get_db)):
    logger.info("Patient registration attempt: username=%s", payload.username)

    # Check username taken
    if db.query(User).filter(User.username == payload.username).first():
        logger.warning("Patient registration failed: username '%s' already taken", payload.username)
        raise HTTPException(400, "Username already taken")

    try:
        # Create auth user with patient role
        user = User(
            username=payload.username,
            hashed_password=hash_password(payload.password),
            role="patient",
            is_active=True,
        )
        db.add(user)
        db.flush()  # get user.id

        # Create patient profile
        profile = PatientProfile(
            user_id=user.id,
            full_name=payload.full_name,
            date_of_birth=payload.date_of_birth,
            gender=payload.gender,
            blood_group=payload.blood_group,
            phone=payload.phone,
            email=payload.email,
            address=payload.address,
            emergency_name=payload.emergency_name,
            emergency_phone=payload.emergency_phone,
            emergency_relation=payload.emergency_relation,
        )
        db.add(profile)
        db.commit()
        logger.info("Patient registered: user_id=%s username=%s", user.id, user.username)
    except Exception as exc:
        db.rollback()
        logger.error("Patient registration DB error: %s", exc, exc_info=True)
        raise HTTPException(500, f"Registration failed: {exc}")

    token = create_access_token({"sub": user.username, "role": "patient"})
    return PatientSignupResponse(
        access_token=token,
        role="patient",
        full_name=payload.full_name,
        username=user.username,
    )


@router.get("/patient/profile")
def get_patient_profile(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username, User.role == "patient").first()
    if not user:
        raise HTTPException(404, "Patient not found")
    profile = db.query(PatientProfile).filter(PatientProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(404, "Profile not found")
    return {
        "username": user.username,
        "full_name": profile.full_name,
        "date_of_birth": profile.date_of_birth,
        "gender": profile.gender,
        "blood_group": profile.blood_group,
        "phone": profile.phone,
        "email": profile.email,
        "address": profile.address,
        "emergency_name": profile.emergency_name,
        "emergency_phone": profile.emergency_phone,
        "emergency_relation": profile.emergency_relation,
    }