"""
Freshness reports API endpoints.

Endpoints:
- POST /reports/generate - Generate a freshness report (from image + batch)
- GET  /reports - List user's freshness reports
- GET  /reports/summary - Aggregated report statistics
- GET  /reports/{report_id} - Get specific report
- GET  /reports/{report_id}/download - Download report as HTML
"""
import json
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import HTMLResponse, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import FoodBatch, FreshnessReport as FreshnessReportModel, User
from app.ml.freshness_scorer import FreshnessClassifier
from app.ml.spoilage_detector import SpoilageDetector
from app.ml.report_generator import FreshnessReportGenerator
from app.routers.batches import _ensure_can_view, _get_batch_or_404
from app.schemas import (
    FreshnessReportResponse,
    ReportSummary,
)
from app.services.report_export import (
    batch_report_data,
    build_excel,
    build_pdf,
    inventory_report_data,
    is_valid_report_type,
    table_report_data,
    _REPORT_TYPES,
)

router = APIRouter(prefix="/reports", tags=["Freshness Reports"])

_report_generator = FreshnessReportGenerator()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
MAX_SIZE = 10 * 1024 * 1024


@router.post("/generate", response_model=FreshnessReportResponse)
async def generate_freshness_report(
    file: UploadFile = File(..., description="Food image for analysis"),
    food_name: str = Form("Unknown Food"),
    food_category: Optional[str] = Form(None),
    batch_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate a comprehensive freshness report from a food image."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {file.content_type}.")

    image_bytes = await file.read()
    if len(image_bytes) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Image exceeds 10 MB limit.")
    if len(image_bytes) < 100:
        raise HTTPException(status_code=400, detail="Image file is too small or empty.")

    # Get batch context if linked
    days_to_expiry = None
    inventory_status = None
    if batch_id:
        batch = db.query(FoodBatch).filter(FoodBatch.batch_id == batch_id).first()
        if not batch:
            raise HTTPException(status_code=404, detail=f"Batch '{batch_id}' not found.")
        if food_category is None:
            food_category = batch.category
        if food_name == "Unknown Food":
            food_name = batch.food_name
        days_to_expiry = batch.days_to_expiry
        inventory_status = batch.freshness_status

    # Run analysis
    classifier = FreshnessClassifier()
    detector = SpoilageDetector()

    try:
        assessment = classifier.assess(image_bytes, food_category)
        spoilage = detector.detect(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    # Generate report
    report = _report_generator.generate(
        assessment=assessment,
        spoilage=spoilage,
        batch_id=batch_id,
        food_name=food_name,
        food_category=food_category,
        days_to_expiry=days_to_expiry,
        inventory_freshness_status=inventory_status,
    )

    # Persist
    db_report = FreshnessReportModel(
        report_id=report.report_id,
        user_id=user.id,
        batch_id_ref=batch_id,
        food_name=report.food_name,
        food_category=report.food_category,
        classification=report.classification,
        confidence_score=report.confidence_score,
        spoilage_detected=report.spoilage_detected,
        spoilage_probability=report.spoilage_probability,
        risk_level=report.risk_level,
        recommended_action=report.recommended_action,
        estimated_shelf_life_days=report.estimated_shelf_life_days,
        report_data=json.dumps({
            "freshness_score": report.freshness_score,
            "color_score": report.color_score,
            "texture_score": report.texture_score,
            "mold_risk": report.mold_risk,
            "bruise_risk": report.bruise_risk,
            "damage_risk": report.damage_risk,
            "color_status": report.color_status,
            "texture_status": report.texture_status,
            "mold_indicator": report.mold_indicator,
            "bruise_severity": report.bruise_severity,
            "damage_severity": report.damage_severity,
            "image_quality_score": report.image_quality_score,
            "spoilage_types": report.spoilage_types,
            "spoilage_indicators": report.spoilage_indicators,
            "analysis_details": report.analysis_details,
        }),
        days_to_expiry=report.days_to_expiry,
        inventory_freshness_status=report.inventory_freshness_status,
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)

    return _to_response(db_report)


@router.get("", response_model=list[FreshnessReportResponse])
def list_reports(
    skip: int = 0,
    limit: int = 20,
    classification: Optional[str] = None,
    risk_level: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List freshness reports for the current user."""
    query = db.query(FreshnessReportModel).filter(FreshnessReportModel.user_id == user.id)

    if classification:
        query = query.filter(FreshnessReportModel.classification == classification)
    if risk_level:
        query = query.filter(FreshnessReportModel.risk_level == risk_level)

    reports = query.order_by(FreshnessReportModel.created_at.desc()).offset(skip).limit(limit).all()
    return [_to_response(r) for r in reports]


@router.get("/summary", response_model=ReportSummary)
def get_report_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get aggregated report statistics."""
    base = db.query(FreshnessReportModel).filter(FreshnessReportModel.user_id == user.id)

    total = base.count()
    if total == 0:
        return ReportSummary(
            total_reports=0,
            classification_counts={},
            risk_level_counts={},
            avg_confidence=0.0,
            spoilage_detected_count=0,
            recent_reports=[],
        )

    class_counts = dict(
        base.with_entities(FreshnessReportModel.classification, func.count(FreshnessReportModel.id))
        .group_by(FreshnessReportModel.classification).all()
    )
    risk_counts = dict(
        base.with_entities(FreshnessReportModel.risk_level, func.count(FreshnessReportModel.id))
        .group_by(FreshnessReportModel.risk_level).all()
    )
    avg_conf = base.with_entities(func.avg(FreshnessReportModel.confidence_score)).scalar() or 0.0
    spoilage_count = base.filter(FreshnessReportModel.spoilage_detected == True).count()

    recent = base.order_by(FreshnessReportModel.created_at.desc()).limit(5).all()

    return ReportSummary(
        total_reports=total,
        classification_counts=class_counts,
        risk_level_counts=risk_counts,
        avg_confidence=round(float(avg_conf), 3),
        spoilage_detected_count=spoilage_count,
        recent_reports=[_to_response(r) for r in recent],
    )


_FILE_TYPES = ("pdf", "xlsx")
_MEDIA = {"pdf": "application/pdf", "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}


def _download_response(data: dict, file_format: str, filename: str) -> Response:
    if file_format == "pdf":
        content = build_pdf(data)
    else:
        content = build_excel(data)
    return Response(
        content=content,
        media_type=_MEDIA[file_format],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/data")
def get_report_data(
    report_type: str = Query(default="freshness", description="freshness | shelf_life | inventory_quality | waste_reduction | storage_compliance"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Retrieve structured data for any of the five Milestone 4 report types."""
    if not is_valid_report_type(report_type):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported report type '{report_type}'. Allowed types: {', '.join(_REPORT_TYPES)}."
        )
    return table_report_data(db, user, report_type)


@router.get("/export", response_class=Response)
def export_report(
    report_type: str = Query(default="freshness", description="freshness | shelf_life | inventory_quality | waste_reduction | storage_compliance"),
    file_format: str = Query(default="pdf", description="pdf | xlsx"),
    batch_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Universal export endpoint for all 5 report types in PDF or Excel."""
    if not is_valid_report_type(report_type):
        raise HTTPException(status_code=400, detail=f"Unsupported report type '{report_type}'.")
    if file_format not in _FILE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported format '{file_format}'.")

    if batch_id:
        batch = _get_batch_or_404(db, batch_id)
        _ensure_can_view(user, batch)
        data = batch_report_data(db, batch)
        filename = f"{report_type}-{batch_id}-{date.today().isoformat()}.{file_format}"
    else:
        data = table_report_data(db, user, report_type)
        filename = f"{report_type}-report-{date.today().isoformat()}.{file_format}"

    return _download_response(data, file_format, filename)


@router.get("/export-inventory", response_class=Response)
def export_inventory_report(
    report_type: str = Query(default="inventory_quality", description="freshness | shelf_life | inventory_quality | waste_reduction | storage_compliance"),
    file_format: str = Query(default="pdf", description="pdf | xlsx"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Export an inventory report (PDF/Excel). Supports all five report types."""
    if not is_valid_report_type(report_type):
        raise HTTPException(status_code=400, detail=f"Unsupported report type '{report_type}'.")
    if file_format not in _FILE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported format '{file_format}'.")

    data = table_report_data(db, user, report_type)
    return _download_response(data, file_format, f"inventory-{report_type}-{date.today().isoformat()}.{file_format}")


@router.get("/export/{batch_id}", response_class=Response)
def export_batch_report(
    batch_id: str,
    report_type: str = Query(default="freshness", description="freshness | shelf_life | storage_compliance | inventory_quality | waste_reduction"),
    file_format: str = Query(default="pdf", description="pdf | xlsx"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Export a per-batch report (PDF/Excel)."""
    if not is_valid_report_type(report_type):
        raise HTTPException(status_code=400, detail=f"Unsupported report type '{report_type}'.")
    if file_format not in _FILE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported format '{file_format}'.")

    batch = _get_batch_or_404(db, batch_id)
    _ensure_can_view(user, batch)

    data = batch_report_data(db, batch)
    titles = {
        "freshness": "Batch Freshness Report",
        "shelf_life": "Shelf-Life Prediction Report",
        "storage_compliance": "Storage Compliance Report",
        "inventory_quality": "Inventory Quality Report",
        "waste_reduction": "Waste Reduction Report",
    }
    data["title"] = titles.get(report_type, "Batch Report")
    return _download_response(data, file_format, f"{report_type}-{batch_id}-{date.today().isoformat()}.{file_format}")


@router.get("/{report_id}", response_model=FreshnessReportResponse)
def get_report(
    report_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a specific freshness report."""
    report = db.query(FreshnessReportModel).filter(
        FreshnessReportModel.report_id == report_id,
        FreshnessReportModel.user_id == user.id,
    ).first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    return _to_response(report)


@router.get("/{report_id}/download", response_class=HTMLResponse)
def download_report(
    report_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Download a freshness report as a printable HTML document."""
    report = db.query(FreshnessReportModel).filter(
        FreshnessReportModel.report_id == report_id,
        FreshnessReportModel.user_id == user.id,
    ).first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")

    data = None
    if report.report_data:
        try:
            data = json.loads(report.report_data)
        except (json.JSONDecodeError, TypeError):
            data = None

    color_score = data.get("color_score", 0) if data else 0
    texture_score = data.get("texture_score", 0) if data else 0
    mold_risk = data.get("mold_risk", 0) if data else 0
    bruise_risk = data.get("bruise_risk", 0) if data else 0
    damage_risk = data.get("damage_risk", 0) if data else 0
    image_quality = data.get("image_quality_score", 0) if data else 0
    spoilage_indicators = data.get("spoilage_indicators", []) if data else []

    classification = report.classification
    cls_colors = {
        "Fresh": "#16a34a",
        "Good": "#0ea5e9",
        "Acceptable": "#d97706",
        "Near Spoilage": "#f43f5e",
        "Spoiled": "#dc2626",
    }
    cls_color = cls_colors.get(classification, "#6b7280")

    indicators_html = ""
    for ind in spoilage_indicators:
        status = "Detected" if ind.get("detected") else "Not Detected"
        color = "#dc2626" if ind.get("detected") else "#16a34a"
        indicators_html += f"""
        <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">{ind.get('name', 'N/A')}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;color:{color};font-weight:600;">{status}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">{ind.get('probability', 0)*100:.1f}%</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">{ind.get('severity', 'N/A')}</td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Freshness Report - {report.report_id}</title>
<style>
  body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f9fafb; color: #1f2937; }}
  .container {{ max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }}
  .header {{ background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 32px; text-align: center; }}
  .header h1 {{ margin: 0 0 8px; font-size: 1.5rem; }}
  .header p {{ margin: 0; opacity: 0.9; font-size: 0.9rem; }}
  .section {{ padding: 24px 32px; border-bottom: 1px solid #e5e7eb; }}
  .section:last-child {{ border-bottom: none; }}
  .section h2 {{ font-size: 1.1rem; color: #059669; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.5px; }}
  .score-grid {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px; }}
  .score-card {{ text-align: center; padding: 16px; background: #f9fafb; border-radius: 8px; }}
  .score-card .value {{ font-size: 2rem; font-weight: 700; }}
  .score-card .label {{ font-size: 0.8rem; color: #6b7280; margin-top: 4px; }}
  .badge {{ display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 0.85rem; font-weight: 600; }}
  table {{ width: 100%; border-collapse: collapse; }}
  th {{ text-align: left; padding: 8px; background: #f3f4f6; font-size: 0.85rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }}
  .footer {{ padding: 24px 32px; background: #f9fafb; font-size: 0.8rem; color: #9ca3af; text-align: center; }}
  @media print {{ body {{ padding: 0; }} .container {{ box-shadow: none; }} }}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>FOOD FRESHNESS MONITORING REPORT</h1>
    <p>Report ID: {report.report_id}</p>
  </div>

  <div class="section">
    <h2>Food Information</h2>
    <table>
      <tr><td style="padding:6px 0;font-weight:600;width:160px;">Food Name</td><td style="padding:6px 0;">{report.food_name}</td></tr>
      <tr><td style="padding:6px 0;font-weight:600;">Batch ID</td><td style="padding:6px 0;">{report.batch_id_ref or 'N/A'}</td></tr>
      <tr><td style="padding:6px 0;font-weight:600;">Category</td><td style="padding:6px 0;">{report.food_category or 'Unknown'}</td></tr>
      <tr><td style="padding:6px 0;font-weight:600;">Analysis Date</td><td style="padding:6px 0;">{report.created_at.strftime('%d %b %Y, %H:%M') if report.created_at else 'N/A'}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>Freshness Assessment</h2>
    <div class="score-grid">
      <div class="score-card">
        <div class="value" style="color:{cls_color};">{report.confidence_score * 100:.0f}</div>
        <div class="label">Freshness Score (out of 100)</div>
      </div>
      <div class="score-card">
        <div class="value"><span class="badge" style="background:{cls_color}22;color:{cls_color};">{classification}</span></div>
        <div class="label">Quality Assessment</div>
      </div>
      <div class="score-card">
        <div class="value" style="color:#dc2626;">{report.spoilage_probability * 100:.0f}%</div>
        <div class="label">Est. Spoilage Probability</div>
      </div>
    </div>
    <p style="margin:8px 0 0;font-size:0.9rem;color:#6b7280;">
      <strong>Freshness Category:</strong> {classification} &nbsp;|&nbsp;
      <strong>Risk Level:</strong> {report.risk_level.capitalize()} &nbsp;|&nbsp;
      {f'<strong>Est. Shelf Life:</strong> {report.estimated_shelf_life_days} days' if report.estimated_shelf_life_days is not None else ''}
    </p>
  </div>

  <div class="section">
    <h2>Detailed Analysis</h2>
    <table>
      <thead>
        <tr><th>Indicator</th><th>Status</th><th>Score/Risk</th><th>Severity</th></tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">Color Analysis</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">Degradation: {color_score * 100:.1f}%</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">Score: {(1 - color_score) * 100:.0f}%</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">-</td>
        </tr>
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">Texture Analysis</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">Change: {texture_score * 100:.1f}%</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">Score: {(1 - texture_score) * 100:.0f}%</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">-</td>
        </tr>
        {indicators_html}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Recommended Action</h2>
    <p style="line-height:1.7;">{report.recommended_action}</p>
  </div>

  <div class="footer">
    <p><strong>Disclaimer:</strong> This report provides a visual freshness/quality assessment based on image characteristics
    and should not be considered laboratory food-safety certification.</p>
    <p>Generated by Food Freshness Monitoring Platform | {report.created_at.strftime('%d %b %Y %H:%M') if report.created_at else ''}</p>
  </div>
</div>
</body>
</html>"""

    return HTMLResponse(
        content=html,
        headers={
            "Content-Disposition": f'attachment; filename="freshness-report-{report.report_id}.html"',
        },
    )


def _to_response(r: FreshnessReportModel) -> FreshnessReportResponse:
    data = None
    if r.report_data:
        try:
            data = json.loads(r.report_data)
        except (json.JSONDecodeError, TypeError):
            data = None

    # Compute freshness_score from report data or confidence_score
    freshness_score = 0.0
    if data and "freshness_score" in data:
        freshness_score = data["freshness_score"]
    else:
        freshness_score = r.confidence_score * 100

    return FreshnessReportResponse(
        id=r.id,
        report_id=r.report_id,
        food_name=r.food_name,
        food_category=r.food_category,
        classification=r.classification,
        confidence_score=r.confidence_score,
        freshness_score=freshness_score,
        spoilage_detected=r.spoilage_detected,
        spoilage_probability=r.spoilage_probability,
        risk_level=r.risk_level,
        recommended_action=r.recommended_action,
        estimated_shelf_life_days=r.estimated_shelf_life_days,
        report_data=data,
        batch_id_ref=r.batch_id_ref,
        days_to_expiry=r.days_to_expiry,
        inventory_freshness_status=r.inventory_freshness_status,
        created_at=r.created_at,
    )
