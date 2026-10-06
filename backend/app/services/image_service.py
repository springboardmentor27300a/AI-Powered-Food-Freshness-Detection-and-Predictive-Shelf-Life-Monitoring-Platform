"""
Secure image upload handling. Never trusts client-supplied filenames or
paths: the file is saved under a generated UUID name inside the configured
upload directory only.
"""
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from PIL import Image
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.food_image import FoodImage

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


def _upload_dir() -> Path:
    d = Path(settings.UPLOAD_DIR)
    d.mkdir(parents=True, exist_ok=True)
    return d


async def save_upload(db: Session, file: UploadFile, batch_id: uuid.UUID, uploaded_by: uuid.UUID) -> FoodImage:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported image type '{file.content_type}'. Allowed: JPEG, PNG, WEBP.",
        )

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".jpg" if file.content_type == "image/jpeg" else ".png"

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image exceeds the {settings.MAX_UPLOAD_SIZE_MB}MB limit.",
        )
    if len(contents) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

    stored_filename = f"{uuid.uuid4().hex}{ext}"
    dest_path = _upload_dir() / stored_filename  # never derived from user input
    with open(dest_path, "wb") as f:
        f.write(contents)

    # Validate it's actually a readable image (also gives us dimensions).
    try:
        with Image.open(dest_path) as img:
            img.verify()
        with Image.open(dest_path) as img:
            width, height = img.size
    except Exception:
        dest_path.unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is not a valid image.")

    food_image = FoodImage(
        batch_id=batch_id,
        stored_filename=stored_filename,
        original_filename=file.filename,
        content_type=file.content_type,
        file_size_bytes=len(contents),
        width=width,
        height=height,
        uploaded_by=uploaded_by,
    )
    db.add(food_image)
    db.commit()
    db.refresh(food_image)
    return food_image


def get_image_path(food_image: FoodImage) -> Path:
    return _upload_dir() / food_image.stored_filename
