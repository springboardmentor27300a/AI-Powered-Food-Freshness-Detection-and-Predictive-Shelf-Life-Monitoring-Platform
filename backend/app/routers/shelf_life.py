"""
/api/shelf-life — Milestone 3.
"""

import csv
import io
import uuid
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from sqlalchemy.orm import Session, joinedload

from openpyxl import Workbook
from openpyxl.styles import Font

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.dependencies.roles import require_role

from app.models.batch import Batch
from app.models.shelf_life import ShelfLifePrediction
from app.models.user import User, UserRole

from app.schemas.shelf_life import ShelfLifePredictionOut

from app.services import shelf_life_service


router = APIRouter(
    prefix="/api/shelf-life",
    tags=["shelf-life"],
)


ESTIMATOR_ROLES = (
    UserRole.RETAIL_MANAGER,
    UserRole.WAREHOUSE_OPERATOR,
    UserRole.QUALITY_INSPECTOR,
    UserRole.ADMINISTRATOR,
)


# ============================================================
# Shelf-Life Prediction
# ============================================================

@router.post(
    "/batch/{batch_id}/estimate",
    response_model=ShelfLifePredictionOut,
)
def estimate_shelf_life_for_batch(
    batch_id: uuid.UUID,
    current_user: User = Depends(
        require_role(*ESTIMATOR_ROLES)
    ),
    db: Session = Depends(get_db),
):
    batch = (
        db.query(Batch)
        .filter(Batch.id == batch_id)
        .first()
    )

    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Batch not found",
        )

    # Use the most recent visual analysis score
    # for this batch, if one exists.
    from app.models.analysis import VisualAnalysisResult
    from app.models.food_image import FoodImage

    latest_visual = (
        db.query(VisualAnalysisResult)
        .join(
            FoodImage,
            FoodImage.id == VisualAnalysisResult.image_id,
        )
        .filter(FoodImage.batch_id == batch_id)
        .order_by(
            VisualAnalysisResult.created_at.desc()
        )
        .first()
    )

    overall_visual_score = (
        latest_visual.overall_visual_score
        if latest_visual
        else None
    )

    return shelf_life_service.generate_and_save(
        db,
        batch,
        overall_visual_score,
        current_user.id,
    )


# ============================================================
# Shelf-Life History
# ============================================================

@router.get(
    "/batch/{batch_id}",
    response_model=list[ShelfLifePredictionOut],
)
def get_shelf_life_history(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(ShelfLifePrediction)
        .filter(
            ShelfLifePrediction.batch_id == batch_id
        )
        .order_by(
            ShelfLifePrediction.created_at.desc()
        )
        .all()
    )


# ============================================================
# Latest Shelf-Life Prediction
# ============================================================

@router.get(
    "/batch/{batch_id}/latest",
    response_model=ShelfLifePredictionOut,
)
def get_latest_shelf_life(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(ShelfLifePrediction)
        .filter(
            ShelfLifePrediction.batch_id == batch_id
        )
        .order_by(
            ShelfLifePrediction.created_at.desc()
        )
        .first()
    )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No shelf-life estimate yet for this batch. "
                "POST to /estimate first."
            ),
        )

    return row


# ============================================================
# Helper — Get Batch + Predictions
# ============================================================

def _get_batch_and_predictions(
    batch_id: uuid.UUID,
    db: Session,
):
    batch = (
        db.query(Batch)
        .options(joinedload(Batch.food_item))
        .filter(Batch.id == batch_id)
        .first()
    )

    if batch is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Batch not found",
        )

    predictions = (
        db.query(ShelfLifePrediction)
        .filter(
            ShelfLifePrediction.batch_id == batch_id
        )
        .order_by(
            ShelfLifePrediction.created_at.desc()
        )
        .all()
    )

    return batch, predictions


# ============================================================
# Shelf-Life Report — CSV
# ============================================================

@router.get(
    "/batch/{batch_id}/report/csv"
)
def download_shelf_life_csv(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    batch, predictions = _get_batch_and_predictions(
        batch_id,
        db,
    )

    output = io.StringIO()

    writer = csv.writer(output)

    writer.writerow([
        "Food Item",
        "Batch Code",
        "Category",
        "Expiry Date",
        "Estimated Days Remaining",
        "Estimated Expiry Date",
        "Risk Level",
        "Confidence (%)",
        "Explanation",
        "Created At",
    ])

    category = (
        batch.food_item.category.value
        if hasattr(
            batch.food_item.category,
            "value",
        )
        else str(batch.food_item.category)
    )

    for prediction in predictions:

        risk_level = (
            prediction.risk_level.value
            if hasattr(
                prediction.risk_level,
                "value",
            )
            else str(prediction.risk_level)
        )

        writer.writerow([
            batch.food_item.name,
            batch.batch_code,
            category,
            batch.expiry_date,
            prediction.estimated_days_remaining,
            prediction.estimated_expiry_date,
            risk_level,
            prediction.confidence_pct,
            prediction.explanation or "",
            prediction.created_at,
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                "attachment; "
                f'filename="FoodCare_Shelf_Life_Report_'
                f'{batch.batch_code}.csv"'
            )
        },
    )


# ============================================================
# Shelf-Life Report — Excel
# ============================================================

@router.get(
    "/batch/{batch_id}/report/excel"
)
def download_shelf_life_excel(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    batch, predictions = _get_batch_and_predictions(
        batch_id,
        db,
    )

    workbook = Workbook()

    worksheet = workbook.active
    worksheet.title = "Shelf-Life Report"

    headers = [
        "Food Item",
        "Batch Code",
        "Category",
        "Expiry Date",
        "Estimated Days Remaining",
        "Estimated Expiry Date",
        "Risk Level",
        "Confidence (%)",
        "Explanation",
        "Created At",
    ]

    worksheet.append(headers)

    for cell in worksheet[1]:
        cell.font = Font(bold=True)

    category = (
        batch.food_item.category.value
        if hasattr(
            batch.food_item.category,
            "value",
        )
        else str(batch.food_item.category)
    )

    for prediction in predictions:

        risk_level = (
            prediction.risk_level.value
            if hasattr(
                prediction.risk_level,
                "value",
            )
            else str(prediction.risk_level)
        )

        worksheet.append([
            batch.food_item.name,
            batch.batch_code,
            category,
            str(batch.expiry_date),
            prediction.estimated_days_remaining,
            str(prediction.estimated_expiry_date),
            risk_level,
            prediction.confidence_pct,
            prediction.explanation or "",
            str(prediction.created_at),
        ])

    # Automatically size columns.
    for column in worksheet.columns:

        max_length = 0

        column_letter = (
            column[0].column_letter
        )

        for cell in column:

            value = (
                str(cell.value)
                if cell.value is not None
                else ""
            )

            max_length = max(
                max_length,
                len(value),
            )

        worksheet.column_dimensions[
            column_letter
        ].width = min(
            max_length + 2,
            50,
        )

    output = BytesIO()

    workbook.save(output)

    output.seek(0)

    return Response(
        content=output.getvalue(),
        media_type=(
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition": (
                "attachment; "
                f'filename="FoodCare_Shelf_Life_Report_'
                f'{batch.batch_code}.xlsx"'
            )
        },
    )


# ============================================================
# Shelf-Life Report — PDF
# ============================================================

@router.get(
    "/batch/{batch_id}/report/pdf"
)
def download_shelf_life_pdf(
    batch_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    batch, predictions = _get_batch_and_predictions(
        batch_id,
        db,
    )

    buffer = BytesIO()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ShelfLifeTitle",
        parent=styles["Title"],
        textColor=colors.HexColor("#166534"),
    )

    heading_style = ParagraphStyle(
        "ShelfLifeHeading",
        parent=styles["Heading2"],
        textColor=colors.HexColor("#166534"),
    )

    normal_style = styles["Normal"]

    elements = []

    # Title
    elements.append(
        Paragraph(
            "FoodCare",
            title_style,
        )
    )

    elements.append(
        Paragraph(
            "Shelf-Life Prediction Report",
            heading_style,
        )
    )

    elements.append(
        Spacer(1, 10)
    )

    category = (
        batch.food_item.category.value
        if hasattr(
            batch.food_item.category,
            "value",
        )
        else str(batch.food_item.category)
    )

    # Batch information
    metadata = [
        [
            "Food Item",
            batch.food_item.name,
        ],
        [
            "Batch Code",
            batch.batch_code,
        ],
        [
            "Category",
            category,
        ],
        [
            "Expiry Date",
            str(batch.expiry_date),
        ],
        [
            "Generated Predictions",
            str(len(predictions)),
        ],
    ]

    metadata_table = Table(
        metadata,
        colWidths=[
            5 * cm,
            11 * cm,
        ],
    )

    metadata_table.setStyle(
        TableStyle([
            (
                "FONTNAME",
                (0, 0),
                (0, -1),
                "Helvetica-Bold",
            ),
            (
                "GRID",
                (0, 0),
                (-1, -1),
                0.5,
                colors.HexColor("#e2e8f0"),
            ),
            (
                "FONTSIZE",
                (0, 0),
                (-1, -1),
                9,
            ),
            (
                "BACKGROUND",
                (0, 0),
                (0, -1),
                colors.HexColor("#f0fdf4"),
            ),
            (
                "BOTTOMPADDING",
                (0, 0),
                (-1, -1),
                6,
            ),
            (
                "TOPPADDING",
                (0, 0),
                (-1, -1),
                6,
            ),
        ])
    )

    elements.append(metadata_table)

    elements.append(
        Spacer(1, 15)
    )

    # Prediction history
    elements.append(
        Paragraph(
            "Prediction History",
            heading_style,
        )
    )

    if predictions:

        table_data = [
            [
                "Days Remaining",
                "Estimated Expiry",
                "Risk",
                "Confidence",
                "Created At",
            ]
        ]

        for prediction in predictions:

            risk_level = (
                prediction.risk_level.value
                if hasattr(
                    prediction.risk_level,
                    "value",
                )
                else str(
                    prediction.risk_level
                )
            )

            table_data.append([
                str(
                    prediction.estimated_days_remaining
                ),
                str(
                    prediction.estimated_expiry_date
                ),
                risk_level,
                f"{prediction.confidence_pct}%",
                str(
                    prediction.created_at
                ),
            ])

        prediction_table = Table(
            table_data,
            colWidths=[
                2.5 * cm,
                3.5 * cm,
                3 * cm,
                3 * cm,
                4 * cm,
            ],
            repeatRows=1,
        )

        prediction_table.setStyle(
            TableStyle([
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.HexColor("#f0fdf4"),
                ),
                (
                    "FONTNAME",
                    (0, 0),
                    (-1, 0),
                    "Helvetica-Bold",
                ),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.5,
                    colors.HexColor("#e2e8f0"),
                ),
                (
                    "FONTSIZE",
                    (0, 0),
                    (-1, -1),
                    8,
                ),
                (
                    "ALIGN",
                    (0, 0),
                    (-1, -1),
                    "CENTER",
                ),
                (
                    "BOTTOMPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
                (
                    "TOPPADDING",
                    (0, 0),
                    (-1, -1),
                    6,
                ),
            ])
        )

        elements.append(
            prediction_table
        )

        elements.append(
            Spacer(1, 12)
        )

        # Latest prediction
        latest = predictions[0]

        latest_risk = (
            latest.risk_level.value
            if hasattr(
                latest.risk_level,
                "value",
            )
            else str(
                latest.risk_level
            )
        )

        elements.append(
            Paragraph(
                f"<b>Latest Estimate:</b> "
                f"{latest.estimated_days_remaining} "
                f"day(s) remaining, "
                f"estimated expiry "
                f"{latest.estimated_expiry_date}, "
                f"risk level "
                f"<b>{latest_risk}</b>, "
                f"confidence "
                f"{latest.confidence_pct}%.",
                normal_style,
            )
        )

        if latest.explanation:

            elements.append(
                Spacer(1, 8)
            )

            elements.append(
                Paragraph(
                    "<b>Explanation:</b> "
                    f"{latest.explanation}",
                    normal_style,
                )
            )

    else:

        elements.append(
            Paragraph(
                "No shelf-life predictions are "
                "available for this batch.",
                normal_style,
            )
        )

    elements.append(
        Spacer(1, 15)
    )

    elements.append(
        Paragraph(
            "FoodCare shelf-life values are "
            "automated estimates based on "
            "available batch, visual and storage "
            "information. They should not be "
            "treated as a substitute for "
            "professional food safety inspection "
            "or laboratory testing.",
            normal_style,
        )
    )

    document.build(elements)

    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                "attachment; "
                f'filename="FoodCare_Shelf_Life_Report_'
                f'{batch.batch_code}.pdf"'
            )
        },
    )