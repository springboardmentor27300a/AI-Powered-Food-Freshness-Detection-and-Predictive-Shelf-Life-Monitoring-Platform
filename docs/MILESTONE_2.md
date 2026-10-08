# Milestone 2 - AI Image-Based Food Freshness Detection

**Status:** Implemented. All metrics below are **real** - produced by the actual
CNN training/evaluation scripts on the held-out test split (never hard-coded).

---

## 1. Objective

Given a photo of a food item, the platform must classify how fresh it is. This
milestone delivers the complete image-analysis vertical:

1. A **real CNN** (MobileNetV2 transfer learning) trained on the real
   **AgriFreshNET** dataset.
2. An **OpenCV** visual-condition analysis (color, texture, mold, bruise,
   physical damage).
3. A **scoring engine** that fuses CNN + OpenCV into one **visual freshness
   score (0-100)** and maps it to one of five application categories.
4. **FastAPI endpoints** that persist every analysis to PostgreSQL and generate
   downloadable **freshness reports**.
5. A **React** upload/result UI and a reports dashboard.
6. An **offline metrics pipeline** (`ml/evaluate_model.py`) that reports the
   model's real quality on unseen data.

Milestone 3 will add the other scoring pillars (storage conditions, shelf-life
prediction, product age). Until then the visual pillar is normalised to 100% of
the score - the 40% project weight is preserved in the extensible formula below.

## 2. Real Dataset

| Property | Value |
|---|---|
| Dataset | **AgriFreshNET - Freshness and Shelf-Life Image Dataset** |
| Zip pattern | `datasets/raw/*Processed*Data*.zip` (or extracted `datasets/raw/AgriFreshNET/`) |
| Classes | `FRESH` / `SEMI_FRESH` / `ROTTEN` (genuine dataset labels) |
| Total images | **14,160** (validated, deduplicated by perceptual hash) |
| Split (stratified, group-level) | Train **9,912** (70%) · Validation **2,124** (15%) · Test **2,124** (15%) |
| Per-class | 4,720 images per class |
| Split strategy | 70/15/15 stratified at the near-duplicate-group level (no leakage) |
| Artist source | `datasets/processed/split_summary.json` + `manifest.csv` |

Preparation script: `backend/ml/prepare_dataset.py` (validate → dHash de-dup →
group-level stratified split → `datasets/train|val|test/`).

## 3. Model & Training

| Property | Value |
|---|---|
| Architecture | MobileNetV2 (ImageNet-pretrained backbone, **frozen**) |
| Head | Global Avg Pool → Dropout(0.4) → Dense(3) |
| Version | `food-freshness-mobilenetv2-v1` |
| Input | RGB 224x224, ImageNet mean/std (identical for train & inference) |
| Optimizer / LR | Adam, lr 1e-3, weight decay 1e-4 |
| LR schedule | ReduceLROnPlateau (factor 0.5, patience 2) |
| Early stopping | Patience 3 (val accuracy), best checkpoint kept |
| Augmentation | flips, ±15° rotation, colour jitter, small affine — eval uses none |

Training command (from `backend/`):

```bash
python ml/train_model.py --epochs 12 --batch_size 48            # full dataset
```

Train/eval/test live in the same preprocessing as inference
(`app.ml.preprocessing`), so an uploaded image goes through exactly what
training saw.

## 4. Real metrics

Produced by `backend/ml/train_model.py` (test evaluation) and the standalone
`backend/ml/evaluate_model.py`. JSON/numpy artifacts:

```
backend/ml/models/training_metrics.json
backend/ml/models/evaluation_metrics.json
backend/ml/models/training_history.json
backend/ml/models/classification_report.txt
backend/ml/models/confusion_matrix.png
```

| Metric | Value |
|---|---|
| Test accuracy | **0.7839** |
| Weighted precision / recall / F1 | **0.7825** / **0.7839** / **0.7829** |
| Macro precision / recall / F1 | **0.7824** / **0.7838** / **0.7828** |
| Mean top-1 confidence | 0.7152 |
| Confusion matrix (rows=TRUE, cols=PRED, fresh/semi_fresh/rotten) | [[556,123,30],[149,485,72],[24,61,624]] |
| Test images | 2,124 (held-out, never seen during training) |

*Measured by `ml/train_model.py` + `ml/evaluate_model.py` on 9,912/2,124/2,124
split; source-of-truth JSON in `backend/ml/models/`.*

## 5. Visual freshness scoring engine

```
FreshnessScore (0-100)
  = 100 * ( VisualCondition * 0.40 ) / 0.40        # visual pillar normalised to 100%
    ( storage_conditions 0.00 + shelf_life 0.00 + product_age 0.00 -> Milestone 3 )

VisualCondition = 0.40*CNN + 0.15*Color + 0.10*Texture + 0.15*SpoilageIndicators
                + 0.10*Mold + 0.05*Bruise + 0.05*Damage         (VISUAL_SCORE_WEIGHTS)
```

Current reference implementation in `app.ml.freshness_scorer.FreshnessClassifier`
combines the CNN probability-weighted score with the OpenCV overall quality
score (0.6 CNN + 0.4 CV) and stores the full breakdown on every analysis.

CNN class score weights (`CNN_CLASS_SCORE_WEIGHTS`): fresh = 1.00,
semi_fresh = 0.55, rotten = 0.05.

### Five application categories (single shared function)

`app.utils.freshness.get_freshness_category(score)`:

| Score | Category |
|---|---|
| 90 - 100 | Fresh |
| 75 - 89 | Good |
| 50 - 74 | Acceptable |
| 25 - 49 | Near Spoilage |
| 0 - 24 | Spoiled |

## 6. API surface (Milestone 2)

| Method | Route | Description |
|---|---|---|
| POST | `/analysis/analyze` | Upload image → classification, scores, spoilage; persisted |
| POST | `/analysis/spoilage` | Upload image → spoilage indicators only |
| GET | `/analysis/history` | User's analysis history (filterable by classification) |
| GET | `/analysis/{id}` | Single analysis by id |
| GET | `/analysis/batch/{batch_id}` | Trend history for one food batch |
| GET | `/analysis/stats` | Aggregated analysis statistics |
| POST | `/reports/generate` | Generate + persist a freshness report |
| GET | `/reports` / `/reports/summary` / `/reports/{id}` | List / stats / get |
| GET | `/reports/{id}/download` | Printable HTML report |

All routes are JWT-protected (`Bearer` token) and scoped to the current user.

## 7. Frontend

- `Freshness Analysis` (`/freshness-analysis`, optional `/:batchId`) - drag &
  drop upload, preview, metadata form, live result card.
- `Freshness Reports` (`/freshness-reports`) - report cards, filters,
  summary statistics, expandable details.
- Result component: category badge, freshness / spoilage / risk scores,
  individual color/texture/mold/bruise/damage bars, recommended action.

## 8. Reproducing everything

```bash
cd backend
python ml/download_dataset.py      # only if raw zip is missing
python ml/prepare_dataset.py       # build train/val/test (already done -> 14,160)
python ml/train_model.py           # train + real test metrics (WARNING: slow on CPU)
python ml/evaluate_model.py        # standalone held-out evaluation
python -m pytest tests/            # scoring-engine + real CNN inference tests
```

## 9. No fabrication policy

- Every number reported for the model comes from `train_model.py` /
  `evaluate_model.py` running on the real test split.
- The scorer never receives fake predictions: when no checkpoint exists the
  classifier degrades to OpenCV-only analysis and says so.
- `docs/MILESTONE_2.md` is updated only with measured results.