"""
Database base configuration for MEDVAULT.

Exports:
  engine       — SQLAlchemy engine (singleton)
  SessionLocal — session factory
  Base         — declarative base for all models
  get_db()     — FastAPI dependency that yields a scoped session
  get_engine() — returns the engine (used by main.py health check)
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from config.settings import settings


# ─────────────────────────────────────────────────────────────────────────────
# Engine
#
# pool_pre_ping=True  : test connections before use; drops stale ones silently.
# pool_size           : persistent connections kept alive (default 5).
# max_overflow        : extra connections allowed above pool_size under load.
# pool_recycle        : force-reconnect after N seconds (avoids "server gone"
#                       errors from PostgreSQL's idle timeout).
# ─────────────────────────────────────────────────────────────────────────────

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,   # 30 minutes
    echo=settings.environment == "development",  # SQL logging in dev only
)

# ─────────────────────────────────────────────────────────────────────────────
# Session factory
# ─────────────────────────────────────────────────────────────────────────────

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# ─────────────────────────────────────────────────────────────────────────────
# Declarative base
# ─────────────────────────────────────────────────────────────────────────────

Base = declarative_base()


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI dependency
# ─────────────────────────────────────────────────────────────────────────────

def get_db():
    """
    Yield a database session for a single request lifecycle.
    Ensures the session is always closed, even on errors.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Engine accessor (used by main.py startup health check)
# ─────────────────────────────────────────────────────────────────────────────

def get_engine():
    """Return the shared SQLAlchemy engine."""
    return engine