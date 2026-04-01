import requests
from datetime import datetime, timedelta
import random

API_BASE = "http://127.0.0.1:8000/api/v1"

EVENT_TYPES = [
    "arrival",
    "resource_request",
    "resource_release",
    "transfer",
    "departure",
]

DAYS_BACK = 14
EVENTS_PER_HOSPITAL = {
    "Megacity Hospital": 60,
    "Metro Care Hospital": 40,
    "District Medical Center": 25,
    "Rural Health Unit": 15,
}


def random_timestamp():
    start = datetime.now() - timedelta(days=DAYS_BACK)
    end = datetime.now()
    delta = end - start
    return start + timedelta(seconds=random.randint(0, int(delta.total_seconds())))


def seed():
    # 1. Fetch existing hospitals
    hospitals = requests.get(f"{API_BASE}/hospitals", timeout=10).json()

    name_to_id = {
        h["name"]: h["id"]
        for h in hospitals
        if h["name"] in EVENTS_PER_HOSPITAL
    }

    if not name_to_id:
        raise RuntimeError("No matching hospitals found. Cannot seed events.")

    events = []

    for name, hospital_id in name_to_id.items():
        print(f"Seeding {EVENTS_PER_HOSPITAL[name]} events for {name} (ID {hospital_id})")

        for _ in range(EVENTS_PER_HOSPITAL[name]):
            events.append({
                "event_type": random.choice(EVENT_TYPES),
                "timestamp": random_timestamp().isoformat(),
                "hospital_id": hospital_id,
                "department_id": None,
                "resource_id": None,
                "patient_id": f"H{hospital_id}-P{random.randint(1, 100)}",
                "event_metadata": {},
            })

    print(f"\nIngesting {len(events)} events...")

    resp = requests.post(
        f"{API_BASE}/ingestion/events",
        json=events,
        timeout=30,
    )
    resp.raise_for_status()

    print("✔ Seeding complete")
    print(resp.json())


if __name__ == "__main__":
    seed()
