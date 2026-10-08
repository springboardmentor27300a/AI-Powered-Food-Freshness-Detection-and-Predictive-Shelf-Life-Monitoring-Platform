"""
[NOW OBSOLETE - kept only so old references keep working]

The canonical training pipeline lives in ``backend/ml/train_model.py``.
This module re-exports it verbatim.

Use instead:
    python ml/train_model.py [--epochs N] [--batch_size N]

It trains MobileNetV2 transfer learning on the REAL AgriFreshNET dataset
(FRESH / SEMI_FRESH / ROTTEN) with a stratified pre-split dataset
(``datasets/train|val|test``) and reports real test metrics.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml.train_model import main  # noqa: E402,F401

if __name__ == "__main__":
    main()