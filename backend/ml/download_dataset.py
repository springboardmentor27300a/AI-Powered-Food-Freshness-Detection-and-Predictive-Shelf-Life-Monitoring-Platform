"""
Dataset download helper.

Checks whether the AgriFreshNET "Processed Data.zip" is already present under
``datasets/raw/``.  If it is missing, this script:

1. tells the user exactly where to get the dataset manually (primary option),
2. optionally attempts an automatic download when ``--auto`` and a known URL
   are supplied.

We do NOT silently download random archives from unknown websites.  The
dataset must come from the dataset owner's official distribution channel.

Usage (from the ``backend/`` directory)::

    python ml/download_dataset.py
    python ml/download_dataset.py --auto --url <official_download_url>
"""
import argparse
from pathlib import Path

from ml.config import DATASET_NAME, DATASET_ZIP_PATTERN, RAW_DIR

MANUAL_INSTRUCTIONS = f"""
=== Dataset status: NOT FOUND in this project ===

Dataset required : {DATASET_NAME}
Expected folder : {str(RAW_DIR)}
Expected file   : <{DATASET_ZIP_PATTERN}>

How to obtain it:
  1. Download the "Processed Data.zip" of the {DATASET_NAME}
     from the dataset owner's official/public distribution channel
     (e.g. its published Google Drive / Kaggle / research portal page).
  2. Confirm the license allows research use (see datasets/README.md).
  3. Place the zip file directly inside:
        {str(RAW_DIR)}
     keeping the original file name (or any "Processed Data.zip" name).
  4. Re-run:
        python ml/download_dataset.py       # -> should now report FOUND
        python ml/prepare_dataset.py
        python ml/train_model.py

If you have an official direct download URL you can try:
        python ml/download_dataset.py --auto --url "<official_url>"
"""


def find_existing_zip() -> Path | None:
    if not RAW_DIR.exists():
        return None
    matches = list(RAW_DIR.rglob(DATASET_ZIP_PATTERN))
    return matches[0] if matches else None


def main() -> None:
    parser = argparse.ArgumentParser(description="Locate/download the AgriFreshNET dataset zip.")
    parser.add_argument("--auto", action="store_true", help="Attempt an automatic download via --url.")
    parser.add_argument("--url", type=str, default=None, help="Official download URL (only with --auto).")
    args = parser.parse_args()

    existing = find_existing_zip()
    if existing:
        size_mb = existing.stat().st_size / (1024 * 1024)
        print(f"[OK] Dataset zip found: {existing}")
        print(f"     Size: {size_mb:.1f} MB")
        print("     Next step:  python ml/prepare_dataset.py")
        return

    if args.auto and args.url:
        import urllib.request

        RAW_DIR.mkdir(parents=True, exist_ok=True)
        dest = RAW_DIR / "Processed Data.zip"
        print(f"Downloading from {args.url} -> {dest} ...")
        try:
            urllib.request.urlretrieve(args.url, dest)
        except Exception as exc:  # noqa: BLE001 - surface the real reason
            print(f"[ERROR] Automatic download failed: {exc}")
            print(MANUAL_INSTRUCTIONS)
            return
        print("[OK] Download complete. Next step: python ml/prepare_dataset.py")
        return

    print(MANUAL_INSTRUCTIONS)


if __name__ == "__main__":
    main()