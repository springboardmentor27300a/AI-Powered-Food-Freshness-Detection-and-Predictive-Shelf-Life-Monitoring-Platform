"""
Central Machine-Learning & freshness-scoring configuration.

Single source of truth for the CNN pipeline and the Milestone 2
freshness scoring engine.  Both the application (FastAPI / inference) and the
training scripts (backend/ml/*) import from here so that:

- training preprocessing and inference preprocessing stay identical,
- freshness thresholds are defined once (backend + mirrored in the frontend),
- no magic numbers are scattered through the code base.

Paths are resolved relative to this file so the same code runs from any
current working directory and on any machine (no hard-coded absolute paths).
"""
from pathlib import Path

# ---------------------------------------------------------------------------
# Filesystem layout
# ---------------------------------------------------------------------------
_BACKEND_DIR = Path(__file__).resolve().parents[2]   # backend/
PROJECT_ROOT = _BACKEND_DIR.parent                   # repository root

DATASETS_DIR = PROJECT_ROOT / "datasets"
RAW_DIR = DATASETS_DIR / "raw"
# Primary source: the extracted class-folder root of AgriFreshNET (the dataset
# owner's ships the zip with this folder name).
EXTRACTED_CLASS_ROOT = RAW_DIR / "AgriFreshNET"
PROCESSED_DIR = DATASETS_DIR / "processed"
TRAIN_DIR = DATASETS_DIR / "train"
VAL_DIR = DATASETS_DIR / "val"
TEST_DIR = DATASETS_DIR / "test"

ML_DIR = _BACKEND_DIR / "ml"
MODEL_DIR = ML_DIR / "models"
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"

# ---------------------------------------------------------------------------
# CNN model configuration
# ---------------------------------------------------------------------------
IMAGE_SIZE = 224                     # square input size used by training + inference

# The dataset (AgriFreshNET) provides exactly three classes.  The CNN is always
# trained on these three real labels.  The five application-level freshness
# categories are produced later by the scoring engine, never by the CNN.
DATASET_CLASS_NAMES = ["FRESH", "SEMI_FRESH", "ROTTEN"]      # split folder names
CNN_CLASS_KEYS = ["fresh", "semi_fresh", "rotten"]           # probability keys
CNN_CLASS_LABELS = {
    "fresh": "Fresh",
    "semi_fresh": "Semi-Fresh",
    "rotten": "Rotten",
}

# Model version is recorded with every stored analysis to support future
# model upgrades and Milestone 4 trend analysis.
MODEL_VERSION = "food-freshness-mobilenetv2-v1"
MODEL_FILENAME = "food_freshness_model.pt"
MODEL_PATH = MODEL_DIR / MODEL_FILENAME

# Pretrained ImageNet backbone used for transfer learning.
BACKBONE_NAME = "mobilenet_v2"

# Transfer-learning settings (must agree between training and inference).
FREEZE_BACKBONE = True   # keep ImageNet features frozen during training
DROPOUT_RATE = 0.4       # dropout before the classification head

# Minimum softmax probability for the CNN prediction to be treated as reliable.
CONFIDENCE_THRESHOLD = 0.50
# Below this confidence the UI shows "low-confidence prediction" guidance.
LOW_CONFIDENCE_THRESHOLD = 0.35

# ---------------------------------------------------------------------------
# Application-level freshness categories (score -> category).
# Used by backend (scoring engine) and mirrored in frontend/src/utils/constants.js.
# ---------------------------------------------------------------------------
FRESHNESS_THRESHOLDS = [
    (90, "Fresh"),
    (75, "Good"),
    (50, "Acceptable"),
    (25, "Near Spoilage"),
    (0, "Spoiled"),
]

# ---------------------------------------------------------------------------
# Milestone 3 weighted overall freshness score.
#
# Project specification weights:
#     Visual Condition Analysis = 40% (of the FULL score)
#     Storage Conditions        = 25%
#     Shelf-Life Prediction     = 20%
#     Product Age               = 15%
#
# The scoring service (app.services.scoring_service) combines the visual
# freshness score produced by this module with the Milestone 3 pillars to
# compute the overall freshness score for every batch.
# ---------------------------------------------------------------------------
SCORING_PILLARS = {
    "visual_condition": 0.40,
    "storage_conditions": 0.25,     # Milestone 3
    "shelf_life_prediction": 0.20,  # Milestone 3
    "product_age": 0.15,            # Milestone 3
}

# Sub-weights of the visual-condition pillar.  Must sum to 1.0.
VISUAL_SCORE_WEIGHTS = {
    "cnn": 0.40,            # CNN freshness class probabilities
    "color": 0.15,          # OpenCV color degradation
    "texture": 0.10,        # OpenCV surface / texture condition
    "spoilage_indicators": 0.15,  # combined visible spoilage indicators
    "mold": 0.10,           # visible mold/fungus indicator (visual estimate only)
    "bruise": 0.05,         # bruising / dark spots
    "damage": 0.05,         # physical damage (cuts, cracks, etc.)
}

# Classification weight used to translate CNN probabilities into a 0..1 "CNN
# freshness score" per class.  These map the raw model outputs onto our score
# scale and are documented in docs/MILESTONE_2.md.
CNN_CLASS_SCORE_WEIGHTS = {
    "fresh": 1.00,
    "semi_fresh": 0.55,
    "rotten": 0.05,
}

# ---------------------------------------------------------------------------
# Upload validation
# ---------------------------------------------------------------------------
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_IMAGE_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024   # 10 MB
MIN_UPLOAD_BYTES = 100                # below this the file cannot be a real image