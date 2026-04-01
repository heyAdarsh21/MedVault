"""
Patient self-registration endpoint.
Place at: patient_signup_route.py  (same level as main.py)
Then add to main.py:
    from patient_signup_route import router as patient_signup_router
    app.include_router(patient_signup_router)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

from database.base import get_db
from database.models import User
from database.patient_models import PatientProfile
# Inline auth helpers to avoid import path issues
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import jwt as _jose_jwt
from config.settings import settings as _settings

_pwd = CryptContext(schemes=['argon2'], deprecated='auto')

def hash_password(password: str) -> str:
    return _pwd.hash(password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    to_encode['exp'] = datetime.utcnow() + timedelta(
        minutes=getattr(_settings, 'access_token_expire_minutes',
                getattr(_settings, 'jwt_access_token_expire_minutes', 60))
    )
    secret = getattr(_settings, 'secret_key',
             getattr(_settings, 'jwt_secret_key', 'CHANGE_ME_IN_ENV'))
    return _jose_jwt.encode(to_encode, secret, algorithm='HS256')

router = APIRouter(prefix="/api/v1/public", tags=["Patient Auth"])


class PatientSignupRequest(BaseModel):
    # Auth
    username:       str = Field(..., min_length=3)
    password:       str = Field(..., min_length=6)
    # Personal
    full_name:      str = Field(..., min_length=2)
    date_of_birth:  str                               # YYYY-MM-DD
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
    # Check username taken
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(400, "Username already taken")

    # Create auth user with patient role
    user = User(
        username=payload.username,
        hashed_password=hash_password(payload.password),
        role="patient",
        is_active=1,
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