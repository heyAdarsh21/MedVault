"""Page 2 - Hospital Analysis"""
import streamlit as st
import requests
from datetime import datetime, timedelta

API_BASE = "http://127.0.0.1:8000/api/v1"


def render():
    st.title("Hospital Analysis")
    st.markdown("**Question:** Why is this hospital slow?")

    try:
        # 1. Fetch hospitals
        hospitals = requests.get(f"{API_BASE}/hospitals").json()
        if not hospitals:
            st.warning("No hospitals available.")
            return

        hospital_map = {h["name"]: h["id"] for h in hospitals}
        selected_name = st.selectbox("Select Hospital", list(hospital_map.keys()))
        hospital_id = hospital_map[selected_name]

        # 2. Time window (optional – backend tolerates empty)
        col1, col2 = st.columns(2)
        start = col1.date_input("Start Date", datetime.now().date() - timedelta(days=7))
        end = col2.date_input("End Date", datetime.now().date())

        params = {
            "start_time": datetime.combine(start, datetime.min.time()).isoformat(),
            "end_time": datetime.combine(end, datetime.max.time()).isoformat(),
        }

        # 3. Fetch flow analysis
        flow_resp = requests.get(
            f"{API_BASE}/analytics/flow/{hospital_id}",
            params=params
        )

        if flow_resp.status_code != 200:
            st.warning("No flow analysis available.")
            return

        flow = flow_resp.json()

        # 4. Metrics
        st.subheader("Flow Metrics")
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Efficiency", f"{flow['efficiency_score']:.2%}")
        c2.metric("Total Flow Time", f"{flow['total_flow_time']:.1f}s")
        c3.metric("Critical Path Length", len(flow["critical_path"]))
        c4.metric("Bottlenecks", len(flow["bottleneck_departments"]))

        # 5. Critical Path (textual – stable for demo)
        st.subheader("Critical Path")
        if not flow["critical_path"]:
            st.info("No dominant critical path detected.")
        else:
            depts = requests.get(
                f"{API_BASE}/departments",
                params={"hospital_id": hospital_id}
            ).json()

            dept_lookup = {d["id"]: d["name"] for d in depts}
            path_names = [
                dept_lookup.get(did, f"Dept {did}")
                for did in flow["critical_path"]
            ]

            st.write(" → ".join(path_names))

        # 6. Bottlenecks
        st.subheader("Bottleneck Departments")
        if flow["bottleneck_departments"]:
            for did in flow["bottleneck_departments"]:
                name = dept_lookup.get(did, f"Dept {did}")
                st.warning(f"⚠️ {name}")
        else:
            st.success("No major bottlenecks detected.")

        # 7. Capacity
        st.subheader("Resource Utilization")
        cap_resp = requests.get(
            f"{API_BASE}/analytics/capacity",
            params={"hospital_id": hospital_id}
        )

        if cap_resp.status_code == 200:
            caps = cap_resp.json()
            if caps:
                for r in caps:
                    st.write(
                        f"{r['resource_name']} — "
                        f"{r['utilization']*100:.1f}% used "
                        f"(capacity {r['capacity']})"
                    )
            else:
                st.info("No resource utilization data.")

    except requests.exceptions.ConnectionError:
        st.error("API server not running.")
        st.code("uvicorn api.main:app --reload")

    except Exception as e:
        st.error(f"Unexpected error: {e}")
