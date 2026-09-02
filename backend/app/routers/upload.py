import os
import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)

from app.core.security import get_current_user
from app.models.user import User


router = APIRouter(
    prefix="/upload",
    tags=["Image Upload"],
)


# ============================================================
# UPLOAD DIRECTORY
# ============================================================

UPLOAD_DIR = "uploads"

os.makedirs(
    UPLOAD_DIR,
    exist_ok=True,
)


# ============================================================
# ALLOWED IMAGE TYPES
# ============================================================

ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}


# ============================================================
# FOOD IMAGE UPLOAD
# ============================================================

@router.post("/food-image")
async def upload_food_image(
    file: UploadFile = File(...),
    current_user: User = Depends(
        get_current_user
    ),
):

    # Check file
    if not file.filename:

        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,

            detail=
                "No file selected",
        )


    # Get extension
    extension = os.path.splitext(
        file.filename
    )[1].lower()


    # Validate extension
    if (
        extension
        not in ALLOWED_EXTENSIONS
    ):

        raise HTTPException(
            status_code=
                status.HTTP_400_BAD_REQUEST,

            detail=
                "Only JPG, JPEG, PNG and WEBP images are allowed",
        )


    # Generate unique filename
    unique_filename = (
        f"{uuid.uuid4()}{extension}"
    )


    file_path = os.path.join(
        UPLOAD_DIR,
        unique_filename,
    )


    # Read file
    file_content = await file.read()


    # Save file
    with open(
        file_path,
        "wb"
    ) as buffer:

        buffer.write(
            file_content
        )


    return {

        "message":
            "Food image uploaded successfully",

        "filename":
            unique_filename,

        "original_filename":
            file.filename,

        "path":
            file_path,

        "user_id":
            current_user.id,
    }