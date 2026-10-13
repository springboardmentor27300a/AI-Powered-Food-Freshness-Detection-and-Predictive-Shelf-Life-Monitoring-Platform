# User Guide

Role-by-role walkthrough of the Food Freshness Monitoring Platform, plus a
demo script you can run end-to-end in about 10 minutes.

## Getting started

1. Start the backend (`uvicorn main:app --port 8000`, see [README](../README.md))
   and the frontend (`npm run dev`), open **http://localhost:5173**.
2. Sign up at **Signup** with one of the five roles:

| Role | Best for |
|---|---|
| Consumer | Households: own inventory, AI scans, personal reports |
| Retail Manager | Store ops: sell/expire/archive, waste + shelf-life analytics |
| Warehouse Operator | Storage compliance, environmental monitoring, disposal |
| Food Quality Inspector | Image inspection workflow, scan history, exports |
| Administrator | Everything + users, platform analytics, report management |

Passwords must meet the signup rules; emails must use a real TLD
(`@example.com` works, `@x.test` is rejected).

Every role shares: sidebar with your dashboard + Reports hub (+ Executive
Analytics for staff roles), a **notification bell** with unread count, and
role-appropriate alert panels.

---

## Consumer

**Dashboard sections:** KPI cards (Active Items, Fresh/Good, Near Spoilage,
Active Alerts), My Food Inventory, Recently Analyzed Items, Freshness/Quality,
Shelf-Life Estimates, Storage Recommendations, My Alerts, My Reports.

**Actions:**
- **Register Food** — add an item with category, quantity, dates, batch.
- **Scan Food** — upload an image; the backend runs MobileNetV2 + OpenCV,
  computes the quality score, estimates shelf life, generates recommendations,
  persists a per-scan report, and shows the result inline. The scan appears in
  history immediately after.
- **View Analysis / View Report** — modal with freshness verdict, quality
  score, shelf-life estimate + disclaimer, recommendations, and **Export
  PDF / Export Excel** buttons that download real files.
- **Archive/Remove own item** — you only ever see and touch your own records;
  the API enforces this, not just the UI.

**Privacy:** inventory, scans, reports, alerts, and analytics are scoped to
your account server-side.

---

## Retail Manager

**KPIs:** Total Active Inventory, Fresh Items, At-Risk Items, Spoiled/Expired,
Waste-Risk Units, Items Requiring Attention.

**Charts:** freshness distribution, inventory by category, shelf-life risk,
waste trend, quality trend (all computed from Mongo records).

**Panels:** Shelf-Life & Inventory Alerts (broadcast + own), Inventory Quality,
Waste Reduction, Rotation/Markdown Candidates, Recent Activity.

**Actions:** View / Edit, **Sell**, **Mark Expired** (confirmation modal),
**Dispose**, **Archive** — each maps to a real lifecycle endpoint and writes an
immutable `lifecycle_events` entry. **Generate Report** (freshness, shelf-life,
inventory quality, waste reduction) and export any saved report as PDF/Excel.

---

## Warehouse Operator

**KPIs:** Storage Compliance %, Average Temperature, Average Humidity,
At-Risk Storage, Active Inventory, Expiring Items.

**Charts:** temperature trend, humidity trend, compliance trend, storage
quality trend (30-day windows from `storage_readings`).

**Panels:** Storage Violations + Environmental Alerts (alerts routed to
Warehouse/Admin), Batch Freshness, Inventory Health, Expiry Risk.

**Actions:** record storage readings (validated against per-category standards;
status shown immediately), Adjust inventory quantities, Dispose damaged stock,
Mark Expired, Archive, plus report generation/exports and Executive Analytics.

---

## Food Quality Inspector

The inspection workflow: **upload image → MobileNetV2 prediction + OpenCV
heuristics → combined 0–100 quality score → spoilage assessment → shelf-life
estimate → recommendations → persisted freshness report**.

- **Alerts panel** — spoilage broadcasts addressed to Inspectors.
- **Report modal** — view the persisted report and **Export PDF / Export
  Excel**.
- **Scan history** — every past analysis with images and verdicts.
- Read-only on inventory (no Inventory link in the sidebar; the API rejects
  mutations with 403).

Predictions are deterministic and explainable; shelf-life results always show
their `parametric_estimate` label and disclaimer. Accuracy percentages are
never shown because they have not been measured — this is intentional.

---

## Administrator

- **Platform analytics** — freshness donut, lifecycle status distribution,
  category breakdown, user/report/alert totals, all from live collections.
- **Reporting Management** — filter the `reports` collection by type, open,
  export PDF/Excel, or delete saved reports.
- **User management** — list accounts, activate/suspend.
- **System monitoring** — shows database connectivity and model status from
  `/api/health`; metrics that are not instrumented are labeled
  “Not available (not instrumented)” rather than faked.
- **Executive Analytics** — cross-module KPIs + 14-day time series.
- **Permanent delete** of items requires the `DELETE-PERMANENTLY` confirmation
  and notifies all Administrators.

---

## Demo script (≈10 minutes)

1. **Login as Consumer** → Register Food (e.g. Fresh Apples, 6 units) →
   **Scan Food** with a produce image → verify quality score, shelf-life +
   disclaimer, recommendations → open **View Report** → **Export PDF** and
   **Export Excel** → check the file opens with title, KPIs, and records.
2. **Open Reports hub** → generate a **Freshness Report** (last 30 days) →
   open it → export both formats → delete it (or leave it for the admin view).
3. **Login as Retail Manager** → confirm the new item appears in analytics →
   **Sell** or **Mark Expired** one item (confirmation modal) → refresh and
   see KPIs/analytics update → check the alerts panel for routed alerts.
4. **Login as Warehouse Operator** → record a storage reading out of range →
   confirm Suboptimal/Critical status + violation alert appears in the panel →
   record an in-range reading → compliance KPI updates.
5. **Login as Inspector** → run an image scan → open the report → export →
   confirm Inventory is absent from the sidebar.
6. **Login as Administrator** → Reporting Management: open the report created
   in step 2 → export → Executive Analytics: verify 14-day charts →
   Notification Bell: unread count increments when platform notifications
   arrive (e.g. after a new signup).
7. **Logout** → try a Consumer-only API with a staff token (or vice versa)
   with `curl` → expect 403 — permissions are server-side.

## Tips

- The bell polls every 30 seconds; unread badges update without reload.
- Every dashboard shows its data source honestly: if something is not
  instrumented, it says so instead of showing a fake number.
- Shelf-life and quality outputs are deterministic — re-running the same scan
  returns the same numbers.
