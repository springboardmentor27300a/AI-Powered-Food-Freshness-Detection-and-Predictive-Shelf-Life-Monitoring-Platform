"""
app/services/report_service.py

Two responsibilities:
  1. generate_report() — runs the full Milestone 2/3 workflow for an
     already-uploaded, already-analyzed image: pulls the CNN prediction +
     visual analysis for that image, computes shelf life, computes the
     weighted freshness score, generates recommendations, and saves one
     FreshnessReport row that snapshots everything.
  2. build_report_pdf() — renders that report to a real PDF via ReportLab.
"""
import io
import uuid
from datetime import datetime, timezone
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (Image as RLImage, Paragraph, SimpleDocTemplate,
                                 Spacer, Table, TableStyle)
from sqlalchemy.orm import Session

from app.models.analysis import CNNPrediction, VisualAnalysisResult
from app.models.batch import Batch
from app.models.food_image import FoodImage
from app.models.report import FreshnessCategory, FreshnessReport, ReportStatus
from app.models.shelf_life import ShelfLifePrediction
from app.services import recommendation_service, scoring_service, shelf_life_service
from app.services.image_service import get_image_path
from app.services.notification_service import create_notification


def _generate_report_number(db: Session) -> str:
    year = datetime.now(timezone.utc).year
    count = db.query(FreshnessReport).count() + 1
    return f"FC-RPT-{year}-{count:05d}"


def generate_report(db: Session, batch_id: uuid.UUID, image_id: uuid.UUID,
                     inspector_id: uuid.UUID, notes: str | None = None) -> FreshnessReport:
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if batch is None:
        raise ValueError("Batch not found")

    image = db.query(FoodImage).filter(FoodImage.id == image_id).first()
    if image is None:
        raise ValueError("Image not found")

    cnn_pred = db.query(CNNPrediction).filter(CNNPrediction.image_id == image_id).first()
    visual = db.query(VisualAnalysisResult).filter(VisualAnalysisResult.image_id == image_id).first()
    if visual is None:
        raise ValueError("Run image analysis (POST /api/images/{id}/analyze) before generating a report")

    # --- Shelf life ---
    shelf_life = shelf_life_service.generate_and_save(
        db, batch, overall_visual_score=visual.overall_visual_score, created_by=inspector_id
    )

    # --- Weighted freshness score ---
    age_source = batch.received_date or batch.manufacturing_date or batch.created_at.date()
    product_age_days = (datetime.now(timezone.utc).date() - age_source).days
    category_baseline = shelf_life_service.CATEGORY_BASELINE_DAYS.get(
        batch.food_item.category.value, 7
    )

    score_result = scoring_service.compute_freshness_score(
        overall_visual_score=visual.overall_visual_score,
        cnn_predicted_class=cnn_pred.predicted_class if cnn_pred else None,
        cnn_confidence=cnn_pred.confidence if cnn_pred else None,
        temperature_factor=shelf_life.factors.get("temperature_factor"),
        humidity_factor=shelf_life.factors.get("humidity_factor"),
        is_storage_compliant=None,
        estimated_days_remaining=shelf_life.estimated_days_remaining,
        category_baseline_days=category_baseline,
        product_age_days=product_age_days,
    )

    from app.services import storage_service
    latest_reading = storage_service.latest_reading_for_batch(db, batch.id)
    storage_snapshot = None
    if latest_reading:
        storage_snapshot = {
            "temperature_c": latest_reading.temperature_c,
            "humidity_pct": latest_reading.humidity_pct,
            "storage_location": latest_reading.storage_location,
            "is_compliant": latest_reading.is_compliant,
            "recorded_at": latest_reading.recorded_at.isoformat(),
        }

    report = FreshnessReport(
        report_number=_generate_report_number(db),
        batch_id=batch.id,
        image_id=image.id,
        cnn_prediction_id=cnn_pred.id if cnn_pred else None,
        visual_analysis_id=visual.id,
        shelf_life_prediction_id=shelf_life.id,
        visual_component_score=score_result.visual_component_score,
        storage_component_score=score_result.storage_component_score,
        shelf_life_component_score=score_result.shelf_life_component_score,
        product_age_component_score=score_result.product_age_component_score,
        freshness_score=score_result.freshness_score,
        freshness_category=FreshnessCategory(score_result.freshness_category),
        spoilage_probability_pct=score_result.spoilage_probability_pct,
        storage_conditions_snapshot=storage_snapshot,
        inspector_id=inspector_id,
        status=ReportStatus.FINALIZED,
        notes=notes,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    # --- Shelf-life warning notification ---
    if shelf_life.estimated_days_remaining <= 2:
        create_notification(
        db,
        user_id=inspector_id,
        title=f"Shelf-Life Warning: {batch.food_item.name}",
        message=(
            f"Batch {batch.batch_code} has approximately "
            f"{shelf_life.estimated_days_remaining} day(s) of shelf life remaining. "
            f"Risk level: {shelf_life.risk_level.value}."
        ),
        severity="critical" if shelf_life.estimated_days_remaining <= 0 else "warning",
        notification_type="shelf_life",
        reference_type="shelf_life_prediction",
        reference_id=shelf_life.id,
        action_url=f"/reports/{report.id}",
    )
    # --- Recommendations (generated after the report exists, referencing it) ---
    recs = recommendation_service.generate_for_batch(db, batch, shelf_life, report)
    
    
    report.recommendations_snapshot = [
        {"type": r.type.value, "priority": r.priority.value, "title": r.title, "message": r.message}
        for r in recs
    ]
    db.commit()
    db.refresh(report)

    # --- Freshness notification ---
    if report.freshness_category in {
        FreshnessCategory.NEAR_SPOILAGE,
        FreshnessCategory.SPOILED,
    }:
        severity = (
            "critical"
            if report.freshness_category == FreshnessCategory.SPOILED
            else "warning"
        )

        create_notification(
            db,
            user_id=inspector_id,
            title=f"Freshness Alert: {batch.food_item.name}",
            message=(
                f"Batch {batch.batch_code} has been classified as "
                f"{report.freshness_category.value.replace('_', ' ').title()}. "
                f"Freshness score: {report.freshness_score}."
            ),
            severity=severity,
            notification_type="freshness",
            reference_type="freshness_report",
            reference_id=report.id,
            action_url=f"/reports/{report.id}",
        )
        if report.freshness_category == FreshnessCategory.SPOILED:
            create_notification(
        db,
        user_id=inspector_id,
        title=f"Spoilage Detected: {batch.food_item.name}",
        message=(
            f"Batch {batch.batch_code} has been classified as SPOILED. "
            f"Freshness score: {report.freshness_score}. "
            f"Please review the batch and take appropriate action."
        ),
        severity="critical",
        notification_type="spoilage",
        reference_type="freshness_report",
        reference_id=report.id,
        action_url=f"/reports/{report.id}",
    )
    return report


# ------------------------- PDF generation -------------------------

_CATEGORY_COLORS = {
    "fresh": colors.HexColor("#16a34a"),
    "good": colors.HexColor("#65a30d"),
    "acceptable": colors.HexColor("#ca8a04"),
    "near_spoilage": colors.HexColor("#ea580c"),
    "spoiled": colors.HexColor("#dc2626"),
}


def build_report_pdf(report: FreshnessReport) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1.5 * cm, bottomMargin=1.5 * cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleFC", parent=styles["Title"], textColor=colors.HexColor("#166534"))
    h2 = ParagraphStyle("H2FC", parent=styles["Heading2"], textColor=colors.HexColor("#166534"), spaceBefore=10)
    normal = styles["Normal"]
    small = ParagraphStyle("Small", parent=styles["Normal"], fontSize=8, textColor=colors.grey)

    elements = []
    elements.append(Paragraph("FoodCare", title_style))
    elements.append(Paragraph("AI-Based Food Freshness Monitoring &amp; Shelf-Life Prediction Platform", small))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(f"Freshness Report — {report.report_number}", h2))

    batch = report.batch
    food_item = batch.food_item
    meta_data = [
        ["Report ID", report.report_number, "Analysis Date", report.created_at.strftime("%Y-%m-%d %H:%M UTC")],
        ["Food Item", food_item.name, "Category", food_item.category.value.replace("_", " ").title()],
        ["Batch Code", batch.batch_code, "Expiry Date", str(batch.expiry_date)],
        ["Inspector", report.inspector.full_name if report.inspector else "-", "Report Status", report.status.value.title()],
    ]
    meta_table = Table(meta_data, colWidths=[3 * cm, 5.5 * cm, 3 * cm, 5.5 * cm])
    meta_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 12))

    if report.image:
        try:
            img_path = get_image_path(report.image)
            if Path(img_path).exists():
                elements.append(RLImage(str(img_path), width=6 * cm, height=6 * cm, kind="proportional"))
                elements.append(Spacer(1, 10))
        except Exception:
            pass

    elements.append(Paragraph("CNN Model Prediction", h2))
    cnn = report.cnn_prediction
    if cnn and cnn.status.value == "success":
        elements.append(Paragraph(
            f"Predicted class: <b>{cnn.predicted_class}</b> &nbsp;|&nbsp; Confidence: <b>{cnn.confidence * 100:.1f}%</b> "
            f"&nbsp;|&nbsp; Model: {cnn.model_version}", normal))
    else:
        reason = cnn.error_message if cnn else "No CNN prediction was run for this image."
        elements.append(Paragraph(f"CNN prediction unavailable. Reason: {reason}", normal))
    elements.append(Spacer(1, 8))

    elements.append(Paragraph("Visual Condition Analysis (OpenCV)", h2))
    va = report.visual_analysis
    if va:
        visual_table = Table([
            ["Color", "Texture", "Dark Spots", "Bruising", "Damage", "Overall"],
            [f"{va.color_score}", f"{va.texture_score}", f"{va.dark_spot_score}",
             f"{va.bruising_score}", f"{va.damage_score}", f"{va.overall_visual_score}"],
        ], colWidths=[2.8 * cm] * 6)
        visual_table.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0fdf4")),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ]))
        elements.append(visual_table)
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(va.summary, normal))
        elements.append(Paragraph(f"<i>{va.explanation}</i>", small))
    elements.append(Spacer(1, 10))

    elements.append(Paragraph("Freshness Assessment", h2))
    cat_color = _CATEGORY_COLORS.get(report.freshness_category.value, colors.black)
    score_table = Table([
        ["Visual (40%)", "Storage (25%)", "Shelf Life (20%)", "Product Age (15%)", "Overall Score", "Category"],
        [f"{report.visual_component_score}", f"{report.storage_component_score}",
         f"{report.shelf_life_component_score}", f"{report.product_age_component_score}",
         f"{report.freshness_score}", report.freshness_category.value.replace("_", " ").title()],
    ], colWidths=[2.6 * cm] * 4 + [2.4 * cm, 3 * cm])
    score_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0fdf4")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TEXTCOLOR", (5, 1), (5, 1), cat_color),
        ("FONTNAME", (5, 1), (5, 1), "Helvetica-Bold"),
    ]))
    elements.append(score_table)
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(f"Spoilage probability estimate: <b>{report.spoilage_probability_pct}%</b>", normal))
    elements.append(Spacer(1, 10))

    elements.append(Paragraph("Storage Conditions", h2))
    if report.storage_conditions_snapshot:
        s = report.storage_conditions_snapshot
        elements.append(Paragraph(
            f"{s.get('temperature_c')}\u00b0C, {s.get('humidity_pct')}% humidity at "
            f"{s.get('storage_location')} — recorded {s.get('recorded_at')}. "
            f"Compliant: {'Yes' if s.get('is_compliant') else 'No'}.", normal))
    else:
        elements.append(Paragraph("No storage reading was available at the time of this report; default "
                                   "reference conditions were used in the shelf-life estimate.", normal))
    elements.append(Spacer(1, 10))

    elements.append(Paragraph("Shelf-Life Estimate", h2))
    sl = report.shelf_life_prediction
    if sl:
        elements.append(Paragraph(
            f"Estimated <b>{sl.estimated_days_remaining} day(s)</b> remaining "
            f"(expiry ~{sl.estimated_expiry_date}), risk level: <b>{sl.risk_level.value}</b>, "
            f"confidence: {sl.confidence_pct}%.", normal))
        elements.append(Paragraph(f"<i>{sl.explanation}</i>", small))
    elements.append(Spacer(1, 10))

    elements.append(Paragraph("Recommendations", h2))
    if report.recommendations_snapshot:
        for rec in report.recommendations_snapshot:
            elements.append(Paragraph(f"\u2022 <b>[{rec['priority'].upper()}] {rec['title']}:</b> {rec['message']}", normal))
    else:
        elements.append(Paragraph("No recommendations were generated.", normal))
    elements.append(Spacer(1, 14))

    elements.append(Paragraph(
        "Disclaimer: FoodCare is a monitoring and decision-support tool. CNN predictions and OpenCV visual "
        "indicators are automated estimates and are not a substitute for professional food safety inspection "
        "or laboratory testing. Shelf-life figures are model/rule-based estimates, not guarantees.",
        small,
    ))

    doc.build(elements)
    return buffer.getvalue()
