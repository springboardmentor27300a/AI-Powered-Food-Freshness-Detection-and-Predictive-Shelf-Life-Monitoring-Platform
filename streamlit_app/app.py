"""
Food Freshness Monitoring Platform - Central Streamlit Application Entrypoint
Provides role-based routing, authentication protection, modern dashboard styling,
and enterprise persona navigation across all 5 user roles (Port 8000 backend).
"""

import streamlit as st
import logging

from streamlit_app.config import config
from streamlit_app.auth import (
    init_auth_state,
    is_authenticated,
    get_current_user,
    get_current_role,
    render_auth_page,
    logout,
)
from streamlit_app.pages.consumer import render_consumer_dashboard
from streamlit_app.pages.retailer import render_retailer_dashboard
from streamlit_app.pages.warehouse_operator import render_warehouse_operator_dashboard
from streamlit_app.pages.food_quality_inspector import render_food_quality_inspector_dashboard
from streamlit_app.pages.administrator import render_administrator_dashboard

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("streamlit_app")


def inject_custom_styles():
    st.markdown(
        """
        <style>
            /* Global theme typography and layout */
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

            html, body, [class*="css"] {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }

            /* Main container polish */
            .main .block-container {
                padding-top: 2rem;
                padding-bottom: 3rem;
                max-width: 1400px;
            }

            /* Metric cards styling */
            div[data-testid="stMetric"] {
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                padding: 1rem 1.25rem;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            }

            /* Sidebar custom styling */
            section[data-testid="stSidebar"] {
                background-color: #f8fafc;
                border-right: 1px solid #e2e8f0;
            }

            /* Form submits and buttons */
            .stButton > button {
                border-radius: 8px;
                font-weight: 600;
                transition: all 0.15s ease-in-out;
            }

            .stButton > button:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 6px rgba(0,0,0,0.08);
            }

            /* Tabs styling */
            .stTabs [data-baseweb="tab-list"] {
                gap: 1.5rem;
            }

            .stTabs [data-baseweb="tab"] {
                font-weight: 600;
                font-size: 0.95rem;
                color: #64748b;
            }

            .stTabs [aria-selected="true"] {
                color: #0f172a !important;
                border-bottom-color: #10b981 !important;
            }

            /* Alert and notification cards */
            .stAlert {
                border-radius: 8px;
            }
        </style>
        """,
        unsafe_allow_html=True
    )


def main():
    st.set_page_config(
        page_title="Food Freshness Monitoring Platform",
        page_icon="🌱",
        layout="wide",
        initial_sidebar_state="expanded"
    )

    inject_custom_styles()
    init_auth_state()

    # If unauthenticated, render the authentication view
    if not is_authenticated():
        render_auth_page()
        return

    # User is authenticated
    user = get_current_user() or {}
    authoritative_role = get_current_role()

    # Persona Switcher for Administrators (facilitates testing across all 5 roles)
    active_role = authoritative_role
    if authoritative_role == "Admin":
        with st.sidebar:
            st.markdown("---")
            st.markdown("#### 🛡️ Admin Persona Switcher")
            role_options = [
                "Admin",
                "Consumer",
                "Retailer",
                "Warehouse Operator",
                "Food Quality Inspector",
            ]
            persona_choice = st.selectbox(
                "Active View Lens",
                role_options,
                index=role_options.index(st.session_state.get("admin_preview_role", "Admin")),
                key="admin_persona_select",
                help="As an Administrator, you can view the platform through the lens of any operational role."
            )
            st.session_state["admin_preview_role"] = persona_choice
            active_role = persona_choice

    # Route based on active role
    try:
        if active_role == "Consumer":
            render_consumer_dashboard()
        elif active_role == "Retailer":
            render_retailer_dashboard()
        elif active_role == "Warehouse Operator":
            render_warehouse_operator_dashboard()
        elif active_role == "Food Quality Inspector":
            render_food_quality_inspector_dashboard()
        elif active_role == "Admin":
            render_administrator_dashboard()
        else:
            st.error(f"Unrecognized role '{active_role}'. Defaulting to Consumer dashboard.")
            render_consumer_dashboard()

    except Exception as e:
        logger.exception("Error rendering dashboard for role %s", active_role)
        st.error(
            f"An unexpected error occurred while rendering the {active_role} workspace. "
            f"Please verify that the backend is running at {config.API_BASE_URL} (Port 8000)."
        )
        with st.expander("Diagnostic Error Details"):
            st.code(str(e))


if __name__ == "__main__":
    main()
