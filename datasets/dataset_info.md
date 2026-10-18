# Food Freshness Platform — Dataset Organization & Metadata

This document catalogs the datasets identified and organized for future AI training, transfer learning, and evaluation in **Milestone 2** and beyond.

---

## 1. Fruits Freshness Dataset

- **Dataset Name**: Fruit Freshness & Rotten Fruit Classification Dataset
- **Source**: Kaggle / Academic Open Repositories (e.g., Sriram et al., Mendeley Data)
- **Purpose**: Train deep convolutional neural networks (CNNs) and Vision Transformers (ViTs) to distinguish freshly harvested fruits from deteriorating or spoiled specimens.
- **Classes**:
  - `freshapples`, `rottenapples`
  - `freshbanana`, `rottenbanana`
  - `freshoranges`, `rottenoranges`
- **Number of Images**: ~13,500 curated RGB images across various lighting conditions, angles, and backgrounds.
- **License**: CC BY 4.0 / Open Access for non-commercial educational research.
- **Intended Use**: Benchmark visual classifier for retail produce displays and household fruit bowls; foundational model training for RGB freshness scoring.
- **Target Subdirectory**: `datasets/fruits/`

---

## 2. Vegetable Freshness Dataset

- **Dataset Name**: Multi-Class Vegetable Freshness & Spoilage Dataset
- **Source**: Kaggle Datasets / Roboflow Universe Open Food Collection
- **Purpose**: Detect visual wilting, bacterial rotting, fungal spots, and dehydration across everyday commercial vegetables.
- **Classes**:
  - `fresh_capsicum`, `rotten_capsicum`
  - `fresh_tomato`, `rotten_tomato`
  - `fresh_potato`, `rotten_potato`
  - `fresh_cucumber`, `rotten_cucumber`
  - `fresh_spinach`, `rotten_spinach`
- **Number of Images**: ~9,200 RGB photographs annotated with bounding boxes and categorical freshness labels.
- **License**: MIT / CC0 Public Domain.
- **Intended Use**: Quality assurance screening for supermarket shelves, restaurant prep kitchens, and cold warehouse distribution hubs.
- **Target Subdirectory**: `datasets/vegetables/`

---

## 3. Kaggle Comprehensive Food Freshness Dataset

- **Dataset Name**: Binary & Multi-Grade Food Freshness Assessment Dataset
- **Source**: Kaggle (Food Quality & Spoilage Benchmark)
- **Purpose**: Generalize binary (`Fresh` vs. `Spoiled`) and continuous freshness index regression (0% to 100% shelf life score).
- **Classes**:
  - `Fresh` (Grade A - optimal quality, Grade B - acceptable shelf quality)
  - `Expiring Soon` (Grade C - culinary usage required within 24-48 hours)
  - `Spoiled` (Grade D - unsafe for consumption, fungal growth/bacterial breakdown)
- **Number of Images**: ~18,400 multi-category food items (fruits, vegetables, baked goods, dairy products, meats).
- **License**: CC BY-SA 4.0.
- **Intended Use**: Unified feature extractor backbone for the platform's multi-category freshness prediction API.
- **Target Subdirectory**: `datasets/fresh/` and `datasets/spoiled/`

---

## 4. Food-101 Benchmark Dataset

- **Dataset Name**: Food-101 (ETH Zurich Computer Vision Lab)
- **Source**: [https://data.vision.ee.ethz.ch/cvl/datasets_extra/food-101/](https://data.vision.ee.ethz.ch/cvl/datasets_extra/food-101/)
- **Purpose**: Autonomous food dish, ingredient, and produce categorization prior to freshness estimation.
- **Classes**: 101 distinct food classes (including apple pie, bakery goods, steaks, sushi, salads, etc.).
- **Number of Images**: 101,000 images (750 training and 250 test images per category).
- **License**: Academic Non-Commercial Open Research License.
- **Intended Use**: Zero-shot and fine-tuned product category identification when a user uploads an unlabelled food photograph.

---

## 5. Storage Directory Structure

```text
datasets/
├── dataset_info.md        # Comprehensive metadata and license guidelines
├── fruits/                # Fruit images organized by sub-classes
├── vegetables/            # Vegetable images organized by sub-classes
├── fresh/                 # Binary baseline: Confirmed fresh food items
└── spoiled/               # Binary baseline: Confirmed spoiled food items
```

---

## 6. Ethical Compliance & Licensing Guidelines

1. **License Verification**: Prior to downloading or embedding training weights, maintainers must verify that dataset terms allow educational/research utilization.
2. **No Proprietary Scraping**: No automated web scraping from copyright-restricted commercial grocery websites is permitted without express written consent.
3. **Data Quality Standards**:
   - Resolution minimum: 224x224 pixels.
   - Formats: JPEG, PNG, WebP.
   - Metadata tags: category, temperature at capture, estimated time since harvest/purchase.
