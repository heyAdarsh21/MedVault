import streamlit as st
import requests
from datetime import datetime

API_BASE = "http://127.0.0.1:8000/api/v1"


def render():
    st.title("Data Ingestion")
    st.caption("Add hospital workflow events directly into MEDVAULT")

    # -----------------------------
    # Fetch hospitals
    # -----------------------------
    try:
        hospitals = requests.get(f"{API_BASE}/hospitals", timeout=5).json()
    except Exception:
        st.error("Backend not reachable.")
        return

    if not hospitals:
        st.warning("No hospitals available.")
        return

    hospital_map = {h["name"]: h["id"] for h in hospitals}
    hospital_name = st.selectbox("Hospital", list(hospital_map.keys()))
    hospital_id = hospital_map[hospital_name]

    # -----------------------------
    # Fetch departments (optional)
    # -----------------------------
    departments = []
    try:
        departments = requests.get(
            f"{API_BASE}/departments",
            params={"hospital_id": hospital_id},
            timeout=5,
        ).json()
    except Exception:
        pass

    dept_map = {"None": None}
    for d in departments:
        dept_map[d["name"]] = d["id"]

    dept_name = st.selectbox("Department (optional)", list(dept_map.keys()))
    department_id = dept_map[dept_name]

    # -----------------------------
    # Fetch resources (optional)
    # -----------------------------
    resources = []
    if department_id is not None:
        try:
            resources = requests.get(
                f"{API_BASE}/resources",
                params={"department_id": department_id},
                timeout=5,
            ).json()
        except Exception:
            pass

    resource_map = {"None": None}
    for r in resources:
        resource_map[r["name"]] = r["id"]

    resource_name = st.selectbox("Resource (optional)", list(resource_map.keys()))
    resource_id = resource_map[resource_name]

    # -----------------------------
    # Event details
    # -----------------------------
    patient_id = st.text_input("Patient ID", value="P-001")

    event_type = st.selectbox(
        "Event Type",
        [
            "arrival",
            "transfer",
            "resource_request",
            "resource_release",
            "departure",
        ],
    )

    timestamp = st.datetime_input("Timestamp", value=datetime.now())

    # -----------------------------
    # Submit
    # -----------------------------
    if st.button("Ingest Event"):
        payload = {
            "event_type": event_type,
            "timestamp": timestamp.isoformat(),
            "hospital_id": hospital_id,
            "department_id": department_id,
            "resource_id": resource_id,
            "patient_id": patient_id,
            "event_metadata": {},
        }

        try:
            resp = requests.post(
                f"{API_BASE}/ingestion/events",
                json=[payload],  # API expects list
                timeout=10,
            )
            resp.raise_for_status()

            st.success("Event ingested successfully")
            st.json(resp.json())

        except requests.exceptions.HTTPError as e:
            st.error("Failed to ingest event")
            st.code(resp.text)

        except Exception as e:
            st.error(f"Unexpected error: {e}")
