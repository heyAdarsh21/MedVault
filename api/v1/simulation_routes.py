"""
Simulation endpoints for MEDVAULT API v1.

Endpoints:
  POST /simulation/run             — run a simulation and get rich outcome analytics
  POST /simulation/run-scenario    — run a named scenario (normal_day, mass_casualty, etc.)
  GET  /simulation/scenarios       — list all available scenarios

The old route returned a flat 5-field dict.
This version returns a full SimulationRunResponse with an `outcome` object
containing patient counts, wait times, utilization, bottleneck summaries,
and auto-generated English insights.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from api.v1.auth import get_current_user, require_roles
from database.base import get_db
from domain.schemas import (
    SimulationRunResponse,
    User,
    UserRole,
)
from services.simulation_service import SimulationService

router = APIRouter(prefix="/simulation", tags=["simulation"])


def _svc(db: Session = Depends(get_db)) -> SimulationService:
    return SimulationService(db)


# ─────────────────────────────────────────────────────────────────────────────
# Run simulation (manual parameters)
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/run",
    response_model=SimulationRunResponse,
    summary="Run a discrete-event patient flow simulation",
    description=(
        "Runs a SimPy simulation for the specified hospital. "
        "Generates FlowEvent records in the database, then immediately "
        "analyses them to return outcome metrics: patient count, avg wait time, "
        "peak utilization, bottleneck summary, capacity summary, and insights. "
        "Requires Analyst or Admin role."
    ),
)
def run_simulation(
    hospital_id: int = Query(..., description="Target hospital ID"),
    duration: int = Query(
        1000,
        ge=1,
        le=86400,
        description="Simulation duration in time units (see scenarios for real-world mapping)",
    ),
    arrival_rate: float = Query(
        0.1,
        gt=0.0,
        le=10.0,
        description="Mean patient arrival rate (Poisson). Higher = more patients.",
    ),
    seed: Optional[int] = Query(
        None,
        description="Optional random seed for reproducible runs.",
    ),
    svc: SimulationService = Depends(_svc),
    current_user: User = Depends(get_current_user),
) -> SimulationRunResponse:
    try:
        return svc.run_simulation(
            hospital_id=hospital_id,
            duration=duration,
            arrival_rate=arrival_rate,
            seed=seed,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Simulation failed: {str(e)}",
        )


# ─────────────────────────────────────────────────────────────────────────────
# Run named scenario
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/run-scenario",
    response_model=SimulationRunResponse,
    summary="Run a predefined simulation scenario",
    description=(
        "Runs one of the predefined scenarios (normal_day, evening_surge, "
        "mass_casualty, staffing_shortage). Scenario parameters are preset but "
        "can be individually overridden. Requires Analyst or Admin role."
    ),
)
def run_scenario(
    hospital_id: int = Query(..., description="Target hospital ID"),
    scenario_name: str = Query(
        ...,
        description=(
            "Scenario name. Available: normal_day, evening_surge, "
            "mass_casualty, staffing_shortage."
        ),
    ),
    duration: Optional[int] = Query(
        None,
        ge=1,
        description="Override scenario duration.",
    ),
    arrival_rate: Optional[float] = Query(
        None,
        gt=0.0,
        description="Override scenario arrival rate.",
    ),
    seed: Optional[int] = Query(
        None,
        description="Override scenario seed.",
    ),
    svc: SimulationService = Depends(_svc),
    current_user: User = Depends(get_current_user),
) -> SimulationRunResponse:
    try:
        return svc.run_simulation(
            hospital_id=hospital_id,
            scenario_name=scenario_name,
            duration=duration,
            arrival_rate=arrival_rate,
            seed=seed,
        )
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),  # "Unknown scenario 'X'. Available: ..."
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scenario simulation failed: {str(e)}",
        )


# ─────────────────────────────────────────────────────────────────────────────
# List scenarios
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/scenarios",
    response_model=Dict[str, Any],
    summary="List available simulation scenarios",
    description=(
        "Returns all predefined scenarios with their parameters: "
        "duration, arrival_rate, seed, and description."
    ),
)
def list_scenarios(
    svc: SimulationService = Depends(_svc),
) -> Dict[str, Any]:
    return svc.list_scenarios()