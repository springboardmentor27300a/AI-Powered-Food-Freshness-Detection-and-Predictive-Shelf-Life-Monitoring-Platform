"""
Food Freshness Monitoring Platform - Navigation Component
"""

import streamlit as st
from typing import List
from streamlit_app.auth import get_current_user, get_current_role, logout
from streamlit_app.config import config
from streamlit_app.api_client import api_client

ROLE_BADGE_COLORS = {
    "Consumer": "#10b981",
    "Retailer": "#0284c7",
    "Warehouse Operator": "#f59e0b",
    "Food Quality Inspector": "#8b5cf6",
    "Admin": "#ef4444",
}

ROLE_EMOJIS = {
    "Consumer": "🛒",
    "Retailer": "🏪",
    "Warehouse Operator": "❄️",
    "Food Quality Inspector": "🔬",
    "Admin": "🛡️",
}


def render_sidebar_navigation(views: List[str], current_view_key: str = "active_view") -> str:
    user = get_current_user() or {}
    role = get_current_role()
    badge_color = ROLE_BADGE_COLORS.get(role, "#10b981")
    emoji = ROLE_EMOJIS.get(role, "👤")

    with st.sidebar:
        st.markdown(
            f"""
            <div style="display: flex; align-items: center; gap: 10px; padding: 0.5rem 0 1rem 0; border-bottom: 1px solid #e2e8f0; margin-bottom: 1rem;">
                <span style="font-size: 2rem;">🌱</span>
                <div>
                    <div style="font-weight: 800; font-size: 1.15rem; color: #0f172a; line-height: 1.2;">FreshGuard</div>
                    <div style="font-size: 0.72rem; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 0.05em;">AI Freshness Intelligence</div>
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )

        user_name = user.get("name", "User")
        user_email = user.get("email", "")
        st.markdown(
            f"""
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.85rem; margin-bottom: 1.2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem;">
                    <span style="font-weight: 700; font-size: 0.95rem; color: #1e293b;">{user_name}</span>
                    <span style="background: {badge_color}; color: white; padding: 2px 8px; border-radius: 9999px; font-size: 0.7rem; font-weight: 700;">
                        {emoji} {role}
                    </span>
                </div>
                <div style="font-size: 0.78rem; color: #64748b; word-break: break-all;">{user_email}</div>
            </div>
            """,
            unsafe_allow_html=True
        )

        st.markdown("<p style='font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;'>Workspace Navigation</p>", unsafe_allow_html=True)

        if current_view_key not in st.session_state:
            st.session_state[current_view_key] = views[0]

        selected_view = st.radio(
            "Select Workspace View",
            options=views,
            index=views.index(st.session_state[current_view_key]) if st.session_state[current_view_key] in views else 0,
            label_visibility="collapsed",
            key=f"nav_radio_{role}"
        )
        st.session_state[current_view_key] = selected_view

        st.markdown("<div style='margin-top: 2rem;'></div>", unsafe_allow_html=True)
        st.divider()

        c_status, c_logout = st.columns([1, 1])
        with c_status:
            try:
                health = api_client.check_health()
                is_healthy = health.get("status") == "healthy"
                color_dot = "🟢" if is_healthy else "🟡"
                st.caption(f"{color_dot} Port 8000")
            except Exception:
                st.caption("🔴 API Offline")

        with c_logout:
            if st.button("Sign Out", type="secondary", use_container_width=True):
                logout()

    return selected_view
