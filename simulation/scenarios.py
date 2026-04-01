"""Predefined simulation scenarios for MEDVAULT.

These scenarios are intentionally simple – they provide realistic-enough
parameters for stress‑testing the system without encoding real PHI.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional


@dataclass(frozen=True)
class SimulationScenario:
    """Configuration for a simulation run.

    All time units are in **simulation seconds**. How those seconds map to
    wall‑clock time is purely interpretive at the UI layer.
    """

    name: str
    description: str
    duration: int  # total simulation time (env.run(until=...))
    arrival_rate: float  # patients per time unit (Poisson)
    seed: Optional[int] = None


SCENARIOS: Dict[str, SimulationScenario] = {
    "normal_day": SimulationScenario(
        name="normal_day",
        description="Typical weekday with steady but manageable demand.",
        duration=24 * 60 * 60,  # 24h in seconds (conceptually)
        arrival_rate=0.0015,  # ~130 patients/day
        seed=42,
    ),
    "evening_surge": SimulationScenario(
        name="evening_surge",
        description="Evening peak with higher ER arrivals for several hours.",
        duration=12 * 60 * 60,  # 12h window
        arrival_rate=0.003,  # ~130 patients/12h
        seed=7,
    ),
    "mass_casualty": SimulationScenario(
        name="mass_casualty",
        description="Short, intense surge to stress test capacity.",
        duration=4 * 60 * 60,  # 4h window
        arrival_rate=0.01,  # very high rate
        seed=101,
    ),
    "staffing_shortage": SimulationScenario(
        name="staffing_shortage",
        description="Normal arrivals, but effective capacity is constrained.",
        duration=24 * 60 * 60,
        arrival_rate=0.0015,
        seed=202,
    ),
}


def get_scenario(name: str) -> SimulationScenario:
    """Return a scenario by name, raising a helpful KeyError if missing."""
    key = name.strip().lower()
    if key not in SCENARIOS:
        available = ", ".join(sorted(SCENARIOS.keys()))
        raise KeyError(f"Unknown scenario '{name}'. Available: {available}")
    return SCENARIOS[key]

