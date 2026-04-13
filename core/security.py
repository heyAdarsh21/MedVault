"""
Password hashing and verification for MEDVAULT.

Uses argon2 as primary scheme (argon2-cffi backend).
Also accepts bcrypt hashes for backward compatibility.
"""
import logging

from passlib.context import CryptContext

logger = logging.getLogger(__name__)

pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"],
    default="argon2",
    deprecated=["bcrypt"],
)


def hash_password(password: str) -> str:
    """Hash a plaintext password using argon2."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plaintext password against a hash.
    Accepts both argon2 and bcrypt hashes.
    Returns False on any error (never raises).
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as exc:
        logger.error("Password verification error: %s", exc)
        return False
