"""
Food Freshness Monitoring Platform - Consumer Dashboard
"""

import streamlit as st
import pandas as pd
from datetime import date, timedelta
from typing import Optional, Dict, Any, List

from streamlit_app.auth import require_role
from streamlit_app.api_client import api_client, ApiException
from streamlit_app.components.navigation import render_sidebar_navigation
from streamlit_app.components.metrics import render_metric_card, render_freshness_badge
from streamlit_app.components.charts import render_arrhenius_degradation_chart
from streamlit_app.components.alerts import render_notifications_center


def render_consumer_dashboard():
    require_role(["Consumer", "Admin"])

    views = [
        "🔍 AI Freshness Scanner",
        "📦 My Food Inventory",
        "📜 Freshness Analysis History",
        "⏳ Shelf-Life Kinetics Simulator",
        "💡 Storage Recommendations",
    ]

    active_view = render_sidebar_navigation(views, current_view_key="consumer_view")
    render_notifications_center()

    if active_view == "🔍 AI Freshness Scanner":
        _render_ai_scanner_view()
    elif active_view == "📦 My Food Inventory":
        _render_inventory_view()
    elif active_view == "📜 Freshness Analysis History":
        _render_history_view()
    elif active_view == "⏳ Shelf-Life Kinetics Simulator":
        _render_simulator_view()
    elif active_view == "💡 Storage Recommendations":
        _render_recommendations_view()


def _render_ai_scanner_view():
    st.title("🔍 AI Food Freshness Diagnostic Scanner")
    st.caption("Computer Vision Visual Decomposition & Arrhenius Shelf-Life Kinetics (Port 8000)")

    col_input, col_result = st.columns([1, 1], gap="large")

    with col_input:
        st.subheader("Food Sample Input")
        upload_mode = st.radio("Image Source", ["Device File Upload", "Web Image URL / Specimen Demo"], horizontal=True)

        uploaded_file = None
        image_url = None

        if upload_mode == "Device File Upload":
            uploaded_file = st.file_uploader(
                "Upload Food Image (JPEG, PNG, WebP)",
                type=["jpg", "jpeg", "png", "webp"],
                help="High-resolution specimen photo for accurate spectral analysis."
            )
            if uploaded_file:
                st.image(uploaded_file, caption="Selected Food Specimen", use_container_width=True)
        else:
            sample_options = {
                "Custom URL": "",
                "Sample Fresh Apple": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600",
                "Sample Avocado": "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=600",
                "Sample Fresh Berries": "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=600",
            }
            specimen_choice = st.selectbox("Select Specimen Template or Custom", list(sample_options.keys()))
            if specimen_choice == "Custom URL":
                image_url = st.text_input("Enter Image URL", placeholder="https://example.com/fruit.jpg")
            else:
                image_url = sample_options[specimen_choice]
            if image_url:
                try:
                    st.image(image_url, caption=f"Specimen Preview: {specimen_choice}", use_container_width=True)
                except Exception:
                    st.caption("Image preview unavailable.")

        c_cat, c_name = st.columns(2)
        with c_cat:
            category = st.selectbox("Food Category", ["Fruits", "Vegetables", "Dairy", "Meat", "Fish", "Bakery", "Grains", "Packaged Food", "Other"])
        with c_name:
            food_name = st.text_input("Food Item Name", value="Fresh Produce Sample")

        with st.expander("🌡️ Storage Environment Parameters (Optional)", expanded=False):
            c_temp, c_hum = st.columns(2)
            with c_temp:
                storage_temp = st.number_input("Ambient Temp (°C)", value=4.0, step=0.5)
            with c_hum:
                storage_humidity = st.number_input("Relative Humidity (% RH)", value=85.0, min_value=10.0, max_value=100.0, step=1.0)

        run_scan = st.button("⚡ Execute AI Freshness Diagnostic", type="primary", use_container_width=True)

    with col_result:
        st.subheader("Diagnostic Telemetry & Assessment")
        if run_scan:
            file_bytes = uploaded_file.getvalue() if uploaded_file else None
            file_name = uploaded_file.name if uploaded_file else None

            if not file_bytes and not image_url:
                st.warning("⚠️ Please provide an image file or URL before initiating analysis.")
            else:
                with st.spinner("Processing multi-spectral color degradation & Arrhenius kinetics..."):
                    try:
                        res = api_client.quick_scan_food(
                            file_bytes=file_bytes,
                            file_name=file_name,
                            image_url=image_url,
                            category=category,
                            food_name=food_name,
                            storage_temp=storage_temp,
                            storage_humidity=storage_humidity
                        )
                        st.session_state["last_scan_result"] = res
                        st.success("Analysis Complete!")
                    except ApiException as e:
                        st.error(f"AI Diagnostic Failure: {e.message}")
                    except Exception as e:
                        st.error(f"Unexpected error: {str(e)}")

        result = st.session_state.get("last_scan_result")
        if result:
            score = float(result.get("composite_freshness_score") or result.get("freshness_score") or 0.0)
            status_label = result.get("freshness_category") or result.get("freshness_label") or "Fresh"
            confidence = float(result.get("confidence") or result.get("confidence_score") or 90.0)
            shelf_days = float(result.get("estimated_shelf_life_days") or 7.0)
            spoilage_prob = float(result.get("spoilage_probability") or 0.0)
            mold_detected = result.get("mold_detected", False)
            bruising_detected = result.get("bruising_detected", False)

            st.markdown("#### Primary Classification")
            render_freshness_badge(score, status_label)

            m1, m2, m3 = st.columns(3)
            with m1: render_metric_card("Composite Score", f"{score:.1f}%")
            with m2: render_metric_card("Shelf-Life", f"{shelf_days:.1f} Days")
            with m3: render_metric_card("AI Confidence", f"{confidence:.1f}%")

            st.markdown("##### Microbial & Defect Evaluation")
            d1, d2, d3 = st.columns(3)
            with d1: st.markdown(f"**Mycelial Mold:** {'🔴 Detected' if mold_detected else '🟢 Clear'}")
            with d2: st.markdown(f"**Physical Bruising:** {'🟠 Present' if bruising_detected else '🟢 None'}")
            with d3: st.markdown(f"**Spoilage Prob:** `{spoilage_prob * 100:.1f}%`")

            forecast = [
                {"day_offset": d, "predicted_quality_score": max(5.0, score - (d * (score / max(1.0, shelf_days))))}
                for d in range(1, min(14, int(shelf_days) + 2))
            ]
            fig = render_arrhenius_degradation_chart(forecast, current_score=score)
            st.plotly_chart(fig, use_container_width=True)

        else:
            st.info("👈 Upload an image and click **Execute AI Freshness Diagnostic**.")


def _render_inventory_view():
    st.title("📦 Food Inventory Tracker")
    st.caption("Manage stored perishables, track expiry dates, and trigger live AI audits.")

    c_f1, c_f2, c_btn = st.columns([2, 2, 2])
    with c_f1: cat_filter = st.selectbox("Filter Category", ["All", "Fruits", "Vegetables", "Dairy", "Meat", "Fish", "Bakery", "Grains", "Packaged Food", "Other"])
    with c_f2: status_filter = st.selectbox("Filter Status", ["All", "Fresh", "Expiring Soon", "Spoiled"])
    with c_btn:
        st.write("")
        st.write("")
        add_item_toggle = st.checkbox("➕ Add New Food Item", value=False)

    if add_item_toggle:
        with st.expander("Create Food Inventory Entry", expanded=True):
            with st.form("add_inventory_form"):
                f_name = st.text_input("Food Item Name", placeholder="e.g. Organic Strawberries")
                c1, c2, c3 = st.columns(3)
                with c1: f_cat = st.selectbox("Category", ["Fruits", "Vegetables", "Dairy", "Meat", "Fish", "Bakery", "Other"])
                with c2: f_qty = st.number_input("Quantity", value=1.0, min_value=0.1, step=0.5)
                with c3: f_unit = st.selectbox("Unit", ["kg", "lbs", "units", "packs", "liters"])

                c4, c5 = st.columns(2)
                with c4: f_storage = st.selectbox("Storage Type", ["Refrigerated", "Frozen", "Pantry", "Ambient", "Cold Storage"])
                with c5: f_expiry_days = st.number_input("Days until expected expiry", value=7, min_value=1, step=1)

                f_submit = st.form_submit_button("Save Item to Inventory", type="primary")

                if f_submit:
                    if not f_name:
                        st.error("Please enter a food name.")
                    else:
                        payload = {
                            "food_name": f_name,
                            "category": f_cat,
                            "quantity": f_qty,
                            "unit": f_unit,
                            "storage_type": f_storage,
                            "purchase_date": date.today().strftime("%Y-%m-%d"),
                            "expiry_date": (date.today() + timedelta(days=f_expiry_days)).strftime("%Y-%m-%d"),
                        }
                        try:
                            api_client.create_inventory_item(payload)
                            st.success(f"Added {f_name} to inventory!")
                            st.rerun()
                        except ApiException as e:
                            st.error(f"Failed to add item: {e.message}")

    try:
        items = api_client.get_inventory(
            category=cat_filter if cat_filter != "All" else None,
            freshness_status=status_filter if status_filter != "All" else None
        )
        if not items:
            st.info("No items found matching the selected filters.")
        else:
            st.subheader(f"Current Perishables ({len(items)} items)")
            for item in items:
                i_id = str(item.get("id") or item.get("_id", ""))
                name = item.get("food_name", "Food Item")
                cat = item.get("category", "General")
                status_str = item.get("freshness_status") or item.get("freshness_category") or "Fresh"
                score_val = float(item.get("freshness_score") or item.get("composite_freshness_score") or 85.0)
                exp_date = item.get("expiry_date", "N/A")

                with st.container():
                    st.markdown(
                        f"""
                        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.9rem; margin-bottom: 0.75rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <strong style="font-size: 1.05rem; color: #0f172a;">{name}</strong>
                                    <span style="font-size: 0.8rem; color: #64748b; margin-left: 8px;">({cat} &bull; {item.get('quantity', 1)} {item.get('unit', '')})</span>
                                </div>
                                <span style="font-size: 0.82rem; color: #475569;">Expiry: <strong>{exp_date}</strong></span>
                            </div>
                        </div>
                        """,
                        unsafe_allow_html=True
                    )

                    c_badge, c_audit, c_rec, c_del = st.columns([2, 1, 1, 1])
                    with c_badge: render_freshness_badge(score_val, status_str)
                    with c_audit:
                        if st.button("🔬 Audit AI", key=f"audit_{i_id}", use_container_width=True):
                            try:
                                res = api_client.analyze_freshness(i_id)
                                st.session_state["last_scan_result"] = res
                                st.success("Audit complete!")
                            except ApiException as e:
                                st.error(f"Audit failed: {e.message}")
                    with c_rec:
                        if st.button("💡 Storage", key=f"rec_{i_id}", use_container_width=True):
                            st.session_state["selected_rec_id"] = i_id
                            st.session_state["consumer_view"] = "💡 Storage Recommendations"
                            st.rerun()
                    with c_del:
                        if st.button("🗑️ Delete", key=f"del_{i_id}", use_container_width=True):
                            try:
                                api_client.delete_inventory_item(i_id)
                                st.success("Item removed.")
                                st.rerun()
                            except ApiException as e:
                                st.error(f"Delete failed: {e.message}")

    except ApiException as e:
        st.error(f"Failed to load inventory: {e.message}")


def _render_history_view():
    st.title("📜 AI Freshness Diagnostic History")
    st.caption("Chronological record of computer vision evaluations and Arrhenius predictions.")

    try:
        records = api_client.get_freshness_history(limit=50)
        if not records:
            st.info("No prior freshness analyses recorded.")
            return

        formatted = []
        for r in records:
            formatted.append({
                "Date": str(r.get("analysis_date", ""))[:19],
                "Food Name": r.get("food_name", "N/A"),
                "Category": r.get("category", "N/A"),
                "Freshness Status": r.get("freshness_label") or r.get("freshness_category", "Fresh"),
                "Quality Score": f"{float(r.get('freshness_score') or 0.0):.1f}%",
                "Confidence": f"{float(r.get('confidence') or 0.0):.1f}%",
                "Shelf-Life": f"{float(r.get('estimated_shelf_life_days') or 0.0):.1f} days",
                "Defects": ", ".join(r.get("detected_defects", [])) or "None",
            })

        st.dataframe(pd.DataFrame(formatted), use_container_width=True)

    except ApiException as e:
        st.error(f"Failed to retrieve history: {e.message}")


def _render_simulator_view():
    st.title("⏳ Arrhenius Shelf-Life Kinetics Simulator")
    st.caption("Interactive temperature-sensitivity modeling (Q10 rule & Arrhenius equation).")

    col_ctrl, col_graph = st.columns([1, 1], gap="large")

    with col_ctrl:
        st.subheader("Simulation Parameters")
        sim_cat = st.selectbox("Food Category", ["Fruits", "Vegetables", "Dairy", "Meat", "Fish", "Bakery", "Grains"])
        sim_name = st.text_input("Food Item", value=f"Sample {sim_cat} Batch")
        sim_temp = st.slider("Storage Temperature (°C)", min_value=-5.0, max_value=35.0, value=4.0, step=0.5)
        sim_humidity = st.slider("Relative Humidity (% RH)", min_value=20.0, max_value=95.0, value=85.0, step=1.0)
        sim_score = st.slider("Initial Freshness Score (%)", min_value=50.0, max_value=100.0, value=95.0, step=1.0)
        sim_packaging = st.selectbox("Packaging Barrier Factor", ["Standard Pack", "Vacuum Pack", "Modified Atmosphere Bag", "Clamshell Punnet", "Tetra Pak", "Open Air"])
        calc = st.button("Simulate Arrhenius Kinetics", type="primary", use_container_width=True)

    with col_graph:
        st.subheader("Kinetic Degradation Projection")
        if calc:
            with st.spinner("Calculating reaction rate constants..."):
                try:
                    sim_res = api_client.simulate_shelf_life(
                        category=sim_cat, food_name=sim_name, storage_temp=sim_temp,
                        storage_humidity=sim_humidity, current_freshness_score=sim_score, packaging_type=sim_packaging
                    )
                    days_rem = float(sim_res.get("predicted_remaining_days") or 7.0)
                    acc_factor = float(sim_res.get("temperature_acceleration_factor") or 1.0)

                    m1, m2 = st.columns(2)
                    with m1: render_metric_card("Estimated Shelf-Life", f"{days_rem:.1f} Days", icon="⏳")
                    with m2: render_metric_card("Temp Acceleration Factor", f"{acc_factor:.2f}x", icon="🌡️")

                    forecast = sim_res.get("forecast_7_days") or [
                        {"day_offset": d, "predicted_quality_score": max(5.0, sim_score - (d * (sim_score / max(1.0, days_rem))))}
                        for d in range(1, 8)
                    ]
                    fig = render_arrhenius_degradation_chart(forecast, current_score=sim_score)
                    st.plotly_chart(fig, use_container_width=True)
                except ApiException as e:
                    st.error(f"Simulation failed: {e.message}")
        else:
            st.info("Adjust the temperature and packaging parameters and click **Simulate Arrhenius Kinetics**.")


def _render_recommendations_view():
    st.title("💡 Prescriptive Food Storage Recommendations")
    st.caption("Science-backed storage guidelines and ethylene sensitivity matrix.")

    categories = ["Fruits", "Vegetables", "Dairy", "Meat", "Fish", "Bakery", "Grains", "Packaged Food"]
    sel_cat = st.selectbox("Select Commodity Category", categories)

    try:
        rec = api_client.get_recommendations_by_category(sel_cat)
        if rec:
            st.subheader(f"Optimal Cold-Chain Parameters for {sel_cat}")
            c1, c2, c3 = st.columns(3)
            with c1: render_metric_card("Optimal Temperature", f"{rec.get('optimal_temperature', '2-4')}°C", icon="🌡️")
            with c2: render_metric_card("Target Humidity", f"{rec.get('optimal_humidity', '85-90')}% RH", icon="💧")
            with c3: render_metric_card("Recommended Zone", rec.get("recommended_zone", "Crisper Drawer"), icon="❄️")

            st.markdown("#### Handling Guidelines & Ethylene Compatibility")
            advice = rec.get("storage_advice") or rec.get("recommendations", [])
            if isinstance(advice, list):
                for tip in advice: st.markdown(f"- {tip}")
            else:
                st.write(str(advice))
    except ApiException as e:
        st.error(f"Failed to load guidelines: {e.message}")
