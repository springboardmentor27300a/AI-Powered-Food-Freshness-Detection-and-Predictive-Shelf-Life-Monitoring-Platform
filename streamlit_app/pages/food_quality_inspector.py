"""
Food Freshness Monitoring Platform - Food Quality Inspector Dashboard
Provides produce inspection workbench with OpenCV AI vision, regulatory grading,
batch review & human validation, defect analysis, and storage compliance checks.
"""

import streamlit as st
import pandas as pd
from typing import Dict, Any, List, Optional

from streamlit_app.auth import require_role
from streamlit_app.api_client import api_client, ApiException
from streamlit_app.components.navigation import render_sidebar_navigation
from streamlit_app.components.metrics import render_metric_card, render_freshness_badge
from streamlit_app.components.charts import render_freshness_donut_chart, render_defect_matrix_chart
from streamlit_app.components.alerts import render_notifications_center


def render_food_quality_inspector_dashboard():
    require_role(["Food Quality Inspector", "Admin"])

    views = [
        "🔬 Produce Inspection Workbench",
        "📋 Inspection Registry & Review",
        "⚠️ Quality & Spoilage Alerts",
        "📊 QA Analytics & Defect Matrix",
        "🌡️ Cold-Chain Compliance Audit",
    ]

    active_view = render_sidebar_navigation(views, current_view_key="inspector_view")
    render_notifications_center()

    if active_view == "🔬 Produce Inspection Workbench":
        _render_inspection_workbench_view()
    elif active_view == "📋 Inspection Registry & Review":
        _render_registry_view()
    elif active_view == "⚠️ Quality & Spoilage Alerts":
        _render_inspector_alerts_view()
    elif active_view == "📊 QA Analytics & Defect Matrix":
        _render_analytics_view()
    elif active_view == "🌡️ Cold-Chain Compliance Audit":
        _render_storage_audit_view()


def _render_inspection_workbench_view():
    st.title("🔬 Produce Inspection Workbench")
    st.caption("AI-assisted computer vision inspection, defect detection, and sensory grading.")

    # KPI summary
    try:
        dash_data = api_client.get_inspector_dashboard()
        c1, c2, c3, c4 = st.columns(4)
        with c1:
            render_metric_card("Total Inspections", str(dash_data.get("total_inspections", 0)), icon="🔬")
        with c2:
            render_metric_card("Pending Reviews", str(dash_data.get("pending_reviews_count", 0)), delta="Requires Action", delta_color="inverse", icon="⏳")
        with c3:
            render_metric_card("Active Alerts", str(dash_data.get("active_alerts_count", 0)), icon="⚠️")
        with c4:
            avg_q = float(dash_data.get("average_quality_score", 0.0))
            render_metric_card("Avg Quality Score", f"{avg_q:.1f}/100", icon="⭐")
    except Exception:
        pass

    st.markdown("---")

    col_left, col_right = st.columns([1, 1])

    with col_left:
        st.subheader("1. Food Lot & Environmental Metadata")
        p_name = st.text_input("Product Name", value="Fresh Organic Apples", key="insp_pname")
        p_category = st.selectbox("Category", ["Fruits", "Vegetables", "Dairy", "Meat", "Fish", "Bakery", "Grains", "Packaged Food"], key="insp_pcat")
        p_batch = st.text_input("Batch / Lot Traceability Code", value=f"BATCH-{p_category[:3].upper()}-2026", key="insp_pbatch")
        p_loc = st.text_input("Storage Location / Cold Bay", value="Cold Bay 2 - Chiller", key="insp_ploc")

        st.markdown("##### Environmental Conditions")
        c_temp, c_hum = st.columns(2)
        with c_temp:
            obs_temp = st.number_input("Observed Temperature (°C)", value=4.0, step=0.5, key="insp_ptemp")
        with c_hum:
            obs_hum = st.number_input("Observed Humidity (%RH)", value=88.0, step=1.0, key="insp_phum")

        insp_notes = st.text_area("Field Notes & Provenance", placeholder="Visual appearance, supplier seal, initial sensory notes...", key="insp_pnotes")

    with col_right:
        st.subheader("2. Produce Image Acquisition")
        uploaded_file = st.file_uploader(
            "Upload Produce Specimen Image",
            type=["jpg", "jpeg", "png", "webp"],
            help="High-resolution image for OpenCV edge detection, color histogram, and texture scoring.",
            key="insp_image_uploader"
        )

        image_url = None
        if not uploaded_file:
            image_url = st.text_input("Or Provide Image URL", placeholder="https://example.com/produce.jpg", key="insp_img_url")

        if uploaded_file:
            st.image(uploaded_file, caption="Produce Specimen Prepared for AI Analysis", use_container_width=True)

        submit_inspection = st.button("🚀 Run Computer Vision & Grade Inspection", type="primary", use_container_width=True)

    if submit_inspection:
        if not p_name.strip():
            st.error("Please enter a valid product name.")
            return

        file_bytes = None
        file_name = None
        if uploaded_file:
            file_bytes = uploaded_file.getvalue()
            file_name = uploaded_file.name

        try:
            with st.spinner("Executing OpenCV computer vision inspection and calculating shelf-life kinetics..."):
                res = api_client.create_inspector_inspection(
                    file_bytes=file_bytes,
                    file_name=file_name,
                    product_name=p_name.strip(),
                    category=p_category,
                    batch_number=p_batch.strip(),
                    storage_temperature=obs_temp,
                    storage_humidity=obs_hum,
                    storage_location=p_loc.strip(),
                    notes=insp_notes.strip(),
                    image_url=image_url if image_url else None
                )

            st.success("Inspection created and analyzed successfully!")

            # Display Inspection Findings
            ai_data = res.get("ai_result", {})
            st.markdown("### 📊 AI Inspection Findings & Diagnostics")

            r1, r2, r3, r4 = st.columns(4)
            classification = ai_data.get("classification", "Pending")
            confidence = float(ai_data.get("confidence", 0.0)) * 100
            quality_score = float(ai_data.get("quality_score", 0.0))
            spoilage_risk = ai_data.get("spoilage_risk", "Low")
            shelf_life = float(ai_data.get("estimated_shelf_life_days", 0.0))

            with r1:
                render_metric_card("AI Classification", classification, delta=f"{confidence:.1f}% Confidence", icon="🏷️")
            with r2:
                render_metric_card("Quality Score", f"{quality_score:.1f}/100", icon="⭐")
            with r3:
                render_metric_card("Spoilage Risk", spoilage_risk, delta=f"{shelf_life:.1f} Days Rem.", icon="⚠️")
            with r4:
                storage_rev = res.get("storage_review", {})
                st_status = storage_rev.get("status", "Compliant")
                render_metric_card("Storage Compliance", st_status, icon="🌡️")

            # Defect indicators
            defects = ai_data.get("detected_defects", [])
            mold = ai_data.get("mold_detected", False)
            bruising = ai_data.get("bruising_detected", False)

            d_col1, d_col2 = st.columns(2)
            with d_col1:
                st.markdown("##### 🔬 Surface & Texture Metrics")
                st.write(f"- **Color Score:** {ai_data.get('color_score', 0):.1f}/100")
                st.write(f"- **Texture Uniformity:** {ai_data.get('texture_score', 0):.1f}/100")
                st.write(f"- **Browning Index:** {ai_data.get('browning_index', 0):.2f}")
                st.write(f"- **Roughness Index:** {ai_data.get('roughness_index', 0):.2f}")
            with d_col2:
                st.markdown("##### 🚨 Pathological Defects")
                st.write(f"- **Mold Presence:** {'⚠️ DETECTED (' + str(ai_data.get('mold_coverage_pct', 0)) + '%)' if mold else '✅ Negative'}")
                st.write(f"- **Mechanical Bruising:** {'⚠️ Detected' if bruising else '✅ None'}")
                if defects:
                    st.write(f"- **Defect Flags:** {', '.join(defects)}")
                else:
                    st.write("- **Defect Flags:** None identified")

        except ApiException as e:
            st.error(f"Inspection Submission Failed: {e.message}")
        except Exception as e:
            st.error(f"Unexpected error: {e}")


def _render_registry_view():
    st.title("📋 Inspection Registry & Human Validation")
    st.caption("Review automated findings, validate decisions, or flag batches for quarantine.")

    f1, f2, f3 = st.columns(3)
    with f1:
        cat_filter = st.selectbox("Category", ["All", "Fruits", "Vegetables", "Dairy", "Meat", "Fish", "Bakery", "Grains", "Packaged Food"], key="reg_cat")
    with f2:
        status_filter = st.selectbox("Status", ["All", "Pending", "Confirmed", "Flagged", "Requires Further Inspection"], key="reg_status")
    with f3:
        search_kw = st.text_input("Search Product / Batch", placeholder="Search by batch ID or product...", key="reg_search")

    try:
        inspections = api_client.get_inspector_inspections(
            status=status_filter if status_filter != "All" else None,
            batch_id=search_kw.strip() if search_kw.strip() else None,
            limit=50
        )

        if not inspections:
            st.info("No inspection records found matching your filters.")
            return

        st.subheader(f"Inspections ({len(inspections)})")
        for insp in inspections:
            iid = str(insp.get("id") or insp.get("_id", ""))
            pname = insp.get("product_name", "Produce Item")
            cat = insp.get("category", "General")
            batch = insp.get("batch_number", "N/A")
            created_at = insp.get("created_at", "N/A")
            istatus = insp.get("status", "Pending")
            ai_info = insp.get("ai_result", {})
            classification = ai_info.get("classification", "Pending")
            q_score = float(ai_info.get("quality_score", 0.0))

            with st.expander(f"📦 {pname} | Batch: {batch} | AI: {classification} ({q_score:.1f}/100) — Status: {istatus}"):
                c_info1, c_info2 = st.columns(2)
                with c_info1:
                    st.write(f"**Inspection ID:** `{iid}`")
                    st.write(f"**Category:** {cat}")
                    st.write(f"**Logged Date:** {created_at}")
                    st.write(f"**Storage Location:** {insp.get('storage_location', 'N/A')}")
                with c_info2:
                    st.write(f"**AI Classification:** {classification}")
                    st.write(f"**Quality Score:** {q_score:.1f}")
                    st.write(f"**Estimated Shelf-Life:** {ai_info.get('estimated_shelf_life_days', 'N/A')} Days")
                    st.write(f"**Current Status:** `{istatus}`")

                st.markdown("---")
                st.markdown("##### Human Inspector Validation")

                action_choice = st.radio(
                    f"Action for {iid}",
                    ["Validate & Confirm", "Flag for Quarantine / Issue", "Requires Further Lab Inspection"],
                    horizontal=True,
                    key=f"act_choice_{iid}"
                )

                if action_choice == "Validate & Confirm":
                    review_reason = st.text_input("Validation Reason", value="Visual and sensory criteria confirm AI rating.", key=f"rev_reason_{iid}")
                    review_comments = st.text_area("Detailed Comments", key=f"rev_comm_{iid}")
                    if st.button("✅ Confirm Inspection Decision", key=f"btn_confirm_{iid}"):
                        try:
                            api_client.review_inspector_inspection(
                                inspection_id=iid,
                                decision="Confirmed",
                                reason=review_reason,
                                comments=review_comments
                            )
                            st.success("Inspection confirmed successfully!")
                            st.rerun()
                        except ApiException as e:
                            st.error(f"Validation failed: {e.message}")

                elif action_choice == "Flag for Quarantine / Issue":
                    fl_issue = st.selectbox(
                        "Issue Type",
                        ["Spoilage Suspected", "Low Quality", "Storage Violation", "AI Result Requires Review", "Short Remaining Shelf Life"],
                        key=f"flag_issue_{iid}"
                    )
                    fl_sev = st.selectbox("Severity", ["Medium", "High", "Critical", "Low"], key=f"flag_sev_{iid}")
                    fl_reason = st.text_input("Flagging Justification", placeholder="Describe observed defect...", key=f"flag_reason_{iid}")
                    fl_notes = st.text_area("Actionable Instructions", placeholder="Move lot to quarantine chiller...", key=f"flag_comm_{iid}")

                    if st.button("🚩 Flag & Issue Quality Alert", key=f"btn_flag_{iid}"):
                        if not fl_reason.strip():
                            st.error("Justification reason is required when flagging a batch.")
                        else:
                            try:
                                api_client.flag_inspector_inspection(
                                    inspection_id=iid,
                                    reason=fl_reason.strip(),
                                    issue_type=fl_issue,
                                    severity=fl_sev,
                                    comments=fl_notes.strip()
                                )
                                st.warning("Batch flagged and active quality alert raised!")
                                st.rerun()
                            except ApiException as e:
                                st.error(f"Flagging failed: {e.message}")

                elif action_choice == "Requires Further Lab Inspection":
                    rf_notes = st.text_input("Reason for Secondary Review", placeholder="e.g. Inconclusive browning, sending sample for bacterial test.", key=f"rf_notes_{iid}")
                    if st.button("🧪 Mark for Lab Inspection", key=f"btn_rf_{iid}"):
                        try:
                            api_client.review_inspector_inspection(
                                inspection_id=iid,
                                decision="Requires Further Inspection",
                                reason=rf_notes,
                                comments=rf_notes
                            )
                            st.info("Marked for further inspection.")
                            st.rerun()
                        except ApiException as e:
                            st.error(f"Update failed: {e.message}")

    except ApiException as e:
        st.warning(f"Could not load inspection registry: {e.message}")
    except Exception as e:
        st.error(f"Error fetching inspections: {e}")


def _render_inspector_alerts_view():
    st.title("⚠️ Quality & Spoilage Alerts")
    st.caption("Critical spoilage flags, abnormal quality degradations, and cold-chain non-compliance notifications.")

    try:
        alerts = api_client.get_inspector_alerts(status="all")
        if not alerts:
            st.success("🎉 All clear! No active quality or spoilage alerts.")
            return

        st.subheader(f"Alert Notices ({len(alerts)})")
        for a in alerts:
            aid = str(a.get("alert_id") or a.get("id", ""))
            title = a.get("title") or a.get("reason", "Quality Alert")
            desc = a.get("description") or a.get("comments", "Quality threshold exceeded.")
            sev = str(a.get("severity", "Medium"))
            status = a.get("status", "active")
            created_at = a.get("created_at", "N/A")

            color_map = {"Critical": "#ef4444", "High": "#f97316", "Medium": "#f59e0b", "Low": "#3b82f6"}
            b_col = color_map.get(sev, "#94a3b8")

            with st.container():
                st.markdown(
                    f"""
                    <div style="background: white; border-left: 5px solid {b_col}; border-radius: 8px; padding: 1rem; margin-bottom: 0.8rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <div style="display: flex; justify-content: space-between;">
                            <div>
                                <span style="font-weight: 700; color: {b_col}; text-transform: uppercase; font-size: 0.78rem;">{sev} SEVERITY</span>
                                <h4 style="margin: 0.2rem 0; color: #0f172a;">{title}</h4>
                                <div style="font-size: 0.85rem; color: #475569;">{desc}</div>
                                <div style="font-size: 0.78rem; color: #94a3b8; margin-top: 0.3rem;">Logged: {created_at} | Status: <code>{status}</code></div>
                            </div>
                        </div>
                    </div>
                    """,
                    unsafe_allow_html=True
                )

                if status.lower() == "active":
                    with st.expander(f"Resolve Alert #{aid[:8]}"):
                        res_notes = st.text_input("Corrective Resolution Notes", placeholder="e.g. Lot quarantined and supplier notified.", key=f"res_notes_{aid}")
                        act_taken = st.text_input("Action Code", value="QUARANTINE_DISPOSED", key=f"res_act_{aid}")
                        if st.button("Mark Resolved", key=f"res_btn_{aid}"):
                            try:
                                api_client.resolve_inspector_alert(
                                    alert_id=aid,
                                    resolution_notes=res_notes,
                                    action_taken=act_taken
                                )
                                st.success("Alert resolved successfully!")
                                st.rerun()
                            except ApiException as e:
                                st.error(f"Resolution failed: {e.message}")

    except ApiException as e:
        st.warning(f"Could not load alerts: {e.message}")
    except Exception as e:
        st.error(f"Error fetching alerts: {e}")


def _render_analytics_view():
    st.title("📊 QA Analytics & Defect Matrix")
    st.caption("Distribution of inspected produce quality, defect incidence, and category compliance.")

    try:
        analytics = api_client.get_inspector_quality_analytics()
        f_dist = analytics.get("freshness_distribution", {})
        defects = analytics.get("defect_matrix", [])

        c1, c2 = st.columns([1, 1])
        with c1:
            st.subheader("Freshness Classification Distribution")
            if f_dist:
                render_freshness_donut_chart(
                    fresh_count=f_dist.get("Fresh", 0),
                    moderate_count=f_dist.get("Moderately Fresh", 0),
                    spoiled_count=f_dist.get("Spoiled", 0)
                )
            else:
                st.info("No freshness distribution data available.")

        with c2:
            st.subheader("Detected Defect Incidence")
            if defects:
                render_defect_matrix_chart(defects)
            else:
                st.info("No defect patterns detected in current dataset.")

    except ApiException as e:
        st.warning(f"Unable to load QA analytics: {e.message}")
    except Exception as e:
        st.error(f"Error loading analytics: {e}")


def _render_storage_audit_view():
    st.title("🌡️ Cold-Chain Compliance Audit Reference")
    st.caption("Verify storage temperature and humidity tolerances against food science category benchmarks.")

    col1, col2 = st.columns(2)
    with col1:
        cat = st.selectbox("Produce Category to Audit", ["Fruits", "Vegetables", "Dairy", "Meat", "Fish", "Bakery", "Grains", "Packaged Food"], key="audit_cat")
        t_val = st.number_input("Current Storage Temperature (°C)", value=3.5, step=0.5, key="audit_temp")
        h_val = st.number_input("Current Relative Humidity (%)", value=85.0, step=1.0, key="audit_hum")

    with col2:
        st.markdown("### Benchmark Evaluation")
        try:
            audit_res = api_client.get_inspector_storage_review(category=cat, temperature=t_val, humidity=h_val)
            compliant = audit_res.get("status") == "Compliant"
            t_min = audit_res.get("permitted_temp_min", 0.0)
            t_max = audit_res.get("permitted_temp_max", 10.0)
            h_min = audit_res.get("permitted_humidity_min", 70.0)
            h_max = audit_res.get("permitted_humidity_max", 95.0)

            status_color = "#10b981" if compliant else "#ef4444"
            st.markdown(
                f"""
                <div style="background: white; border: 2px solid {status_color}; border-radius: 12px; padding: 1.25rem;">
                    <div style="font-size: 0.85rem; color: #64748b; font-weight: 600;">COMPLIANCE VERDICT</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: {status_color}; margin-top: 0.3rem;">
                        {'✅ COMPLIANT' if compliant else '⚠️ REGULATORY NON-COMPLIANCE'}
                    </div>
                    <hr style="margin: 0.75rem 0;" />
                    <div style="font-size: 0.9rem; color: #334155;">
                        <strong>Safe Temperature Range:</strong> {t_min}°C to {t_max}°C (Observed: {t_val}°C)<br/>
                        <strong>Safe Humidity Range:</strong> {h_min}% to {h_max}% (Observed: {h_val}%)<br/>
                        <strong>Regulatory Note:</strong> {audit_res.get('notes', 'Within standard agricultural storage guidelines.')}
                    </div>
                </div>
                """,
                unsafe_allow_html=True
            )
        except Exception as e:
            st.info(f"Compliance audit engine: {e}")
