"""
Food batch CRUD routes with role-based access control.

Role matrix (enforced server-side, mirrored in the UI):
    consumer            -> create + manage ONLY their own batches
    retail_manager      -> create + manage any batch
    warehouse_operator  -> create + manage any batch
    quality_inspector   -> view-only (no create/update/delete)
    administrator       -> full access to everything
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.constants import EXPIRING_SOON_WINDOW_DAYS
from app.database import get_db
from app.deps import get_current_user
from app.models import FoodBatch, User
from app.schemas import BatchCreate, BatchOut, BatchUpdate, Message
from app.utils.batch_ids import MAX_SEQUENCE_ATTEMPTS, generate_batch_id

router = APIRouter(prefix="/batches", tags=["Food Batches"])

# Roles that may create batches and modify existing ones.
MANAGEMENT_ROLES = ("retail_manager", "warehouse_operator", "administrator")
# Roles that may create batches at all (inspectors are read-only).
CREATOR_ROLES = ("consumer",) + MANAGEMENT_ROLES


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _visible_batches_query(db: Session, user: User):
    """Base query scoped by role: consumers only ever see their own batches."""
    query = select(FoodBatch)
    if user.role == "consumer":
        query = query.where(FoodBatch.user_id == user.id)
    return query


def _get_batch_or_404(db: Session, batch_id_str: str) -> FoodBatch:
    batch = db.scalar(select(FoodBatch).where(FoodBatch.batch_id == batch_id_str))
    if batch is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Food batch '{batch_id_str}' was not found.",
        )
    return batch


def _ensure_can_view(user: User, batch: FoodBatch) -> None:
    """Consumers may only access batches they own themselves."""
    if user.role == "consumer" and batch.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: consumers can only view their own food batches.",
        )


def _ensure_can_modify(user: User, batch: FoodBatch) -> None:
    """Inspectors cannot modify anything; consumers only their own batches."""
    if user.role == "quality_inspector":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Food Quality Inspectors have read-only access.",
        )
    if user.role not in MANAGEMENT_ROLES and batch.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: you can only manage your own food batches.",
        )


def _validate_dates_and_quantities(
    received_date: date,
    expiry_date: date,
    quantity: float,
    available_quantity: float,
) -> None:
    """Business-rule validation shared by create/update."""
    if expiry_date < received_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expiry date cannot be earlier than the received date.",
        )
    if available_quantity > quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Available quantity cannot be greater than the total quantity.",
        )


def _status_filter(query, status_name: str):
    """Translate a freshness status name into an expiry-date SQL condition."""
    today = date.today()
    window_end = today + timedelta(days=EXPIRING_SOON_WINDOW_DAYS)
    conditions = {
        "Expired": FoodBatch.expiry_date < today,
        "Expiring Soon": FoodBatch.expiry_date.between(today, window_end),
        "Fresh": FoodBatch.expiry_date > window_end,
    }
    if status_name not in conditions:
        allowed = ", ".join(conditions)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status filter '{status_name}'. Allowed values: {allowed}.",
        )
    return query.where(conditions[status_name])


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@router.post("", response_model=BatchOut, status_code=status.HTTP_201_CREATED)
def create_batch(
    payload: BatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Register a new food batch. The unique batch ID
    (<FOOD>-<YYYYMMDD>-<seq>) is generated automatically here.
    """
    if current_user.role not in CREATOR_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Food Quality Inspectors cannot create food batches.",
        )

    available = payload.available_quantity if payload.available_quantity is not None else payload.quantity
    _validate_dates_and_quantities(payload.received_date, payload.expiry_date, payload.quantity, available)

    # Retry loop: two simultaneous requests could compute the same sequence
    # number; the UNIQUE constraint on batch_id makes one of them retry.
    for attempt in range(MAX_SEQUENCE_ATTEMPTS):
        candidate_id = generate_batch_id(db, payload.food_name, payload.received_date)
        batch = FoodBatch(
            batch_id=candidate_id,
            user_id=current_user.id,
            food_name=payload.food_name,
            category=payload.category,
            quantity=payload.quantity,
            available_quantity=available,
            unit=payload.unit,
            received_date=payload.received_date,
            expiry_date=payload.expiry_date,
            storage_location=payload.storage_location,
            packaging_type=payload.packaging_type,
            notes=payload.notes,
            temperature_c=payload.temperature_c,
            humidity_pct=payload.humidity_pct,
            air_circulation=payload.air_circulation,
            light_exposure=payload.light_exposure,
        )
        db.add(batch)
        try:
            db.commit()
            db.refresh(batch)
            return batch
        except IntegrityError:
            db.rollback()  # duplicate batch_id -> bump sequence and try again

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not allocate a unique batch ID after several attempts. Please retry.",
    )


@router.get("/expiring", response_model=list[BatchOut])
def list_expiring_batches(
    days: int = Query(default=EXPIRING_SOON_WINDOW_DAYS, ge=0, le=365,
                      description="Include items expiring within this many days"),
    include_expired: bool = Query(default=False, description="Also include already-expired items"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Expiry alerts feed: soon-to-expire items (optionally expired ones too)."""
    today = date.today()
    horizon = today + timedelta(days=days)

    query = _visible_batches_query(db, current_user).where(FoodBatch.expiry_date <= horizon)
    if not include_expired:
        query = query.where(FoodBatch.expiry_date >= today)
    query = query.order_by(FoodBatch.expiry_date.asc())
    return db.scalars(query).all()


@router.get("", response_model=list[BatchOut])
def list_batches(
    q: str | None = Query(default=None, max_length=100, description="Search by food name or batch ID"),
    category: str | None = Query(default=None, description="Filter by exact category"),
    batch_status: str | None = Query(default=None, alias="status",
                                     description="Fresh | Expiring Soon | Expired"),
    limit: int = Query(default=500, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List food batches visible to the current user.

    - Consumers receive only their own batches.
    - Staff roles (retail manager, warehouse operator, inspector, admin) receive all.
    - Supports search (`q`), `category` and dynamic freshness `status` filters.
    """
    query = _visible_batches_query(db, current_user)

    if q:
        needle = f"%{q.strip()}%"
        query = query.where(or_(
            FoodBatch.food_name.ilike(needle),
            FoodBatch.batch_id.ilike(needle),
        ))
    if category:
        query = query.where(FoodBatch.category == category)
    if batch_status:
        query = _status_filter(query, batch_status)

    # FEFO (First Expiry, First Out): nearest expiry always first.
    query = query.order_by(FoodBatch.expiry_date.asc(), FoodBatch.id.asc()).limit(limit)
    return db.scalars(query).all()


@router.get("/{batch_id_str}", response_model=BatchOut)
def get_batch(
    batch_id_str: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch a single batch by its human-readable batch ID (e.g. APP-20260821-001)."""
    batch = _get_batch_or_404(db, batch_id_str)
    _ensure_can_view(current_user, batch)
    return batch


@router.put("/{batch_id_str}", response_model=BatchOut)
def update_batch(
    batch_id_str: str,
    payload: BatchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Edit batch details / update the available quantity (partial updates supported)."""
    batch = _get_batch_or_404(db, batch_id_str)
    _ensure_can_modify(current_user, batch)

    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided to update.")

    for field, value in updates.items():
        setattr(batch, field, value)

    # Re-validate business rules on the merged state.
    _validate_dates_and_quantities(batch.received_date, batch.expiry_date, batch.quantity, batch.available_quantity)

    db.commit()
    db.refresh(batch)
    return batch


@router.delete("/{batch_id_str}", response_model=Message)
def delete_batch(
    batch_id_str: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a batch permanently (UI asks for confirmation first)."""
    batch = _get_batch_or_404(db, batch_id_str)
    _ensure_can_modify(current_user, batch)

    db.delete(batch)
    db.commit()
    return Message(message=f"Food batch '{batch_id_str}' was deleted successfully.")
