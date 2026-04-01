import streamlit as st
import requests

API_BASE_URL = "http://127.0.0.1:8000/api/v1"


def render():
    st.header("📝 Create Account")

    username = st.text_input("Username")
    password = st.text_input("Password", type="password")
    confirm = st.text_input("Confirm Password", type="password")

    if st.button("Sign Up"):
        if not username or not password:
            st.error("All fields are required")
            return

        if password != confirm:
            st.error("Passwords do not match")
            return

        response = requests.post(
            f"{API_BASE_URL}/auth/signup",
            json={
                "username": username,
                "password": password,
            },
        )

        if response.status_code == 200:
            st.session_state.token = response.json()["access_token"]
            st.success("Account created successfully")
            st.rerun()
        else:
            st.error(response.json().get("detail", "Signup failed"))
