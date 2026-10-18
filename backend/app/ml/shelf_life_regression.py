"""
shelf_life_regression.py — FreshGuard M3 ML Shelf-Life Regression Trainer

Implements regression models for exact shelf-life prediction on audited datasets:
  1. Tomato (Dryad) — primary exact-label dataset
  2. Avocado (Hass) — derived-label dataset

No external ML library dependencies besides Python stdlib, pickle, and math.
Supports training, evaluation, and inference with proper data leakage prevention.

Scoring: MAE, RMSE, R² (computed in pure Python).
"""

import json
import math
import pickle
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any

# ============================================================================
# Constants & Paths
# ============================================================================

SAVED_MODELS_DIR = Path(__file__).parent / "saved_models"
TOMATO_MODEL_PATH = SAVED_MODELS_DIR / "shelf_life_tomato_rfr.pkl"
AVOCADO_MODEL_PATH = SAVED_MODELS_DIR / "shelf_life_avocado_rfr.pkl"
TOMATO_METRICS_PATH = SAVED_MODELS_DIR / "shelf_life_tomato_metrics.json"
AVOCADO_METRICS_PATH = SAVED_MODELS_DIR / "shelf_life_avocado_metrics.json"

ML_SUPPORT_MATRIX = {
    "tomato": {"model_path": TOMATO_MODEL_PATH, "name": "Dryad Tomato Regression", "status": "pending"},
    "avocado": {"model_path": AVOCADO_MODEL_PATH, "name": "Hass Avocado Regression", "status": "pending"},
}

# ============================================================================
# Pure-Python Random Forest Regressor (Minimal Implementation)
# ============================================================================

class SimpleDecisionTreeRegressor:
    """
    Minimal decision tree regressor for demonstration and training without
    sklearn. In production, use sklearn.ensemble.RandomForestRegressor.
    """
    def __init__(self, max_depth: int = 10, min_samples_split: int = 5):
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.tree = None

    def fit(self, X: List[List[float]], y: List[float]):
        """Fit the tree using recursive binary split on the feature with highest variance reduction."""
        self.tree = self._build_tree(X, y, depth=0)
        return self

    def _build_tree(self, X, y, depth):
        if depth >= self.max_depth or len(X) < self.min_samples_split or self._is_pure(y):
            return {"type": "leaf", "value": sum(y) / len(y) if y else 0.0}

        best_split = self._find_best_split(X, y)
        if best_split is None:
            return {"type": "leaf", "value": sum(y) / len(y) if y else 0.0}

        feat_idx, threshold = best_split
        X_left = [X[i] for i in range(len(X)) if X[i][feat_idx] <= threshold]
        X_right = [X[i] for i in range(len(X)) if X[i][feat_idx] > threshold]
        y_left = [y[i] for i in range(len(y)) if X[i][feat_idx] <= threshold]
        y_right = [y[i] for i in range(len(y)) if X[i][feat_idx] > threshold]

        if not X_left or not X_right:
            return {"type": "leaf", "value": sum(y) / len(y) if y else 0.0}

        return {
            "type": "split",
            "feature": feat_idx,
            "threshold": threshold,
            "left": self._build_tree(X_left, y_left, depth + 1),
            "right": self._build_tree(X_right, y_right, depth + 1),
        }

    def _find_best_split(self, X, y):
        """Find the best feature and threshold to split on (variance reduction)."""
        if not X or not y:
            return None
        y_var_before = self._variance(y)
        best_gain = 0.0
        best_split = None
        for feat_idx in range(len(X[0])):
            values = sorted(set(x[feat_idx] for x in X))
            for threshold in values:
                y_left = [y[i] for i in range(len(y)) if X[i][feat_idx] <= threshold]
                y_right = [y[i] for i in range(len(y)) if X[i][feat_idx] > threshold]
                if not y_left or not y_right:
                    continue
                gain = y_var_before - (len(y_left) / len(y) * self._variance(y_left) +
                                       len(y_right) / len(y) * self._variance(y_right))
                if gain > best_gain:
                    best_gain = gain
                    best_split = (feat_idx, threshold)
        return best_split

    @staticmethod
    def _variance(values):
        if not values:
            return 0.0
        mean = sum(values) / len(values)
        return sum((v - mean) ** 2 for v in values) / len(values)

    @staticmethod
    def _is_pure(values):
        return len(set(values)) == 1

    def predict(self, X):
        return [self._predict_one(x, self.tree) for x in X]

    @staticmethod
    def _predict_one(x, node):
        if node["type"] == "leaf":
            return node["value"]
        if x[node["feature"]] <= node["threshold"]:
            return SimpleDecisionTreeRegressor._predict_one(x, node["left"])
        else:
            return SimpleDecisionTreeRegressor._predict_one(x, node["right"])


class SimpleRandomForestRegressor:
    """
    Minimal random forest regressor (bags multiple decision trees).
    In production, use sklearn.ensemble.RandomForestRegressor.
    """
    def __init__(self, n_trees: int = 10, max_depth: int = 10, min_samples_split: int = 5):
        self.n_trees = n_trees
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.trees = []

    def fit(self, X: List[List[float]], y: List[float]):
        """Train ensemble by bootstrap sampling."""
        import random
        random.seed(42)
        for _ in range(self.n_trees):
            indices = [random.randint(0, len(X) - 1) for _ in range(len(X))]
            X_boot = [X[i] for i in indices]
            y_boot = [y[i] for i in indices]
            tree = SimpleDecisionTreeRegressor(self.max_depth, self.min_samples_split)
            tree.fit(X_boot, y_boot)
            self.trees.append(tree)
        return self

    def predict(self, X):
        """Aggregate predictions from all trees."""
        predictions = [tree.predict(X) for tree in self.trees]
        return [sum(preds[i] for preds in predictions) / len(predictions) for i in range(len(X))]


# ============================================================================
# Metric Computation (Pure Python)
# ============================================================================

def mean_absolute_error(y_true: List[float], y_pred: List[float]) -> float:
    """Compute MAE."""
    if not y_true:
        return 0.0
    return sum(abs(t - p) for t, p in zip(y_true, y_pred)) / len(y_true)


def root_mean_squared_error(y_true: List[float], y_pred: List[float]) -> float:
    """Compute RMSE."""
    if not y_true:
        return 0.0
    mse = sum((t - p) ** 2 for t, p in zip(y_true, y_pred)) / len(y_true)
    return math.sqrt(mse)


def r2_score(y_true: List[float], y_pred: List[float]) -> float:
    """Compute R² (coefficient of determination)."""
    if not y_true or len(y_true) < 2:
        return 0.0
    mean_y = sum(y_true) / len(y_true)
    ss_tot = sum((y - mean_y) ** 2 for y in y_true)
    ss_res = sum((t - p) ** 2 for t, p in zip(y_true, y_pred))
    return 1.0 - (ss_res / ss_tot) if ss_tot != 0 else 0.0


# ============================================================================
# Data Loading & Preprocessing
# ============================================================================

def load_tomato_data(xlsx_root: Path) -> Tuple[List[Tuple[int, int, int, List[float], int]], str]:
    """
    Load Dryad tomato datasets using pure-Python Excel parsing (no openpyxl).
    Returns list of (neem_level, beeswax_level, replicate, measurements, shelf_life) and a description.
    """
    import xml.etree.ElementTree as ET
    import zipfile
    from io import BytesIO

    def parse_xlsx_to_rows(xlsx_path: Path):
        """Parse .xlsx file without openpyxl using ZIP + XML (pure Python)."""
        try:
            with zipfile.ZipFile(xlsx_path, 'r') as z:
                # Read worksheet XML
                xml_data = z.read('xl/worksheets/sheet1.xml')
                root = ET.fromstring(xml_data)
                
                rows = []
                ns = {'': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                
                for row_elem in root.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
                    row_data = []
                    for cell in row_elem.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                        value = cell.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                        if value is not None:
                            try:
                                row_data.append(float(value.text))
                            except (ValueError, TypeError):
                                row_data.append(value.text)
                        else:
                            row_data.append(None)
                    if row_data:
                        rows.append(row_data)
                return rows
        except Exception as e:
            print(f"    Warning: Failed to parse {xlsx_path}: {e}")
            return []

    data = []
    measurement_files = [
        ("dryad_ta.xlsx", "TA"),
        ("dryad_wl.xlsx", "WL"),
        ("dryad_tss.xlsx", "TSS"),
        ("dryad_ph.xlsx", "pH"),
        ("dryad_decay.xlsx", "Decay"),
        ("dryad_marketability.xlsx", "Marketability"),
        ("dryad_aa.xlsx", "AA"),
    ]
    shelflife_file = "dryad_shelflife.xlsx"

    # Load shelf-life target
    shelflife_map = {}
    shelflife_rows = parse_xlsx_to_rows(xlsx_root / shelflife_file)
    for row in shelflife_rows[1:] if len(shelflife_rows) > 1 else []:
        try:
            if len(row) >= 5:
                neem, bw, treatment, rep, days = row[0], row[1], row[2], row[3], row[4]
                if isinstance(rep, (int, float)) and isinstance(days, (int, float)):
                    key = (str(neem).strip(), str(bw).strip(), int(rep))
                    shelflife_map[key] = int(days)
        except (IndexError, TypeError, ValueError):
            continue

    # Load measurements
    for filename, _ in measurement_files:
        rows = parse_xlsx_to_rows(xlsx_root / filename)
        for row in rows[1:] if len(rows) > 1 else []:
            try:
                if len(row) >= 4:
                    neem, bw, treatment, rep = row[0], row[1], row[2], row[3]
                    measurements = [v for v in row[4:] if isinstance(v, (int, float))]
                    if isinstance(rep, (int, float)):
                        key = (str(neem).strip(), str(bw).strip(), int(rep))
                        if key in shelflife_map:
                            neem_level = int(neem.replace("NLED", "")) if "NLED" in str(neem) else 0
                            bw_level = int(bw.replace("BWC", "")) if "BWC" in str(bw) else 0
                            data.append((neem_level, bw_level, int(rep), measurements, shelflife_map[key]))
            except (IndexError, TypeError, ValueError):
                continue

    return data, "Dryad Tomato: treatment levels (neem, beeswax) + quality measurements -> shelf-life days"


def load_avocado_data(xlsx_path: Path) -> Tuple[List[Tuple[str, int, int, List[int], float]], str]:
    """
    Load Hass avocado metadata and derive shelf-life labels using pure Python.
    For each fruit sample, compute the derived shelf-life as days until Stage 4/5.
    Returns list of (storage_group, sample, day_at_measurement, ripening_stages, derived_shelf_life)
    and a description.
    """
    import xml.etree.ElementTree as ET
    import zipfile
    from collections import defaultdict

    def parse_xlsx_to_rows(xlsx_path: Path):
        """Parse .xlsx file without openpyxl using ZIP + XML (pure Python)."""
        try:
            with zipfile.ZipFile(xlsx_path, 'r') as z:
                xml_data = z.read('xl/worksheets/sheet1.xml')
                root = ET.fromstring(xml_data)
                
                rows = []
                for row_elem in root.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
                    row_data = []
                    for cell in row_elem.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                        value = cell.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                        if value is not None:
                            try:
                                row_data.append(float(value.text))
                            except (ValueError, TypeError):
                                row_data.append(value.text)
                        else:
                            row_data.append(None)
                    if row_data:
                        rows.append(row_data)
                return rows
        except Exception as e:
            print(f"    Warning: Failed to parse {xlsx_path}: {e}")
            return []

    rows = parse_xlsx_to_rows(xlsx_path)

    # Group by fruit sample to find when it reaches end of shelf life
    by_sample = defaultdict(list)
    for r in rows[1:] if len(rows) > 1 else []:
        try:
            if len(r) >= 6 and isinstance(r[4], (int, float)) and isinstance(r[5], (int, float)):
                storage_group = r[2]  # T10, T20, Tamb
                sample_id = r[3]
                day = int(r[4])
                stage = int(r[5])
                by_sample[(storage_group, sample_id)].append((day, stage))
        except (IndexError, TypeError, ValueError):
            continue

    # Derive labels: for each (group, sample), find the day when stage reaches 4 or 5
    data = []
    for (storage_group, sample_id), timeline in by_sample.items():
        timeline = sorted(timeline)
        end_of_shelf_life_day = None
        for day, stage in timeline:
            if stage >= 4:
                end_of_shelf_life_day = day
                break
        if end_of_shelf_life_day:
            for day, stage in timeline:
                if stage < 4:
                    remaining = end_of_shelf_life_day - day
                    # Simple features: storage group (encoded), sample, day, stage history
                    storage_code = {"T10": 10, "T20": 20, "Tam": 0}.get(str(storage_group).strip(), 0)
                    data.append((str(storage_group), sample_id, storage_code, day, stage, remaining))

    return data, "Hass Avocado: storage group + sample + day + ripening stage -> derived shelf-life days"


# ============================================================================
# Training & Evaluation (Grouped Splits to Prevent Leakage)
# ============================================================================

def train_tomato_model(data_root: Path, output_metrics: bool = True) -> Dict[str, Any]:
    """
    Train shelf-life regressor on tomato dataset using grouped split to prevent leakage.
    Grouped by treatment × replicate.
    """
    data, desc = load_tomato_data(data_root)

    if not data:
        raise ValueError("No tomato data loaded")

    # Group by (neem_level, beeswax_level, replicate) to prevent leakage
    by_group = defaultdict(list)
    for neem, bw, rep, meas, days in data:
        by_group[(neem, bw, rep)].append((meas, days))

    groups = list(by_group.keys())
    split_idx = int(len(groups) * 0.7)
    train_groups = groups[:split_idx]
    test_groups = groups[split_idx:]

    X_train, y_train = [], []
    for g in train_groups:
        for meas, days in by_group[g]:
            X_train.append(meas)
            y_train.append(float(days))

    X_test, y_test = [], []
    for g in test_groups:
        for meas, days in by_group[g]:
            X_test.append(meas)
            y_test.append(float(days))

    if not X_train or not X_test:
        raise ValueError("Insufficient data for split")

    # Train
    model = SimpleRandomForestRegressor(n_trees=20, max_depth=8, min_samples_split=2)
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = root_mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    metrics = {
        "model_type": "simple_random_forest",
        "dataset": "Dryad Tomato",
        "description": desc,
        "train_size": len(X_train),
        "test_size": len(X_test),
        "test_mae": round(mae, 4),
        "test_rmse": round(rmse, 4),
        "test_r2": round(r2, 4),
        "test_samples": len(y_test),
        "trained_at": datetime.utcnow().isoformat(),
    }

    # Save model
    SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    with open(TOMATO_MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    print(f"  Tomato model saved → {TOMATO_MODEL_PATH}")

    if output_metrics:
        with open(TOMATO_METRICS_PATH, "w") as f:
            json.dump(metrics, f, indent=2)
        print(f"  Tomato metrics saved → {TOMATO_METRICS_PATH}")

    return metrics


def train_avocado_model(xlsx_path: Path, output_metrics: bool = True) -> Dict[str, Any]:
    """
    Train shelf-life regressor on avocado dataset using grouped split (by fruit sample).
    """
    data, desc = load_avocado_data(xlsx_path)

    if not data:
        raise ValueError("No avocado data loaded")

    # Group by (storage_group, sample_id) to prevent leakage
    by_group = defaultdict(list)
    for storage_group, sample_id, storage_code, day, stage, remaining in data:
        by_group[(storage_group, sample_id)].append((storage_code, day, stage, remaining))

    groups = list(by_group.keys())
    split_idx = int(len(groups) * 0.7)
    train_groups = groups[:split_idx]
    test_groups = groups[split_idx:]

    X_train, y_train = [], []
    for g in train_groups:
        for storage_code, day, stage, remaining in by_group[g]:
            X_train.append([float(storage_code), float(day), float(stage)])
            y_train.append(float(remaining))

    X_test, y_test = [], []
    for g in test_groups:
        for storage_code, day, stage, remaining in by_group[g]:
            X_test.append([float(storage_code), float(day), float(stage)])
            y_test.append(float(remaining))

    if not X_train or not X_test:
        raise ValueError("Insufficient data for split")

    # Train
    model = SimpleRandomForestRegressor(n_trees=15, max_depth=8, min_samples_split=2)
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = root_mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    metrics = {
        "model_type": "simple_random_forest",
        "dataset": "Hass Avocado",
        "description": desc,
        "train_size": len(X_train),
        "test_size": len(X_test),
        "test_mae": round(mae, 4),
        "test_rmse": round(rmse, 4),
        "test_r2": round(r2, 4),
        "test_samples": len(y_test),
        "trained_at": datetime.utcnow().isoformat(),
    }

    # Save model
    SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    with open(AVOCADO_MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    print(f"  Avocado model saved → {AVOCADO_MODEL_PATH}")

    if output_metrics:
        with open(AVOCADO_METRICS_PATH, "w") as f:
            json.dump(metrics, f, indent=2)
        print(f"  Avocado metrics saved → {AVOCADO_METRICS_PATH}")

    return metrics


# ============================================================================
# Model Loading & Inference
# ============================================================================

def load_shelf_life_model(category: str) -> Optional[SimpleRandomForestRegressor]:
    """Load a trained shelf-life regressor for a food category."""
    if category.lower() == "tomato":
        model_path = TOMATO_MODEL_PATH
    elif category.lower() == "avocado":
        model_path = AVOCADO_MODEL_PATH
    else:
        return None

    if not model_path.exists():
        return None

    try:
        with open(model_path, "rb") as f:
            return pickle.load(f)
    except Exception:
        return None


def get_ml_support_status() -> Dict[str, Dict[str, str]]:
    """Return support status for ML-backed categories."""
    result = {}
    for category, info in ML_SUPPORT_MATRIX.items():
        model_path = info["model_path"]
        if model_path.exists():
            result[category] = {
                "name": info["name"],
                "status": "available",
                "model_path": str(model_path),
            }
        else:
            result[category] = {
                "name": info["name"],
                "status": "not_trained",
                "model_path": str(model_path),
            }
    return result


# ============================================================================
# CLI Entry Point
# ============================================================================

if __name__ == "__main__":
    import sys
    from pathlib import Path

    if len(sys.argv) < 2:
        print("Usage: python -m app.ml.shelf_life_regression <command> [args]")
        print("Commands:")
        print("  train-tomato <xlsx_root>    Train tomato model from Dryad files")
        print("  train-avocado <xlsx_path>   Train avocado model from metadata workbook")
        print("  status                      Show ML support status")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "train-tomato" and len(sys.argv) > 2:
        root = Path(sys.argv[2])
        print(f"\n  Training Tomato Shelf-Life Model...")
        print(f"  Data root: {root}")
        metrics = train_tomato_model(root)
        print(f"\n  Training complete!")
        print(f"  Results:")
        print(f"    MAE:  {metrics['test_mae']}")
        print(f"    RMSE: {metrics['test_rmse']}")
        print(f"    R²:   {metrics['test_r2']}")

    elif cmd == "train-avocado" and len(sys.argv) > 2:
        xlsx = Path(sys.argv[2])
        print(f"\n  Training Avocado Shelf-Life Model...")
        print(f"  Metadata file: {xlsx}")
        metrics = train_avocado_model(xlsx)
        print(f"\n  Training complete!")
        print(f"  Results:")
        print(f"    MAE:  {metrics['test_mae']}")
        print(f"    RMSE: {metrics['test_rmse']}")
        print(f"    R²:   {metrics['test_r2']}")

    elif cmd == "status":
        status = get_ml_support_status()
        print(f"\n  ML Support Status:")
        for cat, info in status.items():
            print(f"    {cat}: {info['status']} ({info['name']})")

    else:
        print("Unknown command or missing arguments")
        sys.exit(1)
