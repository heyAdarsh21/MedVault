"""Page 3 - Bottleneck Analysis"""
import streamlit as st
import requests
from datetime import datetime, timedelta
import plotly.express as px

API_BASE = "http://127.0.0.1:8000/api/v1"


def render():
    st.title("Bottleneck Analysis")
    st.markdown("**Question:** Where does time disappear?")

    try:
        hospitals = requests.get(f"{API_BASE}/hospitals").json()
        if not hospitals:
            st.warning("No hospitals available.")
            return

        hospital_map = {h["name"]: h["id"] for h in hospitals}
        hospital_map["All Hospitals"] = None

        selected = st.selectbox("Select Hospital", hospital_map.keys())
        hospital_id = hospital_map[selected]

        col1, col2 = st.columns(2)
        start = col1.date_input("Start Date", datetime.now().date() - timedelta(days=7))
        end = col2.date_input("End Date", datetime.now().date())

        params = {
            "start_time": datetime.combine(start, datetime.min.time()).isoformat(),
            "end_time": datetime.combine(end, datetime.max.time()).isoformat(),
        }

        if hospital_id is not None:
            params["hospital_id"] = hospital_id

        resp = requests.get(f"{API_BASE}/analytics/bottlenecks", params=params)
        if resp.status_code != 200:
            st.warning("No bottleneck data available.")
            return

        bottlenecks = resp.json()
        if not bottlenecks:
            st.success("No significant bottlenecks detected.")
            return

        # ---- Summary ----
        st.subheader("Summary")
        worst = max(bottlenecks, key=lambda b: b["average_delay"])

        c1, c2, c3 = st.columns(3)
        c1.metric("Departments Analyzed", len(bottlenecks))
        c2.metric("Worst Avg Delay", f"{worst['average_delay']:.1f}s")
        c3.metric("Worst Department", worst["department_name"])

        # ---- Table ----
        st.subheader("Department Delays")
        st.dataframe(
            [
                {
                    "Department": b["department_name"],
                    "Avg Delay (s)": round(b["average_delay"], 1),
                    "Max Delay (s)": round(b["max_delay"], 1),
                    "Events": b["delay_count"],
                    "Severity": b["severity"],
                }
                for b in bottlenecks
            ],
            use_container_width=True,
        )

        # ---- Chart ----
        st.subheader("Average Delay by Department")
        fig = px.bar(
            x=[b["department_name"] for b in bottlenecks],
            y=[b["average_delay"] for b in bottlenecks],
            labels={"x": "Department", "y": "Average Delay (seconds)"},
        )
        st.plotly_chart(fig, use_container_width=True)

    except requests.exceptions.ConnectionError:
        st.error("API server not running.")
        st.code("uvicorn api.main:app --reload")

    except Exception as e:
        st.error(f"Unexpected error: {e}")
