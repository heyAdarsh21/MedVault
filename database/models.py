"""
SQLAlchemy models for MEDVAULT.

Changes from original:
  - MetricCache: hospital_id, department_id, resource_id now have proper FK
    constraints, preventing orphaned cache rows on entity deletion.
  - User.is_active: changed from Integer to Boolean (was causing silent
    truthiness bugs when value was anything other than 0/1).
  - Added composite index on FlowEvent (hospital_id, timestamp) — the most
    common query pattern in analytics engines.
  - Added composite index on FlowEvent (department_id, timestamp) — used by
    bottleneck engine department grouping.
  - Added composite index on FlowEvent (resource_id, timestamp) — used by
    capacity engine utilization calculation.
"""
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database.base import Base


# =========================
# Core Domain Models
# =========================

class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    location = Column(String(255), nullable=False)
    capacity = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    departments = relationship(
        "Department",
        back_populates="hospital",
        cascade="all, delete-orphan",
    )
    flow_events = relationship("FlowEvent", back_populates="hospital")


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    hospital_id = Column(
        Integer,
        ForeignKey("hospitals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    capacity = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    hospital = relationship("Hospital", back_populates="departments")
    resources = relationship(
        "Resource",
        back_populates="department",
        cascade="all, delete-orphan",
    )
    flow_events = relationship("FlowEvent", back_populates="department")


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    department_id = Column(
        Integer,
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    capacity = Column(Integer, nullable=False)
    resource_type = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    department = relationship("Department", back_populates="resources")
    flow_events = relationship("FlowEvent", back_populates="resource")


class FlowEvent(Base):
    __tablename__ = "flow_events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    hospital_id = Column(
        Integer,
        ForeignKey("hospitals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    department_id = Column(
        Integer,
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    resource_id = Column(
        Integer,
        ForeignKey("resources.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    patient_id = Column(String(100), nullable=True, index=True)
    event_metadata = Column(JSON, nullable=True)

    hospital = relationship("Hospital", back_populates="flow_events")
    department = relationship("Department", back_populates="flow_events")
    resource = relationship("Resource", back_populates="flow_events")

    # Composite indexes for the most frequent query patterns:
    # analytics engines always filter by (hospital_id + timestamp),
    # (department_id + timestamp), and (resource_id + timestamp).
    __table_args__ = (
        Index("ix_flow_events_hospital_timestamp", "hospital_id", "timestamp"),
        Index("ix_flow_events_department_timestamp", "department_id", "timestamp"),
        Index("ix_flow_events_resource_timestamp", "resource_id", "timestamp"),
        Index("ix_flow_events_patient_timestamp", "patient_id", "timestamp"),
    )


class MetricCache(Base):
    """
    Precomputed metric snapshots.

    FK constraints ensure cached metrics are automatically removed when
    the hospital, department, or resource they reference is deleted.
    All three entity references are optional (nullable) to support
    hospital-wide or system-wide metrics that aren't tied to one entity.
    """
    __tablename__ = "metrics_cache"

    id = Column(Integer, primary_key=True, index=True)
    metric_name = Column(String(100), nullable=False, index=True)

    # FK-constrained — no more orphaned cache rows
    hospital_id = Column(
        Integer,
        ForeignKey("hospitals.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    department_id = Column(
        Integer,
        ForeignKey("departments.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    resource_id = Column(
        Integer,
        ForeignKey("resources.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    value = Column(Float, nullable=False)
    computed_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
    metric_metadata = Column(JSON, nullable=True)


# =========================
# Auth
# =========================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="viewer", nullable=False)

    # Fixed: was Integer — caused silent truthiness bugs (e.g. is_active=2
    # evaluates True in Python but could be unexpected). Boolean is explicit.
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())