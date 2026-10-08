# Milestone 1 - Deliverables Checklist

Infosys Springboard Internship · Food Freshness Monitoring Platform

| # | Requirement | Where it lives | Status |
|---|---|---|---|
| 1 | Project setup (frontend/backend/database/datasets/docs folders) | repository root | Done |
| 2 | Registration with validation + role selection | `frontend/src/pages/Register.jsx`, `backend/app/routers/auth.py` | Done |
| 3 | JWT login, secure password storage (bcrypt), session token | `backend/app/security.py`, `frontend/src/services/api.js` | Done |
| 4 | Landing page with platform intro + Login/Register | `frontend/src/pages/Home.jsx` | Done |
| 5 | Dashboard: welcome header, summary cards, recent batches, expiry alerts | `frontend/src/pages/Dashboard.jsx`, `backend/app/routers/dashboard.py` | Done |
| 6 | Add Food Item form (all fields incl. category/unit lists) | `frontend/src/pages/AddFoodItem.jsx`, `components/BatchForm.jsx` | Done |
| 7 | Inventory table: search, filters, edit, quantity update, delete confirm | `frontend/src/pages/Inventory.jsx` | Done |
| 8 | Automatic unique batch IDs `<FOOD3>-<YYYYMMDD>-<seq>` | `backend/app/utils/batch_ids.py` (+ UNIQUE constraint) | Done |
| 9 | Dynamic freshness status (Fresh / Expiring Soon / Expired) with colors | `backend/app/utils/freshness.py`, `frontend/src/components/StatusBadge.jsx` | Done |
| 10 | Role-based access enforced server-side via JWT | `backend/app/deps.py` (`require_roles`), per-route checks in routers | Done |
| 11 | PostgreSQL schema (users, food_batches) | `database/schema.sql`, SQLAlchemy models in `app/models.py` | Done |
| 12 | Required FastAPI routes (auth, batches CRUD, dashboard, expiring) | `backend/app/routers/*` | Done |
| 13 | Pydantic request/response validation | `backend/app/schemas.py` | Done |
| 14 | CORS for the React frontend | `app/main.py` + `CORS_ORIGINS` env var | Done |
| 15 | Swagger API documentation | <http://localhost:8000/docs> | Done |
| 16 | requirements.txt and .env.example (no real secrets) | `backend/requirements.txt`, `backend/.env.example` | Done |
| 17 | datasets/README.md explaining Milestone-2 data plan (no ML yet) | `datasets/README.md` | Done |
| 18 | Sample seed data for testing | `backend/seed.py` (5 demo users + 14 batches) | Done |
| 19 | Setup instructions & commands | root `README.md` sections 4-9 | Done |

## Explicitly out of scope for Milestone 1

- AI/ML image freshness prediction model
- Shelf-life prediction, notifications, recommendations
- Analytics dashboards beyond the summary cards
- Production deployment (Docker/cloud)

The codebase keeps these concerns isolated (see `docs/` roadmap in the main
README section 10) so later milestones can extend it without rework.
