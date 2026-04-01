import streamlit as st
import requests

API_BASE_URL = "http://127.0.0.1:8000/api/v1"


def render():
    # =====================================================
    # PAGE HEADER
    # =====================================================
    st.markdown("## 🧠 System Health")
    st.caption(
        "Real-time operational overview of hospital capacity, patient flow, and system strain."
    )

    st.markdown("---")

    # =====================================================
    # TOP METRICS — STRICT 3-COLUMN GRID
    # =====================================================
    col1, col2, col3 = st.columns(3)

    with col1:
        st.markdown("**Capacity Utilization**")
        st.metric(
            label="Current Utilization",
            value="78%",
            delta="+4%",
        )
        st.caption("Beds, staff, and critical resources")

    with col2:
        st.markdown("**Flow Efficiency**")
        st.metric(
            label="Patient Throughput",
            value="0.82",
            delta="-0.03",
        )
        st.caption("Admissions → discharge efficiency")

    with col3:
        st.markdown("**Bottleneck Risk**")
        st.metric(
            label="Risk Index",
            value="Moderate",
            delta="↑",
        )
        st.caption("Derived from delay concentration")

    st.markdown("---")

    # =====================================================
    # SYSTEM LOAD CHART (CALM, NO FLASH)
    # =====================================================
    st.markdown("### System Load vs Capacity")
    st.caption("Aggregate demand compared to available capacity")

    # Placeholder chart (replace with real data later)
    chart_data = {
        "Load": [62, 65, 68, 72, 76, 78, 81],
        "Capacity": [85, 85, 85, 85, 85, 85, 85],
    }

    st.line_chart(chart_data, height=260)

    st.markdown("---")

    # =====================================================
    # OPERATIONAL NOTES
    # =====================================================
    st.markdown("### Operational Notes")

    st.info(
        "Emergency department congestion increasing during evening hours. "
        "Consider short-term staffing reallocation."
    )

    st.caption(
        "Last updated: real-time | Data source: flow events, resource logs"
    )
