"""
Training-pipeline configuration (dataset preparation + CNN training).

Imports every canonical constant from ``app.ml.config`` so training and
inference always agree on image size, class names, model path, etc.

Run everything from the ``backend/`` directory with the virtual environment
active, e.g.::

    python ml/prepare_dataset.py
    python ml/train_model.py
    python ml/evaluate_model.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.ml.config import (  # noqa: E402,F401  (canonical values re-exported)
    BACKBONE_NAME,
    CNN_CLASS_KEYS,
    CNN_CLASS_LABELS,
    DATASET_CLASS_NAMES,
    DATASETS_DIR,
    DROPOUT_RATE,
    EXTRACTED_CLASS_ROOT,
    FREEZE_BACKBONE,
    IMAGE_SIZE,
    MODEL_DIR,
    MODEL_FILENAME,
    MODEL_PATH,
    MODEL_VERSION,
    PROCESSED_DIR,
    PROJECT_ROOT,
    RAW_DIR,
    TEST_DIR,
    TRAIN_DIR,
    VAL_DIR,
)

# ---------------------------------------------------------------------------
# Dataset preparation
# ---------------------------------------------------------------------------
# AgriFreshNET "Freshness and Shelf-Life Image Dataset" - Processed Data.zip
# is expected under datasets/raw/.  Folder names in the zip are mapped to the
# three real dataset classes: FRESH / SEMI_FRESH / ROTTEN.
DATASET_NAME = "AgriFreshNET Freshness and Shelf-Life Image Dataset"
DATASET_ZIP_PATTERN = "*Processed*Data*.zip"

# Folder-name prefixes present in the raw zip structure.
CLASS_FOLDER_MAP = {
    "fresh": "FRESH",
    "semi_fresh": "SEMI_FRESH",
    "semi": "SEMI_FRESH",
    "rotten": "ROTTEN",
}

# Split proportions (sum = 1.0): 70% train / 15% validation / 15% test.
SPLIT_RATIOS = {"train": 0.70, "val": 0.15, "test": 0.15}

# Duplicate / near-duplicate grouping uses a perceptual (dHash) of the resized
# image.  Any group of near-identical images is kept entirely inside one split
# so no related versions leak across splits.  (0 = disable deduplication).
DEDUP_HAMMING_THRESHOLD = 4
DEDUP_HASH_SIZE = 8

# Optional per-class cap for a quick smoke training run (None = use everything).
MAX_IMAGES_PER_CLASS = None

# ---------------------------------------------------------------------------
# Training hyper-parameters (student-laptop / CPU friendly).
# ---------------------------------------------------------------------------
EPOCHS = 12
BATCH_SIZE = 48
INITIAL_LR = 0.001
WEIGHT_DECAY = 1e-4
EARLY_STOPPING_PATIENCE = 3
LR_REDUCE_PATIENCE = 2
LR_REDUCE_FACTOR = 0.5
NUM_WORKERS = 2
SEED = 42

# Canonical architecture settings come from app.ml.config
# (FREEZE_BACKBONE = True, DROPOUT_RATE = 0.4).

# Training augmentations (kept modest so food images stay realistic).
AUGMENTATION_SUMMARY = (
    "Random horizontal flip, small rotation (+-15 deg), slight brightness/"
    "contrast/saturation jitter and small affine zoom/translation. "
    "Validation and test images use no random augmentation."
)

# ---------------------------------------------------------------------------
# Evaluation artifacts
# ---------------------------------------------------------------------------
METRICS_JSON = MODEL_DIR / "training_metrics.json"
EVALUATION_METRICS_JSON = MODEL_DIR / "evaluation_metrics.json"
HISTORY_JSON = MODEL_DIR / "training_history.json"
CLASSIFICATION_REPORT_TXT = MODEL_DIR / "classification_report.txt"
CONFUSION_MATRIX_PNG = MODEL_DIR / "confusion_matrix.png"
SPLIT_JSON = PROCESSED_DIR / "split_summary.json"

MANIFEST_CSV = PROCESSED_DIR / "manifest.csv"

# ---------------------------------------------------------------------------
# Visual freshness calibration artifacts
#
# The healthy bands used by the OpenCV freshness heuristics are measured on the
# train+val splits (never the test split) by ml/calibrate_thresholds.py.
# ---------------------------------------------------------------------------
THRESHOLDS_JSON = MODEL_DIR / "thresholds.json"

# Calibration reads train+val (the test split is never used to fit thresholds).
# FRESH_DIR / SEMI_DIR / ROTTEN_DIR stay available for scripts that only want
# the training half; the CALIB_*_DIRS below are what calibrate_thresholds uses.
FRESH_DIR = TRAIN_DIR / "FRESH"
SEMI_DIR = TRAIN_DIR / "SEMI_FRESH"
ROTTEN_DIR = TRAIN_DIR / "ROTTEN"

CALIB_FRESH_DIRS = [TRAIN_DIR / "FRESH", VAL_DIR / "FRESH"]
CALIB_SEMI_DIRS = [TRAIN_DIR / "SEMI_FRESH", VAL_DIR / "SEMI_FRESH"]
CALIB_ROTTEN_DIRS = [TRAIN_DIR / "ROTTEN", VAL_DIR / "ROTTEN"]