"""
Food region segmentation.

Every downstream measurement (color, texture, mold, bruise, damage) must be
restricted to the produce itself.  A photo of a tomato on a white plate used to
be analysed pixel-by-pixel, so the plate counted as "white mold" and the plate
edge counted as a "crack".  This module isolates the food blob so the rest of the
pipeline never sees the background.

Pure OpenCV, no model download required.  Several strategies are tried in order
and each candidate is *validated* before being accepted, because a food photo
may be shot on a white plate, on a wooden table, in a market stall, or cropped
so the produce fills the entire frame:

1.  ``border_color``  - model the image border (almost always background) with
    dominant Lab clusters and cut the distance map with Otsu.  Refined with
    GrabCut.
2.  ``center_saliency`` - spectral-residual saliency combined with a centre
    prior, for scenes where the border already contains produce.
3.  ``center_grabcut`` - a GrabCut seeded from a centred rectangle, the classic
    fallback when the border is not informative.
4.  ``full_frame``     - when nothing is convincing, the whole frame is used
    with a LOW confidence flag so the scoring engine discounts the visual
    evidence instead of silently trusting background-contaminated statistics.
"""
from dataclasses import dataclass, field

import cv2
import numpy as np

MIN_FOOD_AREA_FRACTION = 0.05
MAX_FOOD_AREA_FRACTION = 0.985
#: A candidate is only trusted if it is this different from the frame centre's
#: colour, i.e. the "food" it found is not simply the whole picture.
MIN_COLOR_SEPARATION = 10.0


@dataclass
class SegmentationResult:
    mask: np.ndarray                      # uint8 0/1, same HxW as input
    bbox: tuple[int, int, int, int]       # x, y, w, h
    coverage: float                       # food pixels / total pixels
    method: str
    confidence: float                     # 0..1
    used_full_frame: bool = False
    notes: list[str] = field(default_factory=list)


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _largest_component(mask: np.ndarray) -> np.ndarray:
    num, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if num <= 1:
        return np.zeros_like(mask)
    biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    return (labels == biggest).astype(np.uint8)


def _fill_holes(mask: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    flood = np.zeros((h + 2, w + 2), np.uint8)
    filled = mask.copy()
    if filled[0, 0] == 0:
        cv2.floodFill(filled, flood, (0, 0), 1)
    else:  # border already belongs to the object - pad instead
        padded = cv2.copyMakeBorder(mask, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
        f2 = np.zeros((h + 4, w + 4), np.uint8)
        cv2.floodFill(padded, f2, (0, 0), 1)
        return padded[1:-1, 1:-1]
    return (mask | (1 - filled)).astype(np.uint8)


def _clean(mask: np.ndarray, kernel_size: int = 7) -> np.ndarray:
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    m = cv2.morphologyEx(mask, cv2.MORPH_OPEN, k)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k)
    return _fill_holes(_largest_component(m))


def _otsu_cut(values: np.ndarray) -> float:
    """Otsu on a float map, returned in the map's own units."""
    v = values.astype(np.float32)
    lo, hi = float(np.percentile(v, 1)), float(np.percentile(v, 99))
    if hi - lo < 1e-6:
        return hi
    norm = np.clip((v - lo) / (hi - lo) * 255.0, 0, 255).astype(np.uint8)
    thr, _ = cv2.threshold(norm, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return lo + (float(thr) / 255.0) * (hi - lo)


def _border_background_distance(lab: np.ndarray, border: int = 8) -> np.ndarray:
    """Per-pixel Lab distance to the nearest dominant border colour."""
    h, w = lab.shape[:2]
    b = max(2, min(border, h // 4, w // 4))
    border_px = np.concatenate([
        lab[:b].reshape(-1, 3), lab[-b:].reshape(-1, 3),
        lab[:, :b].reshape(-1, 3), lab[:, -b:].reshape(-1, 3),
    ]).astype(np.float32)

    k = 3 if len(border_px) >= 300 else 1
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0)
    try:
        _, _, centers = cv2.kmeans(border_px, k, None, criteria, 5, cv2.KMEANS_PP_CENTERS)
    except cv2.error:
        centers = border_px.reshape(-1, 3)[:1]

    flat = lab.reshape(-1, 3).astype(np.float32)
    dist = np.min(
        np.stack([np.linalg.norm(flat - c, axis=1) for c in centers], axis=1), axis=1
    )
    return dist.reshape(h, w)


def _spectral_saliency(gray: np.ndarray) -> np.ndarray:
    """Frequency-tuned saliency in 0..1 (1 = salient)."""
    small = cv2.resize(gray, (64, 64)).astype(np.float32)
    fft = np.fft.fft2(small)
    log_amp = np.log(np.abs(fft) + 1e-8)
    phase = np.angle(fft)
    residual = log_amp - cv2.blur(log_amp, (3, 3))
    recon = np.fft.ifft2(np.exp(residual + 1j * phase))
    sal = cv2.GaussianBlur(np.abs(recon), (9, 9), 2.5)
    sal = cv2.resize(sal, (gray.shape[1], gray.shape[0]))
    lo, hi = float(sal.min()), float(sal.max())
    if hi - lo < 1e-6:
        return np.zeros_like(sal, dtype=np.float32)
    return ((sal - lo) / (hi - lo)).astype(np.float32)


def _center_prior(shape: tuple[int, int]) -> np.ndarray:
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cy, cx = (h - 1) / 2.0, (w - 1) / 2.0
    d = np.sqrt(((yy - cy) / (h / 2.0)) ** 2 + ((xx - cx) / (w / 2.0)) ** 2)
    return np.clip(1.15 - d, 0.0, 1.0)


def _grabcut_refine(bgr: np.ndarray, probable_food: np.ndarray,
                    definite_bg: np.ndarray) -> np.ndarray | None:
    """GrabCut seeded with probable-food inside and background outside."""
    h, w = bgr.shape[:2]
    gc = np.full((h, w), cv2.GC_BGD, np.uint8)
    gc[probable_food.astype(bool)] = cv2.GC_PR_FGD
    core = cv2.erode(probable_food, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)),
                     iterations=2)
    if np.count_nonzero(core) < 400:
        return None
    gc[core.astype(bool)] = cv2.GC_FGD
    if definite_bg is not None and definite_bg.any():
        gc[definite_bg.astype(bool)] = cv2.GC_BGD
    try:
        bgd = np.zeros((1, 65), np.float64)
        fgd = np.zeros((1, 65), np.float64)
        cv2.grabCut(bgr, gc, None, bgd, fgd, 3, cv2.GC_INIT_WITH_MASK)
    except cv2.error:
        return None
    out = np.where((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD), 1, 0).astype(np.uint8)
    return out


# --------------------------------------------------------------------------- #
# main entry point
# --------------------------------------------------------------------------- #
def segment_food(bgr: np.ndarray) -> SegmentationResult:
    """Isolate the produce. Always returns a usable mask."""
    h, w = bgr.shape[:2]
    total = float(h * w)
    notes: list[str] = []

    def _full_frame(reason: str, confidence: float = 0.15) -> SegmentationResult:
        notes.append(reason)
        return SegmentationResult(
            mask=np.ones((h, w), np.uint8), bbox=(0, 0, w, h), coverage=1.0,
            method="full_frame", confidence=confidence, used_full_frame=True,
            notes=notes,
        )

    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    prior = _center_prior((h, w))

    candidates: list[tuple[str, np.ndarray]] = []

    # --- strategy 1: border colour model -----------------------------------
    dist = _border_background_distance(lab)
    cut = _otsu_cut(dist)
    definite_bg = (dist <= max(2.0, cut * 0.45)).astype(np.uint8)
    cand1 = (dist > cut).astype(np.uint8)
    cand1 = _clean(cand1)
    c1 = float(np.count_nonzero(cand1)) / total
    notes.append(f"border_color: cut={cut:.1f} coverage={c1:.3f}")
    if MIN_FOOD_AREA_FRACTION <= c1 <= MAX_FOOD_AREA_FRACTION:
        refined = _grabcut_refine(bgr, cand1, definite_bg)
        if refined is not None:
            r = _clean(refined)
            cr = float(np.count_nonzero(r)) / total
            if MIN_FOOD_AREA_FRACTION <= cr <= MAX_FOOD_AREA_FRACTION:
                notes.append(f"grabcut refine -> {cr:.3f}")
                cand1, c1 = r, cr
        candidates.append(("border_color+grabcut" if refined is not None else "border_color", cand1))

    # --- strategy 2: saliency x centre prior -------------------------------
    sal = _spectral_saliency(gray) * prior
    sal8 = (np.clip(sal, 0, 1) * 255).astype(np.uint8)
    _, cand2 = cv2.threshold(sal8, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    cand2 = _clean((cand2 > 0).astype(np.uint8))
    c2 = float(np.count_nonzero(cand2)) / total
    notes.append(f"center_saliency: coverage={c2:.3f}")
    if MIN_FOOD_AREA_FRACTION <= c2 <= MAX_FOOD_AREA_FRACTION:
        candidates.append(("center_saliency", cand2))

    # --- strategy 3: centred rectangle GrabCut -----------------------------
    if not candidates:
        rect_mask = np.zeros((h, w), np.uint8)
        mx, my = int(w * 0.10), int(h * 0.10)
        rect_mask[my:h - my, mx:w - mx] = 1
        refined = _grabcut_refine(bgr, rect_mask, 1 - rect_mask)
        if refined is not None:
            cand3 = _clean(refined)
            c3 = float(np.count_nonzero(cand3)) / total
            notes.append(f"center_grabcut: coverage={c3:.3f}")
            if MIN_FOOD_AREA_FRACTION <= c3 <= MAX_FOOD_AREA_FRACTION:
                candidates.append(("center_grabcut", cand3))

    if not candidates:
        return _full_frame("no foreground strategy produced a plausible region")

    # --- pick the best candidate: plausible size + centre agreement ---------
    best, best_score, best_name = None, -1.0, "full_frame"
    for name, mask in candidates:
        cov = float(np.count_nonzero(mask)) / total
        inside_prior = float(prior[mask.astype(bool)].mean()) if mask.any() else 0.0
        centre_hits = float(mask[h // 4:3 * h // 4, w // 4:3 * w // 4].sum()) / max(
            float(np.count_nonzero(mask[h // 4:3 * h // 4, w // 4:3 * w // 4])), 1.0
        )
        size_ok = 1.0 if 0.10 <= cov <= 0.90 else 0.6
        score = (0.45 * inside_prior + 0.35 * centre_hits + 0.20 * size_ok) * cov
        if score > best_score:
            best, best_score, best_name = mask, score, name

    if best is None:
        return _full_frame("candidate scoring failed")

    best = _clean(best)
    coverage = float(np.count_nonzero(best)) / total
    if coverage < MIN_FOOD_AREA_FRACTION:
        return _full_frame(f"final blob too small ({coverage:.3f})")

    x, y, bw, bh = cv2.boundingRect(best)

    # Separation: how different is the region from the border background.
    separation = float(np.mean(dist[best.astype(bool)])) if coverage > 0 else 0.0
    sep_conf = float(np.clip(separation / 30.0, 0.0, 1.0))
    size_conf = 1.0 if 0.10 <= coverage <= 0.90 else 0.7
    fill_conf = float(np.clip((bw * bh) / max(int(best.sum()), 1.0), 0.0, 1.0))
    confidence = float(np.clip(0.45 * size_conf + 0.35 * sep_conf + 0.20 * fill_conf, 0.1, 1.0))

    notes.append(
        f"selected={best_name} coverage={coverage:.3f} bbox=({x},{y},{bw},{bh}) "
        f"separation={separation:.1f} confidence={confidence:.2f}"
    )
    return SegmentationResult(
        mask=best, bbox=(x, y, bw, bh), coverage=round(coverage, 4),
        method=best_name, confidence=round(confidence, 3),
        used_full_frame=False, notes=notes,
    )
