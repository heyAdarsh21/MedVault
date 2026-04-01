"""Main Streamlit application for MEDVAULT."""

import streamlit as st
import sys
from pathlib import Path

# =========================================================
# FUTURISTIC DARK HUD THEME (NEON MEDICAL + AI)
# =========================================================
st.markdown("""
<style>

/* ===== ROOT ===== */
:root {
    --bg-main: #020617;
    --bg-panel: rgba(8, 15, 30, 0.92);
    --bg-panel-alt: rgba(12, 22, 45, 0.95);
    --neon-cyan: #22D3EE;
    --neon-teal: #0EA5A4;
    --neon-blue: #38BDF8;
    --text-main: #E5E7EB;
    --text-muted: #94A3B8;
}

/* ===== APP BACKGROUND ===== */
.stApp {
    background:
        radial-gradient(1200px 600px at 10% 0%, rgba(34,211,238,0.18), transparent 40%),
        radial-gradient(900px 500px at 90% 10%, rgba(14,165,164,0.22), transparent 45%),
        linear-gradient(180deg, #020617, #020617);
}

/* ===== MAIN CONTAINER ===== */
.block-container {
    max-width: 1650px;
    padding-top: 2.2rem;
    padding-bottom: 3rem;
}

/* ===== HUD PANELS ===== */
.element-container {
    background: var(--bg-panel);
    border-radius: 18px;
    padding: 22px;
    margin-bottom: 22px;
    box-shadow:
        0 0 0 1px rgba(34,211,238,0.15),
        0 0 40px rgba(34,211,238,0.08),
        inset 0 0 30px rgba(14,165,164,0.06);
}

/* ===== HEADINGS ===== */
h1, h2, h3 {
    color: var(--neon-cyan);
    font-weight: 600;
    letter-spacing: 0.02em;
    text-shadow: 0 0 12px rgba(34,211,238,0.35);
}

/* ===== TEXT ===== */
p, .stCaption, span {
    color: var(--text-muted);
    font-size: 0.95rem;
}

/* ===== SIDEBAR ===== */
section[data-testid="stSidebar"] {
    background:
        linear-gradient(180deg, #020617, #020617);
    box-shadow:
        inset -1px 0 0 rgba(34,211,238,0.15),
        0 0 40px rgba(34,211,238,0.08);
}

section[data-testid="stSidebar"] * {
    color: var(--text-main);
}

section[data-testid="stSidebar"] h1 {
    color: var(--neon-cyan);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-shadow: 0 0 16px rgba(34,211,238,0.45);
}

/* ===== METRICS ===== */
div[data-testid="stMetric"] {
    background: linear-gradient(
        135deg,
        rgba(8,15,30,0.95),
        rgba(12,22,45,0.98)
    );
    border-radius: 16px;
    padding: 18px;
    box-shadow:
        0 0 0 1px rgba(34,211,238,0.25),
        0 0 24px rgba(34,211,238,0.15);
}

div[data-testid="stMetric"] * {
    color: var(--text-main);
}

/* ===== BUTTONS ===== */
button {
    border-radius: 14px !important;
}

button[kind="primary"] {
    background: linear-gradient(135deg, var(--neon-teal), var(--neon-cyan));
    border: none;
    font-weight: 600;
    color: #020617;
    box-shadow:
        0 0 18px rgba(34,211,238,0.55),
        inset 0 0 8px rgba(255,255,255,0.25);
}

button[kind="primary"]:hover {
    filter: brightness(1.1);
}

/* ===== INPUTS ===== */
input, textarea, select {
    background: rgba(8,15,30,0.95) !important;
    color: var(--text-main) !important;
    border-radius: 12px !important;
    border: 1px solid rgba(34,211,238,0.35) !important;
}

/* ===== DIVIDERS ===== */
hr {
    border: none;
    height: 1px;
    background: linear-gradient(
        90deg,
        transparent,
        rgba(34,211,238,0.5),
        transparent
    );
}

</style>
""", unsafe_allow_html=True)

# =========================================================
# PATH SETUP
# =========================================================
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# =========================================================
# IMPORTS
# =========================================================
from ui.pages import (
    system_health,
    hospital_analysis,
    bottleneck_analysis,
    simulation_control,
    public_availability,
    data_ingestion,
    auth_login,
    auth_signup,
)

# =========================================================
# APP CONFIG
# =========================================================
st.set_page_config(
    page_title="MEDVAULT — Healthcare Systems Intelligence",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded",
)

# =========================================================
# SESSION STATE
# =========================================================
if "token" not in st.session_state:
    st.session_state.token = None

# =========================================================
# SIDEBAR
# =========================================================
st.sidebar.title("MEDVAULT")
st.sidebar.markdown(
    "<span style='color:#94A3B8;'>Healthcare Intelligence Console</span>",
    unsafe_allow_html=True,
)

st.sidebar.markdown("---")

# =========================================================
# AUTH GATE
# =========================================================
if not st.session_state.token:
    auth_page = st.sidebar.radio("ACCESS", ["Login", "Signup"])

    if auth_page == "Login":
        auth_login.render()
    else:
        auth_signup.render()

    st.stop()

# =========================================================
# LOGOUT
# =========================================================
if st.sidebar.button("⏻ LOGOUT"):
    st.session_state.token = None
    st.rerun()

st.sidebar.markdown("---")

# =========================================================
# NAVIGATION
# =========================================================
page = st.sidebar.selectbox(
    "MODULES",
    [
        "🧠 SYSTEM HEALTH",
        "📊 HOSPITAL ANALYSIS",
        "🚧 BOTTLENECK ANALYSIS",
        "🧪 SIMULATION CONTROL",
        "🏥 PUBLIC AVAILABILITY",
        "📥 DATA INGESTION",
    ],
)

# =========================================================
# ROUTING
# =========================================================
if page.startswith("🧠"):
    system_health.render()
elif page.startswith("📊"):
    hospital_analysis.render()
elif page.startswith("🚧"):
    bottleneck_analysis.render()
elif page.startswith("🧪"):
    simulation_control.render()
elif page.startswith("🏥"):
    public_availability.render()
elif page.startswith("📥"):
    data_ingestion.render()
