# Food Freshness Monitoring Platform

An AI-powered platform for tracking food inventory and analyzing freshness from photos, built as part of the Infosys Springboard internship project.

## Tech Stack

**Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL
**Frontend:** React (Vite)
**AI/CV:** TensorFlow/Keras (MobileNetV2 Transfer Learning), OpenCV
**Auth:** JWT (python-jose), bcrypt password hashing

## Milestone 1 — Core Platform

- User registration and login with JWT-based authentication
- Password hashing with bcrypt (passwords never stored in plain text)
- Food inventory management: add, view, update, delete food items
- Ownership-based access control — users only see and manage their own inventory
- React frontend with login/register pages and a food dashboard

## Milestone 2 — AI Freshness Analysis

- Image classification model trained via transfer learning on MobileNetV2 (fresh vs. spoiled), achieving ~92.3% validation accuracy on 70k+ authentic images.
- `/analyze-freshness` endpoint: accepts an image upload, returns a freshness label, confidence score, and base quality score.
- OpenCV Computer Vision Engine: Calculates color degradation, mold spotting, and surface bruising from the images.
- 5-tier freshness categories (Fresh / Good / Acceptable / Near Spoilage / Spoiled).
- Frontend integration: upload an image directly from a food item's card and see the result inline.

## Milestone 3 — Prediction, Scoring & Recommendations

- **Weighted Freshness Scoring Engine (Section 4.7):** Combines Visual Condition Analysis (40%), Storage Conditions (25%), Shelf-Life Prediction (20%), and Product Age (15%) into a comprehensive 0-100 Quality Score.
- **Shelf-Life Prediction:** Calculates the remaining shelf-life based on expiry date inputs and determines "Fresh", "Expiring", or "Expired" status.
- **Storage Condition Impact:** Evaluates user-input storage temperatures against ideal category baselines.
- **AI Recommendation Engine:** Generates intelligent, actionable advice across 5 categories: Storage, Consumption, Inventory, Waste Reduction, and Quality.
- **Analytics & Reporting Dashboard:** Displays a top-level statistics summary (Total Scans, Avg Quality, Spoilage count).
- **Executive PDF Export:** Ability to generate and print single-page AI quality audit certificates for historical scans.

## Setup & Running Locally

For convenience, you can simply run the provided `start_servers.bat` script on Windows to launch both servers. 

Alternatively, to run manually:

### Backend

```bash
cd food-freshness-backend
python -m uvicorn main:app --reload
```

### Frontend

```bash
cd food-freshness-frontend
npm run dev
```

Backend runs on `http://127.0.0.1:8000` (interactive API docs at `/docs`). 
Frontend runs on `http://localhost:5173`.