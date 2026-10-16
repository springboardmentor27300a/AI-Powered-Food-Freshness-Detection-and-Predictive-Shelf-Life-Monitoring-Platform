"""
Report downloads (Milestone 4):  GET /api/reports/{kind}?format=pdf|xlsx

Access rules (every endpoint requires a valid JWT):
  * freshness, shelf-life, inventory-quality, waste-reduction,
    storage-compliance -> Consumer (own items only), Retail Manager,
    Warehouse Operator, Food Quality Inspector (shared inventory, see
    app/core/access.py).
  * platform-summary -> Administrator only; aggregate counts, no
    personal data.
"""
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.report_data import BUILDERS, REPORT_KINDS
from app.core.report_export import build_pdf, build_xlsx
from app.database import get_db
from app.models.user import User, UserRole

router = APIRouter(prefix="/api/reports", tags=["Reports"])

INVENTORY_REPORT_ROLES = {
    UserRole.CONSUMER,
    UserRole.RETAIL_MANAGER,
    UserRole.WAREHOUSE_OPERATOR,
    UserRole.FOOD_QUALITY_INSPECTOR,
}
ALLOWED_ROLES = {kind: INVENTORY_REPORT_ROLES for kind in REPORT_KINDS}
ALLOWED_ROLES["platform-summary"] = {UserRole.ADMINISTRATOR}

MEDIA = {
    "pdf": "application/pdf",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


@router.get("/{kind}", summary="Download a report as PDF or Excel")
def download_report(
    kind: str,
    format: Literal["pdf", "xlsx"] = "pdf",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if kind not in REPORT_KINDS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown report type")
    if current_user.role not in ALLOWED_ROLES[kind]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this report",
        )

    report = BUILDERS[kind](db, current_user)
    content = build_pdf(report) if format == "pdf" else build_xlsx(report)
    filename = f"{kind}-report-{datetime.now(timezone.utc):%Y%m%d-%H%M}.{format}"
    return Response(
        content=content,
        media_type=MEDIA[format],
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )
