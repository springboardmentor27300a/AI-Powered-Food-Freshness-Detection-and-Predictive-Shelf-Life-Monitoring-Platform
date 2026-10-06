# FoodCare — VS Code Setup Guide (Windows 11 / PowerShell)

This covers Milestones 1+2+3 running locally — no Docker needed yet.

## 0. Prerequisites

- PostgreSQL installed and running
- Python 3.10–3.12
- Node.js 18+
- VS Code

## 1. Database

Open pgAdmin (or `psql`) and create a database:

```sql
CREATE DATABASE foodcare;
```

(Reuse your existing Milestone 1 database if you already have one — the
new tables are added to it, nothing is dropped.)

## 2. Backend setup

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your real DB credentials (do not
commit `.env`):

```powershell
copy .env.example .env
notepad .env
```

Key variables:
```
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/foodcare
SECRET_KEY=<any long random string>
UPLOAD_DIR=uploads
MAX_UPLOAD_SIZE_MB=8
```

Create tables and seed sample data (Milestone 1 users + food items + batches;
Milestone 2/3 tables are created automatically the first time the app starts,
via `Base.metadata.create_all()`):

```powershell
python seed.py
```

This prints the dev login credentials, e.g.:

| Role | Username | Password |
|---|---|---|
| Administrator | admin | Admin@123 |
| Retail Manager | retail_manager | Retail@123 |
| Warehouse Operator | warehouse_operator | Warehouse@123 |
| Food Quality Inspector | quality_inspector | Inspector@123 |
| Consumer | consumer | Consumer@123 |

**Change these before any real deployment.**

Start the backend:

```powershell
uvicorn app.main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` to confirm it's running and browse the
full API (Swagger UI).

### Train the CNN (optional but required for real CNN predictions)

Without this step, the app runs fine — image uploads, OpenCV visual
analysis, shelf-life, storage, recommendations, and reports all work.
`GET /api/images/model-status` will just report the CNN as unavailable,
and reports will show "CNN prediction unavailable" instead of a
fabricated result.

```powershell
# still inside backend/, venv active
# 1. Download the dataset manually — see docs/DATASET.md
#    and place it under backend/ml/data/raw/
python ml/training/prepare_dataset.py
python ml/training/train_cnn.py
python ml/training/evaluate_model.py
```

Restart the backend afterward (or just make a new request — the model is
loaded lazily on first use) and re-check `/api/images/model-status`.

## 3. Frontend setup

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173`.

If your backend runs somewhere other than `http://localhost:8000`, set
`VITE_API_BASE_URL` in `frontend/.env` (see `frontend/.env.example` if
present, or create one):

```
VITE_API_BASE_URL=http://localhost:8000/api
```

## 4. Viewing data in pgAdmin

- Connect to your `foodcare` database.
- New Milestone 2/3 tables to check: `food_images`, `cnn_predictions`,
  `visual_analysis_results`, `shelf_life_predictions`, `storage_readings`,
  `recommendations`, `freshness_reports`.
- After running through the demo workflow below, `SELECT * FROM freshness_reports ORDER BY created_at DESC;`
  should show your generated report(s).

## 5. Demonstrating the full workflow (for your mentor)

1. Log in as `retail_manager` → Inventory → confirm sample food items/batches exist.
2. Log in as `warehouse_operator` → Storage page → log a temperature/humidity reading for a batch's location.
3. Log in as `quality_inspector` → Analyze Image page → pick the food item/batch,
   upload a photo (any fruit/vegetable photo works for the demo), click Analyze.
   - If the CNN is trained: see its predicted class + confidence.
   - If not: see the honest "unavailable" message, and the OpenCV visual scores still populate.
4. Click **Generate Freshness Report** → you're taken to the full report with
   the weighted score, shelf-life estimate, and recommendations.
5. Reports page → find the report → **Download PDF Report** → confirm a real
   PDF downloads with the FoodCare header, your image, scores, and disclaimer.
6. Log in as `administrator` → Analytics page → confirm the counts reflect
   what you just created (not hardcoded).
7. Log in as `consumer` → confirm you can view (but not create) reports,
   shelf-life info, and recommendations.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `relation "freshness_reports" does not exist` | Backend hasn't started yet since adding these files — start it once (`create_all()` runs on startup) |
| CNN status always "unavailable" | You haven't run the training scripts yet, or `backend/ml/models/freshness_model.keras` wasn't generated — check the `reason` field in `/api/images/model-status` |
| Image upload 413 error | File over `MAX_UPLOAD_SIZE_MB` (default 8MB) |
| PDF download fails | Check backend logs — usually a missing report component (run image analysis before generating the report) |
| CORS errors in browser console | Confirm `CORS_ORIGINS` in `backend/.env` includes your frontend's actual origin |
