"""
Food Freshness Monitoring Platform - Authentication & RBAC
"""

import streamlit as st
from typing import Optional, Dict, Any, List, Tuple
from streamlit_app.api_client import api_client, ApiException
from streamlit_app.config import config


def init_auth_state():
    defaults = {
        "authenticated": False,
        "token": None,
        "user": None,
        "role": None,
        "session_expired": False,
        "auth_error": None,
        "auth_success": None,
        "login_email": "",
        "login_password": "",
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v


def is_authenticated() -> bool:
    init_auth_state()
    return bool(st.session_state.get("authenticated") and st.session_state.get("token"))


def get_current_user() -> Optional[Dict[str, Any]]:
    init_auth_state()
    return st.session_state.get("user")


def get_current_role() -> str:
    init_auth_state()
    raw_role = st.session_state.get("role") or (st.session_state.get("user", {}) or {}).get("role", "Consumer")
    return config.normalize_role(raw_role)


def login(email: str, password: str) -> Tuple[bool, Optional[str]]:
    init_auth_state()
    st.session_state["auth_error"] = None
    try:
        res = api_client.login(email=email, password=password)
        token = res.get("access_token")
        user = res.get("user")

        if not token or not user:
            err = "Authentication succeeded but received incomplete session payload."
            st.session_state["auth_error"] = err
            return False, err

        st.session_state["token"] = token
        st.session_state["user"] = user
        st.session_state["role"] = user.get("role", "Consumer")
        st.session_state["authenticated"] = True
        st.session_state["session_expired"] = False
        st.session_state["auth_success"] = f"Welcome back, {user.get('name', 'User')}!"
        return True, None
    except ApiException as e:
        msg = e.message or "Invalid email or password."
        st.session_state["auth_error"] = msg
        return False, msg
    except Exception as e:
        msg = f"Sign-in error: {str(e)}"
        st.session_state["auth_error"] = msg
        return False, msg


def register(name: str, email: str, role: str, password: str, confirm_password: str) -> Tuple[bool, Optional[str]]:
    init_auth_state()
    st.session_state["auth_error"] = None

    if len(name.strip()) < 2: return False, "Full name must be at least 2 characters."
    if "@" not in email or "." not in email: return False, "Please enter a valid email address."
    if len(password) < 6: return False, "Password must be at least 6 characters long."
    if password != confirm_password: return False, "Passwords do not match."

    try:
        api_client.register({
            "name": name.strip(),
            "email": email.strip(),
            "role": role,
            "password": password,
            "confirm_password": confirm_password,
        })
        st.session_state["auth_success"] = "Account registered successfully! You may now sign in."
        return True, None
    except ApiException as e:
        st.session_state["auth_error"] = e.message
        return False, e.message
    except Exception as e:
        msg = f"Registration error: {str(e)}"
        st.session_state["auth_error"] = msg
        return False, msg


def logout():
    init_auth_state()
    st.session_state["authenticated"] = False
    st.session_state["token"] = None
    st.session_state["user"] = None
    st.session_state["role"] = None
    st.session_state["session_expired"] = False
    st.session_state["auth_error"] = None
    st.session_state["auth_success"] = None
    st.rerun()


def require_role(allowed_roles: List[str]) -> bool:
    if not is_authenticated():
        st.warning("🔒 Please sign in to access this workspace.")
        st.stop()
        return False

    current_role = get_current_role()
    normalized_allowed = [config.normalize_role(r) for r in allowed_roles]

    if current_role not in normalized_allowed:
        st.error(
            f"🚫 **Access Restricted (RBAC Policy Enforcement)**\n\n"
            f"Your active role (**{current_role}**) does not have permission to access this workspace. "
            f"Allowed roles: {', '.join(normalized_allowed)}."
        )
        st.stop()
        return False
    return True


def render_auth_page():
    init_auth_state()
    col1, col2, col3 = st.columns([1, 2, 1])

    with col2:
        st.markdown(
            f"""
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <div style="font-size: 3rem; margin-bottom: 0.5rem;">🌱</div>
                <h2 style="color: #0f172a; margin: 0; font-weight: 800;">{config.APP_NAME}</h2>
                <p style="color: #64748b; font-size: 0.95rem; margin-top: 0.4rem;">{config.APP_TAGLINE}</p>
            </div>
            """,
            unsafe_allow_html=True
        )

        if st.session_state.get("session_expired"):
            st.warning("⚠️ Your session has expired. Please sign in again.")
        if st.session_state.get("auth_error"):
            st.error(f"❌ {st.session_state['auth_error']}")
        if st.session_state.get("auth_success"):
            st.success(f"✅ {st.session_state['auth_success']}")

        tab_login, tab_register = st.tabs(["🔑 Sign In", "📝 Create Account"])

        with tab_login:
            with st.form("login_form", clear_on_submit=False):
                email = st.text_input("Email Address", value=st.session_state.get("login_email", ""), placeholder="name@foodfresh.com")
                password = st.text_input("Password", value=st.session_state.get("login_password", ""), type="password", placeholder="••••••••")
                submit_login = st.form_submit_button("Sign In →", use_container_width=True, type="primary")

                if submit_login:
                    if not email or not password:
                        st.error("Please provide both email and password.")
                    else:
                        with st.spinner("Authenticating against port 8000..."):
                            success, err = login(email, password)
                            if success:
                                st.rerun()

            with st.expander("⚡ Quick Demo Credentials (Autofill)", expanded=True):
                st.caption("Click any role button below to autofill verified accounts:")
                demo_accounts = [
                    ("Demo Consumer", "demo@foodfresh.com", "DemoPass123!"),
                    ("Retailer Store", "retailer@foodfresh.com", "RetailerPass123!"),
                    ("Warehouse Hub", "warehouse@foodfresh.com", "WarehousePass123!"),
                    ("Lead QA Inspector", "inspector@foodfresh.com", "InspectorPass123!"),
                    ("Administrator", "admin@foodfresh.com", "AdminPass123!"),
                ]

                for role_label, d_email, d_pass in demo_accounts:
                    c_btn, c_info = st.columns([1, 2])
                    with c_btn:
                        if st.button(f"Use {role_label.split()[0]}", key=f"btn_{d_email}", use_container_width=True):
                            st.session_state["login_email"] = d_email
                            st.session_state["login_password"] = d_pass
                            st.rerun()
                    with c_info:
                        st.markdown(f"<span style='font-size:0.82rem; color:#475569;'>`{d_email}`</span>", unsafe_allow_html=True)

        with tab_register:
            with st.form("register_form", clear_on_submit=False):
                reg_name = st.text_input("Full Name", placeholder="Jane Doe")
                reg_email = st.text_input("Email Address", placeholder="jane@example.com")
                reg_role = st.selectbox("Primary Role", ["Consumer", "Retailer", "Warehouse Operator", "Food Quality Inspector", "Administrator"])
                reg_pass = st.text_input("Password", type="password", placeholder="Minimum 6 characters")
                reg_confirm = st.text_input("Confirm Password", type="password", placeholder="Repeat password")
                submit_reg = st.form_submit_button("Create Account →", use_container_width=True, type="primary")

                if submit_reg:
                    with st.spinner("Creating account..."):
                        success, err = register(reg_name, reg_email, reg_role, reg_pass, reg_confirm)
                        if success:
                            st.rerun()
