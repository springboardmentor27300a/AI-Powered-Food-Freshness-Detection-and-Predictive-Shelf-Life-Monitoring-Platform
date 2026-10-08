"""
Data-driven calibration of the visual freshness thresholds.

The absolute HSV/edge thresholds that used to live in ``image_analyzer`` were
the root of the false positives: "brown", "white" and "green" mean completely
different things on a potato, a tomato and a banana, and a bright background
tripped the same rules as the food.

Instead of hand-tuned constants we measure, on the project's own labelled
dataset, what each relative feature looks like for FRESH versus ROTTEN produce.
The resulting percentiles define the healthy band, and a feature value inside
that band scores 1.0 regardless of which food it came from.

The bands are stored in ``backend/ml/models/thresholds.json`` and regenerated
with::

    python ml/calibrate_thresholds.py

If the file is missing, conservative built-in defaults are used so the API
never hard-fails.
"""
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from app.ml.config import MODEL_DIR
from app.ml.features import BAND_FEATURES

logger = logging.getLogger(__name__)

THRESHOLD_FILE = MODEL_DIR / "thresholds.json"

# Conservative fallbacks: derived from the FRESH-class percentiles of the
# shipped dataset.  They are only used when the JSON file cannot be read.
DEFAULT_BANDS: dict[str, dict[str, float]] = {
    # colour
    "dark_fraction":      {"fresh_p05": 0.005, "fresh_p95": 0.120, "rotten_p95": 0.340},
    "off_hue_fraction":   {"fresh_p05": 0.010, "fresh_p95": 0.180, "rotten_p95": 0.420},
    "browning_fraction":  {"fresh_p05": 0.000, "fresh_p95": 0.090, "rotten_p95": 0.300},
    "bleached_fraction":  {"fresh_p05": 0.000, "fresh_p95": 0.120, "rotten_p95": 0.380},
    "bright_specular_fraction": {"fresh_p05": 0.000, "fresh_p95": 0.045, "rotten_p95": 0.150},
    "p05_value":          {"fresh_p05": 20.0, "fresh_p95": 120.0, "rotten_p95": 55.0},
    # texture
    "edge_density":       {"fresh_p05": 0.004, "fresh_p95": 0.110, "rotten_p95": 0.230},
    "laplacian_var":      {"fresh_p05": 12.0, "fresh_p95": 900.0, "rotten_p95": 2600.0},
    "contrast":           {"fresh_p05": 8.0, "fresh_p95": 70.0, "rotten_p95": 130.0},
    "entropy":            {"fresh_p05": 0.55, "fresh_p95": 0.94, "rotten_p95": 0.98},
    "local_std_mean":     {"fresh_p05": 1.5, "fresh_p95": 22.0, "rotten_p95": 45.0},
    # defects
    "mold_fraction":      {"fresh_p05": 0.000, "fresh_p95": 0.045, "rotten_p95": 0.180},
    "mold_fuzzy_score":   {"fresh_p05": 1.00, "fresh_p95": 1.60, "rotten_p95": 3.00},
    "mold_largest_region_fraction": {"fresh_p05": 0.000, "fresh_p95": 0.030, "rotten_p95": 0.150},
    "spot_fraction":      {"fresh_p05": 0.000, "fresh_p95": 0.060, "rotten_p95": 0.220},
    "crack_fraction":     {"fresh_p05": 0.000, "fresh_p95": 0.030, "rotten_p95": 0.140},
}

CALIBRATION_VERSION = "2"

# Some features are near-constant across the whole dataset (cracks and
# fuzzy-mold area are exactly 0.0 for the large majority of images).  Their
# raw percentile span is then 0, which would turn the health curve into a
# knife edge where the tiniest difference snaps a score to 0 or 1.  Every
# feature therefore gets a floor in its own natural unit of measurement.
DEFAULT_MIN_SPAN = 0.02
MIN_FEATURE_SPAN: dict[str, float] = {
    "p05_value": 8.0,
    "laplacian_var": 400.0,
    "contrast": 6.0,
    "entropy": 0.05,
    "local_std_mean": 1.0,
    "edge_density": 0.01,
    "mold_fuzzy_score": 0.5,
    "mold_largest_region_fraction": 0.01,
    "crack_fraction": 0.02,
    "spot_fraction": 0.02,
    "mold_fraction": 0.02,
    "browning_fraction": 0.02,
    "bleached_fraction": 0.02,
    "bright_specular_fraction": 0.01,
    "dark_fraction": 0.02,
    "off_hue_fraction": 0.02,
}


def min_span_for(feature: str) -> float:
    """Smallest usable healthy-band width for ``feature``."""
    return float(MIN_FEATURE_SPAN.get(feature, DEFAULT_MIN_SPAN))


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


@dataclass
class Band:
    """Healthy range for one feature, learned from the labelled dataset."""

    feature: str
    direction: str
    fresh_p05: float
    fresh_p95: float
    rotten_p95: float
    min_span: float = 0.0

    @property
    def span(self) -> float:
        """Band width, never narrower than the feature's noise floor."""
        return max(self.fresh_p95 - self.fresh_p05, self.min_span, 1e-3)

    def health(self, value: float) -> float:
        """
        Map a raw measurement to 0..1 "healthy".

        1.0 while the value sits inside the FRESH class range, then decaying
        linearly until it reaches the ROTTEN class range (where it is 0.0).
        This is what stops a single noisy heuristic from destroying a score:
        an unseen value only decays, it never snaps to an extreme.
        """
        if self.direction == "band":
            span = self.span
            if self.fresh_p05 <= value <= self.fresh_p95:
                return 1.0
            if value < self.fresh_p05:
                # Being *smoother* than the freshest training example is weak
                # evidence (lighting, resolution, a naturally waxy skin), so it
                # decays gently instead of being treated as spoilage.
                return _clamp(1.0 - (self.fresh_p05 - value) / (2.0 * span))
            reach = max(self.rotten_p95 - self.fresh_p95, 0.5 * span)
            return _clamp(1.0 - (value - self.fresh_p95) / reach)

        if self.direction == "high_bad":
            if value <= self.fresh_p95:
                return 1.0
            reach = max(self.rotten_p95 - self.fresh_p95, self.span)
            return _clamp(1.0 - (value - self.fresh_p95) / reach)

        # low_bad
        if value >= self.fresh_p05:
            return 1.0
        reach = max(self.fresh_p05 - self.rotten_p95, self.span)
        return _clamp(1.0 - (self.fresh_p05 - value) / reach)


class Calibration:
    """Loaded set of healthy bands."""

    def __init__(self, bands: dict[str, Band], source: str, version: str = CALIBRATION_VERSION):
        self.bands = bands
        self.source = source
        self.version = version

    def band(self, feature: str) -> Band:
        if feature in self.bands:
            return self.bands[feature]
        d = DEFAULT_BANDS.get(feature)
        if d is None:
            raise KeyError(f"No calibration band for feature '{feature}'")
        return Band(feature=feature, direction=BAND_FEATURES[feature], **d)

    def health(self, feature: str, value: float) -> float:
        return self.band(feature).health(float(value))

    def to_dict(self) -> dict:
        return {
            "version": self.version,
            "source": self.source,
            "bands": {
                k: {
                    "direction": b.direction,
                    "fresh_p05": round(b.fresh_p05, 5),
                    "fresh_p95": round(b.fresh_p95, 5),
                    "rotten_p95": round(b.rotten_p95, 5),
                }
                for k, b in self.bands.items()
            },
        }


def _bands_from_mapping(data: dict) -> dict[str, Band]:
    bands: dict[str, Band] = {}
    for name, spec in (data.get("bands") or {}).items():
        direction = spec.get("direction") or BAND_FEATURES.get(name, "band")
        try:
            bands[name] = Band(
                feature=name,
                direction=direction,
                fresh_p05=float(spec["fresh_p05"]),
                fresh_p95=float(spec["fresh_p95"]),
                rotten_p95=float(spec["rotten_p95"]),
                min_span=min_span_for(name),
            )
        except (KeyError, TypeError, ValueError):
            continue
    return bands


_CALIBRATION: Optional[Calibration] = None


def load_calibration(path: Optional[Path] = None) -> Calibration:
    """Load (and cache) the calibrated bands; fall back to defaults on error."""
    global _CALIBRATION
    if path is None and _CALIBRATION is not None:
        return _CALIBRATION

    target = Path(path) if path else THRESHOLD_FILE
    try:
        data = json.loads(target.read_text(encoding="utf-8"))
        bands = _bands_from_mapping(data)
        if bands:
            cal = Calibration(bands, source=str(target), version=str(data.get("version", "?")))
        else:
            raise ValueError("no usable bands in file")
    except Exception as e:  # noqa: BLE001 - calibration must never break the API
        logger.warning("Using default freshness calibration (%s): %s", target, e)
        bands = {
            name: Band(feature=name, direction=direction, min_span=min_span_for(name), **spec)
            for name, spec in DEFAULT_BANDS.items()
            for direction in [BAND_FEATURES[name]]
        }
        cal = Calibration(bands, source="builtin-defaults")

    if path is None:
        _CALIBRATION = cal
    return cal


def save_calibration(cal: Calibration, path: Optional[Path] = None) -> Path:
    target = Path(path) if path else THRESHOLD_FILE
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(cal.to_dict(), indent=2), encoding="utf-8")
    return target


def reset_cache() -> None:
    """Drop the cached calibration (used by tests)."""
    global _CALIBRATION
    _CALIBRATION = None
