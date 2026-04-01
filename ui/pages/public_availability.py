import streamlit as st
import requests

API_BASE = "http://127.0.0.1:8000/api/v1/public"


def render():
    st.title("Hospital Availability (Public View)")
    st.caption("Derived from hospital operational analytics")

    try:
        hospitals_resp = requests.get(
            f"{API_BASE}/hospitals",
            timeout=10
        )
        hospitals_resp.raise_for_status()
        hospitals = hospitals_resp.json()
    except Exception as e:
        st.error("Unable to fetch hospital list")
        st.code(str(e))
        return

    for h in hospitals:
        hospital_id = h["id"]
        hospital_name = h["name"]
        location = h.get("location", "Unknown")

        with st.container(border=True):
            st.subheader(f"🏥 {hospital_name}")
            st.write(f"Location: {location}")

            with st.spinner("Computing availability from live operational analytics…"):
                try:
                    availability_resp = requests.get(
                        f"{API_BASE}/hospitals/{hospital_id}/availability",
                        timeout=30  # ⬅️ IMPORTANT FIX
                    )
                    availability_resp.raise_for_status()
                    availability = availability_resp.json()
                except requests.exceptions.Timeout:
                    st.warning(
                        "Availability computation is taking longer than usual. "
                        "This indicates heavy system load."
                    )
                    st.caption(
                        "In production, this result would be cached or precomputed."
                    )
                    continue
                except Exception as e:
                    st.error("Availability data unavailable")
                    st.caption(str(e))
                    continue

            status = availability["status"]
            score = availability["availability_score"]

            color = {
                "AVAILABLE": "🟢",
                "LIMITED": "🟡",
                "OVERLOADED": "🔴"
            }.get(status, "⚪")

            st.markdown(f"### {color} Status: **{status}**")
            st.write(f"Availability Score: **{score}**")

            st.caption(
                "Availability is a conservative estimate derived from "
                "patient flow efficiency, resource utilization, and overload signals."
            )
