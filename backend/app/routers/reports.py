from __future__ import annotations

import csv
import io
import json
import os
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.freshness import FreshnessAssessment
from app.models.inventory import FoodBatch, FoodItem
from app.services import recommendation_engine

router = APIRouter(prefix="/api/reports", tags=["Reports"])


def _assessment_or_404(assessment_id: int, db: Session) -> FreshnessAssessment:
    assessment = db.get(FreshnessAssessment, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Freshness report not found")
    return assessment


def detail(assessment: FreshnessAssessment, db: Session) -> dict:
    batch = db.get(FoodBatch, assessment.batch_id) if assessment.batch_id else None
    item = db.get(FoodItem, batch.food_item_id) if batch else None
    rec = (
        recommendation_engine(batch, item, assessment.remaining_days, assessment.score)
        if batch and item
        else {
            "status": "Unknown",
            "storage_message": "",
            "recommendations": [],
            "priority": "Low",
        }
    )

    return {
        "assessment": {
            column.name: getattr(assessment, column.name)
            for column in assessment.__table__.columns
        },
        "batch": (
            {column.name: getattr(batch, column.name) for column in batch.__table__.columns}
            if batch
            else None
        ),
        "food_item": (
            {column.name: getattr(item, column.name) for column in item.__table__.columns}
            if item
            else None
        ),
        "storage": rec,
        "image_url": f"/uploads/{assessment.image_name}" if assessment.image_name else "",
    }


def _csv_response(content: str, filename: str) -> StreamingResponse:
    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _pdf_response(content: bytes, filename: str) -> StreamingResponse:
    return StreamingResponse(
        iter([content]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# IMPORTANT: all static routes are declared BEFORE /{assessment_id}/... routes.
# Otherwise requests such as /api/reports/all/pdf can be interpreted as
# assessment_id="all" by /{assessment_id}/pdf and FastAPI returns HTTP 422.


@router.get("/summary")
def summary(db: Session = Depends(get_db), user=Depends(get_current_user)):
    assessments = (
        db.query(FreshnessAssessment)
        .order_by(FreshnessAssessment.created_at.desc())
        .limit(100)
        .all()
    )
    return {
        "total_assessments": len(assessments),
        "fresh": sum(a.category == "Fresh" for a in assessments),
        "good": sum(a.category == "Good" for a in assessments),
        "acceptable": sum(a.category == "Acceptable" for a in assessments),
        "near_spoilage": sum(a.category == "Near Spoilage" for a in assessments),
        "spoiled": sum(a.category == "Spoiled" for a in assessments),
        "average_score": round(sum(a.score for a in assessments) / len(assessments), 1)
        if assessments
        else 0,
    }


@router.get("")
def reports(db: Session = Depends(get_db), user=Depends(get_current_user)):
    result = []
    assessments = (
        db.query(FreshnessAssessment)
        .order_by(FreshnessAssessment.created_at.desc())
        .limit(100)
        .all()
    )

    for assessment in assessments:
        batch = db.get(FoodBatch, assessment.batch_id) if assessment.batch_id else None
        item = db.get(FoodItem, batch.food_item_id) if batch else None
        result.append(
            {
                "id": assessment.id,
                "batch_id": assessment.batch_id,
                "food_name": item.name if item else "Unknown",
                "category": item.category if item else "",
                "assessment_category": assessment.category,
                "score": assessment.score,
                "remaining_days": assessment.remaining_days,
                "expiry_date": batch.expiry_date.isoformat() if batch else "",
                "image_name": assessment.image_name,
                "created_at": assessment.created_at.isoformat(),
                "recommendation": assessment.recommendation,
            }
        )
    return result


@router.get("/csv")
def all_csv(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Download all freshness assessments as one CSV file."""
    assessments = (
        db.query(FreshnessAssessment)
        .order_by(FreshnessAssessment.created_at.desc())
        .limit(100)
        .all()
    )

    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(
        [
            "Report ID",
            "Food Item",
            "Food Category",
            "Batch",
            "Freshness Status",
            "Quality Score",
            "Remaining Days",
            "Expiry Date",
            "Spoilage Probability",
            "Visual Score",
            "Storage Score",
            "Shelf-Life Score",
            "Product Age Score",
            "Confidence",
            "Image",
            "Recommendation",
            "Created At",
        ]
    )

    for assessment in assessments:
        batch = db.get(FoodBatch, assessment.batch_id) if assessment.batch_id else None
        item = db.get(FoodItem, batch.food_item_id) if batch else None
        writer.writerow(
            [
                assessment.id,
                item.name if item else "Unknown",
                item.category if item else "",
                batch.batch_code if batch else "",
                assessment.category,
                assessment.score,
                assessment.remaining_days,
                batch.expiry_date if batch else "",
                assessment.spoilage_probability,
                assessment.visual_score,
                assessment.storage_score,
                assessment.shelf_score,
                assessment.age_score,
                assessment.confidence,
                assessment.image_name,
                assessment.recommendation,
                assessment.created_at,
            ]
        )

    return _csv_response(out.getvalue(), "freshguard_freshness_reports.csv")


@router.get("/all/csv")
def all_csv_alias(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Compatibility alias for clients that prefer /all/csv."""
    return all_csv(db=db, user=user)


@router.get("/all/pdf")
def all_pdf(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Download every freshness report as a multi-page PDF."""
    assessments = (
        db.query(FreshnessAssessment)
        .order_by(FreshnessAssessment.created_at.desc())
        .limit(50)
        .all()
    )

    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            Image,
            PageBreak,
            Paragraph,
            SimpleDocTemplate,
            Spacer,
            Table,
            TableStyle,
        )
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF dependency is not installed")

    buffer = io.BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.3 * cm,
        leftMargin=1.3 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm,
    )
    styles = getSampleStyleSheet()
    story = []

    if not assessments:
        story.append(Paragraph("FreshGuard — Freshness Reports", styles["Title"]))
        story.append(Spacer(1, 12))
        story.append(Paragraph("No freshness assessments are available yet.", styles["BodyText"]))
    else:
        for index, assessment in enumerate(assessments):
            data = detail(assessment, db)
            item = data["food_item"]
            batch = data["batch"]

            story.extend(
                [
                    Paragraph("FreshGuard — Food Freshness Report", styles["Title"]),
                    Paragraph(f"Report #{assessment.id}", styles["Normal"]),
                    Spacer(1, 8),
                ]
            )

            if assessment.image_name:
                image_path = os.path.join(
                    os.path.dirname(os.path.dirname(__file__)),
                    "uploads",
                    assessment.image_name,
                )
                if os.path.exists(image_path):
                    story.extend(
                        [
                            Image(image_path, width=5.5 * cm, height=5.5 * cm),
                            Spacer(1, 8),
                        ]
                    )

            table_data = [
                [
                    "Food item",
                    item["name"] if item else "",
                    "Category",
                    item["category"] if item else "",
                ],
                [
                    "Batch",
                    batch["batch_code"] if batch else "",
                    "Expiry",
                    str(batch["expiry_date"]) if batch else "",
                ],
                [
                    "Freshness",
                    assessment.category,
                    "Quality score",
                    f"{assessment.score:.1f}/100",
                ],
                [
                    "Remaining shelf life",
                    f"{assessment.remaining_days} days",
                    "Spoilage probability",
                    f"{assessment.spoilage_probability * 100:.1f}%",
                ],
                [
                    "Temperature",
                    f"{batch['temperature']} °C" if batch else "",
                    "Humidity",
                    f"{batch['humidity']}%" if batch else "",
                ],
            ]

            table = Table(
                table_data,
                colWidths=[3.2 * cm, 5.5 * cm, 3.2 * cm, 5.5 * cm],
            )
            table.setStyle(
                TableStyle(
                    [
                        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d9e1da")),
                        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#edf5e7")),
                        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#edf5e7")),
                        ("FONTSIZE", (0, 0), (-1, -1), 9),
                        ("PADDING", (0, 0), (-1, -1), 6),
                    ]
                )
            )
            story.extend(
                [
                    table,
                    Spacer(1, 10),
                    Paragraph("Indicators", styles["Heading2"]),
                ]
            )

            try:
                indicators = json.loads(assessment.indicators or "[]")
            except (TypeError, ValueError):
                indicators = []
            indicator_text = " • ".join(str(x) for x in indicators) or "No major indicators recorded."
            story.extend(
                [
                    Paragraph(escape(indicator_text), styles["BodyText"]),
                    Spacer(1, 7),
                    Paragraph("Recommendation engine", styles["Heading2"]),
                ]
            )

            for recommendation in data["storage"]["recommendations"]:
                story.append(Paragraph("• " + escape(str(recommendation)), styles["BodyText"]))

            story.extend(
                [
                    Spacer(1, 7),
                    Paragraph("Assessment recommendation", styles["Heading2"]),
                    Paragraph(escape(assessment.recommendation or ""), styles["BodyText"]),
                ]
            )

            if index < len(assessments) - 1:
                story.append(PageBreak())

    document.build(story)
    buffer.seek(0)
    return _pdf_response(buffer.getvalue(), "freshguard_freshness_reports.pdf")


# Dynamic report routes come AFTER every static route above.


@router.get("/{assessment_id}")
def report_detail(assessment_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    assessment = _assessment_or_404(assessment_id, db)
    return detail(assessment, db)


@router.get("/{assessment_id}/csv")
def one_csv(assessment_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    assessment = _assessment_or_404(assessment_id, db)
    data = detail(assessment, db)
    item = data["food_item"]
    batch = data["batch"]

    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["FreshGuard Freshness Report"])
    rows = [
        ("Food item", item["name"] if item else ""),
        ("Category", item["category"] if item else ""),
        ("Batch", batch["batch_code"] if batch else ""),
        ("Expiry", batch["expiry_date"] if batch else ""),
        ("Freshness", assessment.category),
        ("Score", assessment.score),
        ("Remaining days", assessment.remaining_days),
        ("Spoilage probability", assessment.spoilage_probability),
        ("Confidence", assessment.confidence),
        ("Visual score", assessment.visual_score),
        ("Storage score", assessment.storage_score),
        ("Shelf-life score", assessment.shelf_score),
        ("Product age score", assessment.age_score),
        ("Recommendation", assessment.recommendation),
    ]
    for key, value in rows:
        writer.writerow([key, value])

    return _csv_response(out.getvalue(), f"freshness_report_{assessment_id}.csv")


@router.get("/{assessment_id}/xlsx")
def one_xlsx(assessment_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    assessment = _assessment_or_404(assessment_id, db)
    data = detail(assessment, db)
    item = data["food_item"]
    batch = data["batch"]

    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font
    except ImportError:
        raise HTTPException(status_code=500, detail="Excel dependency is not installed")

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Freshness Report"
    sheet["A1"] = "FreshGuard Freshness Report"
    sheet["A1"].font = Font(bold=True, size=16)
    sheet.append([])

    rows = [
        ("Food item", item["name"] if item else ""),
        ("Category", item["category"] if item else ""),
        ("Batch", batch["batch_code"] if batch else ""),
        ("Expiry", str(batch["expiry_date"]) if batch else ""),
        ("Freshness", assessment.category),
        ("Quality score", assessment.score),
        ("Remaining days", assessment.remaining_days),
        ("Spoilage probability", assessment.spoilage_probability),
        ("Confidence", assessment.confidence),
        ("Temperature", batch["temperature"] if batch else ""),
        ("Humidity", batch["humidity"] if batch else ""),
        ("Recommendation", assessment.recommendation),
    ]
    for key, value in rows:
        sheet.append([key, value])

    sheet.column_dimensions["A"].width = 30
    sheet.column_dimensions["B"].width = 85

    buffer = io.BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="freshness_report_{assessment_id}.xlsx"'
        },
    )


@router.get("/{assessment_id}/pdf")
def one_pdf(assessment_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    assessment = _assessment_or_404(assessment_id, db)
    data = detail(assessment, db)

    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF dependency is not installed")

    buffer = io.BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.3 * cm,
        leftMargin=1.3 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm,
    )
    styles = getSampleStyleSheet()
    story = [
        Paragraph("FreshGuard — Food Freshness Report", styles["Title"]),
        Paragraph(f"Report #{assessment.id}", styles["Normal"]),
        Spacer(1, 8),
    ]

    if assessment.image_name:
        image_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "uploads",
            assessment.image_name,
        )
        if os.path.exists(image_path):
            story.extend([Image(image_path, width=5 * cm, height=5 * cm), Spacer(1, 8)])

    item = data["food_item"]
    batch = data["batch"]
    table_data = [
        [
            "Food item",
            item["name"] if item else "",
            "Category",
            item["category"] if item else "",
        ],
        [
            "Batch",
            batch["batch_code"] if batch else "",
            "Expiry",
            str(batch["expiry_date"]) if batch else "",
        ],
        [
            "Freshness",
            assessment.category,
            "Quality score",
            f"{assessment.score:.1f}/100",
        ],
        [
            "Remaining shelf life",
            f"{assessment.remaining_days} days",
            "Spoilage probability",
            f"{assessment.spoilage_probability * 100:.1f}%",
        ],
        [
            "Temperature",
            f"{batch['temperature']} °C" if batch else "",
            "Humidity",
            f"{batch['humidity']}%" if batch else "",
        ],
    ]

    table = Table(table_data, colWidths=[3.2 * cm, 5.5 * cm, 3.2 * cm, 5.5 * cm])
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d9e1da")),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#edf5e7")),
                ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#edf5e7")),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("PADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.extend(
        [
            table,
            Spacer(1, 10),
            Paragraph("Indicators", styles["Heading2"]),
        ]
    )

    try:
        indicators = json.loads(assessment.indicators or "[]")
    except (TypeError, ValueError):
        indicators = []
    indicator_text = " • ".join(str(x) for x in indicators) or "No major indicators recorded."
    story.extend(
        [
            Paragraph(escape(indicator_text), styles["BodyText"]),
            Spacer(1, 7),
            Paragraph("Recommendation engine", styles["Heading2"]),
        ]
    )
    for recommendation in data["storage"]["recommendations"]:
        story.append(Paragraph("• " + escape(str(recommendation)), styles["BodyText"]))

    story.extend(
        [
            Spacer(1, 7),
            Paragraph("Assessment recommendation", styles["Heading2"]),
            Paragraph(escape(assessment.recommendation or ""), styles["BodyText"]),
        ]
    )

    document.build(story)
    buffer.seek(0)
    return _pdf_response(buffer.getvalue(), f"freshness_report_{assessment_id}.pdf")
