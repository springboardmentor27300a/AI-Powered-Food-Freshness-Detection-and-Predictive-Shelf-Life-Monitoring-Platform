# Testing

How to run every suite and what each one covers. All suites talk to the **live
backend** on `http://localhost:8000` with a MongoDB database, so start the
server first:

```bash
cd backend
venv/Scripts/python -m uvicorn main:app --port 8000   # Windows
```

On non-Windows use `venv/bin/python`. If your console uses cp1252, prefix
`PYTHONIOENCODING=utf-8` to see Unicode output.

## Suites and pass counts

| Suite | Command | Checks | Status |
|---|---|---|--:|
| Milestone 4 (reports/exports/notifications/security) | `venv/Scripts/python test_milestone4.py` | 67 | **67/67 PASS** |
| End-to-end workflow | `venv/Scripts/python test_e2e_workflow.py` | 40 | **40/40 PASS** |
| Lifecycle + role matrix | `venv/Scripts/python test_lifecycle.py` | 37 | **37/37 PASS** |
| Milestone 3 (shelf-life engine) | `venv/Scripts/python test_milestone3.py` | 34 | **34/34 PASS** |
| Quality scoring E2E | `venv/Scripts/python test_quality_scoring.py` | — | **PASS** |
| OpenCV image analysis (unit) | `venv/Scripts/python test_image_analysis.py` | — | **PASS** |
| Score math verification | `venv/Scripts/python verify_math.py` | — | **PASS** |

Frontend:

```bash
cd frontend
npm run build     # production build must succeed
npx oxlint src    # 0 errors (a handful of advisory warnings)
```

## What test_milestone4.py covers (67 checks)

- **Health** — `/api/health` returns status/database/model_loaded/time.
- **Inventory + lifecycle** — registration, lifecycle transitions.
- **Negative auth matrix (N1–N9)** — wrong-role and unauthenticated requests
  rejected with 401/403 across inventory, reports, executive, admin endpoints.
- **Scan chain** — image upload → prediction → quality score → shelf-life →
  recommendations → report persisted and linked.
- **Image auth (S1–S3)** — unauthenticated image fetch rejected; header and
  signed `?token=` both succeed.
- **Alert routing (J1–J7)** — broadcast recipients per type, Consumer isolation,
  unread counts, PATCH read-state on both private and broadcast alerts.
- **Report types (K1–K4)** — all 5 types generate from real data with correct
  scoping and non-empty record tables.
- **Exports (L/M)** — PDF starts with `%PDF`, Excel is a valid ZIP/xlsx,
  **exported totals match the API/analytics response**.
- **Executive (N1–N5)** — access control (Admin/Retail/Warehouse only), KPI
  shape, 14-day series, category analytics.
- **Admin report management (O1–O2)** — list/filter, admin-only delete.

## Test data hygiene

Suites create ephemeral users (`m4_*`, `qc_test`) and records with recognizable
prefixes, and clean up the items/reports they create. Any leftover test users,
alerts, or platform notifications are removed in the final cleanup step before
delivery.

## Notes

- `test_e2e_workflow.py` uses dynamic dates (no stale hardcoded dates) so it
  does not rot.
- `test_quality_scoring.py` and `test_image_analysis.py` use project-local
  images under `backend/test_images/`.
- Email validation rejects `.test` TLDs — test accounts use `@example.com`.
- Docker-based tests are **not run locally** (Docker unavailable on the dev
  machine); see [DEPLOYMENT.md](DEPLOYMENT.md) for what remains to verify on a
  Docker-capable host.
