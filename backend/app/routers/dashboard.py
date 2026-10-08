"""
Dashboard summary route: aggregate statistics + recent batches + expiry alerts.

Numbers are scoped by role (consumers only see their own stock; staff roles see
everything), mirroring the /batches visibility rules.
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.constants import EXPIRING_SOON_WINDOW_DAYS
from app.database import get_db
from app.deps import get_current_user
from app.models import FoodBatch, User
from app.routers.batches import _visible_batches_query
from app.schemas import BatchOut, DashboardSummary

router = APIRouter(tags=["Dashboard"])


def _count(db: Session, scoped_query, condition=None) -> int:
    """COUNT(*) over a role-scoped query with an optional extra condition."""
    query = scoped_query
    if condition is not None:
        query = query.where(condition)
    return db.scalar(select(func.count()).select_from(query.subquery())) or 0


@router.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Summary cards, recent-batches table data and expiry alerts in one call."""
    today = date.today()
    window_end = today + timedelta(days=EXPIRING_SOON_WINDOW_DAYS)

    # Role-scoped base query (consumers -> only their own batches).
    scoped = _visible_batches_query(db, current_user)

    total_batches = _count(db, scoped)
    fresh_count = _count(db, scoped, FoodBatch.expiry_date > window_end)
    expiring_soon_count = _count(db, scoped, FoodBatch.expiry_date.between(today, window_end))
    expired_count = _count(db, scoped, FoodBatch.expiry_date < today)

    # Sum must run over the ROLE-SCOPED subquery only. Referencing
    # FoodBatch.available_quantity here instead of sub.c.* silently adds a
    # second FROM element (cartesian product) and inflates the total.
    scoped_sub = scoped.subquery()
    total_available = db.scalar(
        select(func.coalesce(func.sum(scoped_sub.c.available_quantity), 0.0))
        .select_from(scoped_sub)
    ) or 0.0

    # SQLAlchemy 2.x queries are immutable: each .where()/.order_by() call
    # derives a NEW query, so `scoped` can safely be reused below.
    # FEFO (First Expiry, First Out): nearest expiry first, not registration date.
    recent_batches = (
        scoped.order_by(FoodBatch.expiry_date.asc(), FoodBatch.id.asc()).limit(5)
    )
    expiring_alerts = (
        scoped.where(FoodBatch.expiry_date >= today, FoodBatch.expiry_date <= window_end)
        .order_by(FoodBatch.expiry_date.asc())
        .limit(10)
    )

    return DashboardSummary(
        total_batches=total_batches,
        total_available_quantity=round(float(total_available), 2),
        fresh_count=fresh_count,
        expiring_soon_count=expiring_soon_count,
        expired_count=expired_count,
        recent_batches=[BatchOut.model_validate(b) for b in db.scalars(recent_batches).all()],
        expiring_alerts=[BatchOut.model_validate(b) for b in db.scalars(expiring_alerts).all()],
    )
