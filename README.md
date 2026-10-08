# Food Freshness Monitoring Platform

A full-stack web application that helps households, retail stores and warehouses
**register food batches, monitor expiry status, and detect food freshness from
photos** using a real trained CNN plus OpenCV image analysis.

- **Milestone 1 (Weeks 1-2):** project setup, JWT authentication, role-based
  access control and complete food inventory management.
- **Milestone 2 (Weeks 3-4):** AI image-based freshness detection - real
  AgriFreshNET dataset, real MobileNetV2 CNN training/evaluation, OpenCV visual
  analysis, freshness scoring engine, analysis history in PostgreSQL, and
  downloadable freshness reports.

---

## 1. Features (Milestone 1)

| Area | What you get |
|---|---|
| Landing page | Platform introduction, food-waste context, Login / Register buttons |
| Registration | Full name, email, password + confirm, role selection - validated client- and server-side |
| Authentication | JWT login with bcrypt-hashed passwords, invalid-login errors, session-scoped token storage |
| Dashboard | Welcome header with name + role, summary cards (total batches, total available quantity, fresh / expiring soon / expired), recent-batches table and an expiry-alerts section |
| Add Food Item | Full batch form (category, quantity, unit, dates, storage, packaging, notes) with validation and loading/success/error states |
| Inventory | Dynamic table with search (name or batch ID), category filter, status filter, edit modal, available-quantity updates and delete-with-confirmation |
| Automatic batch IDs | `<FOOD3>-<YYYYMMDD>-<seq>` e.g. `APP-20260821-001`, unique in PostgreSQL |
| Expiry management | Computed live: **Fresh** (> 3 days left), **Expiring Soon** (within 3 days), **Expired** - green / orange / red badges |
| Role-based access | Enforced server-side on every endpoint (matrix below) and mirrored in the UI |

## 1b. Features (Milestone 2)

| Area | What you get |
|---|---|
| Real dataset | AgriFreshNET 14,160 images (FRESH / SEMI_FRESH / ROTTEN), validated, deduplicated, stratified 70/15/15 train/val/test splits |
| Real CNN | MobileNetV2 transfer learning trained on 9,912 images; best checkpoint + real metrics saved |
| Real metrics | accuracy, weighted/macro precision-recall-F1 and confusion matrix measured on the held-out test split (`ml/evaluate_model.py`) |
| OpenCV analysis | color degradation, texture change, mold, bruising and physical damage detection per image |
| Scoring engine | CNN + OpenCV fused into a visual freshness score (0-100) → **Fresh / Good / Acceptable / Near Spoilage / Spoiled** |
| Analysis API | `POST /analysis/analyze` persists every assessment to PostgreSQL; history + stats endpoints |
| Reports | `POST /reports/generate` builds a printable HTML freshness report per image/batch |
| Frontend | Freshness Analysis page (upload → AI result card) and Freshness Reports dashboard |

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React.js (JavaScript) + Vite, React Router, Axios, custom responsive CSS |
| Backend | Python FastAPI + Uvicorn, Swagger UI docs at `/docs` |
| Database | PostgreSQL with SQLAlchemy ORM (models + auto-created schema) |
| Auth | JWT (`python-jose`), bcrypt password hashing (`passlib`) |
| ML | PyTorch + torchvision (MobileNetV2), OpenCV, scikit-learn metrics |
| Config | Environment variables via `pydantic-settings` (`.env` files) |

## 3. Project Structure

```
food-freshness-monitoring-platform/
├── backend/
│   ├── app/
│   │   ├── config.py            # env-driven settings (DB URL, JWT secret, CORS)
│   │   ├── database.py          # SQLAlchemy engine/session + get_db dependency
│   │   ├── models.py            # User, FoodBatch, ImageAnalysis, FreshnessReport
│   │   ├── schemas.py           # Pydantic request/response schemas
│   │   ├── security.py          # bcrypt hashing + JWT create/decode
│   │   ├── deps.py              # get_current_user + require_roles RBAC dependencies
│   │   ├── constants.py         # roles, categories, units, expiry window
│   │   ├── ml/
│   │   │   ├── config.py        # CNNs: class keys, image size, scoring pillars
│   │   │   ├── preprocessing.py # ImageNet-normalised 224x224 pipeline (train=inference)
│   │   │   ├── image_analyzer.py# OpenCV color/texture/mold/bruise/damage analysis
│   │   │   ├── freshness_scorer.py # CNN+CV fusion → 5-tier freshness score
│   │   │   ├── spoilage_detector.py # spoilage indicators + risk level
│   │   │   ├── report_generator.py  # HTML report builder dataclasses
│   │   │   └── models/cnn_model.py  # MobileNetV2 build/load/predict
│   │   ├── utils/
│   │   │   ├── batch_ids.py     # automatic unique batch-ID generator
│   │   │   └── freshness.py     # expiry status + get_freshness_category(score)
│   │   └── routers/
│   │       ├── auth.py          # register / login / me / users
│   │       ├── batches.py       # CRUD + search/filter/expiring endpoints
│   │       ├── dashboard.py     # summary statistics endpoint
│   │       ├── analysis.py      # image freshness + spoilage endpoints
│   │       └── reports.py       # freshness report generation/download
│   ├── ml/
│   │   ├── download_dataset.py  # download AgriFreshNET zip
│   │   ├── prepare_dataset.py   # validate/dedup/stratified splits (14,160 images)
│   │   ├── train_model.py       # REAL CNN training + test metrics
│   │   ├── evaluate_model.py    # standalone held-out evaluation
│   │   ├── config.py            # training hyper-parameters + artifact paths
│   │   └── models/              # food_freshness_model.pt + real metrics JSON/PNG
│   ├── tests/                   # pytest: scoring engine + real CNN inference
│   ├── seed.py                  # sample users + batches for testing
│   ├── requirements.txt
│   └── .env.example             # copy to .env and fill real values
├── frontend/
│   ├── src/
│   │   ├── components/          # Layout(sidebar), RouteGuards, BatchForm, FreshnessResult…
│   │   ├── context/AuthContext.jsx
│   │   ├── pages/               # Home, Login, Register, Dashboard,
│   │   │                        # AddFoodItem, Inventory, Profile, Users,
│   │   │                        # FreshnessAnalysis, FreshnessReports
│   │   ├── services/api.js      # axios client (JWT interceptor)
│   │   ├── utils/               # constants + formatting/freshness helpers
│   │   └── styles.css           # full design system
│   ├── package.json
│   └── .env.example             # VITE_API_URL
├── database/
│   └── schema.sql               # reference PostgreSQL DDL (tables/indexes/trigger)
├── datasets/
│   ├── README.md                # dataset guide (AgriFreshNET, splits)
│   ├── raw/  processed/  train/  val/  test/
├── docs/
│   ├── milestone1-deliverables.md
│   └── MILESTONE_2.md           # dataset/model/scoring/API documentation + real metrics
└── README.md
```

## 4. Prerequisites

- **Python 3.10+**
- **Node.js 18+** (with npm)
- **PostgreSQL 13+** running locally

## 5. Step-by-step Setup

### Step A - PostgreSQL

1. Install PostgreSQL from <https://www.postgresql.org/download/> (remember the `postgres` password).
2. Create the database:

```sql
-- psql or pgAdmin:
CREATE DATABASE food_freshness_db;
```

> Tables are created automatically by the FastAPI app on first start.
> To create them manually instead: `psql -U postgres -d food_freshness_db -f database/schema.sql`

### Step B - Backend

```bash
cd backend

# 1. Virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# 2. Dependencies
pip install -r requirements.txt

# 3. Environment file: copy the template then edit values
copy .env.example .env        # (macOS/Linux: cp .env.example .env)
```

Edit `backend/.env`:

```ini
DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/food_freshness_db
SECRET_KEY=paste_output_of_python_-c_"import secrets; print(secrets.token_hex(32))"
ACCESS_TOKEN_EXPIRE_MINUTES=1440
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

Run the API (from `backend/`):

```bash
uvicorn app.main:app --reload
```

- API root: <http://localhost:8000>
- Swagger docs: <http://localhost:8000/docs>

### Step C - Seed sample data (optional but recommended)

With the virtualenv active, from `backend/`:

```bash
python seed.py
```

This creates one demo account per role plus 14 batches whose expiry dates are
relative to *today*, so all three statuses are visible immediately.

| Role | Email | Password |
|---|---|---|
| Administrator | admin@freshtrack.com | Admin@1234 |
| Retail Manager | manager@freshtrack.com | Manager@1234 |
| Warehouse Operator | warehouse@freshtrack.com | Warehouse@1234 |
| Food Quality Inspector | inspector@freshtrack.com | Inspector@1234 |
| Consumer | consumer@freshtrack.com | Consumer@1234 |

*(Demo passwords only - change/remove them before any real deployment.)*

### Step D - Frontend

Open a second terminal:

```bash
cd frontend
npm install
copy .env.example .env      # optional: defaults to http://localhost:8000
npm run dev
```

Open <http://localhost:5173>.

## 5b. Run with Docker (frontend + backend + PostgreSQL)

Everything runs in containers - no local Python/Node/PostgreSQL setup needed.

```bash
# 1. (first run) create your environment file
copy .env.example .env        # macOS/Linux: cp .env.example .env
#    then set POSTGRES_PASSWORD and SECRET_KEY in .env

# 2. Build the images
docker compose build

# 3. Run
docker compose up

# 4. Run in the background (detached)
docker compose up -d

# 5. Stop (add -v to also delete the database volume)
docker compose down
```

| Service  | URL / port                | Notes                                             |
| -------- | ------------------------- | ------------------------------------------------- |
| frontend | <http://localhost:3000>   | React build served by Nginx, proxies `/api` → backend |
| backend  | <http://localhost:8000>   | FastAPI docs at `/docs`, health check at `/health`  |
| database | `localhost:5432`          | PostgreSQL 15, data persisted in the `postgres_data` volume |

Notes:

- Containers talk over Docker service names (`frontend` → `backend` → `database`);
  the frontend is built with `VITE_API_URL=/api`, so no `localhost` is required
  inside the containers.
- On first start the backend creates the tables and seeds the five demo accounts
  (see *Step C* for the e-mails/passwords), so login works immediately.
- Health checks: `database` (`pg_isready`), `backend` (`GET /health`),
  `frontend` (Nginx).

## 6. API Routes

Base URL: `http://localhost:8000` · Interactive docs: `/docs`

| Method | Route | Description | Access |
|---|---|---|---|
| POST | `/auth/register` | Create account (bcrypt-hashed password) | Public |
| POST | `/auth/login` | JSON login -> JWT + user | Public |
| POST | `/auth/token` | OAuth2 form login (for Swagger "Authorize") | Public |
| GET | `/auth/me` | Current user profile from JWT | Any authenticated user |
| GET | `/auth/users` | List all users | Administrator |
| DELETE | `/auth/users/{user_id}` | Delete a user | Administrator |
| POST | `/batches` | Register a batch (auto batch ID) | All except Inspector |
| GET | `/batches` | List batches (`q`, `category`, `status`, `limit`) | Scoped by role |
| GET | `/batches/{batch_id}` | Single batch details | Owner or staff roles |
| PUT | `/batches/{batch_id}` | Edit details / update available quantity | Per matrix below |
| DELETE | `/batches/{batch_id}` | Delete a batch | Per matrix below |
| GET | `/batches/expiring` | Items expiring within N days (`days`, `include_expired`) | Scoped by role |
| GET | `/dashboard/summary` | Card totals + recent batches + alerts | Scoped by role |
| POST | `/analysis/analyze` | Upload food image → AI freshness analysis (persisted) | Any authenticated user |
| POST | `/analysis/spoilage` | Upload food image → spoilage indicator detection | Any authenticated user |
| GET | `/analysis/history` | User's analysis history (`classification`, `limit`) | Any authenticated user |
| GET | `/analysis/{id}` | Single analysis result | Owner |
| GET | `/analysis/batch/{batch_id}` | Freshness trend history for a batch | Owner/staff |
| GET | `/analysis/stats` | Aggregated analysis statistics | Any authenticated user |
| POST | `/reports/generate` | Generate + save a freshness report from an image | Any authenticated user |
| GET | `/reports` | List reports (`classification`, `risk_level`) | Owner |
| GET | `/reports/summary` | Report statistics | Any authenticated user |
| GET | `/reports/{report_id}` | Get a report | Owner |
| GET | `/reports/{report_id}/download` | Printable HTML report | Owner |

## 7. Role-Based Access Matrix

| Action | Consumer | Retail Manager | Warehouse Operator | Quality Inspector | Administrator |
|---|:-:|:-:|:-:|:-:|:-:|
| View batches | Own only | All | All | All | All |
| Create batch | ✔ (own) | ✔ | ✔ | ✖ read-only | ✔ |
| Update / delete batch | Own only | All | All | ✖ | All |
| View all users | ✖ | ✖ | ✖ | ✖ | ✔ |

## 8. Business Rules

**Batch ID** - generated automatically on the server:
`APP-20260821-001` → three letters of the food name + received date + per-day
sequence. Second Apple batch the same day becomes `-002`; uniqueness is enforced
by a UNIQUE constraint with race-safe retries.

**Freshness status** - computed dynamically at request time (never stored stale):

| Status | Rule | Colour |
|---|---|---|
| Fresh | more than 3 days to expiry | Green |
| Expiring Soon | within the next 3 days (incl. today) | Orange |
| Expired | expiry date before today | Red |

## 9. Manual Test Workflow

1. `python seed.py` → open the app → log in as each demo account and observe the different navigation and permissions.
2. Register a brand-new consumer account → confirm you land on Login → log in.
3. As Retail Manager: Add Food Item ("Apple") twice with today's date → IDs `APP-YYYYMMDD-001` / `-002`.
4. Dashboard shows correct card totals; alerts list items expiring within 3 days.
5. Inventory: search "app", filter category *Fruits*, filter status *Expiring Soon*.
6. Edit a batch's available quantity → verify dashboard totals change.
7. Delete a batch → confirmation dialog → row disappears.
8. Log in as Inspector → no "Add Food Item" nav, no edit/delete buttons; direct API calls return `403`.
9. Try `POST /batches` in Swagger without a token → `401`.

## 10. Future Milestones (planned, not in this repo yet)

1. **Milestone 3** – full score pillars: storage conditions (25%), shelf-life prediction (20%), product age (15%).
2. **Notifications** – email/in-app alerts before expiry.
3. **Recommendations** – discount/donate/consume suggestions to reduce waste.
4. **Analytics dashboards** – waste trends by category, location and time.
5. **Deployment** – Dockerised images, CI pipeline, cloud hosting.

## 10b. Milestone 2 - Reproducing AI features

```bash
cd backend

python ml/download_dataset.py       # optional: fetch the AgriFreshNET zip
python ml/prepare_dataset.py        # optional: rebuild train/val/test splits
python ml/train_model.py            # train CNN + real test metrics (CPU: ~30-60 min)
python ml/evaluate_model.py         # standalone held-out evaluation
python -m pytest tests/             # scoring-engine + real CNN inference tests
```

Full documentation, dataset card, model card and the real metrics tables live in
[`docs/MILESTONE_2.md`](docs/MILESTONE_2.md).

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| `Can't connect to server` banner in the UI | Backend not running on port 8000, or `VITE_API_URL` mismatched |
| `password authentication failed` on startup | Wrong PostgreSQL password in `DATABASE_URL` |
| CORS errors in browser console | Add the frontend origin to `CORS_ORIGINS` in `backend/.env` and restart uvicorn |
| `relation "users" does not exist` | Start the API once (`uvicorn ... --reload`) so tables auto-create, or run `database/schema.sql` |
| Port already in use | Change port: `uvicorn app.main:app --port 8001` and update `VITE_API_URL` |
