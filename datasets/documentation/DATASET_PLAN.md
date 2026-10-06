# Freshness Dataset — Collection & Organization Plan

## Status: Milestone 1 (structure only — no CNN/ML work yet)

This directory is prepared so that Milestone 2 (AI-powered freshness
detection) can plug in an image dataset without changing the Milestone 1
codebase or database schema.

## Directory layout

```
datasets/
├── raw/            # Unmodified, as-downloaded images (source of truth)
├── processed/       # Resized/normalized/augmented images, ready for training
├── fruits/          # Fruit-specific freshness images (fresh vs rotten), by class
├── vegetables/       # Vegetable-specific freshness images, by class
└── documentation/    # This file + dataset licenses/citations
```

Within `fruits/` and `vegetables/`, the expected sub-structure once real
data is added (Milestone 2) is:

```
fruits/
├── apple/
│   ├── fresh/
│   └── rotten/
├── banana/
│   ├── fresh/
│   └── rotten/
└── ...
```

## Candidate public datasets (for Milestone 2 integration)

| Dataset | Contents | Notes |
|---|---|---|
| Fruits Freshness Dataset (Kaggle) | Fresh/rotten labeled fruit images | Good baseline for fruit classes |
| Vegetable Freshness Dataset (Kaggle) | Fresh/rotten labeled vegetable images | Complements fruit dataset |
| Kaggle Food Freshness Dataset | Mixed food freshness images | Broader category coverage |
| Food-101 | 101 food categories, 101,000 images | Useful for general food recognition, not freshness-labeled — would need re-labeling or combination with a freshness-specific dataset |

None of these have been downloaded or integrated yet — that is explicitly
out of scope for Milestone 1 per the project boundary.

## How this connects to the database (future work)

In Milestone 2, an `images` table (or similar) will likely be added,
foreign-keyed to `batches.id`, storing an image reference/path and the
model's freshness prediction. This is not built yet — `batches` today has
no image-related columns, by design, so Milestone 1 doesn't need to
anticipate the exact schema.

## What Milestone 1 does NOT include

- No images have been downloaded into `raw/`
- No preprocessing scripts
- No CNN, YOLO, or OpenCV code
- No freshness scoring or spoilage prediction

These begin in Milestone 2.
