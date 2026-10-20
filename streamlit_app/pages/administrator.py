"""
Food Freshness Monitoring Platform - Administrator Console
Provides user management, server-side RBAC governance, AI monitoring,
system health telemetry, cold-chain storage rule management, and audit trails.
"""

import streamlit as st
import pandas as pd
from typing import Dict, Any, List, Optional

from streamlit_app.auth import require_role
from streamlit_app.api_client import api_client, ApiException
from streamlit_app.components.navigation import render_sidebar_navigation
from streamlit_app.components.metrics import render_metric_card
from streamlit_app.components.charts import render_freshness_donut_chart
from streamlit_app.components.alerts import render_notifications_center


def render_administrator_dashboard():
    require_role(["Admin"])

    views = [
        "📊 System Overview & Health",
        "👥 User & Role Access Control",
        "🤖 AI Vision Telemetry",
        "🌡️ Cold Storage Rule Governance",
        "📋 Platform Security Audit Trail",
        "⚙️ Safe System Configuration",
    ]

    active_view = render_sidebar_navigation(views, current_view_key="admin_view")
    render_notifications_center()

    if active_view == "📊 System Overview & Health":
        _render_system_overview_view()
    elif active_view == "👥 User & Role Access Control":
        _render_user_management_view()
    elif active_view == "🤖 AI Vision Telemetry":
        _render_ai_telemetry_view()
    elif active_view == "🌡️ Cold Storage Rule Governance":
        _render_storage_rules_view()
    elif active_view == "📋 Platform Security Audit Trail":
        _render_audit_trail_view()
    elif active_view == "⚙️ Safe System Configuration":
        _render_system_config_view()


def _render_system_overview_view():
    st.title("📊 Platform Executive Overview & Health Probes")
    st.caption("Central administrative telemetries, subsystem readiness probes, and database latency.")

    try:
        dash_data = api_client.get_admin_dashboard()
        m1, m2, m3, m4 = st.columns(4)
        with m1:
            render_metric_card(
                "Registered Users",
                str(dash_data.get("total_users", 0)),
                delta=f"{dash_data.get('active_users', 0)} Active",
                delta_color="normal",
                icon="👥"
            )
        with m2:
            render_metric_card(
                "Tracked Inventory",
                str(dash_data.get("total_inventory", 0)),
                delta="Across all stores",
                icon="📦"
            )
        with m3:
            avg_q = float(dash_data.get("avg_quality_score", 0.0))
            render_metric_card(
                "System Quality Score",
                f"{avg_q:.1f}/100",
                icon="⭐"
            )
        with m4:
            spoiled = dash_data.get("spoiled_count", 0)
            render_metric_card(
                "Spoiled / At-Risk",
                str(spoiled),
                delta="Action Required" if spoiled > 0 else "Normal",
                delta_color="inverse" if spoiled > 0 else "normal",
                icon="⚠️"
            )
    except ApiException as e:
        st.warning(f"Unable to load administrative overview: {e.message}")
    except Exception as e:
        st.error(f"Error: {e}")

    st.markdown("---")

    # Subsystem Health Probe
    st.subheader("🔌 Subsystem Health & Latency Probes")
    try:
        health = api_client.get_admin_system_health()
        h1, h2, h3, h4 = st.columns(4)

        db_status = health.get("database_status", "UNKNOWN")
        db_lat = health.get("database_latency_ms", 0.0)
        cv_status = health.get("vision_engine_status", "ONLINE")
        err_count = health.get("recent_error_count", 0)

        with h1:
            render_metric_card(
                "Database Engine",
                db_status,
                delta=f"{db_lat:.1f} ms Latency",
                delta_color="normal" if db_status in ["ONLINE", "CONNECTED"] else "inverse",
                icon="🗄️"
            )
        with h2:
            render_metric_card(
                "OpenCV Engine",
                cv_status,
                delta="Models Loaded",
                icon="👁️"
            )
        with h3:
            render_metric_card(
                "Storage File System",
                health.get("upload_filesystem_status", "WRITABLE"),
                delta="Uploads Ready",
                icon="💾"
            )
        with h4:
            render_metric_card(
                "System Errors (24h)",
                str(err_count),
                delta="Zero Errors" if err_count == 0 else "Review Logs",
                delta_color="normal" if err_count == 0 else "inverse",
                icon="🛡️"
            )
    except Exception as e:
        st.info(f"Subsystem probe info: {e}")


def _render_user_management_view():
    st.title("👥 User & Role Access Control")
    st.caption("Authoritative RBAC role assignments, account activations, and soft deactivations.")

    f1, f2, f3 = st.columns([2, 2, 4])
    with f1:
        role_filter = st.selectbox(
            "Filter by Role",
            ["All", "Consumer", "Retailer", "Warehouse Operator", "Food Quality Inspector", "Admin"],
            key="adm_u_role"
        )
    with f2:
        status_filter = st.selectbox("Filter by Status", ["All", "active", "deactivated"], key="adm_u_status")
    with f3:
        search_kw = st.text_input("Search Users", placeholder="Search by name or email...", key="adm_u_search")

    try:
        users_resp = api_client.get_admin_users(
            role=role_filter if role_filter != "All" else None,
            status=status_filter if status_filter != "All" else None,
            search=search_kw.strip() if search_kw.strip() else None,
            limit=50
        )

        users = users_resp.get("users", []) if isinstance(users_resp, dict) else users_resp
        if not users:
            st.info("No user records found matching criteria.")
            return

        st.subheader(f"Registered Users ({len(users)})")
        for u in users:
            uid = str(u.get("id") or u.get("_id", ""))
            uname = u.get("full_name") or u.get("name", "User")
            email = u.get("email", "N/A")
            urole = u.get("role", "Consumer")
            ustatus = u.get("status", "active")
            created_at = u.get("created_at", "N/A")

            with st.expander(f"👤 {uname} ({email}) — Role: {urole} | Status: {ustatus.upper()}"):
                c1, c2 = st.columns(2)
                with c1:
                    st.write(f"**User ID:** `{uid}`")
                    st.write(f"**Full Name:** {uname}")
                    st.write(f"**Email Address:** {email}")
                    st.write(f"**Created At:** {created_at}")
                with c2:
                    st.write(f"**Current Role:** `{urole}`")
                    st.write(f"**Account Status:** `{ustatus}`")

                st.markdown("---")
                st.markdown("##### Administrative Actions")

                act1, act2 = st.columns(2)
                with act1:
                    st.markdown("**Change User Role**")
                    new_role = st.selectbox(
                        "New Operational Role",
                        ["Consumer", "Retailer", "Warehouse Operator", "Food Quality Inspector", "Admin"],
                        index=["Consumer", "Retailer", "Warehouse Operator", "Food Quality Inspector", "Admin"].index(urole)
                        if urole in ["Consumer", "Retailer", "Warehouse Operator", "Food Quality Inspector", "Admin"] else 0,
                        key=f"sel_role_{uid}"
                    )
                    if st.button("Apply Role Change", key=f"btn_role_{uid}"):
                        try:
                            api_client.update_user_role(user_id=uid, new_role=new_role)
                            st.success(f"User role updated to '{new_role}'.")
                            st.rerun()
                        except ApiException as e:
                            st.error(f"Failed to update role: {e.message}")

                with act2:
                    st.markdown("**Account Status Control**")
                    if ustatus == "active":
                        deact_reason = st.text_input("Deactivation Reason", placeholder="Reason for deactivation...", key=f"reason_{uid}")
                        if st.button("🚫 Deactivate Account", key=f"btn_deact_{uid}"):
                            try:
                                api_client.deactivate_user(user_id=uid, reason=deact_reason)
                                st.warning("Account deactivated.")
                                st.rerun()
                            except ApiException as e:
                                st.error(f"Deactivation failed: {e.message}")
                    else:
                        act_reason = st.text_input("Reactivation Reason", value="Administrative clearance granted.", key=f"act_reason_{uid}")
                        if st.button("✅ Reactivate Account", key=f"btn_act_{uid}"):
                            try:
                                api_client.activate_user(user_id=uid, reason=act_reason)
                                st.success("Account reactivated.")
                                st.rerun()
                            except ApiException as e:
                                st.error(f"Reactivation failed: {e.message}")

    except ApiException as e:
        st.warning(f"Could not load users: {e.message}")
    except Exception as e:
        st.error(f"Error fetching users: {e}")


def _render_ai_telemetry_view():
    st.title("🤖 AI Computer Vision & Shelf-Life Telemetry")
    st.caption("Model inference throughput, freshness classification distributions, and accuracy metrics.")

    try:
        stats = api_client.get_admin_ai_stats()
        c1, c2, c3, c4 = st.columns(4)

        total_scans = stats.get("total_scans", 0)
        fresh_scans = stats.get("fresh_scans", 0)
        marginal_scans = stats.get("marginal_scans", 0)
        spoiled_scans = stats.get("spoiled_scans", 0)
        avg_conf = float(stats.get("average_confidence", 0.0)) * 100

        with c1:
            render_metric_card("Total AI Scans", str(total_scans), icon="🔬")
        with c2:
            render_metric_card("Avg Confidence", f"{avg_conf:.1f}%", icon="🎯")
        with c3:
            render_metric_card("Spoiled Detections", str(spoiled_scans), icon="⚠️")
        with c4:
            render_metric_card("Active Models", "OpenCV + Arrhenius", icon="🧠")

        st.markdown("---")

        st.subheader("Inference Classification Distribution")
        render_freshness_donut_chart(
            fresh_count=fresh_scans,
            moderate_count=marginal_scans,
            spoiled_count=spoiled_scans
        )

    except ApiException as e:
        st.warning(f"Could not load AI telemetry: {e.message}")
    except Exception as e:
        st.error(f"Error: {e}")


def _render_storage_rules_view():
    st.title("🌡️ Cold Storage Rule Governance")
    st.caption("Global temperature and humidity regulatory envelopes enforced across warehouses and retailers.")

    try:
        rules = api_client.get_admin_storage_rules()

        st.subheader("Defined Storage Envelopes")
        if not rules:
            st.info("No storage rules currently defined.")
        else:
            table_data = []
            for r in rules:
                rid = r.get("id", "N/A")
                cat = r.get("category", "General")
                t_min = r.get("min_temperature", 0.0)
                t_max = r.get("max_temperature", 0.0)
                t_rec = r.get("recommended_temperature", 0.0)
                h_min = r.get("min_humidity", 0.0)
                h_max = r.get("max_humidity", 0.0)
                zone = r.get("applicable_zone", "Zone A")

                table_data.append({
                    "Rule ID": rid,
                    "Category": cat,
                    "Optimal Temp": f"{t_rec} °C",
                    "Temp Range": f"{t_min} °C to {t_max} °C",
                    "Humidity Range": f"{h_min}% to {h_max}%",
                    "Assigned Bay": zone,
                })

            st.dataframe(pd.DataFrame(table_data), use_container_width=True, hide_index=True)

        st.markdown("---")
        with st.expander("➕ Define New Category Storage Rule"):
            with st.form("new_storage_rule_form"):
                new_cat = st.text_input("Food Category", placeholder="e.g. Exotic Fruits", key="rule_cat")
                col_t1, col_t2, col_t3 = st.columns(3)
                with col_t1:
                    min_t = st.number_input("Min Temperature (°C)", value=2.0, step=0.5, key="rule_min_t")
                with col_t2:
                    rec_t = st.number_input("Recommended Temperature (°C)", value=4.0, step=0.5, key="rule_rec_t")
                with col_t3:
                    max_t = st.number_input("Max Temperature (°C)", value=7.0, step=0.5, key="rule_max_t")

                col_h1, col_h2 = st.columns(2)
                with col_h1:
                    min_h = st.number_input("Min Relative Humidity (%)", value=75.0, step=1.0, key="rule_min_h")
                with col_h2:
                    max_h = st.number_input("Max Relative Humidity (%)", value=95.0, step=1.0, key="rule_max_h")

                cond_desc = st.text_input("Storage Conditions Description", value="Chilled Refrigeration Vault", key="rule_cond")
                zone_tag = st.text_input("Applicable Zone / Room", value="Cold Bay 1 - Produce", key="rule_zone")

                rule_submitted = st.form_submit_button("Save Category Rule", use_container_width=True)

            if rule_submitted:
                if not new_cat.strip():
                    st.error("Category name is required.")
                elif min_t > max_t:
                    st.error("Minimum temperature cannot exceed maximum temperature.")
                elif min_h > max_h:
                    st.error("Minimum humidity cannot exceed maximum humidity.")
                else:
                    try:
                        api_client.create_admin_storage_rule({
                            "category": new_cat.strip(),
                            "min_temperature": float(min_t),
                            "max_temperature": float(max_t),
                            "recommended_temperature": float(rec_t),
                            "min_humidity": float(min_h),
                            "max_humidity": float(max_h),
                            "storage_conditions": cond_desc.strip(),
                            "applicable_zone": zone_tag.strip()
                        })
                        st.success(f"Storage rule for '{new_cat}' created successfully!")
                        st.rerun()
                    except ApiException as e:
                        st.error(f"Rule creation rejected: {e.message}")

    except ApiException as e:
        st.warning(f"Could not load storage rules: {e.message}")
    except Exception as e:
        st.error(f"Error: {e}")


def _render_audit_trail_view():
    st.title("📋 Platform Security & Governance Audit Trail")
    st.caption("Immutable append-only record of security events, role alterations, and administrative interventions.")

    f1, f2 = st.columns(2)
    with f1:
        act_filter = st.selectbox("Filter by Action", ["All", "ROLE_CHANGE", "USER_ACTIVATION", "USER_DEACTIVATION", "STORAGE_RULE_CREATE", "LOGIN_SUCCESS", "LOGIN_FAILED"], key="adm_audit_act")
    with f2:
        user_filter = st.text_input("Filter by Actor Email", placeholder="e.g. admin@freshguard.io", key="adm_audit_user")

    try:
        logs_resp = api_client.get_admin_audit_logs(
            action=act_filter if act_filter != "All" else None,
            user_id=user_filter.strip() if user_filter.strip() else None,
            limit=50
        )

        logs = logs_resp.get("logs", []) if isinstance(logs_resp, dict) else logs_resp
        if not logs:
            st.info("No security audit logs found matching criteria.")
            return

        table_rows = []
        for l in logs:
            table_rows.append({
                "Timestamp": l.get("timestamp", "N/A"),
                "Actor": l.get("actor_email") or l.get("user_id", "System"),
                "Action": l.get("action", "EVENT"),
                "Target": l.get("target_resource", "SYSTEM"),
                "Status": l.get("status", "SUCCESS").upper(),
                "Details": str(l.get("details", "")),
            })

        st.dataframe(pd.DataFrame(table_rows), use_container_width=True, hide_index=True)

    except ApiException as e:
        st.warning(f"Could not load audit logs: {e.message}")
    except Exception as e:
        st.error(f"Error fetching audit trail: {e}")


def _render_system_config_view():
    st.title("⚙️ Safe Platform Configuration")
    st.caption("Non-sensitive configuration flags and automated threshold policies (Zero secrets exposed).")

    try:
        conf = api_client.get_admin_system_config()

        st.markdown(
            f"""
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem;">
                <h4 style="margin: 0 0 0.5rem 0; color: #0f172a;">Platform Architecture</h4>
                <div><strong>Application:</strong> {conf.get('app_name', 'Food Freshness Monitoring Platform')}</div>
                <div><strong>Version:</strong> {conf.get('version', '1.0.0')} | <strong>Environment:</strong> {conf.get('environment', 'production')}</div>
            </div>
            """,
            unsafe_allow_html=True
        )

        with st.form("sys_config_form"):
            st.subheader("Operational Feature Toggles")
            reg_enabled = st.checkbox("Public User Registration Enabled", value=conf.get("public_registration_enabled", True), key="cfg_reg")
            ai_enabled = st.checkbox("AI Vision Inference Engine Enabled", value=conf.get("ai_inference_enabled", True), key="cfg_ai")
            fefo_enabled = st.checkbox("FEFO (First-Expired, First-Out) Auto-Markdown Strategy", value=conf.get("fefo_auto_markdown_enabled", True), key="cfg_fefo")

            st.markdown("---")
            saved = st.form_submit_button("Update Platform Policies", use_container_width=True)

        if saved:
            try:
                api_client.update_admin_system_config({
                    "public_registration_enabled": reg_enabled,
                    "ai_inference_enabled": ai_enabled,
                    "fefo_auto_markdown_enabled": fefo_enabled
                })
                st.success("System configuration updated successfully!")
                st.rerun()
            except ApiException as e:
                st.error(f"Configuration update failed: {e.message}")

    except ApiException as e:
        st.warning(f"Could not load configuration: {e.message}")
    except Exception as e:
        st.error(f"Error loading system configuration: {e}")
