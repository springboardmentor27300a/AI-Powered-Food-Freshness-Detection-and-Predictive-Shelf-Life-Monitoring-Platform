import io
from datetime import datetime, date
from typing import List, Dict, Any, Optional

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


# =========================================================
# EXCEL GENERATION ENGINE (openpyxl)
# =========================================================

def generate_excel_report(
    inventory_items: List[Any],
    prediction_items: List[Any],
    stats_summary: Optional[Dict[str, Any]] = None
) -> bytes:
    wb = openpyxl.Workbook()

    # Style constants
    header_fill = PatternFill(start_color="0F2444", end_color="0F2444", fill_type="solid")
    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    title_font = Font(name="Segoe UI", size=14, bold=True, color="0F2444")
    data_font = Font(name="Segoe UI", size=10)
    center_align = Alignment(horizontal="center", vertical="center")
    left_align = Alignment(horizontal="left", vertical="center")
    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )

    # ---------------------------------------------------------
    # SHEET 1: INVENTORY MANAGEMENT & FEFO
    # ---------------------------------------------------------
    ws_inv = wb.active
    ws_inv.title = "Inventory & FEFO"
    ws_inv.views.sheetView[0].showGridLines = True

    # Title Banner
    ws_inv.merge_cells("A1:Q1")
    title_cell = ws_inv["A1"]
    title_cell.value = "FreshSense AI - Tracked Food Inventory & FEFO Queue"
    title_cell.font = title_font
    title_cell.alignment = left_align
    ws_inv.row_dimensions[1].height = 28

    headers_inv = [
        "Item ID", "Food Item Name", "Category", "Quantity", "Unit",
        "Batch / Lot #", "Purchase Date", "Expiry Date", "Days Left",
        "Freshness Status", "Storage Location", "Temp (°C)", "Humidity (%)",
        "Air Circulation", "Light Exposure", "FEFO Priority", "Logged At"
    ]

    ws_inv.append([])  # Blank row 2
    ws_inv.append(headers_inv)  # Row 3
    ws_inv.row_dimensions[3].height = 24

    for col_idx in range(1, len(headers_inv) + 1):
        cell = ws_inv.cell(row=3, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = center_align

    today = date.today()
    for item in inventory_items:
        days_left_val = "N/A"
        if getattr(item, "expiry_date", None):
            try:
                exp = datetime.strptime(item.expiry_date, "%Y-%m-%d").date()
                days_left_val = (exp - today).days
            except Exception:
                pass

        created_str = item.created_at.strftime("%Y-%m-%d %H:%M") if getattr(item, "created_at", None) else ""

        row = [
            getattr(item, "id", ""),
            getattr(item, "food_name", ""),
            getattr(item, "category", "Fruits"),
            getattr(item, "quantity", 1.0),
            getattr(item, "unit", "items"),
            getattr(item, "batch_info", "") or "-",
            getattr(item, "purchase_date", "") or "-",
            getattr(item, "expiry_date", ""),
            days_left_val,
            getattr(item, "freshness_status", "Fresh"),
            getattr(item, "storage_location", "Refrigerator"),
            getattr(item, "storage_temperature", "") if getattr(item, "storage_temperature", None) is not None else "-",
            getattr(item, "humidity", "") if getattr(item, "humidity", None) is not None else "-",
            getattr(item, "air_circulation", "Good"),
            getattr(item, "light_exposure", "Low"),
            getattr(item, "consumption_priority", "Normal"),
            created_str
        ]
        ws_inv.append(row)
        current_row = ws_inv.max_row
        for col_idx in range(1, len(headers_inv) + 1):
            c = ws_inv.cell(row=current_row, column=col_idx)
            c.font = data_font
            c.border = thin_border
            if col_idx in [1, 4, 9, 12, 13]:
                c.alignment = center_align

    # ---------------------------------------------------------
    # SHEET 2: INSPECTION HISTORY & QUALITY TELEMETRY
    # ---------------------------------------------------------
    ws_pred = wb.create_sheet(title="Quality Inspections")
    ws_pred.views.sheetView[0].showGridLines = True

    ws_pred.merge_cells("A1:K1")
    t2 = ws_pred["A1"]
    t2.value = "FreshSense AI - Deep Learning Food Inspection Audit Log"
    t2.font = title_font
    t2.alignment = left_align
    ws_pred.row_dimensions[1].height = 28

    headers_pred = [
        "Audit ID", "Food Sample Image", "Primary Result", "Grade (5-Tier)",
        "Confidence (%)", "Freshness Score (%)", "Overall Quality Score (%)",
        "Color Condition", "Texture Condition", "Estimated Shelf-Life (Days)", "Timestamp"
    ]

    ws_pred.append([])
    ws_pred.append(headers_pred)
    ws_pred.row_dimensions[3].height = 24

    for col_idx in range(1, len(headers_pred) + 1):
        cell = ws_pred.cell(row=3, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = center_align

    for p in prediction_items:
        created_str = p.created_at.strftime("%Y-%m-%d %H:%M") if getattr(p, "created_at", None) else ""
        row = [
            getattr(p, "id", ""),
            getattr(p, "image_name", "Food Sample"),
            getattr(p, "result", ""),
            getattr(p, "grade", "") or getattr(p, "result", ""),
            round(getattr(p, "confidence", 0.0), 2),
            round(getattr(p, "freshness_score", 0.0), 2) if getattr(p, "freshness_score", None) is not None else "-",
            round(getattr(p, "overall_quality_score", 0.0), 1) if getattr(p, "overall_quality_score", None) is not None else "-",
            getattr(p, "color_condition", "Good") or "-",
            getattr(p, "texture_condition", "Good") or "-",
            getattr(p, "estimated_shelf_life_days", "-") or "-",
            created_str
        ]
        ws_pred.append(row)
        current_row = ws_pred.max_row
        for col_idx in range(1, len(headers_pred) + 1):
            c = ws_pred.cell(row=current_row, column=col_idx)
            c.font = data_font
            c.border = thin_border
            if col_idx in [1, 3, 4, 5, 6, 7, 8, 9, 10]:
                c.alignment = center_align

    # ---------------------------------------------------------
    # SHEET 3: PLATFORM SUMMARY ANALYTICS
    # ---------------------------------------------------------
    if stats_summary:
        ws_sum = wb.create_sheet(title="Executive Summary")
        ws_sum.views.sheetView[0].showGridLines = True
        ws_sum.append(["FreshSense AI - Platform Analytics Summary"])
        ws_sum["A1"].font = title_font
        ws_sum.append([])

        summary_rows = [
            ("Total Inspections Logged", stats_summary.get("total_analyses", 0)),
            ("Fresh Classifications", stats_summary.get("fresh", 0)),
            ("Spoiled Classifications", stats_summary.get("spoiled", 0)),
            ("Average Inspection Confidence", f"{stats_summary.get('average_confidence', 0)}%"),
            ("Average Freshness Quality Score", f"{stats_summary.get('average_freshness_score', 0)}%"),
            ("Total Tracked Inventory Items", len(inventory_items)),
            ("Generated Date", datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")),
        ]
        for metric, val in summary_rows:
            ws_sum.append([metric, val])
            r = ws_sum.max_row
            ws_sum.cell(row=r, column=1).font = Font(name="Segoe UI", size=11, bold=True)
            ws_sum.cell(row=r, column=2).font = Font(name="Segoe UI", size=11)

        ws_sum.column_dimensions["A"].width = 35
        ws_sum.column_dimensions["B"].width = 25

    # Auto-adjust column widths for all sheets
    for sheet in [ws_inv, ws_pred]:
        for col in sheet.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                if cell.row > 1 and cell.value:
                    max_len = max(max_len, len(str(cell.value)))
            sheet.column_dimensions[col_letter].width = max(max_len + 3, 12)

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()


# =========================================================
# PDF GENERATION ENGINE (reportlab)
# =========================================================

def generate_pdf_report(
    inventory_items: List[Any],
    prediction_items: List[Any],
    stats_summary: Optional[Dict[str, Any]] = None,
    alerts_summary: Optional[List[Dict[str, Any]]] = None,
    user_name: str = "Authorized Inspector"
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0F2444")
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#475569")
    )
    h2_style = ParagraphStyle(
        "DocH2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#0284C7"),
        spaceBefore=12,
        spaceAfter=6
    )
    body_style = ParagraphStyle(
        "DocBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#1E293B")
    )
    caption_style = ParagraphStyle(
        "DocCaption",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#64748B")
    )

    story = []

    # 1. Header Banner
    story.append(Paragraph("🌿 FreshSense AI – Quality & Freshness Assessment Report", title_style))
    story.append(Paragraph(
        f"<b>Generated At:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')} | "
        f"<b>Prepared For:</b> {user_name} | "
        f"<b>Platform Status:</b> Operational",
        subtitle_style
    ))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#0284C7"), spaceAfter=14))

    # 2. Executive Metrics Summary Table
    total_insp = len(prediction_items)
    fresh_count = sum(1 for p in prediction_items if (getattr(p, "result", "")).lower() == "fresh")
    spoiled_count = sum(1 for p in prediction_items if (getattr(p, "result", "")).lower() == "spoiled")
    avg_score = round(sum(getattr(p, "freshness_score", 0.0) or 0.0 for p in prediction_items) / total_insp, 1) if total_insp > 0 else 0.0
    total_inv = len(inventory_items)

    today = date.today()
    near_exp = 0
    for it in inventory_items:
        if getattr(it, "expiry_date", None):
            try:
                exp = datetime.strptime(it.expiry_date, "%Y-%m-%d").date()
                if (exp - today).days <= 3:
                    near_exp += 1
            except Exception:
                pass

    story.append(Paragraph("1. Executive Summary & Telemetry Overview", h2_style))
    summary_data = [
        [
            Paragraph(f"<b>Total Inspections:</b> {total_insp}", body_style),
            Paragraph(f"<b>Fresh Ratio:</b> {round((fresh_count/total_insp*100),1) if total_insp else 0}%", body_style),
            Paragraph(f"<b>Spoiled Detections:</b> {spoiled_count}", body_style)
        ],
        [
            Paragraph(f"<b>Avg Freshness Score:</b> {avg_score}%", body_style),
            Paragraph(f"<b>Total Inventory Items:</b> {total_inv}", body_style),
            Paragraph(f"<b>Items Near Expiry (≤3d):</b> {near_exp}", body_style)
        ]
    ]
    t_summary = Table(summary_data, colWidths=[180, 180, 180])
    t_summary.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F1F5F9")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t_summary)
    story.append(Spacer(1, 10))

    # 3. Latest Food Inspections (Table)
    story.append(Paragraph("2. Deep Learning Visual Inspections Log", h2_style))
    insp_headers = ["Audit ID", "Sample", "Result", "Grade", "Confidence", "Freshness Score", "Quality Score", "Shelf-Life"]
    insp_data = [[Paragraph(f"<b>{h}</b>", body_style) for h in insp_headers]]

    for p in prediction_items[:8]:
        res_color = "#10B981" if (getattr(p, "result", "")).lower() == "fresh" else "#EF4444"
        insp_data.append([
            Paragraph(f"#{getattr(p, 'id', '')}", body_style),
            Paragraph(f"{(getattr(p, 'image_name', 'Sample'))[:16]}", body_style),
            Paragraph(f"<font color='{res_color}'><b>{getattr(p, 'result', '')}</b></font>", body_style),
            Paragraph(f"{getattr(p, 'grade', '') or '-'}", body_style),
            Paragraph(f"{round(getattr(p, 'confidence', 0), 1)}%", body_style),
            Paragraph(f"{round(getattr(p, 'freshness_score', 0) or 0, 1)}%", body_style),
            Paragraph(f"{round(getattr(p, 'overall_quality_score', 0) or 0, 1)}%", body_style),
            Paragraph(f"{getattr(p, 'estimated_shelf_life_days', '-') or '-'}d", body_style),
        ])

    if len(insp_data) == 1:
        insp_data.append([Paragraph("No recent inspection records available.", caption_style)] + [""]*7)

    t_insp = Table(insp_data, colWidths=[50, 95, 65, 70, 65, 75, 70, 50])
    t_insp.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F2444")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(t_insp)
    story.append(Spacer(1, 10))

    # 4. Storage Environment Standards & Telemetry
    story.append(Paragraph("3. Category Preservation Standards & Storage Telemetry", h2_style))
    storage_headers = ["Category", "Ideal Temp", "Ideal Humidity", "Location", "Recommended Packaging", "Advice"]
    storage_data = [
        [Paragraph(f"<b>{h}</b>", body_style) for h in storage_headers],
        [Paragraph("Fruits", body_style), Paragraph("2.0 - 12.0°C", body_style), Paragraph("85 - 95%", body_style), Paragraph("Crisper Drawer", body_style), Paragraph("Perforated produce wrap", body_style), Paragraph("Prevent ethylene gas stagnation", body_style)],
        [Paragraph("Vegetables", body_style), Paragraph("1.0 - 10.0°C", body_style), Paragraph("85 - 95%", body_style), Paragraph("High Humidity Bin", body_style), Paragraph("Produce wrap / open", body_style), Paragraph("Retain cellular moisture", body_style)],
        [Paragraph("Dairy Products", body_style), Paragraph("1.0 - 4.0°C", body_style), Paragraph("50 - 70%", body_style), Paragraph("Coldest Refrigerator Shelf", body_style), Paragraph("Airtight sealed container", body_style), Paragraph("Avoid temperature swings", body_style)],
        [Paragraph("Meat & Poultry", body_style), Paragraph("-1.0 - 3.0°C", body_style), Paragraph("75 - 85%", body_style), Paragraph("Bottom Shelf / Cold Room", body_style), Paragraph("Vacuum packed / double-wrapped", body_style), Paragraph("Prevent fluid drip contamination", body_style)],
    ]
    t_storage = Table(storage_data, colWidths=[70, 75, 75, 105, 115, 100])
    t_storage.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0284C7")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(t_storage)
    story.append(Spacer(1, 10))

    # 5. Inventory Items & FEFO Schedule
    story.append(Paragraph("4. Food Inventory & FEFO (First-Expired, First-Out) Priority", h2_style))
    inv_headers = ["Item Name", "Category", "Quantity", "Expiry Date", "Days Left", "Freshness", "Priority"]
    inv_data = [[Paragraph(f"<b>{h}</b>", body_style) for h in inv_headers]]

    for it in inventory_items[:8]:
        days_left_val = "N/A"
        if getattr(it, "expiry_date", None):
            try:
                exp = datetime.strptime(it.expiry_date, "%Y-%m-%d").date()
                days_left_val = (exp - today).days
            except Exception:
                pass

        prio_color = "#EF4444" if (getattr(it, "consumption_priority", "") == "Consume First" or (isinstance(days_left_val, int) and days_left_val <= 2)) else "#10B981"
        inv_data.append([
            Paragraph(f"<b>{getattr(it, 'food_name', '')}</b>", body_style),
            Paragraph(f"{getattr(it, 'category', 'Fruits')}", body_style),
            Paragraph(f"{getattr(it, 'quantity', 1.0)} {getattr(it, 'unit', '')}", body_style),
            Paragraph(f"{getattr(it, 'expiry_date', '')}", body_style),
            Paragraph(f"{days_left_val}d" if isinstance(days_left_val, int) else "N/A", body_style),
            Paragraph(f"{getattr(it, 'freshness_status', 'Fresh')}", body_style),
            Paragraph(f"<font color='{prio_color}'><b>{getattr(it, 'consumption_priority', 'Normal')}</b></font>", body_style)
        ])

    if len(inv_data) == 1:
        inv_data.append([Paragraph("No active inventory records in system.", caption_style)] + [""]*6)

    t_inv = Table(inv_data, colWidths=[120, 80, 60, 80, 55, 75, 70])
    t_inv.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F2444")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(t_inv)
    story.append(Spacer(1, 10))

    # 6. Active Alerts Summary
    if alerts_summary and len(alerts_summary) > 0:
        story.append(Paragraph("5. Active Risk Warnings & Critical Alerts", h2_style))
        alert_data = [
            [Paragraph("<b>Severity</b>", body_style), Paragraph("<b>Alert Title</b>", body_style), Paragraph("<b>Details & Action</b>", body_style)]
        ]
        for a in alerts_summary[:5]:
            sev = a.get("type", "WARNING")
            sev_color = "#EF4444" if sev == "CRITICAL" else "#F59E0B"
            alert_data.append([
                Paragraph(f"<font color='{sev_color}'><b>{a.get('badge', sev)}</b></font>", body_style),
                Paragraph(f"<b>{a.get('title', '')}</b>", body_style),
                Paragraph(f"{a.get('message', '')}", body_style)
            ])
        t_alert = Table(alert_data, colWidths=[90, 150, 300])
        t_alert.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(t_alert)
        story.append(Spacer(1, 10))

    # 7. Food Safety Disclaimer
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E2E8F0"), spaceAfter=6, spaceBefore=8))
    story.append(Paragraph(
        "<b>Food Safety Notice:</b> FreshSense AI provides automated quality scoring using MobileNetV2 deep learning and heuristic computer vision. "
        "Outputs are intended for operational decision support and waste reduction and do not replace statutory microbiological laboratory testing.",
        caption_style
    ))

    doc.build(story)
    return buffer.getvalue()
