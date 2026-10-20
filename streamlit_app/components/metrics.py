"""
Food Freshness Monitoring Platform - Metrics Component
"""

import streamlit as st
from typing import Optional


def render_metric_card(title: str, value: str, delta: Optional[str] = None, icon: str = "📊", subtitle: Optional[str] = None):
    st.markdown(
        f"""
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.4rem;">
                <span style="font-size: 0.82rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">{title}</span>
                <span style="font-size: 1.3rem;">{icon}</span>
            </div>
            <div style="font-size: 1.75rem; font-weight: 800; color: #0f172a; line-height: 1.1;">{value}</div>
            {f'<div style="font-size: 0.8rem; color: #10b981; margin-top: 0.3rem;">▲ {delta}</div>' if delta else ''}
            {f'<div style="font-size: 0.78rem; color: #94a3b8; margin-top: 0.35rem;">{subtitle}</div>' if subtitle else ''}
        </div>
        """,
        unsafe_allow_html=True
    )


def render_freshness_badge(score: float, status_label: Optional[str] = None):
    score_val = float(score or 0.0)
    if not status_label:
        if score_val >= 70.0: status_label = "Fresh"
        elif score_val >= 40.0: status_label = "Expiring Soon"
        else: status_label = "Spoiled"

    if status_label == "Fresh":
        bg, fg, border, icon = "#ecfdf5", "#065f46", "#a7f3d0", "🌿"
    elif status_label == "Expiring Soon":
        bg, fg, border, icon = "#fffbeb", "#92400e", "#fde68a", "⏳"
    else:
        bg, fg, border, icon = "#fef2f2", "#991b1b", "#fecaca", "⚠️"

    st.markdown(
        f"""
        <div style="display: inline-flex; align-items: center; gap: 6px; background: {bg}; color: {fg}; border: 1px solid {border}; border-radius: 8px; padding: 4px 10px; font-weight: 700; font-size: 0.85rem;">
            <span>{icon}</span>
            <span>{status_label} ({score_val:.1f}%)</span>
        </div>
        """,
        unsafe_allow_html=True
    )


def render_severity_badge(severity: str):
    s = (severity or "Low").capitalize()
    colors = {
        "Critical": ("#fef2f2", "#991b1b", "#fecaca"),
        "High": ("#fff1f2", "#9f1239", "#fecdd3"),
        "Medium": ("#fffbeb", "#92400e", "#fde68a"),
        "Low": ("#f0fdf4", "#166534", "#bbf7d0"),
    }
    bg, fg, border = colors.get(s, colors["Low"])
    st.markdown(
        f"""
        <span style="background: {bg}; color: {fg}; border: 1px solid {border}; border-radius: 6px; padding: 2px 8px; font-size: 0.75rem; font-weight: 700;">
            {s}
        </span>
        """,
        unsafe_allow_html=True
    )
