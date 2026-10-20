"""
Food Freshness Monitoring Platform - Alerts Component
"""

import streamlit as st
from typing import Dict, Any, List
from streamlit_app.api_client import api_client, ApiException


def render_alert_banner(alert: Dict[str, Any]):
    severity = alert.get("severity", "Medium")
    title = alert.get("title") or alert.get("message", "Operational Alert")
    timestamp = str(alert.get("created_at") or alert.get("timestamp", ""))[:19]
    alert_id = str(alert.get("id") or alert.get("_id", ""))
    is_acked = alert.get("acknowledged", False) or alert.get("status") == "Acknowledged"

    st.markdown(
        f"""
        <div style="background: white; border-left: 4px solid {'#ef4444' if severity == 'Critical' else '#f59e0b'}; border-radius: 8px; border: 1px solid #e2e8f0; padding: 0.9rem; margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong style="color: #0f172a;">{title}</strong>
                <span style="font-size: 0.75rem; color: #94a3b8;">{timestamp}</span>
            </div>
            <p style="font-size: 0.84rem; color: #475569; margin: 0.3rem 0;">{alert.get('details') or alert.get('description', '')}</p>
            <div style="font-size: 0.78rem; color: #64748b;">Severity: <strong>{severity}</strong> | {'✅ Acknowledged' if is_acked else '⚠️ Pending'}</div>
        </div>
        """,
        unsafe_allow_html=True
    )

    if not is_acked and alert_id:
        if st.button("Acknowledge Alert", key=f"ack_{alert_id}"):
            try:
                api_client.acknowledge_alert(alert_id)
                st.success("Alert acknowledged.")
                st.rerun()
            except ApiException as e:
                st.error(f"Failed to acknowledge: {e.message}")


def render_notifications_center():
    with st.expander("🔔 Notifications", expanded=False):
        try:
            notifs = api_client.get_notifications(limit=15)
            unread = api_client.get_unread_notifications_count()
            c1, c2 = st.columns([3, 1])
            with c1: st.caption(f"Unread messages: **{unread}**")
            with c2:
                if unread > 0 and st.button("Mark All Read", key="btn_notif_read_all"):
                    api_client.mark_all_notifications_read()
                    st.rerun()

            if not notifs:
                st.write("No notifications.")
            else:
                for n in notifs:
                    st.markdown(f"- **{n.get('title', 'Notice')}**: {n.get('message', '')} _({str(n.get('created_at', ''))[:19]})_")
        except Exception:
            st.caption("Notifications unavailable.")
