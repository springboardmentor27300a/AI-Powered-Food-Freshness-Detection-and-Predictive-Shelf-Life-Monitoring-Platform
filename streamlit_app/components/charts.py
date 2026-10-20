"""
Food Freshness Monitoring Platform - Charts Component
"""

import plotly.graph_objects as go
from typing import List, Dict, Any, Optional
import pandas as pd


def render_freshness_donut_chart(
    fresh_count: int = 0,
    expiring_count: Optional[int] = None,
    spoiled_count: int = 0,
    moderate_count: Optional[int] = None,
    marginal_count: Optional[int] = None,
    auto_render: bool = True
) -> go.Figure:
    exp = expiring_count if expiring_count is not None else (moderate_count if moderate_count is not None else (marginal_count or 0))
    labels = ["Fresh", "Expiring / Marginal", "Spoiled"]
    values = [max(0, fresh_count), max(0, exp), max(0, spoiled_count)]
    colors = ["#10b981", "#f59e0b", "#ef4444"]

    fig = go.Figure(
        data=[
            go.Pie(
                labels=labels,
                values=values,
                hole=0.55,
                marker=dict(colors=colors, line=dict(color="#ffffff", width=2)),
                textinfo="label+percent",
                hoverinfo="label+value+percent",
            )
        ]
    )
    fig.update_layout(
        showlegend=True,
        margin=dict(t=20, b=20, l=20, r=20),
        height=280,
        legend=dict(orientation="h", yanchor="bottom", y=-0.2, xanchor="center", x=0.5),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
    )
    if auto_render:
        try:
            import streamlit as st
            st.plotly_chart(fig, use_container_width=True)
        except Exception:
            pass
    return fig


def render_arrhenius_degradation_chart(forecast_days: List[Dict[str, Any]], current_score: float = 95.0, title: str = "Arrhenius Kinetic Shelf-Life Degradation Forecast") -> go.Figure:
    days = [0]
    scores = [current_score]

    for item in forecast_days:
        day_num = item.get("day") or item.get("day_offset", len(days))
        score = item.get("predicted_quality_score") or item.get("freshness_score") or item.get("quality_score", 0.0)
        days.append(day_num)
        scores.append(score)

    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=days,
            y=scores,
            mode="lines+markers",
            name="Projected Quality Score",
            line=dict(color="#0284c7", width=3, shape="spline"),
            marker=dict(size=7, color="#0284c7"),
            fill="tozeroy",
            fillcolor="rgba(2, 132, 199, 0.08)",
        )
    )

    fig.add_hline(y=40.0, line_dash="dash", line_color="#ef4444", annotation_text="Critical Spoilage Threshold (40%)")
    fig.add_hline(y=70.0, line_dash="dot", line_color="#10b981", annotation_text="Optimal Freshness Floor (70%)")

    fig.update_layout(
        title=dict(text=title, font=dict(size=14, color="#1e293b")),
        xaxis=dict(title="Elapsed Storage (Days)", gridcolor="#f1f5f9"),
        yaxis=dict(title="Freshness Score (%)", range=[0, 105], gridcolor="#f1f5f9"),
        margin=dict(t=40, b=40, l=40, r=40),
        height=320,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
    )
    return fig


def render_warehouse_telemetry_chart(
    readings: Any,
    target_temp: float = 4.0,
    min_temp: float = 2.0,
    max_temp: float = 6.0,
    min_safe: Optional[float] = None,
    max_safe: Optional[float] = None
) -> go.Figure:
    lower_bound = min_safe if min_safe is not None else min_temp
    upper_bound = max_safe if max_safe is not None else max_temp

    if readings is None or (isinstance(readings, (list, tuple)) and len(readings) == 0):
        fig = go.Figure()
        fig.update_layout(title="No telemetry readings recorded.")
        return fig

    if isinstance(readings, pd.DataFrame):
        df = readings.copy()
    else:
        df = pd.DataFrame(readings)

    if df.empty:
        fig = go.Figure()
        fig.update_layout(title="No telemetry readings recorded.")
        return fig

    time_col = next((c for c in ["timestamp", "recorded_at", "time", "date"] if c in df.columns), None)
    if time_col:
        df["timestamp"] = pd.to_datetime(df[time_col])
    else:
        df["timestamp"] = range(len(df))
    df = df.sort_values("timestamp")

    fig = go.Figure()
    if "temperature" in df.columns:
        fig.add_trace(go.Scatter(x=df["timestamp"], y=df["temperature"], mode="lines+markers", name="Temperature (°C)", line=dict(color="#0284c7", width=2.5), yaxis="y1"))
    if "humidity" in df.columns:
        fig.add_trace(go.Scatter(x=df["timestamp"], y=df["humidity"], mode="lines", name="Humidity (% RH)", line=dict(color="#10b981", width=2, dash="dot"), yaxis="y2"))

    fig.add_hline(y=upper_bound, line_dash="dash", line_color="#f59e0b", annotation_text=f"Max Safe ({upper_bound}°C)")
    fig.add_hline(y=lower_bound, line_dash="dash", line_color="#3b82f6", annotation_text=f"Min Safe ({lower_bound}°C)")

    fig.update_layout(
        title=dict(text="Storage Zone Environmental Telemetry Trend", font=dict(size=14)),
        xaxis=dict(title="Time", gridcolor="#f1f5f9"),
        yaxis=dict(title="Temperature (°C)", gridcolor="#f1f5f9", side="left"),
        yaxis2=dict(title="Humidity (% RH)", overlaying="y", side="right", range=[0, 100]),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        margin=dict(t=50, b=40, l=40, r=40),
        height=340,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
    )
    return fig


def render_temperature_humidity_history_chart(
    readings: Any,
    target_temp: float = 4.0,
    min_safe: Optional[float] = None,
    max_safe: Optional[float] = None,
    **kwargs
) -> go.Figure:
    fig = render_warehouse_telemetry_chart(
        readings,
        target_temp=target_temp,
        min_safe=min_safe,
        max_safe=max_safe,
        **kwargs
    )
    try:
        import streamlit as st
        st.plotly_chart(fig, use_container_width=True)
    except Exception:
        pass
    return fig


def render_defect_matrix_bar_chart(defects: Any) -> go.Figure:
    if isinstance(defects, dict):
        categories = list(defects.keys())
        scores = [float(v) for v in defects.values()]
    elif isinstance(defects, list):
        categories = []
        scores = []
        for item in defects:
            if isinstance(item, dict):
                cat = item.get("defect") or item.get("name") or item.get("category", "Defect")
                val = float(item.get("percentage") or item.get("score") or item.get("count", 10.0))
                categories.append(str(cat))
                scores.append(val)
            else:
                categories.append(str(item))
                scores.append(25.0)
    else:
        categories = ["No Defects Identified"]
        scores = [0.0]

    fig = go.Figure(
        data=[
            go.Bar(
                x=categories,
                y=scores,
                marker_color=["#ef4444" if s > 50 else "#f59e0b" if s > 25 else "#10b981" for s in scores],
                text=[f"{s:.1f}%" for s in scores],
                textposition="auto",
            )
        ]
    )
    fig.update_layout(
        title=dict(text="Computer Vision Defect Matrix", font=dict(size=14)),
        xaxis=dict(title="Defect Category"),
        yaxis=dict(title="Defect Severity (%)", range=[0, 100], gridcolor="#f1f5f9"),
        margin=dict(t=40, b=30, l=30, r=30),
        height=260,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
    )
    return fig


def render_defect_matrix_chart(defects: Any) -> go.Figure:
    fig = render_defect_matrix_bar_chart(defects)
    try:
        import streamlit as st
        st.plotly_chart(fig, use_container_width=True)
    except Exception:
        pass
    return fig
