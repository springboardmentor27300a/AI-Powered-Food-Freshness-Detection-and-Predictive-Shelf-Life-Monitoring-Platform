# Inventory Lifecycle Implementation Report

**Date:** 2026-09-29 · Scope: full product lifecycle (Active → Sold Out / Consumed / Disposed / Expired / Archived) with role-enforced transitions, event audit trail, and history preservation. All tests green; test data cleaned up.

---

## 1. Database Changes

**New collection: `lifecycle_events`** — immutable audit trail per item. Each event: `item_id`, `batch_id`, `event_type` (registered / sold / disposed / adjusted / archived / deleted), `quantity_delta`, `quantity_after`, `reason`, `notes`, `performed_by(_username/_role)`, `created_at`. Indexed on `(item_id, created_at desc)`.

**Extended `food_items` documents** (existing docs get defaults lazily at read time via `_backfill()` — no migration needed):

| Field | Meaning |
|---|---|
| `status` | Active · Sold Out · Consumed · Disposed · Expired · Archived |
| `active_quantity` | units currently in stock (used everywhere instead of `quantity`) |
| `sold_quantity` / `sold_at` / `sold_by` | cumulative sales record |
| `disposed_quantity` / `disposed_at` / `disposed_by` | cumulative damage/spoilage record |
| `archived_at` / `archived_by` | who archived, when |
| `batch_id` | direct link to the item's batch record |

The original `quantity` field is preserved as the registration baseline; nothing is duplicated — `active = quantity − sold − disposed` is maintained as a stored field for efficient queries. **No record is deleted by selling/disposal/archiving**: analyses, reports, predictions, readings, recommendations, and alerts all remain linked via `item_id`.

## 2. New/Updated API Endpoints (all role-enforced server-side)

| Endpoint | Method | Roles | Behavior |
|---|---|---|---|
| `/api/inventory/` | POST | Retail, Warehouse, Consumer (own), Admin; **Inspector 403** | Register; sets lifecycle defaults; logs `registered` event |
| `/api/inventory/` | GET | any authenticated role | `?scope=mine` (consumer-forced) · `?lifecycle=active\|archived_view\|all` |
| `/api/inventory/{id}` | GET | viewer/owner | Item + batches + lifecycle event trail |
| `/api/inventory/{id}/history` | GET | viewer/owner | Standalone event history |
| `/api/inventory/{id}/sell` | POST | **Retail Manager** (+Admin) | Partial sale → decrements, stays Active; full sale → **Sold Out**; 400 if overselling; 409 if not Active |
| `/api/inventory/{id}/dispose` | POST | **Warehouse Operator** (+Admin) | Damage/spoilage disposal; full → **Disposed** |
| `/api/inventory/{id}/adjust` | POST | **Warehouse Operator** (+Admin) | Count reconciliation; → Consumed at 0 |
| `/api/inventory/{id}/mark-expired` | POST | Warehouse, Retail (+Admin) | → **Expired**, active units zeroed |
| `/api/inventory/{id}/archive` | POST | Retail/Warehouse/Consumer(own)/Admin; **Inspector explicitly 403** | Soft-hide; history preserved |
| `/api/inventory/{id}` | PATCH | Retail/Warehouse/Admin | Edit details; re-baselines active stock |
| `/api/inventory/{id}` | DELETE | **Administrator only** | Requires `?confirm=DELETE-PERMANENTLY` (400 without); items+batches removed, analyses/reports retained in their collections |

**Cross-module filtering:** `/api/recommendations/inventory-overview`, `/api/analytics/freshness`, `/api/analytics/overview` now query **active inventory only**, and all quantities use `active_quantity` (remaining stock) — partial sales immediately change insights, waste-risk units, rotation lists, and analytics. `/api/ml/predict` refuses scans of non-active items (409).

## 3. Role Permission Matrix (backend-enforced; verified by tests)

| Action | Consumer | Retail Mgr | Warehouse Op | Inspector | Admin |
|---|---|---|---|---|---|
| Register | ✅ (own) | ✅ | ✅ | ❌ | ✅ |
| View | own only | ✅ | ✅ | ✅ | ✅ |
| Sell | ❌ 403 | ✅ | ❌ 403 | ❌ 403 | ✅* |
| Adjust / Dispose / Expire | ❌ 403 | ❌ 403 | ✅ | ❌ 403 | ✅* |
| Archive | own only | ✅ | ✅ | ❌ 403 | ✅ |
| Edit details | ❌ | ✅ | ✅ | ❌ | ✅ |
| Permanent delete | ❌ 403 | ❌ 403 | ❌ 403 | ❌ 403 | ✅ (confirm-gated) |

\* Admin inherits via `require_roles` (Administrator always allowed).

## 4. UI Changes

**[InventoryDashboard.jsx](frontend/src/pages/dashboards/InventoryDashboard.jsx):**
- New **Actions column** with role-based buttons per your spec: Retail → `[View] [Mark Sold] [Edit] [Archive]`; Warehouse → `[View] [Edit] [Adjust] [Damage/Dispose] [Archive]`; Inspector → `[View]` only; Admin → everything + `[Delete]`.
- **Confirmation modals** for every status-changing/destructive action: sale modal (quantity/max validation, sale date, notes), disposal modal (quantity + reason dropdown: damaged/expired/spoiled/contaminated/other, notes), adjust modal (new quantity + reason), archive modal (explains history is preserved), **admin delete modal** (red panel stating it is administrative, permanent, history retained).
- **Status badges** (Active green, Sold Out gray, Disposed red, Expired amber, Archived light-gray, Consumed teal) and quantity display showing `N active (X sold · Y disposed)`.
- **Lifecycle view toggle**: "Active Inventory" vs "Sold Out / Disposed / Archived".
- **View drawer**: quantities + full **lifecycle history timeline** (event, delta, reason, actor, timestamp).
- **Edit** wired to PATCH (pre-fills form, updates via API); success/error toasts; working empty states.
- Fixed a latent crash (`canAddInventory` undefined variable).

**[ConsumerDashboard.jsx](frontend/src/pages/dashboards/ConsumerDashboard.jsx):** per-item **[Remove]** with confirmation modal ("history preserved" explanation + optional reason), **Removed Items** toggle to view archived items with their archived date, scan history remains visible for archived items.

## 5. Lifecycle Behavior

REGISTER → Active (event: registered) → monitor/scan/analyze as before →
- partial sale → Active with reduced `active_quantity` (sold_quantity accumulates, sold event logged)
- final sale → **Sold Out**: excluded from active lists, insights, analytics, rotation, monitoring; item+history intact
- damage/spoilage → **Disposed** (per-reason events)
- expiry → **Expired** (or auto-flagged via mark-expired)
- consumer removal → **Archived** (personal items)
- admin → permanent delete only with confirm token; event `deleted` logged first.

Nothing in the sell/dispose/archive path destroys analyses, reports, predictions, readings, recommendations, or alerts — they stay queryable via `item_id`, and the archived view exposes them.

## 6. Test Results

**New suite `backend/test_lifecycle.py` — 35/35 PASS** (live server + MongoDB):
- **A** register → Active 20/0/0 + registered event · **B** partial sale 8/20 → 12 active, still Active, sold event with actor · **C** full sale → Sold Out, sold_by recorded, further sale → 409 · **D** sold-out excluded from active list, present in archive view, excluded from insights AND freshness analytics · **E/F** item record + event trail + prediction history all intact after Sold Out · **G** partial disposal 4/10 → 6 active; full → Disposed; adjust on Disposed → 409; mark-expired → Expired with units zeroed · **H** consumer archives own item; hidden from active view; **cannot** archive another user's item or sell (403) · **I** inspector blocked from sell/archive/dispose/delete (403 ×4) but CAN view (200) · **J** admin delete without confirm → 400; with confirm → deleted, then 404; retail delete → 403 · **K** disposal state survives re-login · **L** insights show remaining quantity after partial sale (30 → 5) and drop fully-disposed items · **X** test cleanup verified.

**Regression:** engine tests 34/34 · original E2E suite 40/40 (its cleanup updated to the admin-confirmed delete contract — the 403 it initially hit was the new permission working correctly) · frontend build + oxlint clean. One real bug found & fixed by the tests: insights/analytics used original `quantity` instead of `active_quantity` after partial sales.

All test users/items/events were purged afterward — the database is left clean.
