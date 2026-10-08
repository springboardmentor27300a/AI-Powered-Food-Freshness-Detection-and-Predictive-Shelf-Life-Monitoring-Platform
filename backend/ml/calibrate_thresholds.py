"""
Calibrate the visual freshness thresholds on the labelled AgriFreshNET data.

Run from the ``backend/`` directory::

    python ml/calibrate_thresholds.py
    python ml/calibrate_thresholds.py --per-class 40

For every feature in :data:`app.ml.features.BAND_FEATURES` the script measures
the FRESH and ROTTEN class distributions and stores:

    fresh_p05 / fresh_p95  -> the healthy band (value scores 1.0 inside it)
    rotten_p95             -> where an unhealthy value has fully decayed to 0.0

Because the features are all *relative to the produce itself*, one calibration
covers tomatoes, bananas, oranges, papayas, pineapples, cucumbers and eggplants
without any per-food rules.
"""
import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.ml.calibration import Band, Calibration, save_calibration  # noqa: E402
from app.ml.calibration import MIN_FEATURE_SPAN  # noqa: E402
from app.ml.features import BAND_FEATURES, extract_features  # noqa: E402
from app.ml.preprocessing import decode_and_resize  # noqa: E402
from app.ml.segmentation import segment_food  # noqa: E402
from ml.config import (  # noqa: E402
    CALIB_FRESH_DIRS, CALIB_ROTTEN_DIRS, CALIB_SEMI_DIRS, THRESHOLDS_JSON,
)

#: Features whose unhealthy direction is "too low"; everything else is
#: "too high".  Texture features are two-sided and come from the dict.
FEATURES = list(BAND_FEATURES.keys())

#: Minimum width of the healthy band per feature.  A few features are almost
#: constant across the whole dataset (e.g. interior ridges on smooth fruit), and
#: without a floor a 1% deviation would read as total decay - the exact
#: false-positive failure this rewrite is meant to eliminate.  The single source
#: of truth lives in app.ml.calibration so the writer and the runtime reader can
#: never drift apart.
MIN_SPAN = dict(MIN_FEATURE_SPAN)


def _sample_images(folder: Path, per_class: int) -> list[Path]:
    if not folder.exists():
        print(f"[warn] missing folder: {folder}")
        return []
    exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
    images = sorted(p for p in folder.iterdir() if p.suffix.lower() in exts)
    if not images:
        return []
    if per_class and len(images) > per_class:
        idx = np.linspace(0, len(images) - 1, per_class).astype(int)
        images = [images[i] for i in idx]
    return images


def _measure(folders: list[Path], per_class: int, label: str) -> dict[str, list[float]]:
    """
    Measure every band feature over one class across all given splits.

    ``per_class`` is the budget per split, so passing train and val fits the
    healthy bands on the full development set without ever touching test.
    """
    rows: dict[str, list[float]] = {f: [] for f in FEATURES}
    extra = {"food_coverage": [], "seg_confidence": [], "used_full_frame": []}
    images: list[Path] = []
    for folder in folders:
        images.extend(_sample_images(folder, per_class))
    if not images:
        return {}

    for i, path in enumerate(images, 1):
        bgr = decode_and_resize(path.read_bytes())
        seg = segment_food(bgr)
        f = extract_features(bgr, seg.mask)
        for name in FEATURES:
            rows[name].append(float(getattr(f, name)))
        extra["food_coverage"].append(f.food_coverage)
        extra["seg_confidence"].append(seg.confidence)
        extra["used_full_frame"].append(1.0 if seg.used_full_frame else 0.0)
        if i % 50 == 0:
            print(f"    {label}: {i}/{len(images)}")

    print(f"  {label}: n={len(images)} "
          f"coverage={np.mean(extra['food_coverage']):.2f} "
          f"full_frame={np.mean(extra['used_full_frame']):.0%}")
    rows.update(extra)
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Calibrate visual freshness thresholds.")
    parser.add_argument("--per-class", type=int, default=200,
                        help="Images sampled per class per split (evenly spaced).")
    args = parser.parse_args()

    print("Measuring FRESH class (train+val)...")
    fresh = _measure(CALIB_FRESH_DIRS, args.per_class, "FRESH")
    if not fresh:
        print("[ERROR] no FRESH images found. Run: python ml/prepare_dataset.py")
        sys.exit(1)
    print("Measuring ROTTEN class (train+val)...")
    rotten = _measure(CALIB_ROTTEN_DIRS, args.per_class, "ROTTEN")
    print("Measuring SEMI_FRESH class (train+val, for reporting)...")
    semi = _measure(CALIB_SEMI_DIRS, args.per_class, "SEMI_FRESH")

    bands: dict[str, Band] = {}
    report: dict[str, dict[str, float]] = {}
    for name in FEATURES:
        direction = BAND_FEATURES[name]
        fq05, fq95 = np.percentile(fresh[name], [5, 95])
        fq50 = float(np.percentile(fresh[name], 50))
        rq95 = float(np.percentile(rotten[name], 95)) if rotten.get(name) else float(fq95)
        rq50 = float(np.percentile(rotten[name], 50)) if rotten.get(name) else float(fq95)
        sq50 = float(np.percentile(semi[name], 50)) if semi.get(name) else 0.0

        # Some features are extremely stable across the whole dataset (e.g.
        # local_std after CLAHE equalisation).  Without a floor the "healthy
        # band" would be a sliver and a 1% deviation would read as total decay,
        # which is exactly the false-positive failure we are fixing.
        min_span = max(MIN_SPAN.get(name, 0.0), 0.25 * abs(fq50))
        if direction in ("high_bad", "band"):
            min_span = max(min_span, 1e-3)
        fq05_eff, fq95_eff = max(float(fq05), 0.0) if direction != "low_bad" else float(fq05), float(fq95)
        if fq95_eff - fq05_eff < min_span:
            mid = 0.5 * (fq95_eff + fq05_eff)
            fq05_eff, fq95_eff = mid - min_span / 2.0, mid + min_span / 2.0
        if direction != "low_bad":
            fq05_eff = max(fq05_eff, 0.0)

        if direction == "band":
            span = max(fq95_eff - fq05_eff, 1e-3)
            rotten_p95 = max(rq95, fq95_eff + 0.5 * span)
        elif direction == "high_bad":
            rotten_p95 = max(rq95, fq95_eff + min_span)
        else:  # low_bad
            rotten_p95 = min(rq95, fq05_eff - min_span)

        bands[name] = Band(
            feature=name,
            direction=direction,
            fresh_p05=fq05_eff,
            fresh_p95=fq95_eff,
            rotten_p95=float(rotten_p95),
            min_span=float(min_span),
        )
        report[name] = {
            "direction": direction,
            "fresh_p05": round(fq05_eff, 5),
            "fresh_p50": round(fq50, 5),
            "fresh_p95": round(fq95_eff, 5),
            "semi_p50": round(sq50, 5),
            "rotten_p50": round(rq50, 5),
            "rotten_p95": round(float(rq95), 5),
            "band_widened": bool(abs(fq95_eff - float(fq95)) > 1e-9),
        }

    cal = Calibration(bands, source="AgriFreshNET train+val (measured)")
    path = save_calibration(cal, THRESHOLDS_JSON)

    print(f"\n[ok] calibration -> {path}\n")
    print(f"{'feature':26s} {'dir':9s} {'fresh p05':>11s} {'fresh p95':>11s} "
          f"{'semi p50':>10s} {'rotten p50':>11s} {'rotten p95':>11s}")
    for name in FEATURES:
        r = report[name]
        print(f"{name:26s} {r['direction']:9s} {r['fresh_p05']:11.4f} {r['fresh_p95']:11.4f} "
              f"{r['semi_p50']:10.4f} {r['rotten_p50']:11.4f} {r['rotten_p95']:11.4f}")

    summary = {
        "samples": {
            "fresh": len(fresh["dark_fraction"]),
            "rotten": len(rotten.get("dark_fraction", [])),
            "semi": len(semi.get("dark_fraction", [])),
        },
        "mean_food_coverage": {
            "fresh": round(float(np.mean(fresh["food_coverage"])), 4),
            "rotten": round(float(np.mean(rotten["food_coverage"])), 4) if rotten else None,
        },
        "full_frame_fallback_rate": {
            "fresh": round(float(np.mean(fresh["used_full_frame"])), 4),
            "rotten": round(float(np.mean(rotten["used_full_frame"])), 4) if rotten else None,
        },
        "features": report,
    }
    stats_path = THRESHOLDS_JSON.with_name("threshold_calibration_report.json")
    stats_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"\n[ok] report -> {stats_path}")


if __name__ == "__main__":
    main()
