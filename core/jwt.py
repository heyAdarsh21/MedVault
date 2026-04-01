from datetime import datetime, timedelta
from jose import jwt
from config.settings import settings

ALGORITHM = "HS256"


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    to_encode["exp"] = expire
    return jwt.encode(
        to_encode,
        settings.secret_key,
        algorithm=ALGORITHM
    )
