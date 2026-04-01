"""Patient path and timing logic for the MEDVAULT simulation.

This module does **not** talk to the database directly – it only reasons
about department structure and returns decisions that the scheduler uses.
"""
from __future__ import annotations

import random
from typing import Dict, Iterable, List

from database.models import Department


def determine_patient_path(departments: Iterable[Department]) -> List[Dict]:
    """Return an ordered list of departments a patient will visit.

    Simple baseline logic:
    - All patients go through ER‑like entry (ER/Emergency or first dept).
    - 30% route via ICU if present.
    - Most end up in a general/ward‑like unit before discharge.
    """
    departments = list(departments)
    if not departments:
        return []

    er_dept = next(
        (d for d in departments if "ER" in d.name.upper() or "EMERGENCY" in d.name.upper()),
        None,
    )
    if not er_dept:
        er_dept = departments[0]

    path: List[Dict] = [{"id": er_dept.id, "name": er_dept.name}]

    # ICU branch
    if random.random() < 0.3:
        icu_dept = next((d for d in departments if "ICU" in d.name.upper()), None)
        if icu_dept:
            path.append({"id": icu_dept.id, "name": icu_dept.name})

    # Ward/general step
    ward_dept = next(
        (
            d
            for d in departments
            if "WARD" in d.name.upper() or "GENERAL" in d.name.upper()
        ),
        None,
    )
    if ward_dept and ward_dept.id not in [p["id"] for p in path]:
        path.append({"id": ward_dept.id, "name": ward_dept.name})

    return path


def get_service_time(department_name: str, resource_type: str) -> float:
    """Return resource service time for a given department (simulation seconds)."""
    base_times = {
        "ER": {"bed": 120 * 60, "equipment": 30 * 60, "staff": 60 * 60},
        "ICU": {"bed": 24 * 60 * 60, "equipment": 60 * 60, "staff": 2 * 60 * 60},
        "WARD": {"bed": 48 * 60 * 60, "equipment": 20 * 60, "staff": 30 * 60},
    }

    dept_key = department_name.upper()
    for key, mapping in base_times.items():
        if key in dept_key:
            return mapping.get(resource_type.lower(), 60 * 60)
    return 60 * 60  # default 1 hour


def get_department_time(department_name: str) -> float:
    """Return dwell time in a department (simulation seconds)."""
    base_times = {
        "ER": 3 * 60 * 60,
        "ICU": 24 * 60 * 60,
        "WARD": 48 * 60 * 60,
    }

    dept_key = department_name.upper()
    for key, value in base_times.items():
        if key in dept_key:
            return value
    return 4 * 60 * 60  # default 4 hours

