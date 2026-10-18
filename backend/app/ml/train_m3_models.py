import os
import sys
import json
import joblib
import pandas as pd
import numpy as np
from datetime import datetime
from pathlib import Path

from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import GroupKFold, LeaveOneGroupOut
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score

# Set directories
BASE_DIR = Path(__file__).parent
PROCESSED_DIR = BASE_DIR / "datasets/processed"
SAVED_MODELS_DIR = BASE_DIR / "saved_models"
REPORTS_DIR = BASE_DIR / "reports"
OOF_DIR = REPORTS_DIR / "oof"

SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)
OOF_DIR.mkdir(parents=True, exist_ok=True)

RANDOM_SEED = 42

print("=== FRESHGUARD M3 MODEL TRAINING & EVALUATION (PHASE 4) ===")

def get_candidates(random_state=42):
    return {
        "LinearRegression": LinearRegression(),
        "RandomForestRegressor": RandomForestRegressor(n_estimators=100, random_state=random_state),
        "GradientBoostingRegressor": GradientBoostingRegressor(n_estimators=100, random_state=random_state)
    }

CATEGORIES_CONFIG = {
    "tomato": {
        "csv": PROCESSED_DIR / "tomato_training.csv",
        "cat_features": ["nled_level", "bwc_level", "packaging_type"],
        "num_features": ["storage_temperature_c", "humidity_pct", "storage_duration_days"],
        "target": "remaining_shelf_life_days",
        "group_col": "group_id",
        "cv_type": "GroupKFold(n_splits=5)",
        "model_file": SAVED_MODELS_DIR / "tomato_rsl.joblib",
        "oof_file": OOF_DIR / "tomato_oof.csv",
        "domain": {
            "temperature_min": 20.0,
            "temperature_max": 25.0,
            "humidity_min": 65.0,
            "humidity_max": 75.0,
            "storage_duration_min": 0.0,
            "storage_duration_max": 35.0,
            "allowed_categories": ["tomato"],
            "allowed_packaging": ["uncoated", "beeswax_coated"]
        }
    },
    "paneer": {
        "csv": PROCESSED_DIR / "paneer_training.csv",
        "cat_features": ["packaging_type"],
        "num_features": ["storage_temperature_c", "humidity_pct", "storage_duration_days"],
        "target": "remaining_shelf_life_days",
        "group_col": "group_id",
        "cv_type": "GroupKFold(n_splits=5)",
        "model_file": SAVED_MODELS_DIR / "paneer_rsl.joblib",
        "oof_file": OOF_DIR / "paneer_oof.csv",
        "domain": {
            "temperature_min": 4.0,
            "temperature_max": 8.0,
            "humidity_min": 30.0,
            "humidity_max": 50.0,
            "storage_duration_min": 0.0,
            "storage_duration_max": 15.0,
            "allowed_categories": ["paneer"],
            "allowed_packaging": ["sealed"]
        }
    },
    "chicken": {
        "csv": PROCESSED_DIR / "chicken_training.csv",
        "cat_features": ["packaging_type"],
        "num_features": ["storage_temperature_c", "humidity_pct", "storage_duration_days"],
        "target": "remaining_shelf_life_days",
        "group_col": "group_id",
        "cv_type": "LeaveOneGroupOut()",
        "model_file": SAVED_MODELS_DIR / "chicken_rsl.joblib",
        "oof_file": OOF_DIR / "chicken_oof.csv",
        "domain": {
            "temperature_min": 4.0,
            "temperature_max": 15.0,
            "humidity_min": 70.0,
            "humidity_max": 80.0,
            "storage_duration_min": 0.0,
            "storage_duration_max": 14.0,
            "allowed_categories": ["chicken"],
            "allowed_packaging": ["modified_atmosphere"]
        }
    },
    "seafood": {
        "csv": PROCESSED_DIR / "seafood_training.csv",
        "cat_features": ["species", "packaging_type"],
        "num_features": ["storage_temperature_c", "humidity_pct", "storage_duration_days"],
        "target": "remaining_shelf_life_days",
        "group_col": "group_id",
        "cv_type": "GroupKFold(n_splits=5)",
        "model_file": SAVED_MODELS_DIR / "seafood_rsl.joblib",
        "oof_file": OOF_DIR / "seafood_oof.csv",
        "domain": {
            "temperature_min": 0.0,
            "temperature_max": 2.0,
            "humidity_min": 80.0,
            "humidity_max": 90.0,
            "storage_duration_min": 0.0,
            "storage_duration_max": 3.0,
            "allowed_species": ["mackerel", "tilapia", "tuna"],
            "allowed_packaging": ["open"]
        }
    }
}

model_registry_output = {}
domain_metadata_output = {}
evaluation_report_data = []

# Save training config
training_config = {
    "random_seed": RANDOM_SEED,
    "python_version": sys.version,
    "sklearn_version": sys.modules['sklearn'].__version__,
    "pandas_version": pd.__version__,
    "numpy_version": np.__version__,
    "training_timestamp": datetime.utcnow().isoformat()
}
with open(REPORTS_DIR / "M3_TRAINING_CONFIG.json", "w") as f:
    json.dump(training_config, f, indent=2)

print("Saved training config -> M3_TRAINING_CONFIG.json")

# Train and evaluate per category
for cat_name, cfg in CATEGORIES_CONFIG.items():
    print(f"\n==================================================")
    print(f"TRAINING CATEGORY: {cat_name.upper()}")
    print(f"==================================================")
    
    df = pd.read_csv(cfg["csv"])
    cat_cols = cfg["cat_features"]
    num_cols = cfg["num_features"]
    target_col = cfg["target"]
    group_col = cfg["group_col"]
    
    feature_cols = cat_cols + num_cols
    X = df[feature_cols]
    y = df[target_col].values
    groups = df[group_col].values
    
    print(f"Rows: {len(df)} | Unique Groups: {len(set(groups))}")
    print(f"Features: {feature_cols}")
    
    # Preprocessor
    preprocessor = ColumnTransformer(transformers=[
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_cols),
        ("num", StandardScaler(), num_cols)
    ])
    
    # Set CV splitter
    if cat_name == "chicken":
        cv = LeaveOneGroupOut()
        splits = list(cv.split(X, y, groups))
    else:
        cv = GroupKFold(n_splits=min(5, len(set(groups))))
        splits = list(cv.split(X, y, groups))
        
    candidates = get_candidates(RANDOM_SEED)
    candidate_results = {}
    oof_predictions_dict = {}
    
    for name, estimator in candidates.items():
        pipeline = Pipeline(steps=[
            ("preprocessor", preprocessor),
            ("regressor", estimator)
        ])
        
        oof_preds = np.zeros(len(df))
        fold_maes = []
        fold_rmses = []
        fold_r2s = []
        
        for fold, (train_idx, val_idx) in enumerate(splits):
            X_train, y_train = X.iloc[train_idx], y[train_idx]
            X_val, y_val = X.iloc[val_idx], y[val_idx]
            
            pipeline.fit(X_train, y_train)
            preds = pipeline.predict(X_val)
            oof_preds[val_idx] = preds
            
            mae_f = mean_absolute_error(y_val, preds)
            rmse_f = root_mean_squared_error(y_val, preds)
            r2_f = r2_score(y_val, preds)
            
            fold_maes.append(mae_f)
            fold_rmses.append(rmse_f)
            fold_r2s.append(r2_f)
            
        mae_mean, mae_std = np.mean(fold_maes), np.std(fold_maes)
        rmse_mean, rmse_std = np.mean(fold_rmses), np.std(fold_rmses)
        r2_mean, r2_std = np.mean(fold_r2s), np.std(fold_r2s)
        
        candidate_results[name] = {
            "mae_mean": float(mae_mean),
            "mae_std": float(mae_std),
            "rmse_mean": float(rmse_mean),
            "rmse_std": float(rmse_std),
            "r2_mean": float(r2_mean),
            "r2_std": float(r2_std),
            "fold_maes": [float(m) for m in fold_maes],
            "oof_preds": oof_preds
        }
        
        print(f"  [{name}] MAE: {mae_mean:.4f} +/- {mae_std:.4f} | RMSE: {rmse_mean:.4f} | R2: {r2_mean:.4f}")
    
    # Model Selection: Lowest measured MAE
    best_model_name = min(candidate_results.keys(), key=lambda k: candidate_results[k]["mae_mean"])
    best_stats = candidate_results[best_model_name]
    print(f"  --> Selected Model for {cat_name}: {best_model_name} (Lowest CV MAE: {best_stats['mae_mean']:.4f})")
    
    # Fit selected model on ALL category data and save
    final_pipeline = Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("regressor", get_candidates(RANDOM_SEED)[best_model_name])
    ])
    final_pipeline.fit(X, y)
    joblib.dump(final_pipeline, cfg["model_file"])
    print(f"  Saved model -> {cfg['model_file']}")
    
    # Save OOF file
    best_oof = best_stats["oof_preds"]
    errors = y - best_oof
    abs_errors = np.abs(errors)
    
    oof_df = pd.DataFrame({
        "group_id": df[group_col],
        "actual_rsl": y,
        "predicted_rsl": best_oof,
        "error": errors,
        "absolute_error": abs_errors
    })
    oof_df.to_csv(cfg["oof_file"], index=False)
    print(f"  Saved OOF -> {cfg['oof_file']}")
    
    overpred_count = int(np.sum(best_oof > y))
    underpred_count = int(np.sum(best_oof < y))
    neg_pred_count = int(np.sum(best_oof < 0))
    max_abs_err = float(np.max(abs_errors))
    median_abs_err = float(np.median(abs_errors))
    
    model_registry_output[cat_name] = {
        "food_category": cat_name,
        "model_file": str(cfg["model_file"].name),
        "model_type": best_model_name,
        "features": feature_cols,
        "target": target_col,
        "training_rows": len(df),
        "independent_groups": int(len(set(groups))),
        "cv_strategy": cfg["cv_type"],
        "mae_mean": round(best_stats["mae_mean"], 4),
        "mae_std": round(best_stats["mae_std"], 4),
        "rmse_mean": round(best_stats["rmse_mean"], 4),
        "rmse_std": round(best_stats["rmse_std"], 4),
        "r2_mean": round(best_stats["r2_mean"], 4),
        "r2_std": round(best_stats["r2_std"], 4),
        "max_absolute_error": round(max_abs_err, 4),
        "median_absolute_error": round(median_abs_err, 4),
        "negative_predictions_count": neg_pred_count,
        "domain": cfg["domain"]
    }
    
    domain_metadata_output[cat_name] = cfg["domain"]
    
    evaluation_report_data.append({
        "category": cat_name,
        "rows": len(df),
        "groups": len(set(groups)),
        "selected_model": best_model_name,
        "candidates": candidate_results,
        "max_abs_err": max_abs_err,
        "median_abs_err": median_abs_err,
        "neg_preds": neg_pred_count
    })

model_registry_output["avocado"] = {
    "status": "BLOCKED",
    "reason": "raw dataset unavailable locally"
}

with open(SAVED_MODELS_DIR / "model_registry.json", "w") as f:
    json.dump(model_registry_output, f, indent=2)
print("\nSaved model registry -> model_registry.json")

with open(REPORTS_DIR / "model_domains.json", "w") as f:
    json.dump(domain_metadata_output, f, indent=2)
print("Saved domain metadata -> model_domains.json")

report_path = REPORTS_DIR / "M3_ML_EVALUATION_REPORT.md"
with open(report_path, "w", encoding="utf-8") as f:
    f.write("# FreshGuard M3 — ML Model Evaluation Report (Phase 4)\n\n")
    f.write("## 1. Methodology & Grouped Cross-Validation\n\n")
    f.write("To prevent target data leakage, validation was conducted strictly using **Grouped Cross-Validation** based on the independent physical experimental units identified in Phase 3.5:\n")
    f.write("- **Tomato:** `GroupKFold` across 48 independent treatment-replicate batch groups.\n")
    f.write("- **Paneer:** `GroupKFold` across 5 independent replicate package groups.\n")
    f.write("- **Chicken:** `LeaveOneGroupOut` across 2 temperature run groups (`4C` and `8C`).\n")
    f.write("- **Seafood:** `GroupKFold` across 9 species-date session groups.\n\n")
    
    f.write("## 2. Model Performance Factual Comparison\n\n")
    f.write("| Category | Training Rows | Groups | Selected Model | Mean MAE | Mean RMSE | Mean R² | Max Abs Error |\n")
    f.write("|---|---:|---:|---|---:|---:|---:|---:|\n")
    for d in evaluation_report_data:
        c = d["category"]
        best_m = d["selected_model"]
        res = d["candidates"][best_m]
        f.write(f"| **{c.capitalize()}** | {d['rows']} | {d['groups']} | `{best_m}` | **{res['mae_mean']:.4f}** | {res['rmse_mean']:.4f} | {res['r2_mean']:.4f} | {d['max_abs_err']:.2f} |\n")
    f.write("| **Avocado** | 0 | 0 | *BLOCKED* | N/A | N/A | N/A | N/A |\n\n")
    
    f.write("---\n\n")
    f.write("## 3. Detailed Category Evaluations\n\n")
    
    for d in evaluation_report_data:
        c = d["category"].capitalize()
        f.write(f"### {c} Model Evaluation\n")
        f.write(f"- **Training Rows:** {d['rows']}\n")
        f.write(f"- **Independent Group Count:** {d['groups']}\n")
        f.write("- **Candidate Comparisons:**\n")
        for mname, mstats in d["candidates"].items():
            f.write(f"  - `{mname}`: MAE = {mstats['mae_mean']:.4f} (+/- {mstats['mae_std']:.4f}), RMSE = {mstats['rmse_mean']:.4f}, R² = {mstats['r2_mean']:.4f}\n")
        f.write(f"- **Selected Model:** `{d['selected_model']}` (Lowest CV MAE)\n")
        f.write(f"- **Median Absolute Error:** {d['median_abs_err']:.4f} days\n")
        f.write(f"- **Maximum Absolute Error:** {d['max_abs_err']:.4f} days\n")
        f.write(f"- **Negative Predictions in OOF:** {d['neg_preds']}\n")
        if c == "Chicken":
            f.write("- **Evaluation Limitation Note:** *MODEL SELECTION UNCERTAIN DUE TO LIMITED INDEPENDENT EXPERIMENTAL GROUPS (2 groups).* High metric variance expected.\n")
        f.write("\n")

print(f"Saved evaluation report -> {report_path}")

print("\n==================================================")
print("RUNNING MODEL SERIALIZATION & RELOAD TEST")
print("==================================================")
for cat_name, cfg in CATEGORIES_CONFIG.items():
    model_path = cfg["model_file"]
    print(f"Testing reload for {cat_name} -> {model_path.name}...")
    loaded_pipe = joblib.load(model_path)
    
    df_sample = pd.read_csv(cfg["csv"]).head(1)
    feature_cols = cfg["cat_features"] + cfg["num_features"]
    sample_input = df_sample[feature_cols]
    
    pred = loaded_pipe.predict(sample_input)
    print(f"  Sample Input: {sample_input.to_dict(orient='records')[0]}")
    print(f"  Predicted RSL: {pred[0]:.2f} days | Reload Test SUCCESS!")

print("\nPhase 4 Model Training, Evaluation, and Serialization Complete!")
