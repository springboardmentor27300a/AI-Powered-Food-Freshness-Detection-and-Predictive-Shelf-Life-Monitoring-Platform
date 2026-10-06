# FoodCare — Architecture Overview

## Stack

- **Backend:** FastAPI + SQLAlchemy 2.0 + PostgreSQL + Alembic + JWT (OAuth2 password flow)
- **Frontend:** React 18 + Vite + Tailwind + React Router + Axios
- **ML:** TensorFlow/Keras (MobileNetV2 transfer learning) for CNN freshness
  classification; OpenCV/NumPy for rule-based visual indicators

## High-level layout

```
food-freshness-platform/
  backend/
    app/
      main.py              <- FastAPI app, router registration, static /uploads mount
      core/config.py       <- Settings (env vars)
      database.py          <- SQLAlchemy engine/session/Base
      dependencies/        <- auth, db session, role-check dependencies
      models/               <- SQLAlchemy ORM models (M1 + M2/M3)
      schemas/              <- Pydantic request/response schemas
      routers/              <- one router per resource, all under /api/*
      services/             <- business logic (kept out of routers)
    ml/
      training/             <- prepare_dataset.py, train_cnn.py, evaluate_model.py
      inference/             <- freshness_predictor.py (loaded by app/services/cnn_service.py)
      models/                <- trained model + metrics land here (gitignored, user-generated)
      config/class_names.json
    alembic/                 <- migration scaffolding (create_all is used for now; see below)
    uploads/                  <- uploaded food images (created at runtime)
  frontend/
    src/
      api/                    <- one file per backend resource, thin axios wrappers
      components/              <- shared UI (Navbar, StatusBadge, FreshnessBadge, FreshnessScoreCircle, ...)
      pages/                    <- one file per route
      context/AuthContext.jsx   <- JWT/user state
  docs/                          <- this file and its siblings
```

## Data flow: image analysis → report

```
Frontend (ImageUpload.jsx)
  -> POST /api/images/upload            (image_service: validate + save to disk, FoodImage row)
  -> POST /api/images/{id}/analyze
       -> cnn_service.run_cnn_prediction()   -> ml/inference/freshness_predictor.py -> CNNPrediction row
       -> visual_service.run_visual_analysis() -> app/services/opencv_service.py -> VisualAnalysisResult row
  -> POST /api/reports/generate
       -> shelf_life_service.generate_and_save()   -> ShelfLifePrediction row
       -> scoring_service.compute_freshness_score() -> weighted 40/25/20/15 score
       -> FreshnessReport row (snapshots everything)
       -> recommendation_service.generate_for_batch() -> Recommendation rows, snapshotted onto the report
  -> GET /api/reports/{id}/pdf           (report_service.build_report_pdf, ReportLab)
```

## Why CNN and OpenCV are kept as separate, clearly-labeled records

`CNNPrediction` and `VisualAnalysisResult` are two different tables with
two different `status`/scoring semantics. `scoring_service.visual_component()`
blends them (50/50) only when the CNN is genuinely available; otherwise the
visual component is OpenCV-only and the API/UI say so explicitly. This
directly satisfies the project rule: "do not present OpenCV heuristics as
CNN predictions."

## Database strategy

Milestone 1 used `Base.metadata.create_all()` at startup (no Alembic
migrations had been generated yet — `alembic/versions/` was empty). The
Milestone 2/3 tables follow the same approach: `create_all()` is additive
and only creates tables that don't already exist, so all Milestone 1 data
is preserved. Alembic is still configured and ready if you want to
generate versioned migrations going forward (`alembic revision --autogenerate`).

## New tables (Milestone 2/3)

`food_images`, `cnn_predictions`, `visual_analysis_results`,
`shelf_life_predictions`, `storage_readings`, `recommendations`,
`freshness_reports` — see each model file in `backend/app/models/` for
full column definitions, or `GET /docs` (Swagger) for the live schema via
the Pydantic response models.

## OpenCV visual analysis method

See the module docstring in `backend/app/services/opencv_service.py` for
the exact, deterministic formulas (color/texture/dark-spot/bruising/damage
scores) — summarized: HSV color-band coverage, Laplacian-variance texture,
dark connected-region area, brown-hue connected-region area, and Canny-edge
contour density. All thresholds and weights are stated in that file, not
tuned against hidden data, and documented as heuristics rather than a
trained model.

## Weighted freshness scoring

See `backend/app/services/scoring_service.py`:
`Freshness Score = Visual 40% + Storage 25% + Shelf-Life 20% + Product Age 15%`,
each component normalized 0–100 first. Category thresholds:
Fresh ≥90, Good ≥75, Acceptable ≥55, Near Spoilage ≥30, Spoiled <30.
