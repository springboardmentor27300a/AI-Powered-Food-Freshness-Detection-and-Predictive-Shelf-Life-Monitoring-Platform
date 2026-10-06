# Dataset Documentation

## Dataset used

**Fruits Fresh and Rotten for Classification**

- **Source / owner:** Kaggle, uploaded by user `sriramr`
- **URL:** https://www.kaggle.com/datasets/sriramr/fruits-fresh-and-rotten-for-classification
- **License / usage:** Listed on Kaggle for educational/research use. Verify the
  current license tab on the dataset page before any commercial use — this
  project uses it strictly for a college coursework demo.
- **Classes:** 6 raw folders, collapsing to **2 usable labels**:
  - `freshapples`, `freshbanana`, `freshoranges` → **fresh**
  - `rottenapples`, `rottenbanana`, `rottenoranges` → **rotten**
- **Number of images:** ~13,599 total across train+test in the original
  Kaggle listing (exact count can vary slightly by mirror/re-upload — verify
  the count you actually get after downloading; `prepare_dataset.py` prints
  the real count it finds).
- **Original split:** Kaggle ships `train/` and `test/` folders.
  `ml/training/prepare_dataset.py` carves an additional **validation** split
  (15%) out of `train/` only, so `test/` stays completely unseen until
  `evaluate_model.py` runs. No image ever appears in more than one split —
  this is how leakage is avoided.
- **Suitability for CNN training:** Yes — it's a standard, widely-used
  binary image classification dataset with a reasonable number of images
  per class, commonly used for exactly this kind of transfer-learning demo.

## Why this dataset (and not a 5-class one)

The project spec calls for 5 platform freshness categories (Fresh / Good /
Acceptable / Near Spoilage / Spoiled), but this dataset only provides
binary fresh/rotten labels. Per the project's own rule ("do not create
five-class CNN predictions from a binary dataset without a valid training
or mapping method"), the CNN here is trained honestly on **2 classes only**.

The 5-tier platform category is then produced *after* the CNN, in
`app/services/scoring_service.py`, by combining:
- the CNN's fresh/rotten signal (40% weight, blended with OpenCV — see
  `visual_component()`),
- storage conditions (25%),
- shelf-life estimate (20%),
- product age (15%).

This mapping is documented in `ml/config/class_names.json` under
`cnn_to_platform_mapping` and is intentionally coarse (fresh→{fresh,good},
rotten→{near_spoilage,spoiled}) rather than a false claim that the CNN
itself distinguishes 5 grades of freshness.

## Download instructions (manual — do this on your machine)

1. Create a free Kaggle account if you don't have one.
2. Go to the dataset page above and click **Download** (~2GB zip), or use
   the Kaggle CLI:
   ```powershell
   pip install kaggle
   # place your kaggle.json API token at %USERPROFILE%\.kaggle\kaggle.json first
   kaggle datasets download -d sriramr/fruits-fresh-and-rotten-for-classification
   ```
3. Unzip it.
4. Copy the unzipped folder into `backend/ml/data/raw/` so that
   `backend/ml/data/raw/.../train/...` and `.../test/...` exist somewhere
   under that path (nested one level deeper is fine — `prepare_dataset.py`
   searches for it).
5. Run `python ml/training/prepare_dataset.py` from `backend/` — see
   `CNN_TRAINING.md` for the full sequence.

## Preprocessing

- Images resized to 224x224 (MobileNetV2's expected input size)
- Pixel values passed through `mobilenet_v2.preprocess_input` (scales to
  [-1, 1], matching how the ImageNet backbone was originally trained)
- Data augmentation on the training split only: horizontal flip, small
  rotation, zoom, contrast jitter (`tf.keras.layers.Random*`)
- No augmentation applied to validation/test — those must reflect real,
  unmodified images for honest metrics
