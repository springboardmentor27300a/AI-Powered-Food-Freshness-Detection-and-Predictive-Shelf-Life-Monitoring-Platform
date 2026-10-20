"""
Food Freshness Monitoring Platform - Warehouse Operator Dashboard
Provides cold-chain storage management, live environmental telemetry,
safety validations, hardware controller command dispatching, and audit logs.
"""

import streamlit as st
import pandas as pd
from typing import Dict, Any, List, Optional

from streamlit_app.auth import require_role
from streamlit_app.api_client import api_client, ApiException
from streamlit_app.components.navigation import render_sidebar_navigation
from streamlit_app.components.metrics import render_metric_card
from streamlit_app.components.charts import render_temperature_humidity_history_chart
from streamlit_app.components.alerts import render_notifications_center


def render_warehouse_operator_dashboard():
    require_role(["Warehouse Operator", "Admin"])

    views = [
        "🏢 Storage Zones & Telemetry",
        "🎛️ Climate Adjustment Controller",
        "⚠️ Cold-Chain Alerts",
        "📋 Environmental Audit Trail",
    ]

    active_view = render_sidebar_navigation(views, current_view_key="warehouse_view")
    render_notifications_center()

    if active_view == "🏢 Storage Zones & Telemetry":
        _render_zones_overview_view()
    elif active_view == "🎛️ Climate Adjustment Controller":
        _render_climate_controller_view()
    elif active_view == "⚠️ Cold-Chain Alerts":
        _render_warehouse_alerts_view()
    elif active_view == "📋 Environmental Audit Trail":
        _render_audit_trail_view()


def _render_zones_overview_view():
    st.title("🏢 Cold-Chain Storage Zones & Live Telemetry")
    st.caption("Real-time environmental monitoring across cold bays, chillers, and ambient warehouse vaults.")

    # High-level KPIs
    try:
        dash_data = api_client.get_warehouse_dashboard()
        k1, k2, k3, k4 = st.columns(4)
        with k1:
            render_metric_card(
                "Total Storage Zones",
                str(dash_data.get("total_zones", 0)),
                delta=f"{dash_data.get('compliant_zones', 0)} Compliant",
                delta_color="normal",
                icon="🏢"
            )
        with k2:
            render_metric_card(
                "Active Sensors",
                str(dash_data.get("controller_online_count", 0)),
                delta="Online / Connected",
                delta_color="normal",
                icon="📡"
            )
        with k3:
            render_metric_card(
                "Monitored Products",
                str(dash_data.get("total_monitored_products", 0)),
                icon="🍎"
            )
        with k4:
            alerts_count = dash_data.get("active_alerts_count", 0)
            render_metric_card(
                "Environmental Alerts",
                str(alerts_count),
                delta="Excursions" if alerts_count > 0 else "All Normal",
                delta_color="inverse" if alerts_count > 0 else "normal",
                icon="⚠️"
            )
        zones = dash_data.get("zones", [])
    except ApiException as e:
        st.warning(f"Unable to load warehouse dashboard metrics: {e.message}")
        zones = []
    except Exception as e:
        st.warning(f"Error fetching zones: {e}")
        zones = []

    st.markdown("---")

    if not zones:
        try:
            zones = api_client.get_warehouse_zones()
        except Exception:
            zones = []

    if not zones:
        st.info("No storage zones currently configured or detected on this warehouse instance.")
        return

    # Zone selection & detailed telemetry view
    zone_names = {f"{z.get('zone_name', 'Zone')} ({z.get('zone_id', '')})": z for z in zones}
    selected_label = st.selectbox("Select Storage Zone for Deep Telemetry Analysis", list(zone_names.keys()), key="wh_selected_zone")
    active_zone = zone_names[selected_label]
    zone_id = active_zone.get("zone_id", "")

    col_z1, col_z2, col_z3 = st.columns(3)
    curr_temp = active_zone.get("current_temperature", 0.0)
    target_temp = active_zone.get("target_temperature", 0.0)
    curr_hum = active_zone.get("current_humidity", 0.0)
    min_safe = active_zone.get("min_safe_temp", 0.0)
    max_safe = active_zone.get("max_safe_temp", 10.0)
    eq_status = active_zone.get("equipment_status", "ONLINE")
    zone_status = active_zone.get("status", "Optimal")

    with col_z1:
        render_metric_card(
            "Measured Temperature",
            f"{curr_temp:.1f} °C",
            delta=f"Setpoint: {target_temp:.1f} °C",
            icon="🌡️"
        )
    with col_z2:
        render_metric_card(
            "Relative Humidity",
            f"{curr_hum:.1f} %",
            delta="RH Sensor Reading",
            icon="💧"
        )
    with col_z3:
        status_color = "#10b981" if zone_status == "Optimal" else "#f59e0b"
        st.markdown(
            f"""
            <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.1rem; text-align: center;">
                <div style="font-size: 0.85rem; color: #64748b; font-weight: 600;">CONTROLLER & ZONE STATE</div>
                <div style="margin-top: 0.4rem; font-size: 1.25rem; font-weight: 700; color: {status_color};">
                    {zone_status.upper()}
                </div>
                <div style="font-size: 0.8rem; color: #475569; margin-top: 0.3rem;">
                    Hardware: <code>{eq_status}</code> | Range: {min_safe}°C to {max_safe}°C
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )

    st.markdown("### 📈 24-Hour Environmental Telemetry Trend")
    hours_filter = st.radio("Telemetry Timeframe", [6, 12, 24, 72, 168], index=2, horizontal=True, format_func=lambda x: f"{x} Hours", key="telemetry_hours")

    try:
        history_resp = api_client.get_warehouse_zone_history(zone_id, hours=hours_filter)
        points = history_resp.get("history", []) if isinstance(history_resp, dict) else history_resp
        if points:
            df_hist = pd.DataFrame(points)
            render_temperature_humidity_history_chart(
                df_hist,
                target_temp=target_temp,
                min_safe=min_safe,
                max_safe=max_safe
            )
        else:
            st.info(f"No historical telemetry logged for zone {zone_id} in the past {hours_filter} hours.")
    except Exception as e:
        st.info(f"Unable to load historical trend: {e}")

    # Stored Products & Safe Storage Criteria
    st.markdown("### 🥦 Stored Food Batches & Safe Temperature Bounds")
    stored_prods = active_zone.get("stored_products", [])
    if stored_prods:
        prod_data = []
        for p in stored_prods:
            prod_data.append({
                "Product": p.get("food_name", "N/A"),
                "Category": p.get("category", "General"),
                "Batch ID": p.get("batch_number", "N/A"),
                "Required Min (°C)": p.get("min_temp", min_safe),
                "Required Max (°C)": p.get("max_temp", max_safe),
                "Safe RH (%)": f"{p.get('min_humidity', 80)}% - {p.get('max_humidity', 95)}%",
                "Compliance": "✅ Within Range" if min_safe <= curr_temp <= max_safe else "⚠️ Excursion Risk"
            })
        st.dataframe(pd.DataFrame(prod_data), use_container_width=True, hide_index=True)
    else:
        st.caption("No individual inventory lots currently assigned to this specific zone envelope.")


def _render_climate_controller_view():
    st.title("🎛️ Cold Storage Climate Adjustment Controller")
    st.caption("Hardware controller integration (Modbus/BACnet/PLC) with server-side regulatory safety checks.")

    try:
        zones = api_client.get_warehouse_zones()
    except Exception as e:
        st.error(f"Failed to fetch warehouse storage zones: {e}")
        return

    if not zones:
        st.info("No zones available for adjustment.")
        return

    zone_map = {f"{z.get('zone_name')} [{z.get('zone_id')}]": z for z in zones}
    selected_key = st.selectbox("Select Target Storage Zone", list(zone_map.keys()), key="ctrl_zone")
    zone = zone_map[selected_key]
    zone_id = zone.get("zone_id")

    curr_target = float(zone.get("target_temperature", 4.0))
    min_safe = float(zone.get("min_safe_temp", 0.0))
    max_safe = float(zone.get("max_safe_temp", 10.0))
    eq_status = str(zone.get("equipment_status", "ONLINE"))

    st.markdown(
        f"""
        <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 1rem; border-radius: 6px; margin: 1rem 0;">
            <strong>Hardware Controller Interface:</strong> <code>{eq_status}</code><br/>
            <strong>Permitted Regulatory Safety Range:</strong> {min_safe:.1f} °C to {max_safe:.1f} °C<br/>
            <strong>Active Target Setpoint:</strong> {curr_target:.1f} °C
        </div>
        """,
        unsafe_allow_html=True
    )

    with st.form("temperature_command_form"):
        st.subheader("Submit Climate Adjustment Command")
        new_temp = st.number_input(
            "Requested Setpoint Temperature (°C)",
            min_value=-25.0,
            max_value=35.0,
            value=curr_target,
            step=0.5,
            format="%.1f",
            help=f"Allowed safe operating envelope: {min_safe} °C to {max_safe} °C"
        )

        reason = st.text_input(
            "Operational Justification / Reason",
            placeholder="e.g. Received new shipment of chilled berries; precooling bay.",
            help="Required for ISO/HACCP compliance audit logs."
        )

        force_override = st.checkbox(
            "Emergency Override (Force bypass regulatory safety limits)",
            value=False,
            help="Enabling this will log a high-severity supervisory audit event and dispatch an out-of-spec command to hardware."
        )

        submitted = st.form_submit_button("📡 Dispatch Command to Equipment Controller", use_container_width=True)

    if submitted:
        if not reason.strip():
            st.error("Please enter a valid justification reason for the environmental adjustment.")
            return

        try:
            with st.spinner("Validating safety parameters and transmitting to equipment controller..."):
                resp = api_client.submit_warehouse_temperature_command(
                    zone_id=zone_id,
                    requested_temp=new_temp,
                    reason=reason.strip(),
                    force_override=force_override
                )

            st.success(f"Command Processed: {resp.get('message', 'Temperature command transmitted successfully.')}")

            # Display controller confirmation status
            cmd_status = resp.get("status", "Applied")
            ack = resp.get("equipment_connected", True)
            c1, c2, c3 = st.columns(3)
            with c1:
                render_metric_card("Command Status", cmd_status, icon="📋")
            with c2:
                render_metric_card("New Setpoint", f"{new_temp:.1f} °C", icon="🌡️")
            with c3:
                render_metric_card("Hardware ACK", "Confirmed" if ack else "Simulated / Offline", icon="📡")

            if not ack:
                st.info("ℹ️ Physical controller is currently simulated or offline; software target updated without false physical claims.")

        except ApiException as e:
            st.error(f"Command Rejected by Server Safety Rules: {e.message}")
        except Exception as e:
            st.error(f"Unexpected error executing climate command: {e}")


def _render_warehouse_alerts_view():
    st.title("⚠️ Cold-Chain Storage Alerts & Threshold Violations")
    st.caption("Active temperature excursions, sensor anomalies, and refrigeration unit warnings.")

    f1, f2 = st.columns(2)
    with f1:
        sev_filter = st.selectbox("Filter by Severity", ["All", "critical", "high", "medium", "low"], key="wh_alert_sev")
    with f2:
        zone_filter = st.text_input("Filter by Zone ID (Optional)", placeholder="e.g. ZONE-COLD-A-BERRIES", key="wh_alert_zone")

    try:
        alerts = api_client.get_warehouse_alerts(
            zone_id=zone_filter.strip() if zone_filter.strip() else None,
            severity=sev_filter if sev_filter != "All" else None
        )

        if not alerts:
            st.success("🎉 No active environmental alerts or cold-chain excursions detected.")
            return

        st.subheader(f"Active Environmental Alerts ({len(alerts)})")
        for a in alerts:
            aid = str(a.get("alert_id") or a.get("id", ""))
            title = a.get("title", "Temperature Excursion Alert")
            desc = a.get("description", "Excursion detected in storage zone.")
            sev = a.get("severity", "medium").lower()
            zid = a.get("zone_id", "Unknown Zone")
            ts = a.get("created_at") or a.get("timestamp", "Recent")

            color_map = {
                "critical": "#ef4444",
                "high": "#f97316",
                "medium": "#f59e0b",
                "low": "#3b82f6"
            }
            border_col = color_map.get(sev, "#94a3b8")

            with st.container():
                st.markdown(
                    f"""
                    <div style="background: white; border-left: 5px solid {border_col}; border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: {border_col};">{sev}</span>
                                <h4 style="margin: 0.2rem 0; color: #0f172a;">{title}</h4>
                                <div style="font-size: 0.85rem; color: #475569;">{desc}</div>
                                <div style="font-size: 0.78rem; color: #94a3b8; margin-top: 0.3rem;">Zone: <code>{zid}</code> | Logged: {ts}</div>
                            </div>
                        </div>
                    </div>
                    """,
                    unsafe_allow_html=True
                )

    except ApiException as e:
        st.warning(f"Could not load warehouse alerts: {e.message}")
    except Exception as e:
        st.error(f"Error fetching alerts: {e}")


def _render_audit_trail_view():
    st.title("📋 Environmental Adjustment Audit Logs")
    st.caption("Immutable tamper-evident record of all setpoint modifications, operator credentials, and equipment responses.")

    limit = st.slider("Audit Log Count", min_value=10, max_value=150, value=50, step=10, key="wh_audit_limit")

    try:
        logs = api_client.get_warehouse_audit_logs(limit=limit)
        if not logs:
            st.info("No warehouse audit logs found on this instance.")
            return

        table_rows = []
        for l in logs:
            table_rows.append({
                "Timestamp": l.get("timestamp", "N/A"),
                "Zone": l.get("zone_id", "N/A"),
                "Operator": l.get("operator_email") or l.get("user_id", "System"),
                "Previous Target (°C)": l.get("previous_temperature", "N/A"),
                "New Target (°C)": l.get("new_target_temperature", "N/A"),
                "Action": l.get("action", "SETPOINT_ADJUSTMENT"),
                "Controller Status": l.get("controller_status", "ACKNOWLEDGED"),
                "Result": l.get("result", "SUCCESS"),
            })

        st.dataframe(pd.DataFrame(table_rows), use_container_width=True, hide_index=True)

    except ApiException as e:
        st.warning(f"Unable to retrieve audit logs: {e.message}")
    except Exception as e:
        st.error(f"Error loading audit trail: {e}")
