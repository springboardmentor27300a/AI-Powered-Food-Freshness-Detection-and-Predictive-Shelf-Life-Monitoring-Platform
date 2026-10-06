"""
/api/reports — Milestone 2 Freshness Reports: generate, list, search,
filter, view detail, and download as PDF.
"""
import uuid
from datetime import date
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from openpyxl import Workbook
from openpyxl.styles import Font


from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.roles import require_role
from app.models.report import FreshnessCategory, FreshnessReport
from app.models.user import User, UserRole
from app.schemas.report import (FreshnessReportDetail, FreshnessReportListResponse,
                                 FreshnessReportOut, GenerateReportRequest)
from app.services import report_service


router = APIRouter(prefix="/api/reports", tags=["reports"])

INSPECTOR_ROLES = (UserRole.QUALITY_INSPECTOR, UserRole.ADMINISTRATOR)


@router.post("/generate", response_model=FreshnessReportOut, status_code=status.HTTP_201_CREATED)
def generate_report(
    data: GenerateReportRequest,
    current_user: User = Depends(require_role(*INSPECTOR_ROLES)),
    db: Session = Depends(get_db),
):
    try:
        return report_service.generate_report(db, data.batch_id, data.image_id, current_user.id, data.notes)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("", response_model=FreshnessReportListResponse)
def list_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: FreshnessCategory | None = None,
    batch_id: uuid.UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    sort_by: str = Query("created_at", pattern="^(created_at|freshness_score)$"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(FreshnessReport)
    if category:
        query = query.filter(FreshnessReport.freshness_category == category)
    if batch_id:
        query = query.filter(FreshnessReport.batch_id == batch_id)
    if date_from:
        query = query.filter(FreshnessReport.created_at >= date_from)
    if date_to:
        query = query.filter(FreshnessReport.created_at <= date_to)

    sort_col = FreshnessReport.created_at if sort_by == "created_at" else FreshnessReport.freshness_score
    query = query.order_by(sort_col.desc() if sort_dir == "desc" else sort_col.asc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return FreshnessReportListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{report_id}", response_model=FreshnessReportDetail)
def get_report(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.query(FreshnessReport).filter(FreshnessReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    detail = FreshnessReportDetail.model_validate(report)
    detail.batch_code = report.batch.batch_code if report.batch else None
    detail.food_item_name = report.batch.food_item.name if report.batch and report.batch.food_item else None
    detail.inspector_name = report.inspector.full_name if report.inspector else None
    return detail


@router.get("/{report_id}/pdf")
def download_report_pdf(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.query(FreshnessReport).filter(FreshnessReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    try:
        pdf_bytes = report_service.build_report_pdf(report)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                             detail=f"PDF generation failed: {exc}")

    filename = f"FoodCare_Freshness_Report_{report.report_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{report_id}/csv")
def download_report_csv(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.query(FreshnessReport).filter(FreshnessReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    rows = [
        "field,value",
        f"report_number,{report.report_number}",
        f"batch_code,{report.batch.batch_code if report.batch else ''}",
        f"food_item,{report.batch.food_item.name if report.batch and report.batch.food_item else ''}",
        f"freshness_score,{report.freshness_score}",
        f"freshness_category,{report.freshness_category.value}",
        f"spoilage_probability_pct,{report.spoilage_probability_pct}",
        f"created_at,{report.created_at.isoformat()}",
    ]
    csv_content = "\n".join(rows)
    filename = f"FoodCare_Freshness_Report_{report.report_number}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.get("/{report_id}/excel")
def download_report_excel(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = (
        db.query(FreshnessReport)
        .filter(FreshnessReport.id == report_id)
        .first()
    )

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Freshness Report"

    rows = [
        ("Report Number", report.report_number),
        (
            "Batch Code",
            report.batch.batch_code if report.batch else "",
        ),
        (
            "Food Item",
            report.batch.food_item.name
            if report.batch and report.batch.food_item
            else "",
        ),
        ("Freshness Score", report.freshness_score),
        (
            "Freshness Category",
            report.freshness_category.value,
        ),
        (
            "Spoilage Probability (%)",
            report.spoilage_probability_pct,
        ),
        (
            "Created At",
            report.created_at.isoformat(),
        ),
    ]

    # Header
    worksheet["A1"] = "Field"
    worksheet["B1"] = "Value"

    worksheet["A1"].font = Font(bold=True)
    worksheet["B1"].font = Font(bold=True)

    # Data
    for row_number, (field, value) in enumerate(rows, start=2):
        worksheet.cell(row=row_number, column=1, value=field)
        worksheet.cell(row=row_number, column=2, value=value)

    # Column widths
    worksheet.column_dimensions["A"].width = 28
    worksheet.column_dimensions["B"].width = 45

    # Create Excel file in memory
    output = BytesIO()
    workbook.save(output)
    output.seek(0)

    filename = (
        f"FoodCare_Freshness_Report_"
        f"{report.report_number}.xlsx"
    )

    return Response(
        content=output.getvalue(),
        media_type=(
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            )
        },
    )