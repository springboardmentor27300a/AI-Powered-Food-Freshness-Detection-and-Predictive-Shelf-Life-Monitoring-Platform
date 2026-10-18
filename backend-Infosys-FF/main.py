from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    UploadFile,
    File
)

import os
import sys
import json
import tempfile
import subprocess

from shelf_life import predict_shelf_life

from typing import List

from fastapi.middleware.cors import CORSMiddleware

from feature_routes import router as feature_router

from fastapi.security import (
    HTTPBearer,
    HTTPAuthorizationCredentials
)

from sqlalchemy.orm import Session
from sqlalchemy import text

from database import Base, engine, get_db

from models import (
    User,
    FoodItem,
    FoodBatch,
    AnalysisReport
)

from schemas import (
    UserRegister,
    UserResponse,
    UserLogin,
    FoodItemCreate,
    FoodItemResponse,
    FoodBatchCreate,
    FoodBatchResponse,
    AnalysisReportResponse
)

from auth import (
    hash_password,
    verify_password,
    create_access_token,
    verify_access_token
)

import models

Base.metadata.create_all(bind=engine)


# ============================================================
# SECURITY
# ============================================================

security = HTTPBearer()


# ============================================================
# ALLOWED ROLES & ROLE NORMALIZATION
# ============================================================

ALLOWED_ROLES = {
    "Consumer",
    "Retail Manager",
    "Warehouse Operator",
    "Food Quality Inspector",
    "Administrator",
}

ROLE_ALIASES = {
    "admin": "Administrator",
    "administrator": "Administrator",
    "consumer": "Consumer",
    "retail manager": "Retail Manager",
    "warehouse operator": "Warehouse Operator",
    "food quality inspector": "Food Quality Inspector",
}


def normalize_role(role: str) -> str:
    if not role:
        return "Consumer"
    cleaned = str(role).strip()
    return ROLE_ALIASES.get(cleaned.lower(), cleaned)


# ============================================================
# GET CURRENT USER FROM JWT
# ============================================================

def get_current_user_from_token(
    credentials: HTTPAuthorizationCredentials,
    db: Session
):

    token = credentials.credentials

    payload = verify_access_token(token)

    try:

        user_id = int(payload["sub"])

    except (KeyError, ValueError, TypeError):

        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token"
        )

    current_user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not current_user:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    current_user.role = normalize_role(current_user.role)

    if current_user.role not in ALLOWED_ROLES:

        raise HTTPException(
            status_code=403,
            detail="Invalid user role"
        )

    return current_user


# ============================================================
# ROLE CHECK
# ============================================================

def require_roles(allowed_roles: List[str]):

    def role_checker(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        db: Session = Depends(get_db)
    ):

        current_user = get_current_user_from_token(
            credentials,
            db
        )

        if current_user.role not in allowed_roles:

            raise HTTPException(
                status_code=403,
                detail="You do not have permission to perform this action"
            )

        return current_user

    return role_checker


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="Food Freshness Monitoring Platform",
    description="AI-powered food freshness monitoring system",
    version="1.0.0"
)

app.include_router(feature_router)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://food-freshness-frontend-a337.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "message": "Food Freshness Monitoring Platform API is running!"
    }


# ============================================================
# DATABASE HEALTH
# ============================================================

@app.get("/api/health")
def health_check():

    try:

        with engine.connect() as connection:

            connection.execute(
                text("SELECT 1")
            )

        return {
            "status": "healthy",
            "database": "connected"
        }

    except Exception as e:

        return {
            "status": "unhealthy",
            "database": "connection failed",
            "error": str(e)
        }


# ============================================================
# REGISTER
# ============================================================

@app.post(
    "/auth/register",
    response_model=UserResponse
)
def register_user(
    user: UserRegister,
    db: Session = Depends(get_db)
):

    existing_user = db.query(User).filter(
        User.email == user.email
    ).first()

    if existing_user:

        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    normalized_role = normalize_role(user.role)
    if normalized_role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Allowed roles are: {', '.join(sorted(ALLOWED_ROLES))}"
        )

    new_user = User(
        name=user.name,
        email=user.email,
        password_hash=hash_password(user.password),
        role=normalized_role
    )

    db.add(new_user)

    try:

        db.commit()

        db.refresh(new_user)

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Could not create user"
        )

    return new_user


# ============================================================
# LOGIN
# ============================================================

@app.post("/auth/login")
def login_user(
    user: UserLogin,
    db: Session = Depends(get_db)
):

    existing_user = db.query(User).filter(
        User.email == user.email
    ).first()

    if not existing_user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    password_correct = verify_password(
        user.password,
        existing_user.password_hash
    )

    if not password_correct:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    access_token = create_access_token(
        data={
            "sub": str(existing_user.id),
            "role": existing_user.role
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# ============================================================
# CURRENT USER
# ============================================================

@app.get("/auth/me")
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):

    current_user = get_current_user_from_token(
        credentials,
        db
    )

    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role
    }


# ============================================================
# CREATE FOOD ITEM
# ============================================================

@app.post(
    "/inventory/food-items",
    response_model=FoodItemResponse
)
def create_food_item(
    food_item: FoodItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            "Retail Manager",
            "Warehouse Operator",
            "Administrator"
        ])
    )
):

    new_food_item = FoodItem(
        name=food_item.name,
        category=food_item.category,
        description=food_item.description
    )

    db.add(new_food_item)

    try:

        db.commit()

        db.refresh(new_food_item)

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Could not create food item"
        )

    return new_food_item


# ============================================================
# GET FOOD ITEMS
# ============================================================

@app.get(
    "/inventory/food-items",
    response_model=List[FoodItemResponse]
)
def get_food_items(
    db: Session = Depends(get_db)
):

    return db.query(FoodItem).all()


# ============================================================
# UPDATE FOOD ITEM
# ============================================================

@app.put(
    "/inventory/food-items/{food_item_id}",
    response_model=FoodItemResponse
)
def update_food_item(
    food_item_id: int,
    food_item: FoodItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            "Retail Manager",
            "Warehouse Operator",
            "Administrator"
        ])
    )
):

    existing_food_item = db.query(
        FoodItem
    ).filter(
        FoodItem.id == food_item_id
    ).first()

    if not existing_food_item:

        raise HTTPException(
            status_code=404,
            detail="Food item not found"
        )

    existing_food_item.name = food_item.name

    existing_food_item.category = (
        food_item.category
    )

    existing_food_item.description = (
        food_item.description
    )

    try:

        db.commit()

        db.refresh(
            existing_food_item
        )

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Could not update food item: {str(e)}"
        )

    return existing_food_item


# ============================================================
# CREATE FOOD BATCH
# ============================================================

@app.post(
    "/inventory/batches",
    response_model=FoodBatchResponse
)
def create_food_batch(
    batch: FoodBatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            "Retail Manager",
            "Warehouse Operator",
            "Administrator"
        ])
    )
):

    food_item = db.query(
        FoodItem
    ).filter(
        FoodItem.id == batch.food_item_id
    ).first()

    if not food_item:

        raise HTTPException(
            status_code=404,
            detail="Food item not found"
        )

    existing_batch = db.query(
        FoodBatch
    ).filter(
        FoodBatch.batch_number == batch.batch_number
    ).first()

    if existing_batch:

        raise HTTPException(
            status_code=400,
            detail="Batch number already exists"
        )

    new_batch = FoodBatch(

        food_item_id=batch.food_item_id,

        batch_number=batch.batch_number,

        quantity=batch.quantity,

        unit=batch.unit,

        storage_temperature=
            batch.storage_temperature,

        humidity=batch.humidity,

        packaging_type=
            batch.packaging_type,

        purchase_date=
            batch.purchase_date,

        expiry_date=
            batch.expiry_date
    )

    db.add(new_batch)

    try:

        db.commit()

        db.refresh(new_batch)

    except Exception:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Could not create food batch"
        )

    return new_batch


# ============================================================
# GET FOOD BATCHES
# ============================================================

@app.get(
    "/inventory/batches",
    response_model=List[FoodBatchResponse]
)
def get_food_batches(
    db: Session = Depends(get_db)
):

    return db.query(
        FoodBatch
    ).all()


# ============================================================
# DELETE FOOD BATCH
# ============================================================

@app.delete(
    "/inventory/batches/{batch_id}"
)
def delete_food_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([
            "Retail Manager",
            "Warehouse Operator",
            "Administrator"
        ])
    )
):

    batch = db.query(
        FoodBatch
    ).filter(
        FoodBatch.id == batch_id
    ).first()

    if not batch:

        raise HTTPException(
            status_code=404,
            detail="Food batch not found"
        )

    try:

        db.delete(batch)

        db.commit()

        return {
            "message": "Food batch deleted successfully",
            "batch_id": batch_id
        }

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Could not delete food batch: {str(e)}"
        )


# ============================================================
# FOOD IMAGE ANALYSIS
# ============================================================

@app.post("/analyze")
async def analyze_food_image(
    file: UploadFile = File(...),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # GET LOGGED-IN USER
    # --------------------------------------------------------

    current_user = get_current_user_from_token(
        credentials,
        db
    )

    # --------------------------------------------------------
    # VALIDATE FILE
    # --------------------------------------------------------

    if not file.content_type:

        raise HTTPException(
            status_code=400,
            detail="File type could not be determined"
        )

    allowed_types = {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp"
    }

    if file.content_type not in allowed_types:

        raise HTTPException(
            status_code=400,
            detail="Please upload a JPG, JPEG, PNG, or WEBP image"
        )

    # --------------------------------------------------------
    # FIND SCRIPT & INTERPRETER PATHS
    # --------------------------------------------------------

    backend_root = os.path.dirname(
        os.path.abspath(__file__)
    )

    project_root = os.path.dirname(
        backend_root
    )

    script_candidates = [
        os.path.join(project_root, "Datasets", "analyze_food.py"),
        os.path.join(backend_root, "Datasets", "analyze_food.py"),
        os.path.join(backend_root, "analyze_food.py"),
        os.path.join(project_root, "analyze_food.py"),
    ]

    analyze_script = next(
        (path for path in script_candidates if os.path.isfile(path)),
        None
    )

    if not analyze_script:
        raise HTTPException(
            status_code=500,
            detail=f"Food analysis script not found: {os.path.join(project_root, 'Datasets', 'analyze_food.py')}"
        )

    python_candidates = [
        os.path.join(project_root, "ml-venv", "Scripts", "python.exe"),
        os.path.join(project_root, "ml-venv", "bin", "python"),
        os.path.join(backend_root, "venv", "Scripts", "python.exe"),
        os.path.join(backend_root, "venv", "bin", "python"),
        sys.executable,
    ]

    ml_python = next(
        (path for path in python_candidates if path and os.path.isfile(path)),
        sys.executable
    )

    # --------------------------------------------------------
    # TEMPORARY IMAGE
    # --------------------------------------------------------

    file_extension = os.path.splitext(
        file.filename or ".jpg"
    )[1]

    temporary_file = tempfile.NamedTemporaryFile(
        delete=False,
        suffix=file_extension
    )

    temporary_path = temporary_file.name

    try:

        contents = await file.read()

        temporary_file.write(
            contents
        )

        temporary_file.close()

        # ----------------------------------------------------
        # RUN ML SCRIPT
        # ----------------------------------------------------

        result = subprocess.run(

            [
                ml_python,
                analyze_script,
                temporary_path
            ],

            capture_output=True,

            text=True,

            timeout=120
        )

        if result.returncode != 0:

            raise HTTPException(
                status_code=500,
                detail={
                    "message":
                        "Food analysis failed",

                    "error":
                        result.stderr
                }
            )

        output = result.stdout

        # ----------------------------------------------------
        # FIND JSON REPORT
        # ----------------------------------------------------

        report_start = output.find(
            "REPORT_JSON_START"
        )

        report_end = output.find(
            "REPORT_JSON_END"
        )

        if (
            report_start == -1
            or
            report_end == -1
        ):

            raise HTTPException(
                status_code=500,
                detail=
                    "Structured freshness report was not generated"
            )

        json_start = (
            report_start
            +
            len("REPORT_JSON_START")
        )

        json_text = output[
            json_start:report_end
        ].strip()

        try:

            report = json.loads(
                json_text
            )

        except json.JSONDecodeError:

            raise HTTPException(
                status_code=500,
                detail=
                    "Invalid JSON report generated by ML analysis"
            )

        # ----------------------------------------------------
        # EXTRACT REPORT SECTIONS
        # ----------------------------------------------------

        freshness = report.get(
            "freshness",
            {}
        )

        color = report.get(
            "color_degradation",
            {}
        )

        texture = report.get(
            "surface_texture_changes",
            {}
        )

        mold = report.get(
            "mold_detection",
            {}
        )

        bruising = report.get(
            "bruising_detection",
            {}
        )

        physical_damage = report.get(
            "physical_damage_detection",
            {}
        )

        overall = report.get(
            "overall_assessment",
            {}
        )

        # ----------------------------------------------------
        # SAVE REPORT TO DATABASE
        # ----------------------------------------------------

        new_report = AnalysisReport(

            user_id=current_user.id,

            filename=
                file.filename or "unknown",

            freshness_classification=
                freshness.get(
                    "classification"
                ),

            freshness_confidence=
                freshness.get(
                    "confidence"
                ),

            freshness_score=
                overall.get(
                    "freshness_score"
                ),

            color_level=
                color.get(
                    "level"
                ),

            color_score=
                color.get(
                    "score"
                ),

            texture_level=
                texture.get(
                    "level"
                ),

            texture_score=
                texture.get(
                    "score"
                ),

            mold_level=
                mold.get(
                    "level"
                ),

            mold_score=
                mold.get(
                    "score"
                ),

            bruising_level=
                bruising.get(
                    "level"
                ),

            bruising_score=
                bruising.get(
                    "score"
                ),

            physical_damage_level=
                physical_damage.get(
                    "level"
                ),

            physical_damage_score=
                physical_damage.get(
                    "score"
                ),

            condition=
                overall.get(
                    "condition"
                ),

            recommendation=
                overall.get(
                    "recommendation"
                )
        )

        db.add(
            new_report
        )

        try:

            db.commit()

            db.refresh(
                new_report
            )

        except Exception as e:

            db.rollback()

            raise HTTPException(
                status_code=500,
                detail={
                    "message":
                        "Analysis completed but report could not be saved",

                    "database_error":
                        str(e)
                }
            )

        # ----------------------------------------------------
        # RETURN REPORT
        # ----------------------------------------------------

        return {

            "filename":
                file.filename,

            "status":
                "success",

            "message":
                "Analysis completed and report saved successfully",

            "report_id":
                new_report.id,

            "user_id":
                current_user.id,

            "report":
                report
        }

    except subprocess.TimeoutExpired:

        raise HTTPException(
            status_code=504,
            detail=
                "Food analysis took too long"
        )

    except HTTPException:

        raise

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:

        if os.path.exists(
            temporary_path
        ):

            try:

                os.remove(
                    temporary_path
                )

            except Exception:

                pass


# ============================================================
# GET MY ANALYSIS REPORTS
# ============================================================

@app.get("/analysis/my-reports")
def get_my_reports(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):

    current_user = get_current_user_from_token(
        credentials,
        db
    )

    reports = db.query(
        AnalysisReport
    ).filter(
        AnalysisReport.user_id ==
        current_user.id
    ).order_by(
        AnalysisReport.created_at.desc()
    ).all()

    return {
        "user_id":
            current_user.id,

        "count":
            len(reports),

        "reports":
            reports
    }


# ============================================================
# GET ALL ANALYSIS REPORTS
#
# ACCESS:
# Administrator
# Retail Manager
# Warehouse Operator
# Food Quality Inspector
# ============================================================

@app.get("/analysis/reports")
def get_all_reports(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):

    current_user = get_current_user_from_token(
        credentials,
        db
    )

    # IMPORTANT:
    # Warehouse Operator is included here so the
    # Warehouse Dashboard can display batch freshness
    # and quality reports.

    if current_user.role not in {

        "Administrator",

        "Retail Manager",

        "Warehouse Operator",

        "Food Quality Inspector"

    }:

        raise HTTPException(
            status_code=403,
            detail=
                "You do not have permission to view all reports"
        )

    reports = db.query(
        AnalysisReport
    ).order_by(
        AnalysisReport.created_at.desc()
    ).all()

    return {

        "count":
            len(reports),

        "reports":
            reports
    }


# ============================================================
# MILESTONE 3 - SHELF LIFE PREDICTION
# ============================================================

@app.post("/shelf-life/predict")
def predict_food_shelf_life(

    category: str,

    freshness_score: float,

    storage_temperature:
        float | None = None,

    humidity:
        float | None = None,

    packaging_type:
        str | None = None,

    purchase_date:
        str | None = None,

    expiry_date:
        str | None = None

):

    """
    Predict remaining shelf life and expiry date
    using food freshness and storage conditions.
    """

    from datetime import date

    # --------------------------------------------------------
    # CONVERT DATES
    # --------------------------------------------------------

    parsed_purchase_date = None

    parsed_expiry_date = None

    try:

        if purchase_date:

            parsed_purchase_date = (
                date.fromisoformat(
                    purchase_date
                )
            )

        if expiry_date:

            parsed_expiry_date = (
                date.fromisoformat(
                    expiry_date
                )
            )

    except ValueError:

        raise HTTPException(
            status_code=400,
            detail=
                "Dates must be in YYYY-MM-DD format."
        )

    # --------------------------------------------------------
    # VALIDATE FRESHNESS SCORE
    # --------------------------------------------------------

    if (
        freshness_score < 0
        or
        freshness_score > 100
    ):

        raise HTTPException(
            status_code=400,
            detail=
                "Freshness score must be between 0 and 100."
        )

    # --------------------------------------------------------
    # RUN SHELF-LIFE PREDICTION
    # --------------------------------------------------------

    result = predict_shelf_life(

        category=category,

        freshness_score=
            freshness_score,

        storage_temperature=
            storage_temperature,

        humidity=
            humidity,

        packaging_type=
            packaging_type,

        purchase_date=
            parsed_purchase_date,

        expiry_date=
            parsed_expiry_date

    )

    # --------------------------------------------------------
    # RETURN PREDICTION
    # --------------------------------------------------------

    return {

        "status":
            "success",

        "prediction":
            result

    }