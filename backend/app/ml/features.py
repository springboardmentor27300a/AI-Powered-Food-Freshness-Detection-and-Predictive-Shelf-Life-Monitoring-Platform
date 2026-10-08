"""
Relative image features for freshness analysis.

Design rule: every feature is expressed *relative to the produce itself*, never
in absolute image terms.  The analyzer only ever sees these features plus the
calibrated reference bands, so a red tomato, a yellow banana and a brown potato
are all judged by the same logic:

    "does this deviate from what a healthy example of this food looks like?"

rather than

    "does this pixel happen to be brown / green / dark".

Background pixels never enter the computation - all statistics are masked to
the food region found by :mod:`app.ml.segmentation`.
"""
from dataclasses import dataclass

import cv2
import numpy as np

# HSV hue is circular; these are the named anchor hues used for the
# "is this pixel off-colour relative to the food" test.
HUE_RED = 0
HUE_GREEN = 60
HUE_BLUE = 120
HUE_YELLOW = 30
HUE_MAGENTA = 150


def circular_hue_distance(h1: np.ndarray, h2: np.ndarray) -> np.ndarray:
    """Absolute angular distance between two OpenCV hue arrays (0..179)."""
    d = np.abs(h1.astype(np.float32) - h2.astype(np.float32))
    return np.minimum(d, 180.0 - d)


def dominant_hue(hue: np.ndarray, sat: np.ndarray, weights: np.ndarray | None = None) -> float:
    """
    Circular mean of the hue distribution, weighted by saturation so that
    near-grey pixels (no meaningful hue) do not drag the estimate around.
    """
    w = (sat.astype(np.float32) / 255.0)
    if weights is not None:
        w = w * weights
    total = float(w.sum())
    if total < 1e-6:
        return float(np.mean(hue)) if hue.size else 0.0
    theta = hue.astype(np.float32) * (2.0 * np.pi / 180.0)
    sin = float((w * np.sin(theta)).sum())
    cos = float((w * np.cos(theta)).sum())
    return float((np.arctan2(sin, cos) * 180.0 / (2.0 * np.pi)) % 180.0)


@dataclass
class RegionFeatures:
    """All measurements for a single image, restricted to the food region."""

    # --- region ---
    food_coverage: float = 1.0
    seg_method: str = "unknown"
    seg_confidence: float = 0.0
    used_full_frame: bool = False
    #: binary food mask (uint8 0/1) kept so region geometry can be reported
    #: without re-running segmentation.
    mask: np.ndarray | None = None
    #: the exact mold candidate mask the fractions above were measured on, kept
    #: so reported region geometry can never drift from the measured numbers.
    mold_candidate_mask: np.ndarray | None = None

    # --- colour (relative) ---
    mean_hue: float = 0.0
    hue_dispersion: float = 0.0
    mean_saturation: float = 0.0
    median_saturation: float = 0.0
    mean_value: float = 0.0
    median_value: float = 0.0
    p05_value: float = 0.0
    dark_fraction: float = 0.0
    off_hue_fraction: float = 0.0
    browning_fraction: float = 0.0
    bleached_fraction: float = 0.0
    bright_specular_fraction: float = 0.0

    # --- texture ---
    edge_density: float = 0.0
    laplacian_var: float = 0.0
    contrast: float = 0.0
    entropy: float = 0.0
    local_std_mean: float = 0.0
    local_std_median: float = 0.0

    # ---------------- defect candidates ---
    mold_fraction: float = 0.0
    mold_region_count: int = 0
    mold_largest_region_fraction: float = 0.0
    mold_fuzzy_score: float = 1.0
    mold_offcolour_fraction: float = 0.0
    spot_fraction: float = 0.0
    spot_count: int = 0
    crack_fraction: float = 0.0
    crack_count: int = 0

    def as_dict(self) -> dict:
        return {k: (round(v, 5) if isinstance(v, float) else v)
                for k, v in self.__dict__.items()
                if k not in ("mask", "mold_candidate_mask")}


# Features compared against the calibrated reference bands, with the direction
# that counts as "unhealthy".
BAND_FEATURES = {
    # colour - all "higher is worse"
    "dark_fraction": "high_bad",
    "off_hue_fraction": "high_bad",
    "browning_fraction": "high_bad",
    "bleached_fraction": "high_bad",
    "bright_specular_fraction": "high_bad",
    "p05_value": "low_bad",
    # texture - healthy only inside the calibrated band
    "edge_density": "band",
    "laplacian_var": "band",
    "contrast": "band",
    "entropy": "band",
    "local_std_mean": "band",
    # defects - higher is worse
    "mold_fraction": "high_bad",
    "mold_fuzzy_score": "high_bad",
    "mold_largest_region_fraction": "high_bad",
    "spot_fraction": "high_bad",
    "crack_fraction": "high_bad",
}


def _masked_stats(values: np.ndarray, mask_bool: np.ndarray) -> np.ndarray:
    return values[mask_bool]


def _local_std(gray: np.ndarray, ksize: int = 7) -> np.ndarray:
    # gray is uint8, so gray * gray would wrap around and make real
    # texture look perfectly smooth. Widen to float before squaring.
    g = gray.astype(np.float32)
    mean = cv2.blur(g, (ksize, ksize))
    mean_sq = cv2.blur(g * g, (ksize, ksize))
    var = np.maximum(mean_sq - mean * mean, 0.0)
    return np.sqrt(var)


def _entropy_of(gray_vals: np.ndarray) -> float:
    if gray_vals.size == 0:
        return 0.0
    hist = cv2.calcHist([gray_vals.astype(np.uint8)], [0], None, [64], [0, 256]).ravel()
    p = hist / max(hist.sum(), 1)
    p = p[p > 0]
    return float(-(p * np.log2(p)).sum() / 6.0)   # normalized to 0..1


def _region_areas(mask: np.ndarray, min_area: int, ref_area: float) -> tuple[list[np.ndarray], float]:
    """
    Connected components above a pixel-area floor.

    The returned fraction is relative to ``ref_area`` (the FOOD area), never to
    the mask's own pixel count - otherwise a fully-covered mask would always
    report 100%.
    """
    num, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    blobs, area = [], 0.0
    for i in range(1, num):
        a = int(stats[i, cv2.CC_STAT_AREA])
        if a >= min_area:
            blobs.append(labels == i)
            area += a
    return blobs, area / max(ref_area, 1.0)


def extract_features(bgr: np.ndarray, food_mask: np.ndarray) -> RegionFeatures:
    """
    Compute all relative features inside the food mask.

    ``food_mask`` is uint8 0/1.  When the segmentation had to fall back to the
    full frame the caller can see that via ``food_coverage``/``used_full_frame``
    and discount the results.
    """
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

    food_bool = food_mask.astype(bool)
    food_area = float(np.count_nonzero(food_bool)) or 1.0
    frame_area = float(gray.size)

    f = RegionFeatures(
        food_coverage=round(food_area / frame_area, 4),
    )

    if not food_bool.any():
        return f

    hue = hsv[:, :, 0].astype(np.float32)
    sat = hsv[:, :, 1].astype(np.float32)
    val = hsv[:, :, 2].astype(np.float32)
    grayf = gray.astype(np.float32)

    fh, fs, fv = hue[food_bool], sat[food_bool], val[food_bool]
    fg = grayf[food_bool]

    # ---------------- colour ----------------
    dom_hue = dominant_hue(fh, fs)
    f.mean_hue = round(dom_hue, 2)
    theta = fh * (2.0 * np.pi / 180.0)
    w = fs / 255.0
    cos_mean = float((w * np.cos(theta)).sum()) / max(float(w.sum()), 1e-6)
    f.hue_dispersion = round(float(np.degrees(np.arccos(np.clip(cos_mean, -1, 1))) / 90.0), 4)
    f.mean_saturation = round(float(fs.mean()), 2)
    f.median_saturation = round(float(np.median(fs)), 2)
    f.mean_value = round(float(fv.mean()), 2)
    f.median_value = round(float(np.median(fv)), 2)
    f.p05_value = round(float(np.percentile(fv, 5)), 2)

    med_v = float(np.median(fv))
    med_s = float(np.median(fs))

    # "Dark" is relative to this food's own body, so a dark-skinned potato is
    # never flagged while a pale banana with black patches is.
    dark_thr = max(med_v * 0.50, 35.0)
    f.dark_fraction = round(float((fv < dark_thr).sum()) / food_area, 5)

    # Off-colour: hue far from the produce's own dominant hue, ignoring
    # low-saturation pixels (which have no reliable hue).
    colored = fs >= max(med_s * 0.35, 35.0)
    if np.count_nonzero(colored) > 50:
        dist = circular_hue_distance(fh[colored], np.array(dom_hue, np.float32))
        f.off_hue_fraction = round(float((dist > 25.0).sum()) / food_area, 5)
    else:
        f.off_hue_fraction = 0.0

    # Browning: brown/olive tones that are *also* darker than the food's body.
    # Natural brown skin (potato) sits at the food's own median value, so the
    # relative darkness test keeps it out.
    brown_hue = (fv < dark_thr) & (
        ((fh >= 5) & (fh <= 25)) | ((fh >= 30) & (fh <= 45))
    ) & (fs >= 40)
    f.browning_fraction = round(float(brown_hue.sum()) / food_area, 5)

    # Bleached / greyed patches: washed out RELATIVE to this produce's own
    # saturation.  An absolute "low saturation" test would flag every naturally
    # pale food (banana, potato, cauliflower), so the reference is the food.
    bleach_thr = max(med_s * 0.45, 20.0)
    f.bleached_fraction = round(
        float(((fs < bleach_thr) & (fv > med_v * 0.5)).sum()) / food_area, 5
    )
    f.bright_specular_fraction = round(float((fv > 245).sum()) / food_area, 5)

    # ---------------- texture ----------------
    # Work on a CLAHE-equalised crop so lighting/exposure differences do not
    # masquerade as surface change.
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray_eq = clahe.apply(gray)

    edges = cv2.Canny(gray_eq, 60, 160)
    f.edge_density = round(float(np.count_nonzero(edges[food_bool])) / food_area, 5)

    lap = cv2.Laplacian(gray_eq, cv2.CV_64F)
    f.laplacian_var = round(float(np.var(lap[food_bool])), 4)
    f.contrast = round(float(fg.std()), 4)
    f.entropy = round(_entropy_of(fg), 4)

    lstd = _local_std(gray_eq, 7)
    lstd_f = lstd[food_bool]
    f.local_std_mean = round(float(lstd_f.mean()), 4)
    f.local_std_median = round(float(np.median(lstd_f)), 4)

    # ---------------- mold candidates ----------------
    # Two conditions must hold together, because neither is sufficient alone:
    #   1. the colour is clearly NOT the produce's own colour (off-colour), and
    #   2. the neighbourhood is locally irregular (fuzzy mycelium).
    # A green stem, a calyx or a specular highlight satisfies (1) but is
    # perfectly smooth, so condition (2) is what separates fungal growth from
    # a natural colour cast.  Both thresholds are relative to THIS image.
    lstd_med = float(np.median(lstd_f)) or 1.0
    hue_dist = circular_hue_distance(hue, np.array(dom_hue, np.float32))

    off_colour = (hue_dist > 20.0) & (sat >= max(med_s * 0.30, 25.0))
    # A desaturated grey/white cast has no reliable hue, so requiring
    # ``sat >= med_s*0.30`` would hide exactly the pale fuzzy growth that
    # spoilage usually looks like.  Near-grey pixels are admitted here and
    # judged on brightness and fuzziness instead.
    green_cast = (hue >= 30) & (hue <= 95) & (sat >= 25) & (sat < 200) & (val < 220)
    bleached = (sat < bleach_thr) & (val > med_v * 0.45) & (val < 250)

    # Pale, low-saturation fuzz (the usual face of mould) plus greenish fuzz.
    near_grey = (sat < max(med_s * 0.45, 40.0)) & (val > med_v * 0.45) & (val < 250)
    cand = (
        (off_colour & (green_cast | bleached))
        | (green_cast & (hue_dist > 12.0))
        | (near_grey & (hue_dist > 12.0) & (val > med_v * 0.55))
    )
    cand = (cand.astype(np.uint8) & food_mask.astype(np.uint8))

    # Fungal growth is a fine, speckled, high-frequency texture. A wide
    # morphological OPEN would delete exactly that speckle and leave nothing
    # to measure, so the gaps are closed and the blobs merged instead.
    cand = cv2.morphologyEx(
        cand, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    )

    # "Irregular" is measured against this food's own local-variability
    # distribution, never a magic constant.  The gate has to be a MULTIPLE of
    # the food's median local spread: an absolute percentile sits inside the
    # normal range of a textured fruit and rejects genuine mycelium, which is
    # exactly the opposite of the desired behaviour.
    lstd_p80 = float(np.percentile(lstd_f, 80)) or lstd_med
    irregular_gate = max(1.5 * lstd_med, 3.0)
    irregular = ((lstd > irregular_gate) & food_bool).astype(np.uint8)
    fungal = cv2.morphologyEx(
        cand & irregular,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)),
    )

    min_area = max(10, int(0.0005 * food_area))
    # ``mold_fraction`` is the SPECIFIC fungal signature (off-colour AND
    # fuzzy), not a loose off-colour count - a tomato with a green stem is
    # not 4% mouldy, and that loose count is what used to light up the
    # indicator for every fresh red or green fruit in the dataset.
    blobs, area_frac = _region_areas(fungal, min_area, food_area)
    f.mold_candidate_mask = fungal
    f.mold_fraction = round(area_frac, 5)
    f.mold_region_count = len(blobs)
    if blobs:
        biggest = max(blobs, key=lambda b: int(b.sum()))
        f.mold_largest_region_fraction = round(float(biggest.sum()) / food_area, 5)
        # Dimensionless fuzziness of the biggest fungal patch: its mean local
        # variability divided by this food's own 80th percentile.  A smooth
        # colour cast scores near 1.0; fuzzy mycelium scores well above.
        f.mold_fuzzy_score = round(float(lstd[biggest].mean()) / lstd_p80, 4)
    else:
        f.mold_largest_region_fraction = 0.0
        f.mold_fuzzy_score = 1.0

    # Broad off-colour area, reported for debugging only: it separates
    # "there is a colour cast here" from "the fuzzy patches are fungal".
    f.mold_offcolour_fraction = round(
        float(np.count_nonzero(cand)) / food_area, 5
    )

    # ---------------- bruise candidates ----------------
    # A bruise is a patch that is dark RELATIVE TO ITS OWN SURROUNDINGS, not
    # merely darker than a global threshold - otherwise the pitted skin of an
    # orange or the ribbed skin of a papaya scores 95% "bruising".  The
    # silhouette rim is excluded too, where self-shadow always darkens edges.
    eroded = cv2.erode(food_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    core = eroded.astype(bool) if eroded.any() else food_bool
    local_mean = cv2.blur(val, (21, 21))
    dark_core = ((val < local_mean * 0.72) & (val < dark_thr) & core).astype(np.uint8)
    dark_core = cv2.morphologyEx(
        dark_core, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    )
    spot_min = max(10, int(0.0006 * food_area))
    spot_blobs, spot_frac = _region_areas(dark_core, spot_min, food_area)
    f.spot_fraction = round(spot_frac, 5)
    f.spot_count = len(spot_blobs)

    # ---------------- damage candidates ----------------
    # Long thin ridges strictly INSIDE the food - the silhouette outline is
    # erased first so a plate rim cannot be reported as a crack.
    inner = cv2.subtract(food_mask, cv2.dilate(
        food_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)), iterations=1
    ))
    strong = cv2.Canny(gray_eq, 90, 180)
    crack = (strong & (inner > 0)).astype(np.uint8)
    crack = cv2.morphologyEx(
        crack, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    )
    num_c, labels_c, stats_c, _ = cv2.connectedComponentsWithStats(crack, connectivity=8)
    crack_px = 0
    crack_count = 0
    crack_min = max(12, int(0.0002 * food_area))
    for i in range(1, num_c):
        a = int(stats_c[i, cv2.CC_STAT_AREA])
        if a < crack_min:
            continue
        cnts, _ = cv2.findContours(
            (labels_c == i).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        for c in cnts:
            ca = cv2.contourArea(c)
            if ca <= 0:
                continue
            _, _, w2, h2 = cv2.boundingRect(c)
            aspect = max(w2, h2) / (min(w2, h2) + 1e-3)
            if aspect > 2.0:
                crack_px += int(ca)
                crack_count += 1
    f.crack_fraction = round(max(crack_px / food_area, 0.0), 5)
    f.crack_count = crack_count

    return f
