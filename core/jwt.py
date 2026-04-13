"""
JWT token creation helper for MEDVAULT.

Uses PyJWT (import jwt) — the same library used by api/v1/auth.py.
"""
import logging
from datetime import datetime, timedelta, timezone

import jwt

from config.settings import settings

logger = logging.getLogger(__name__)


def create_access_token(data: dict) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_access_token_expire_minutes
    )
    to_encode["exp"] = int(expire.timestamp())
    token = jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    logger.debug("JWT created for sub=%s", data.get("sub"))
    return token
