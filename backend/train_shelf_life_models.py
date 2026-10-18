"""
train_shelf_life_models.py - Training script for tomato and avocado shelf-life regressors

Loads datasets from audit directories and trains pure-Python models without
numpy/sklearn dependencies.

Expected directory structure:
  C:/Users/lakshana/AppData/Local/Temp/freshguard_audit2/  (Dryad Tomato)
  C:/Users/lakshana/AppData/Local/Temp/freshguard_audit3/  (Hass Avocado)
"""

import sys
from pathlib import Path

# Add backend to path so we can import app modules
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.ml.shelf_life_regression import train_tomato_model, train_avocado_model

# ============================================================================
# Paths to Audit Directories
# ============================================================================

DRYAD_ROOT = Path(r"C:\Users\lakshana\AppData\Local\Temp\freshguard_audit2")
AVOCADO_ZIP = Path(r"C:\Users\lakshana\AppData\Local\Temp\freshguard_audit3\avocado.zip")
TEMP_EXTRACT = Path(r"C:\Users\lakshana\AppData\Local\Temp\freshguard_extract")

# ============================================================================
# Main Training Execution
# ============================================================================

def main():
    import zipfile
    
    print("\n" + "=" * 80)
    print("FreshGuard M3 Shelf-Life ML Model Training")
    print("=" * 80)

    # Extract avocado ZIP first
    print("\n[PREP] Extracting avocado dataset from ZIP...")
    TEMP_EXTRACT.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(AVOCADO_ZIP, 'r') as z:
        z.extractall(TEMP_EXTRACT)
    avocado_xlsx = list(TEMP_EXTRACT.glob("**/*.xlsx"))
    if not avocado_xlsx:
        raise FileNotFoundError("No .xlsx files found in avocado.zip")
    avocado_xlsx = avocado_xlsx[0]
    print(f"      Extracted to: {avocado_xlsx}")

    # Train Tomato Model
    print("\n[1/2] Training Dryad Tomato Shelf-Life Regressor...")
    print(f"      Data root: {DRYAD_ROOT}")

    try:
        tomato_metrics = train_tomato_model(DRYAD_ROOT, output_metrics=True)
        print("\n✓ Tomato Model Training Complete")
        print(f"  Train set size:  {tomato_metrics['train_size']}")
        print(f"  Test set size:   {tomato_metrics['test_size']}")
        print(f"  Test MAE:        {tomato_metrics['test_mae']} days")
        print(f"  Test RMSE:       {tomato_metrics['test_rmse']} days")
        print(f"  Test R²:         {tomato_metrics['test_r2']}")
    except Exception as e:
        print(f"\n✗ Tomato model training failed: {e}")
        import traceback
        traceback.print_exc()

    # Train Avocado Model
    print("\n[2/2] Training Hass Avocado Shelf-Life Regressor...")
    print(f"      Metadata file: {avocado_xlsx}")

    try:
        avocado_metrics = train_avocado_model(avocado_xlsx, output_metrics=True)
        print("\n✓ Avocado Model Training Complete")
        print(f"  Train set size:  {avocado_metrics['train_size']}")
        print(f"  Test set size:   {avocado_metrics['test_size']}")
        print(f"  Test MAE:        {avocado_metrics['test_mae']} days")
        print(f"  Test RMSE:       {avocado_metrics['test_rmse']} days")
        print(f"  Test R²:         {avocado_metrics['test_r2']}")
    except Exception as e:
        print(f"\n✗ Avocado model training failed: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "=" * 80)
    print("Training Summary")
    print("=" * 80)
    print("Models saved to: app/ml/saved_models/")
    print("  - shelf_life_tomato_rfr.pkl + shelf_life_tomato_metrics.json")
    print("  - shelf_life_avocado_rfr.pkl + shelf_life_avocado_metrics.json")
    print("\nIntegration:")
    print("  Next: Integrate ML model routing into app/m3.py")
    print("  See: app/ml/shelf_life_models.py (loader & dispatcher)")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()
