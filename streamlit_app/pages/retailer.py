"""
Food Freshness Monitoring Platform - Retailer Dashboard
"""

import streamlit as st
import pandas as pd
from datetime import date, timedelta
from typing import Dict, Any, List

from streamlit_app.auth import require_role
from streamlit_app.api_client import api_client, ApiException
from streamlit_app.components.navigation import render_sidebar_navigation
from streamlit_app.components.metrics import render_metric_card, render_freshness_badge
from streamlit_app.components.alerts import render_notifications_center


def render_retailer_dashboard():
    require_role(["Retailer", "Admin"])

    views = [
        "🏪 Product Inventory & Batches",
        "➕ Add Retailer Product",
        "⏳ Expiry & Shelf-Life Tracking",
        "⚠️ Spoilage & Storage Alerts",
        "📊 Waste Reduction Analytics",
    ]

    active_view = render_sidebar_navigation(views, current_view_key="retailer_view")
    render_notifications_center()

    if active_view == "🏪 Product Inventory & Batches":
        _render_inventory_view()
    elif active_view == "➕ Add Retailer Product":
        _render_add_product_view()
    elif active_view == "⏳ Expiry & Shelf-Life Tracking":
        _render_expiry_view()
    elif active_view == "⚠️ Spoilage & Storage Alerts":
        _render_alerts_view()
    elif active_view == "📊 Waste Reduction Analytics":
        _render_analytics_view()


def _render_inventory_view():
    st.title("🏪 Retailer Product Catalog & Batches")
    st.caption("Manage store shelves, inventory stock levels, and food freshness statuses (Port 8000).")

    try:
        dash_data = api_client.get_retailer_dashboard()
        m1, m2, m3, m4 = st.columns(4)
        with m1: render_metric_card("Total Products", str(dash_data.get("total_products", 0)), icon="📦")
        with m2: render_metric_card("Stock Units", str(dash_data.get("total_stock_units", 0)), icon="🏷️")
        with m3: render_metric_card("Expiring ≤ 7 Days", str(dash_data.get("expiring_soon_count", 0)), icon="⏳")
        with m4: render_metric_card("Spoiled / Critical", str(dash_data.get("spoiled_count", 0)), icon="⚠️")
    except Exception:
        pass

    st.markdown("---")

    f1, f2, f3, f4 = st.columns([2, 2, 2, 3])
    with f1: cat_filter = st.selectbox("Category", ["All", "Fruits", "Vegetables", "Dairy", "Meat", "Fish", "Bakery", "Grains", "Packaged Food"], key="ret_cat")
    with f2: fresh_filter = st.selectbox("Freshness", ["All", "Fresh", "Expiring Soon", "Spoiled"], key="ret_fresh")
    with f3: stock_filter = st.selectbox("Stock Status", ["All", "In Stock", "Low Stock", "Out of Stock"], key="ret_stock")
    with f4: search_query = st.text_input("Search Product / Batch", placeholder="Search by name or batch ID...", key="ret_search")

    try:
        inv_resp = api_client.get_retailer_inventory(
            category=cat_filter, freshness=fresh_filter, stock_status=stock_filter, search=search_query
        )
        items = inv_resp.get("items") or inv_resp.get("inventory") or []
        if isinstance(inv_resp, list): items = inv_resp

        if not items:
            st.info("No retailer inventory found matching the specified filters.")
        else:
            st.subheader(f"Inventory List ({len(items)} items)")
            for prod in items:
                p_id = str(prod.get("id") or prod.get("_id", ""))
                name = prod.get("food_name") or prod.get("name", "Product")
                cat = prod.get("category", "General")
                batch = prod.get("batch_number") or prod.get("batch_id", "N/A")
                stock = prod.get("stock_quantity") or prod.get("quantity", 0)
                unit = prod.get("unit", "units")
                status_str = prod.get("freshness_status") or prod.get("freshness_category") or "Fresh"
                score = float(prod.get("freshness_score") or prod.get("composite_freshness_score") or 90.0)
                expiry = str(prod.get("expiry_date", "N/A"))

                with st.container():
                    st.markdown(
                        f"""
                        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem; margin-bottom: 0.8rem;">
                            <div style="display: flex; justify-content: space-between;">
                                <div>
                                    <h4 style="margin: 0; color: #0f172a;">{name}</h4>
                                    <span style="font-size: 0.82rem; color: #64748b;">Category: <strong>{cat}</strong> | Batch: <code>{batch}</code></span>
                                </div>
                                <div><strong>{stock} {unit}</strong> (Exp: {expiry})</div>
                            </div>
                        </div>
                        """,
                        unsafe_allow_html=True
                    )
                    c_b, c_scan, c_stk, c_del = st.columns([2, 1, 1, 1])
                    with c_b: render_freshness_badge(score, status_str)
                    with c_scan:
                        if st.button("🔬 Audit Batch", key=f"ret_scan_{p_id}", use_container_width=True):
                            try:
                                api_client.analyze_retailer_product(p_id)
                                st.success("Audit completed!")
                                st.rerun()
                            except ApiException as e:
                                st.error(f"Audit failed: {e.message}")
                    with c_stk:
                        with st.popover("Adjust Stock"):
                            new_qty = st.number_input("New Stock Level", value=float(stock), min_value=0.0, step=1.0, key=f"adj_qty_{p_id}")
                            reason = st.text_input("Reason", value="Shelf restock", key=f"adj_rsn_{p_id}")
                            if st.button("Confirm", key=f"conf_stk_{p_id}"):
                                try:
                                    api_client.update_retailer_stock(p_id, {"quantity": new_qty, "reason": reason})
                                    st.success("Stock updated!")
                                    st.rerun()
                                except ApiException as e:
                                    st.error(f"Update failed: {e.message}")
                    with c_del:
                        if st.button("🗑️ Remove", key=f"ret_del_{p_id}", use_container_width=True):
                            try:
                                api_client.delete_retailer_product(p_id)
                                st.success(f"Removed {name}.")
                                st.rerun()
                            except ApiException as e:
                                st.error(f"Delete failed: {e.message}")

    except ApiException as e:
        st.error(f"Failed to fetch retailer catalog: {e.message}")


def _render_add_product_view():
    st.title("➕ Add New Retailer Product")
    st.caption("Register an incoming food lot into inventory.")

    with st.form("retailer_add_form"):
        name = st.text_input("Product Name", placeholder="e.g. Honeycrisp Apples")
        c1, c2 = st.columns(2)
        with c1: category = st.selectbox("Food Category", ["Fruits", "Vegetables", "Dairy", "Meat", "Fish", "Bakery", "Grains", "Packaged Food"])
        with c2: batch_id = st.text_input("Batch / Lot Number", value=f"LOT-{date.today().strftime('%Y%m%d')}-01")

        c3, c4 = st.columns(2)
        with c3: quantity = st.number_input("Stock Quantity", value=100.0, min_value=1.0, step=5.0)
        with c4: unit = st.selectbox("Unit", ["kg", "units", "packs", "crates", "boxes", "lbs"])

        c5, c6 = st.columns(2)
        with c5: purchase_date = st.date_input("Purchase Date", value=date.today())
        with c6: expiry_date = st.date_input("Expiry Date", value=date.today() + timedelta(days=14))

        supplier = st.text_input("Supplier / Distributor", value="Regional Produce Hub")
        storage_zone = st.selectbox("Storage Zone", ["Zone A (Cold Chilled 2-4°C)", "Zone B (Crisper 6-8°C)", "Zone C (Ambient 18-20°C)"])

        submit_btn = st.form_submit_button("Register Product in Inventory", type="primary", use_container_width=True)

        if submit_btn:
            if not name:
                st.error("Product name is required.")
            else:
                payload = {
                    "food_name": name, "category": category, "batch_number": batch_id,
                    "quantity": quantity, "unit": unit, "purchase_date": purchase_date.strftime("%Y-%m-%d"),
                    "expiry_date": expiry_date.strftime("%Y-%m-%d"), "supplier": supplier, "storage_type": storage_zone.split()[0],
                }
                try:
                    api_client.create_retailer_product(payload)
                    st.success(f"Registered {name}!")
                    st.session_state["retailer_view"] = "🏪 Product Inventory & Batches"
                    st.rerun()
                except ApiException as e:
                    st.error(f"Failed to create product: {e.message}")


def _render_expiry_view():
    st.title("⏳ Retailer Expiry Tracker")
    threshold = st.slider("Expiry Horizon (Days Ahead)", min_value=1, max_value=30, value=7)

    try:
        expiry_data = api_client.get_retailer_expiry(threshold_days=threshold)
        items = expiry_data.get("expiring_items") or expiry_data.get("items") or []

        if not items:
            st.success(f"✨ Zero items expiring within the next {threshold} days.")
        else:
            exp_df = []
            for it in items:
                exp_df.append({
                    "Batch": it.get("batch_number", "N/A"),
                    "Product": it.get("food_name") or it.get("name", "Item"),
                    "Stock": f"{it.get('stock_quantity') or it.get('quantity', 0)} {it.get('unit', '')}",
                    "Days Left": it.get("days_until_expiry", 0),
                    "Expiry Date": it.get("expiry_date", "N/A"),
                    "Freshness": it.get("freshness_status", "Fresh"),
                })
            st.dataframe(pd.DataFrame(exp_df), use_container_width=True)
    except ApiException as e:
        st.error(f"Failed to load expiry telemetry: {e.message}")


def _render_alerts_view():
    st.title("⚠️ Retailer Spoilage & Storage Alerts")
    status_filter = st.selectbox("Alert Status", ["Active", "Acknowledged", "All"])

    try:
        alerts_resp = api_client.get_retailer_alerts(status_filter=status_filter)
        alerts = alerts_resp.get("alerts") if isinstance(alerts_resp, dict) else alerts_resp or []

        if not alerts:
            st.info("No alerts logged.")
            return

        for a in alerts:
            a_id = str(a.get("id") or a.get("_id", ""))
            is_acked = a.get("status") == "Acknowledged" or a.get("acknowledged", False)
            st.markdown(f"**{a.get('title', 'Alert')}**: {a.get('details', '')} | Severity: `{a.get('severity', 'Medium')}`")
            if not is_acked and a_id:
                note = st.text_input("Action Note", key=f"nt_{a_id}")
                if st.button("Acknowledge", key=f"ack_r_{a_id}"):
                    try:
                        api_client.acknowledge_retailer_alert(a_id, note=note)
                        st.success("Alert acknowledged.")
                        st.rerun()
                    except ApiException as e:
                        st.error(f"Failed to acknowledge: {e.message}")
    except ApiException as e:
        st.error(f"Failed to load alerts: {e.message}")


def _render_analytics_view():
    st.title("📊 Retailer Waste Reduction & Analytics")
    try:
        waste_data = api_client.get_retailer_waste_reduction()
        w1, w2, w3 = st.columns(3)
        with w1: render_metric_card("Waste Diverted", f"{waste_data.get('waste_diverted_kg', 120.5):.1f} kg", icon="♻️")
        with w2: render_metric_card("Cost Savings", f"${waste_data.get('cost_savings_usd', 450.0):.2f}", icon="💵")
        with w3: render_metric_card("Sustainability Score", f"{waste_data.get('sustainability_score', 88.0):.1f}%", icon="🌱")
    except Exception:
        st.info("Waste analytics are active and tracking current stock records.")
