# Food Freshness Dataset and Model Training

## 1. Overview

This directory contains the scripts and model files used for food freshness classification in the Food Freshness Monitoring Platform.

The model classifies food images into four categories:

- `fresh`
- `half_fresh`
- `rotten`
- `spoiled`

The complete image dataset is not stored in this Git repository because of its large size. The processed dataset occupies approximately 7.49 GB locally.

## 2. Dataset Structure

The processed dataset is expected to follow this structure:

```text
Datasets/
├── models/
│   ├── food_freshness_model.keras
│   └── class_names.txt
├── prepare_dataset.py
├── train_model.py
└── processed/
    ├── train/
    │   ├── fresh/
    │   ├── half_fresh/
    │   ├── rotten/
    │   └── spoiled/
    ├── val/
    │   ├── fresh/
    │   ├── half_fresh/
    │   ├── rotten/
    │   └── spoiled/
    └── test/
        ├── fresh/
        ├── half_fresh/
        ├── rotten/
        └── spoiled/
```

## 3. Dataset Statistics

The locally processed dataset contains 58,597 images.

| Class | Training | Validation | Testing | Total |
|---|---:|---:|---:|---:|
| Fresh | 21,178 | 4,536 | 4,542 | 30,256 |
| Half-fresh | 552 | 118 | 119 | 789 |
| Rotten | 17,853 | 3,825 | 3,827 | 25,505 |
| Spoiled | 1,432 | 306 | 309 | 2,047 |
| **Total** | **41,015** | **8,785** | **8,797** | **58,597** |

These counts describe the current local processed dataset and may change if the dataset is prepared again.

## 4. Dataset Preparation

The `prepare_dataset.py` script combines images from the available raw datasets and organizes them into training, validation, and testing folders.

The configured split ratios are:

- Training: 70%
- Validation: 15%
- Testing: remaining images

The script expects raw datasets under `Datasets/raw/`. It also removes the existing `Datasets/processed/` directory before recreating it. **Back up the processed dataset before running this script.**

Run from the project root after obtaining and organizing the required raw datasets:

```powershell
python .\Datasets\prepare_dataset.py
```

## 5. Model Training

The `train_model.py` script uses TensorFlow/Keras to train the food freshness classification model.

Current configuration:

- Image size: 224 × 224
- Batch size: 32
- Epochs: 10

Install the required machine-learning dependencies in a suitable Python environment before training.

Run from the project root:

```powershell
python .\Datasets\train_model.py
```

The script saves the trained model to:

```text
Datasets/models/food_freshness_model.keras
```

The class names are defined in:

```text
Datasets/models/class_names.txt
```

## 6. Important Notes

- The processed dataset and raw dataset archives are not included in this Git repository.
- Obtain the required datasets and verify their licences and redistribution permissions before sharing them.
- The original dataset source links are documented in Section 7.
- The dataset is imbalanced, particularly for the `half_fresh` and `spoiled` classes. Evaluate performance separately for each class.
- Dataset class order must remain consistent between training, inference, and the saved class-name file.

## 7. Dataset Sources

The following publicly available datasets on Kaggle were used as source datasets for this project:

1. **Freshness44:** https://www.kaggle.com/datasets/siavash93/freshness44
2. **Fresh and Spoiled Food Image Dataset:** https://www.kaggle.com/datasets/maheen00shahid/fresh-and-spoiled-food-image-dataset
3. **Freshness Fish Dataset:** https://www.kaggle.com/datasets/atcharachumpol/freshness-fish-dataset
4. **Meat Freshness Image Dataset:** https://www.kaggle.com/datasets/vinayakshanawad/meat-freshness-image-dataset

Please refer to the original Kaggle pages for dataset descriptions, licences, attribution requirements, and permitted usage.

The processed dataset is not included in this repository because of its large size. The scripts in this directory describe the preparation and training workflow.

## 8. Related Project Files

The project root README contains the overall platform overview, setup instructions, and deployment information.