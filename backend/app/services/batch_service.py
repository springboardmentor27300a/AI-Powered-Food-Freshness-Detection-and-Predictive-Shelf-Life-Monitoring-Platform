"""
Business logic for batch CRUD, including automatic batch_code generation
and status recomputation (never trust a client-supplied status).
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.batch import Batch
from app.models.user import User, UserRole
from app.schemas.batch import BatchCreate, BatchUpdate
from app.services.notification_service import create_notification_for_all_users


def _generate_batch_code(db: Session) -> str:
    year = datetime.now(timezone.utc).year

    existing_codes = (
        db.query(Batch.batch_code)
        .filter(Batch.batch_code.like(f"BATCH-{year}-%"))
        .all()
    )

    used_numbers = set()

    for (code,) in existing_codes:
        try:
            number = int(code.rsplit("-", 1)[1])
            used_numbers.add(number)
        except (ValueError, IndexError):
            continue

    next_number = 1
    while next_number in used_numbers:
        next_number += 1

    return f"BATCH-{year}-{next_number:05d}"
def create_batch(db: Session, data: BatchCreate, created_by: uuid.UUID) -> Batch:
    payload = data.model_dump(exclude={"batch_code"})
    batch = Batch(**payload, created_by=created_by)
    batch.batch_code = data.batch_code or _generate_batch_code(db)
    batch.status = batch.compute_status()
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def list_batches(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
    food_item_id: uuid.UUID | None = None,
):
    query = db.query(Batch)
    if food_item_id:
        query = query.filter(Batch.food_item_id == food_item_id)

    # Recompute status for all rows before filtering by status, so a batch
    # that has silently expired since it was last written is caught.
    all_batches = query.all()
    changed = False
    for b in all_batches:
        new_status = b.compute_status()
        if new_status != b.status:
            b.status = new_status
            changed = True
    if changed:
        db.commit()

    if status:
        all_batches = [b for b in all_batches if b.status.value == status]

    total = len(all_batches)
    all_batches.sort(key=lambda b: b.created_at, reverse=True)
    start = (page - 1) * page_size
    paged = all_batches[start:start + page_size]
    return paged, total


def get_batch(db: Session, batch_id: uuid.UUID) -> Batch | None:
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if batch:
        new_status = batch.compute_status()
        if new_status != batch.status:
            batch.status = new_status
            db.commit()
            db.refresh(batch)
    return batch


# Fields that only a Quality Inspector (or Admin) may set.
INSPECTION_ONLY_FIELDS = {"inspection_notes"}
# Fields a Quality Inspector is NOT allowed to change (read-only for that role).
INSPECTOR_RESTRICTED_FIELDS = {
    "quantity", "unit", "manufacturing_date", "received_date",
    "expiry_date", "storage_location", "is_available",
}


def update_batch(db: Session, batch: Batch, data: BatchUpdate, current_user: User) -> Batch:
    updates = data.model_dump(exclude_unset=True)

    if current_user.role == UserRole.QUALITY_INSPECTOR:
        # Inspector may only touch inspection_notes; strip everything else.
        updates = {k: v for k, v in updates.items() if k in INSPECTION_ONLY_FIELDS}
        if "inspection_notes" in updates:
            batch.inspected_by = current_user.id
            batch.inspected_at = datetime.now(timezone.utc)
    elif current_user.role in (UserRole.RETAIL_MANAGER, UserRole.WAREHOUSE_OPERATOR):
        # These roles cannot edit inspection notes.
        updates.pop("inspection_notes", None)
    # Admin: no restrictions.

    for field, value in updates.items():
        setattr(batch, field, value)

    old_status = batch.status

    batch.status = batch.compute_status()

    db.commit()
    db.refresh(batch)

    # --- Inventory status notifications ---
    if batch.status != old_status:
        if batch.status.value == "low_stock":
            create_notification_for_all_users(
                db,
                title="Low Stock Alert",
                message=(
                    f"Batch {batch.batch_code} for {batch.food_item.name} "
                    f"has reached low stock."
                ),
                severity="warning",
                notification_type="inventory",
                reference_type="batch",
                reference_id=batch.id,
                action_url=f"/batches/{batch.id}",
            )

        elif batch.status.value == "near_expiry":
            create_notification_for_all_users(
                db,
                title="Inventory Expiry Alert",
                message=(
                    f"Batch {batch.batch_code} for {batch.food_item.name} "
                    f"is approaching its expiry date ({batch.expiry_date})."
                ),
                severity="warning",
                notification_type="inventory",
                reference_type="batch",
                reference_id=batch.id,
                action_url=f"/batches/{batch.id}",
            )

    return batch


def delete_batch(db: Session, batch: Batch) -> None:
    db.delete(batch)
    db.commit()
