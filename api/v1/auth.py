"""
JWT-based authentication for MEDVAULT API v1 (DATABASE-BACKED).
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated, List

import jwt  # PyJWT
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from config.settings import settings
from database.base import get_db
from database.models import User as DBUser
from domain.schemas import (
    Token,
    TokenPayload,
    User,
    UserRole,
    UserCreate,
)
from core.security import hash_password, verify_password

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

# =========================
# TOKEN CREATION
# =========================

def _create_access_token(user: DBUser) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_access_token_expire_minutes
    )
    payload = {
        "sub": user.username,
        "role": user.role,
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


# =========================
# SIGNUP
# =========================

@router.post("/signup", response_model=Token)
def signup(user_in: UserCreate, db: Session = Depends(get_db)) -> Token:
    logger.info("Signup attempt for username=%s", user_in.username)

    existing = (
        db.query(DBUser)
        .filter(DBUser.username == user_in.username)
        .first()
    )
    if existing:
        logger.warning("Signup failed: username '%s' already exists", user_in.username)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists",
        )

    try:
        user = DBUser(
            username=user_in.username,
            hashed_password=hash_password(user_in.password),
            role=UserRole.VIEWER.value,
            is_active=True,
        )

        db.add(user)
        db.commit()
        db.refresh(user)
        logger.info("User created: id=%s username=%s role=%s", user.id, user.username, user.role)
    except Exception as exc:
        db.rollback()
        logger.error("Signup DB error for username=%s: %s", user_in.username, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {exc}",
        )

    token = _create_access_token(user)
    return Token(access_token=token, token_type="bearer")


# =========================
# LOGIN (OAUTH2 STANDARD)
# =========================

@router.post("/token", response_model=Token)
def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db),
) -> Token:
    logger.info("Login attempt for username=%s", form_data.username)

    user = (
        db.query(DBUser)
        .filter(DBUser.username == form_data.username)
        .first()
    )

    if not user:
        logger.warning("Login failed: user '%s' not found in DB", form_data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials — user not found",
        )

    if not verify_password(form_data.password, user.hashed_password):
        logger.warning("Login failed: wrong password for user '%s'", form_data.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials — wrong password",
        )

    logger.info("Login success: username=%s role=%s", user.username, user.role)
    token = _create_access_token(user)
    return Token(access_token=token, token_type="bearer")


# =========================
# CURRENT USER
# =========================

def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        username: str | None = payload.get("sub")
        role_value: str | None = payload.get("role")
        exp: int | None = payload.get("exp")

        if not username or not role_value or not exp:
            raise credentials_exception

        role = UserRole(role_value)

    except Exception as exc:
        logger.warning("JWT validation failed: %s", exc)
        raise credentials_exception

    return User(username=username, role=role)


# =========================
# ROLE GUARD
# =========================

def require_roles(allowed_roles: List[UserRole]):
    def dependency(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return dependency


# =========================
# /me ENDPOINT
# =========================

@router.get("/me", response_model=User)
def read_users_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    return current_user
