"""Page 4 - Simulation Control."""
import streamlit as st
import sys
from pathlib import Path
import requests

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from config.settings import settings

API_BASE = "http://127.0.0.1:8000/api/v1"


def render():
    """Render the Simulation Control page."""
    st.title("Simulation Control")
    st.markdown("**Question:** What if demand increases?")

    try:
        # -----------------------------
        # Fetch hospitals
        # -----------------------------
        response = requests.get(f"{API_BASE}/hospitals")
        if response.status_code != 200:
            st.error("Failed to fetch hospitals")
            return

        hospitals = response.json()
        if not hospitals:
            st.warning("No hospitals found. Please create a hospital first.")
            return

        hospital_options = {
            f"{h['name']} ({h['location']})": h['id'] for h in hospitals
        }
        selected_hospital_name = st.selectbox(
            "Select Hospital",
            list(hospital_options.keys())
        )
        hospital_id = hospital_options[selected_hospital_name]

        # -----------------------------
        # Simulation parameters
        # -----------------------------
        st.subheader("Simulation Parameters")

        col1, col2 = st.columns(2)

        with col1:
            duration = st.slider(
                "Simulation Duration (time units)",
                min_value=100,
                max_value=10000,
                value=1000,
                step=100,
                help="How long to run the simulation"
            )

        with col2:
            arrival_rate = st.slider(
                "Patient Arrival Rate (patients per time unit)",
                min_value=0.01,
                max_value=1.0,
                value=0.1,
                step=0.01,
                help="Higher values = more patients = more system stress"
            )

        # ✅ SAFE seed input (FIXED)
        seed_text = st.text_input(
            "Random Seed (optional, leave blank for random)",
            value=""
        )

        # -----------------------------
        # Run simulation
        # -----------------------------
        if st.button("🚀 Run Simulation", type="primary"):
            with st.spinner("Running simulation..."):
                try:
                    params = {
                        "hospital_id": hospital_id,
                        "duration": duration,
                        "arrival_rate": arrival_rate
                    }

                    if seed_text.strip():
                        params["seed"] = int(seed_text)

                    sim_response = requests.post(
                        f"{API_BASE}/simulation/run",
                        params=params
                    )

                    if (
                        sim_response.status_code == 200
                        and sim_response.headers
                        .get("content-type", "")
                        .startswith("application/json")
                    ):
                        result = sim_response.json()

                        st.success("✅ Simulation completed successfully!")

                        st.subheader("Simulation Results")
                        cols = st.columns(4)
                        cols[0].metric("Events Logged", result["events_logged"])
                        cols[1].metric("Duration", result["duration"])
                        cols[2].metric("Arrival Rate", f"{result['arrival_rate']:.2f}")
                        cols[3].metric("Hospital ID", result["hospital_id"])

                        st.info(
                            "💡 Tip: Visit **Hospital Analysis** and "
                            "**Bottleneck Analysis** to see the impact."
                        )
                    else:
                        st.error(
                            f"Simulation failed:\n{sim_response.text}"
                        )

                except ValueError:
                    st.error("Seed must be a valid integer.")
                except Exception as e:
                    st.error(f"Error running simulation: {str(e)}")

        # -----------------------------
        # Explanation section
        # -----------------------------
        st.subheader("About Simulation")
        st.markdown(
            """
        The simulation models patient flow using **discrete-event simulation (SimPy)**.

        **How it works**
        1. Patients arrive based on arrival rate
        2. Patients move through departments
        3. Resources are requested and released
        4. All events are stored in the database

        **Purpose**
        - Stress-test hospital capacity
        - Identify bottlenecks
        - Support planning decisions

        **Note**
        Each simulation **adds new events** to the system.  
        Analysis reflects cumulative system behavior.
        """
        )

        # -----------------------------
        # Hospital structure
        # -----------------------------
        st.subheader("Hospital Structure")

        try:
            dept_response = requests.get(
                f"{API_BASE}/departments",
                params={"hospital_id": hospital_id}
            )

            if dept_response.status_code == 200:
                departments = dept_response.json()

                if not departments:
                    st.warning("No departments found.")
                else:
                    for dept in departments:
                        st.markdown(
                            f"**{dept['name']}** "
                            f"(Capacity: {dept['capacity'] or 'Unlimited'})"
                        )

                        res_response = requests.get(
                            f"{API_BASE}/resources",
                            params={"department_id": dept["id"]}
                        )

                        if res_response.status_code == 200:
                            resources = res_response.json()
                            for r in resources:
                                st.write(
                                    f"- {r['name']} "
                                    f"({r['resource_type']}): "
                                    f"Capacity {r['capacity']}"
                                )
        except Exception:
            st.warning("Could not fetch hospital structure.")

    except requests.exceptions.ConnectionError:
        st.error("Cannot connect to API. Is FastAPI running?")
        st.code("uvicorn api.main:app --reload")
    except Exception as e:
        st.error(f"Unexpected error: {str(e)}")
