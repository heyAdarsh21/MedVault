import streamlit as st
import requests

API_BASE_URL = "http://127.0.0.1:8000/api/v1"


def render():
    st.header("🔐 Login")

    username = st.text_input("Username")
    password = st.text_input("Password", type="password")

    if st.button("Login"):
        if not username or not password:
            st.error("Username and password are required")
            return

        response = requests.post(
            f"{API_BASE_URL}/auth/token",
            data={
                "username": username,
                "password": password,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if response.status_code == 200:
            st.session_state.token = response.json()["access_token"]
            st.success("Login successful")
            st.rerun()
        else:
            st.error("Invalid username or password")
