"""
[NOW OBSOLETE - kept only so old references keep working]

The canonical dataset preparation pipeline lives in
``backend/ml/prepare_dataset.py``.

Use instead:
    python ml/prepare_dataset.py [--zip <path>]

It validates, near-duplicate-deduplicates, and stratifies the real AgriFreshNET
dataset into ``datasets/train|val|test`` (classes FRESH / SEMI_FRESH / ROTTEN).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml.prepare_dataset import main  # noqa: E402,F401

if __name__ == "__main__":
    main()