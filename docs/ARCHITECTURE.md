# Architecture

## System overview

```
┌────────────────────────────┐      ┌─────────────────────────────────┐
│  Frontend (React 19/Vite)  │      │  Backend (FastAPI + Uvicorn)    │
│  port 5173 (dev)           │─────▶│  port 8000                     │
│  • 5 role dashboards       │ JWT  │  • 10 routers under /api/*      │
│  • reports hub + exports   │      │  • role/ownership enforcement   │
│  • SVG charts (no lib)     │      │  • MobileNetV2 + OpenCV         │
│  • notification bell       │      │  • parametric shelf-life engine │
└────────────────────────────┘      └────────────┬────────────────────┘
                                                │ Motor (async)
                                    ┌───────────▼────────────────────┐
                                    │  MongoDB (database:            │
                                    │  food_freshness)               │
                                    │  10 collections + indexes       │
                                    └────────────────────────────────┘
```

- Frontend uses a hand-rolled fetch client ([frontend/src/api.js](../frontend/src/api.js))
  with `VITE_API_BASE_URL`; auth is a Bearer JWT in `localStorage`.
- Backend loads the Keras model once at import; `/api/health` reports readiness.
- CORS is configured from the `CORS_ORIGIN` environment variable.

## Backend layout

| Path | Purpose |
|---|---|
| `backend/main.py` | App wiring, CORS, logging, startup (indexes), `/api/health` |
| `backend/dependencies.py` | `get_current_user`, `require_roles`, serializers, SECRET_KEY |
| `backend/database.py` | Mongo client, 10 collections, `ensure_indexes()` |
| `backend/models.py` | Pydantic models (users, items, lifecycle, alerts, storage) |
| `backend/routes/` | `auth, inventory, ml, storage, shelf_life, recommendations, analytics, alerts, reports, executive` |
| `backend/ml/` | `shelf_life, recommendations, storage_conditions, storage_standards, image_analysis, quality_scoring, alert_helpers, report_builders, report_export, freshness_model.keras` |

## Database collections (all collections are in use)

| Collection | Written by | Read by |
|---|---|---|
| `users` | signup, admin status patch | auth on every request |
| `food_items` | inventory CRUD, lifecycle ops, scan refresh | dashboards, analytics, reports |
| `batches` | inventory register/edit | item detail, overview counts |
| `storage_readings` | storage POST (source="manual") | storage/analytics/executive |
| `analysis_results` | ml.py scan chain | scan history, analytics, freshness reports |
| `shelf_life_predictions` | scan chain, /predict, /predict-for-item | shelf-life report, history |
| `recommendations` | scan chain, inventory-overview | history |
| `alerts` | alert_helpers.generate_alerts, notify_platform | alerts API, bell, dashboard panels |
| `reports` | scan chain (per-scan), /reports/generate (5 types) | reports hub, exports, admin mgmt |
| `lifecycle_events` | inventory.py `_log_event` (immutable) | item history, waste reports |

Indexes are created idempotently at startup (`ensure_indexes`).

## ML / calculation pipeline

1. **Image → CNN**: `freshness_model.keras` (MobileNetV2, 20 classes
   Fresh*/Rotten*). Output → status + confidence + freshness score.
2. **Image → OpenCV** (`ml/image_analysis.py`): saturation-based foreground mask,
   brown/dark pixel ratios, edge density, texture variance, discoloration,
   mold-like region heuristic. Explicitly labeled heuristics, not a detection model.
3. **Combined quality score** (`ml/quality_scoring.py`): 40% ML freshness,
   20% color, 20% texture, 20% surface, ×0.6 penalty when classified Rotten.
4. **Shelf-life** (`ml/shelf_life.py`): see methodology below.
5. **Storage validation** (`ml/storage_conditions.py`): per-category optimal ranges
   from `storage_standards.py`; ratio-based status (Optimal/Suboptimal/Critical).
6. **Recommendations** (`ml/recommendations.py`): consumption, waste, rotation,
   quality, storage-fix, data-capture actions prioritized by risk.
7. **Alerts** (`ml/alert_helpers.py`): event-driven, role-routed.

Every stage is deterministic and explainable; no synthetic ML claims.

## Shelf-life methodology (honest by design)

```
estimated_total_life = base_days × packaging_factor × Q10^((T_ref − T)/10)
                       × (1 − humidity_penalty) × freshness_factor
effective_remaining  = max(0, estimated_total_life − storage_duration_days)
effective_remaining  = min(effective_remaining, label_expiry_days)
```

- Q10 = 2.0; outputs clamped to [0, 365] days; frozen regime (T ≤ −18 °C) handled.
- Every response carries: `source_type="parametric_estimate"`,
  `estimate_label`, `estimate_disclaimer`, `confidence_explanation`
  (input-completeness heuristic, **not** accuracy), and
  `metrics_note.mae = null` — MAE is "Not measured" because no ground-truth
  shelf-life dataset exists. This is never fabricated.

## Alert routing (Milestone 4)

| Alert type | Recipients |
|---|---|
| `spoilage_detected` | acting user + broadcast: Inspector, Retail Manager |
| `shelf_life_warning` | acting user + broadcast: Retail Manager, Administrator |
| `inventory_expiry_risk` | acting user + broadcast: Retail Manager, Administrator |
| `storage_condition_violation` | acting user + broadcast: Warehouse Operator, Administrator |
| `freshness_warning` | acting user only |
| `platform_notification` | broadcast: Administrator (signup, admin deletions) |

Broadcasts use `recipient_id: null` + `recipient_role`; consumers never receive
staff broadcasts and cannot read other users' private data (enforced in Mongo
queries + 403 checks).

## Security model

- bcrypt password hashes; JWT HS256 (24 h default) signed with `SECRET_KEY`
  (required in production via `ENVIRONMENT=production`; dev uses an ephemeral key).
- `require_roles(...)` on every mutating endpoint; Administrator bypass centralized.
- Consumer ownership scoping (`created_by`) on inventory, scans, reports, analytics.
- Scan images: UUID filenames + authenticated endpoint (header or signed
  `?token=` query for `<img>` tags).
- Permanent delete: admin-only + `?confirm=DELETE-PERMANENTLY` gate.
- MongoDB TLS certificate validation ON by default (`MONGO_TLS_ALLOW_INVALID=1`
  dev-only opt-out).
