# API Reference

Base URL (development): `http://localhost:8000`

All endpoints are prefixed `/api/...`. Interactive docs are served by FastAPI at
`/docs` (Swagger UI) and `/redoc` when the backend is running.

## Authentication

Send the JWT returned by `POST /api/auth/login` on every request:

```
Authorization: Bearer <token>
```

- Algorithm HS256, default 24 h expiry, signed with the `SECRET_KEY` environment
  variable (required when `ENVIRONMENT=production`).
- One exception: `GET /api/ml/scans/image/{filename}` also accepts a signed
  `?token=<jwt>` query parameter so `<img>` tags can load images without headers.
- **Trailing slashes matter.** FastAPI redirects `/api/alerts` → `/api/alerts/`
  with a 307; clients that do not follow redirects must include the trailing
  slash (the frontend's `api.js` does).

### Role legend

| Short name | Full role |
|---|---|
| `Consumer` | Consumer |
| `Retail` | Retail Manager |
| `Inspector` | Food Quality Inspector |
| `Warehouse` | Warehouse Operator |
| `Admin` | Administrator |

Roles are enforced server-side with `require_roles(...)` plus ownership scoping
(`created_by` == acting user) for consumer-owned data. Administrator bypasses
role checks in one centralized place.

### Response conventions

- Errors: `{"detail": "..."}` with the appropriate HTTP status
  (400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict).
- Datetimes are ISO-8601 strings.
- `?confirm=DELETE-PERMANENTLY` is required by every permanent-delete endpoint.

---

## Health

| Method | Path | Auth | Roles |
|---|---|---|---|
| GET | `/api/health` | — | public |

Response: `{"status": "ok", "database": "connected", "model_loaded": true, "time": "..."}`

---

## Auth — `/api/auth`

| Method | Path | Auth | Roles | Notes |
|---|---|---|---|---|
| POST | `/api/auth/signup` | — | public | Body: username, email, password, full_name, role, phone?; returns `{access_token, token_type, user}`. Email domain must have a real TLD (`.test` is rejected). New signups fire a `platform_notification` alert to Administrators. |
| POST | `/api/auth/login` | — | public | Body: username, password → `{access_token, token_type, user}` |
| GET | `/api/auth/me` | Bearer | any | Current user profile |
| GET | `/api/auth/users` | Bearer | Admin | All users (excluding hash fields) |
| PATCH | `/api/auth/users/{username}/status` | Bearer | Admin | Body: `{status: "active"\|"suspended"}` |

---

## Inventory — `/api/inventory`

All endpoints require Bearer auth.

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/` | Consumer, Retail, Warehouse, Admin | Register food item (+ batch). Consumer items are scoped to `created_by`. |
| GET | `/` | any | List items; Consumers receive only their own. Filters: `status`, `category`, `search`, `skip`, `limit`. |
| GET | `/stats` | any | Status counts + totals (scoped per role) |
| GET | `/{item_id}` | any | Item detail (ownership-checked) |
| GET | `/{item_id}/history` | any | Immutable `lifecycle_events` for the item |
| PATCH | `/{item_id}` | owner, Retail, Warehouse, Admin | Edit fields |
| POST | `/{item_id}/sell` | Retail, Admin (owner Consumer allowed) | Active → Sold Out; logs lifecycle event |
| POST | `/{item_id}/dispose` | Retail, Warehouse, Admin | Active → Disposed |
| POST | `/{item_id}/adjust` | Retail, Warehouse, Admin | Body: `{quantity_change, reason}` |
| POST | `/{item_id}/mark-expired` | Retail, Warehouse, Admin | Active → Expired (role-gated server-side) |
| POST | `/{item_id}/archive` | owner, Retail, Warehouse, Admin | Active → Archived |
| DELETE | `/{item_id}` | Admin | Permanent delete; requires `?confirm=DELETE-PERMANENTLY`; notifies Admins |

---

## ML / Scans — `/api/ml`

| Method | Path | Auth | Roles | Notes |
|---|---|---|---|---|
| POST | `/predict` | Bearer | any | Multipart image upload. Runs MobileNetV2 + OpenCV → combined quality score → shelf-life → recommendations → per-scan report → alerts. Persists to `analysis_results`, `shelf_life_predictions`, `recommendations`, `reports`. Returns prediction, score breakdown, shelf-life (with honesty fields), recommendations, `report_id`, `scan_id`. |
| GET | `/scans` | Bearer | any | Scan history (own only for Consumers) |
| GET | `/scans/{scan_id}` | Bearer | any | Single scan detail |
| GET | `/scans/image/{filename}` | header **or** `?token=` | any | Serves the uploaded image (UUID filename) |

Deterministic by design: same image + same inputs → same outputs. Shelf-life
responses include `source_type`, `estimate_label`, `estimate_disclaimer`,
`confidence_explanation`, and `metrics_note.mae = null` (not measured — never
fabricated).

---

## Alerts — `/api/alerts`

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/` | any | List alerts addressed to the acting user: `recipient_id == user` OR (`recipient_id == null` AND `recipient_role` matches role). Consumers never see staff broadcasts. **Trailing slash required.** |
| GET | `/unread-count` | any | `{"count": N}` for the notification bell |
| PATCH | `/{alert_id}` | recipient or matching broadcast role | Body: `{read: true}`. Broadcast alerts (`recipient_id: null`) are claimable only when `recipient_role` matches. |

Alert routing (generated by `ml/alert_helpers.py`):

| Type | Recipients |
|---|---|
| `spoilage_detected` | acting user + broadcast Inspector, Retail |
| `shelf_life_warning` | acting user + broadcast Retail, Admin |
| `inventory_expiry_risk` | acting user + broadcast Retail, Admin |
| `storage_condition_violation` | acting user + broadcast Warehouse, Admin |
| `freshness_warning` | acting user only |
| `platform_notification` | broadcast Admin (signup, admin deletion) |

---

## Reports — `/api/reports`

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/types` | any | The 5 report types + their filter definitions |
| POST | `/generate` | any | Body: `{report_type, date_from?, date_to?, category?, item_id?, batch_number?, status?}` (flat fields, not nested). Builds from live Mongo records (role-scoped), persists metadata to `reports`, returns the full report document with `summary` KPIs and `tables`. |
| GET | `/` | any | Saved reports; Consumers receive only their own. Filters: `type`, `skip`, `limit`. |
| GET | `/{report_id}` | any | Full report document (ownership-checked) |
| DELETE | `/{report_id}` | Admin | Remove saved report |
| GET | `/{report_id}/export` | any | `?format=xlsx` or `?format=pdf` → file download (`Content-Disposition`). Contains report title, generated time, applied filters, summary KPIs, and record tables. Legacy per-scan reports (created by the scan chain) export through the same endpoint. |
| POST | `/` | any | Legacy per-scan report creation (used by the scan chain) |

### Report types and filters

`report_type` is one of `freshness`, `shelf_life`, `inventory_quality`,
`waste_reduction`, `storage_compliance` (GET `/types` returns the live list).
All five accept the same optional filters: `date_from`, `date_to`, `category`,
`item_id`, `batch_number`, `status` — empty values are dropped before the
builder runs, so each report only shows the filters actually applied.

Every number in a report originates from Mongo records or the existing
calculation engines (`quality_scoring`, `shelf_life`, `storage_conditions`) —
nothing is synthesized.

Export implementation: `xlsxwriter` (Excel) and `reportlab` landscape pages
(PDF), both in `backend/ml/report_export.py`.

---

## Shelf life — `/api/shelf-life`

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/predict` | any | Parametric Q10 estimate from supplied inputs; returns provenance/disclaimer fields |
| POST | `/predict-for-item/{item_id}` | any | Estimate using a stored item's data (ownership-checked) |
| POST | `/batch` | any | Predict for many items at once |
| GET | `/history` | any | Past `shelf_life_predictions` (own only for Consumers) |

---

## Storage — `/api/storage`

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/` | Retail, Warehouse, Admin (Consumer for own items) | Record a reading (temperature, humidity, category/zone). Validated against `storage_standards` ranges → status Optimal/Suboptimal/Critical, compliance score, violation alerts — generated for zone-only readings too. |
| GET | `/` | any | Reading history (role-scoped) |
| GET | `/status` | any | Current compliance status + violation summary |

---

## Recommendations — `/api/recommendations`

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/item` | any | Prioritized recommendations for one item |
| GET | `/storage/{category}` | any | Storage advice for a food category |
| GET | `/inventory-overview` | any | Cross-inventory advice (scoped) |
| POST | `/inventory-overview` | any | Generate + persist inventory-level recommendations |
| GET | `/history` | any | Past recommendations (own only for Consumers) |

---

## Analytics — `/api/analytics`

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/freshness` | any | Quality/freshness distribution from `analysis_results` |
| GET | `/storage-compliance` | any | Compliance rates and trends from `storage_readings` |
| GET | `/scans` | any | Scan counts/series over time |
| GET | `/overview` | any | Combined analytics overview (scoped per role) |

All series are computed from persisted records — dashboards never display
hardcoded business data.

---

## Executive — `/api/executive`

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/executive` | Admin, Retail, Warehouse | Cross-module KPIs, 14-day time series, category analytics, lifecycle distribution, alerts/reports totals |

---

## Pagination & limits

- List endpoints accept `skip`/`limit` where noted; report record tables cap at
  200 rows in the exported document (summary KPIs always cover the full set).
- Uploads: image endpoints accept multipart form data under the field name
  expected by `fastapi.UploadFile`; keep images under a few MB.

## Changing the base URL

The frontend reads `VITE_API_BASE_URL` (defaults to `http://localhost:8000`).
Server-side, CORS is controlled by the `CORS_ORIGIN` variable (comma-separated
allowed origins, default `http://localhost:5173`).
