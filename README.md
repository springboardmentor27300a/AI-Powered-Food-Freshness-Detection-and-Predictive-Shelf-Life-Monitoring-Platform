# Food Freshness Monitoring Platform

A full-stack application built for the Infosys Springboard Project to monitor food
freshness and reduce waste across the supply chain.

**Milestone 4 status:** complete — authentication, inventory lifecycle, AI freshness
inspection (MobileNetV2 + OpenCV), shelf-life estimation, storage monitoring,
recommendations, routed alerts/notifications, five report types with real PDF/Excel
exports, executive analytics, Docker setup, and full test suites.

---

## Prerequisites

- **Python** 3.11+ (3.13 recommended) — backend + ML
- **Node.js** 18+ — frontend
- **MongoDB** running locally (or a connection string in `backend/.env`)

## Quick start (local development)

### 1. Backend

```bash
cd backend
python -m venv venv
venv/Scripts/pip install -r requirements.txt    # Windows; use pip on Linux/macOS
# create backend/.env (see .env.example at repo root) with at least SECRET_KEY + MONGO_URL
venv/Scripts/python -m uvicorn main:app --port 8000   # Windows
```

The ML model loads on startup (~20–30 s). Health check:
`curl http://localhost:8000/api/health` →
`{"status":"ok","database":"connected","model_loaded":true}`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** and sign up (roles: Consumer, Retail Manager,
Food Quality Inspector, Warehouse Operator, Administrator).

> Frontend API URL defaults to `http://localhost:8000`; override with
> `VITE_API_BASE_URL` (see `.env.example`).

### 3. Docker (production-style stack)

```bash
cp .env.example .env      # set SECRET_KEY etc.
docker compose up --build
```

- Frontend: http://localhost:3000 (nginx, proxies `/api` → backend)
- Backend: http://localhost:8000/api/health
- MongoDB + uploads are persistent named volumes.

---

## Roles

| Role | Capabilities |
|---|---|
| **Consumer** | Own inventory only: register food, AI scan, freshness reports, shelf-life estimates, storage recommendations, alerts, archive own items |
| **Retail Manager** | Register/edit, sell, mark expired, archive; retail analytics, shelf-life alerts, waste-reduction insights, executive analytics |
| **Warehouse Operator** | Register/edit, dispose/adjust/mark expired, archive; storage compliance, environmental trends, batch freshness, executive analytics |
| **Food Quality Inspector** | View-only inventory; AI image analysis workflow, scan history, persisted reports with export |
| **Administrator** | Everything + user management, platform analytics, system monitoring, report management, permanent delete (confirmation-gated), executive analytics |

All permissions are enforced **server-side** (`require_roles` + ownership scoping);
the UI only hides what the API rejects.

## Feature overview

- **AI freshness inspection** — MobileNetV2 CNN (20 classes) + OpenCV heuristics →
  combined 0–100 quality score, persisted with the image.
- **Shelf-life estimation** — parametric Q10 engine with provenance fields and
  disclaimers (no fabricated accuracy metrics).
- **Storage monitoring** — manual readings validated against per-category profiles;
  compliance status, scores, violations, alerts.
- **Inventory lifecycle** — Active → Sold Out / Consumed / Disposed / Expired /
  Archived with immutable `lifecycle_events` audit history.
- **Alerts & notifications** — 6 categories (freshness, shelf-life, spoilage,
  storage, inventory, platform) with role-based recipient routing + notification bell.
- **Reports** — 5 types (freshness, shelf-life, inventory quality, waste reduction,
  storage compliance) with filters, persisted metadata, **PDF + Excel export**.
- **Executive analytics** — cross-module KPIs, 14-day time series, category insights.
- **Dashboards** — 5 role-specific + shared tool pages + reports hub, all DB-backed.

## Tests

```bash
cd backend
# with the backend running on :8000
venv/Scripts/python test_milestone3.py      # shelf-life engine (34 checks)
venv/Scripts/python test_e2e_workflow.py    # full E2E workflow (40 checks)
venv/Scripts/python test_lifecycle.py       # lifecycle + role matrix (37 checks)
venv/Scripts/python test_milestone4.py      # M4: reports/exports/notifications (67 checks)
venv/Scripts/python test_quality_scoring.py # quality scoring E2E
venv/Scripts/python test_image_analysis.py  # OpenCV analysis unit
venv/Scripts/python verify_math.py          # score math verification
```

Frontend: `npm run build` and `npm run lint` (oxlint).

## Documentation

| Document | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, collections, ML pipeline, shelf-life methodology |
| [docs/API.md](docs/API.md) | Full API reference (30+ endpoints) |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Role-by-role walkthrough + demo script |
| [docs/TESTING.md](docs/TESTING.md) | Test suites, coverage, how to run |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Docker + cloud deployment guide |
| [.env.example](.env.example) | All environment variables |

## Milestone reports

- `FINAL_REPORT_M1_M3.md` — Milestones 1–3 deliverables
- `LIFECYCLE_REPORT.md` — inventory lifecycle design + test evidence
