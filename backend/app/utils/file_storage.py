"""
Handles saving uploaded freshness-analysis images to local disk.

Images are stored under backend/media/uploads/, organized by
year/month, and only the relative path is stored in PostgreSQL - the
raw image bytes never go into the database.

This is a local-disk MVP implementation. Swapping this out for
S3/Azure Blob storage later would only require changing this file -
callers only depend on save_uploaded_image() returning a relative path.
"""
import uuid
from datetime import datetime, timezone
from pathlib import Path

MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}

# backend/media/uploads/ (relative to this file's location: app/utils/ -> backend/)
MEDIA_ROOT = Path(__file__).resolve().parents[2] / "media" / "uploads"


class UploadValidationError(ValueError):
    """Raised when an uploaded file fails size/type validation."""


def validate_upload(content_type: str, file_size: int) -> None:
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise UploadValidationError(
            f"Unsupported file type '{content_type}'. "
            f"Allowed types: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}."
        )
    if file_size > MAX_UPLOAD_SIZE_BYTES:
        max_mb = MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)
        raise UploadValidationError(f"File is too large. Maximum size is {max_mb:.0f}MB.")
    if file_size <= 0:
        raise UploadValidationError("Uploaded file is empty.")


def save_uploaded_image(file_bytes: bytes, original_filename: str) -> str:
    """
    Save image bytes to disk under a year/month folder with a random
    filename (never trusting the client-supplied filename), and return
    the path RELATIVE to MEDIA_ROOT for storage in the database.
    """
    now = datetime.now(timezone.utc)
    subdir = Path(str(now.year)) / f"{now.month:02d}"
    target_dir = MEDIA_ROOT / subdir
    target_dir.mkdir(parents=True, exist_ok=True)

    extension = Path(original_filename).suffix.lower()
    if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
        extension = ".jpg"

    filename = f"{uuid.uuid4().hex}{extension}"
    full_path = target_dir / filename

    with open(full_path, "wb") as f:
        f.write(file_bytes)

    # Store as a forward-slash relative path regardless of OS
    # (Windows dev machines included) so it's portable in the DB.
    relative_path = subdir / filename
    return str(relative_path).replace("\\", "/")
