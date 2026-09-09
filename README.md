# Food Freshness Monitoring Platform

An AI-powered platform for tracking food inventory and analyzing freshness from photos, built as part of the Infosys Springboard internship project.

## Tech Stack

**Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL
**Frontend:** React (Vite)
**AI/ML:** TensorFlow, MobileNetV2 (transfer learning)
**Auth:** JWT (python-jose), bcrypt password hashing

## Milestone 1 — Core Platform

- User registration and login with JWT-based authentication
- Password hashing with bcrypt (passwords never stored in plain text)
- Food inventory management: add, view, update, delete food items
- Ownership-based access control — users only see and manage their own inventory
- React frontend with login/register pages and a food dashboard

## Milestone 2 — AI Freshness Analysis

- Image classification model trained via transfer learning on MobileNetV2 (fresh vs. spoiled), achieving ~92% validation accuracy
- `/analyze-freshness` endpoint: accepts an image upload, returns a freshness label, confidence score, quality score (0–100), and category
- 5-tier freshness categories (Fresh / Good / Acceptable / Near Spoilage / Spoiled), derived from the model's confidence score via threshold bucketing
- Freshness analysis results stored in the database, linked to both the food item and the user
- `/freshness-reports` endpoint: returns a user's full analysis history, newest first
- Frontend integration: upload an image directly from a food item's card, see the result inline, and view full analysis history in a Reports panel

## Design Note

The project specification describes a weighted freshness score combining Visual Condition (40%), Storage Conditions (25%), Shelf-Life Prediction (20%), and Product Age (15%). Storage monitoring and shelf-life prediction are scoped to Milestone 3 in the project plan, so Milestone 2's quality score is currently based on visual analysis alone. The 5-tier category system is derived from the trained binary classifier's confidence score via threshold bucketing, which will be extended with the additional scoring components in later milestones.

## Setup

### Backend

cd food-freshness-backend
conda activate freshness
pip install -r requirements.txt
uvicorn main:app --reload


### Frontend

cd food-freshness-frontend
npm install
npm run dev


Backend runs on `http://127.0.0.1:8000` (interactive docs at `/docs`). Frontend runs on `http://localhost:5173`.