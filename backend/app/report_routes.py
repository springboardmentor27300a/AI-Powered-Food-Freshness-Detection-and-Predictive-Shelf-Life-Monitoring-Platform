from collections.abc import Callable
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import get_current_user
from .database import get_db
from .models import FoodItem, FreshnessAnalysis, ShelfLifePrediction, StorageCondition, User
from .reports import (
    generate_freshness_excel,
    generate_freshness_summary_pdf_report,
    generate_inventory_excel,
    generate_inventory_quality_pdf_report,
    generate_shelf_life_excel,
    generate_shelf_life_pdf_report,
    generate_storage_compliance_excel,
    generate_storage_compliance_pdf_report,
    generate_waste_reduction_excel,
    generate_waste_reduction_pdf_report,
)


router = APIRouter(prefix="/reports", tags=["reports"])

REPORT_ROLES = {
    "freshness": {"consumer", "retail_manager", "warehouse_operator", "administrator", "food_quality_inspector"},
    "shelf-life": {"consumer", "retail_manager", "warehouse_operator", "administrator", "food_quality_inspector"},
    "inventory": {"retail_manager", "warehouse_operator", "administrator", "food_quality_inspector"},
    "waste-reduction": {"retail_manager", "warehouse_operator", "administrator"},
    "storage-compliance": {"consumer", "retail_manager", "warehouse_operator", "administrator", "food_quality_inspector"},
}


def _report_data(db: Session, user: User) -> dict[str, list[Any]]:
    return {
        "analyses": list(db.scalars(
            select(FreshnessAnalysis)
            .where(FreshnessAnalysis.user_id == user.id)
            .order_by(FreshnessAnalysis.created_at.desc())
        )),
        "predictions": list(db.scalars(
            select(ShelfLifePrediction)
            .where(ShelfLifePrediction.user_id == user.id)
            .order_by(ShelfLifePrediction.created_at.desc())
        )),
        "inventory": list(db.scalars(
            select(FoodItem)
            .where(FoodItem.created_by == user.id)
            .order_by(FoodItem.expiry_date.asc())
        )),
        "storage_conditions": list(db.scalars(
            select(StorageCondition)
            .where(StorageCondition.user_id == user.id)
            .order_by(StorageCondition.observed_at.desc())
        )),
    }


def _build_report(report_type: str, file_type: str, data: dict[str, list[Any]], user: User) -> bytes:
    if report_type == "freshness":
        generator = (
            generate_freshness_summary_pdf_report
            if file_type == "pdf"
            else generate_freshness_excel
        )
        args = (data["analyses"], user) if file_type == "pdf" else (data["analyses"],)
    elif report_type == "shelf-life":
        generator = generate_shelf_life_pdf_report if file_type == "pdf" else generate_shelf_life_excel
        args = (data["predictions"], user) if file_type == "pdf" else (data["predictions"],)
    elif report_type == "inventory":
        generator = generate_inventory_quality_pdf_report if file_type == "pdf" else generate_inventory_excel
        args = (
            (data["inventory"], data["predictions"], user)
            if file_type == "pdf"
            else (data["inventory"],)
        )
    elif report_type == "waste-reduction":
        generator = generate_waste_reduction_pdf_report if file_type == "pdf" else generate_waste_reduction_excel
        args = (
            (data["predictions"], data["inventory"], user)
            if file_type == "pdf"
            else (data["predictions"],)
        )
    else:
        generator = (
            generate_storage_compliance_pdf_report
            if file_type == "pdf"
            else generate_storage_compliance_excel
        )
        args = (
            (data["storage_conditions"], data["predictions"], user)
            if file_type == "pdf"
            else (data["storage_conditions"], data["predictions"])
        )
    return generator(*args)


def _create_report_endpoint(report_type: str, file_type: str) -> Callable[..., Response]:
    def create_report(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
    ) -> Response:
        if current_user.role not in REPORT_ROLES[report_type]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your role is not allowed to access this report",
            )

        content = _build_report(report_type, file_type, _report_data(db, current_user), current_user)
        if file_type == "pdf":
            media_type = "application/pdf"
            disposition = "inline"
            extension = "pdf"
        else:
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disposition = "attachment"
            extension = "xlsx"
        filename = f"freshguard_{report_type}_report.{extension}"
        return Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": f'{disposition}; filename="{filename}"'},
        )

    create_report.__name__ = f"{report_type.replace('-', '_')}_{file_type}_report"
    return create_report


for _report_type in REPORT_ROLES:
    for _file_type in ("pdf", "excel"):
        router.add_api_route(
            f"/{_report_type}/{_file_type}",
            _create_report_endpoint(_report_type, _file_type),
            methods=["GET"],
            name=f"{_report_type}_{_file_type}_report",
        )
