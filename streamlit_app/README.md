# Food Freshness Monitoring Platform - Streamlit Frontend

A modern, high-performance Streamlit frontend for the **Food Freshness Monitoring Platform**. This interface seamlessly connects to the existing FastAPI backend running on **port 8000**, preserving all database models, business logic, role-based access control (RBAC), and computer vision pipelines.

---

## 🏛️ System Architecture

```
+-----------------------------------------------------------------------------------+
|                           STREAMLIT PYTHON FRONTEND                               |
|                             http://localhost:8501                                 |
|                                                                                   |
|  [Consumer]       [Retailer]     [Warehouse Operator]   [QA Inspector]   [Admin]  |
|  AI Quick-Scan    Catalog & Lot  Cold Bays & Sensors    Produce Lab      RBAC &   |
|  Arrhenius Model  FEFO Expiry    Hardware Controllers   Defect Matrix    Audits   |
+------------------------------------------+----------------------------------------+
                                           | HTTP / REST (JWT Bearer Auth)
                                           v
+-----------------------------------------------------------------------------------+
|                            FASTAPI REST BACKEND                                   |
|                             http://127.0.0.1:8000                                 |
|                                                                                   |
|  /api/auth/*     /api/freshness/*    /api/retailer/*    /api/warehouse/*          |
|  /api/inspector/*  /api/admin/*      /api/inventory/*   /api/reports/*            |
+--------------------+-------------------------------------+------------------------+
                     |                                     |
                     v                                     v
+--------------------------------------+  +-----------------------------------------+
|     MONGODB DATABASE ENGINE          |  |       AI & COMPUTER VISION              |
|  Remote Atlas / Local 127.0.0.1:27017|  |  OpenCV Color/Texture Feature Extractor |
|  319 Pre-Seeded Users & Inventories  |  |  Arrhenius Kinetic Shelf-Life Predictor |
+--------------------------------------+  +-----------------------------------------+
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Python 3.10+** (Tested and verified on Python 3.13)
- Windows PowerShell, macOS Terminal, or Linux Bash
- Activated virtual environment (`.venv`)

### 2. Configure Environment
Copy the example environment file if not already present:
```powershell
Copy-Item streamlit_app/.env.example streamlit_app/.env
```
Default configuration values:
```env
API_BASE_URL=http://127.0.0.1:8000/api
API_TIMEOUT_SECONDS=30
DEBUG=False
```

### 3. Step 1: Start FastAPI Backend (Port 8000)
In your first terminal:
```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
Verify the backend is live by opening [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health) or Swagger docs at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

### 4. Step 2: Start Streamlit Frontend (Port 8501)
In a second terminal:
```powershell
.\.venv\Scripts\Activate.ps1
python -m streamlit run streamlit_app/app.py --server.port 8501
```
Open your browser at **`http://localhost:8501`**.

---

## 👥 Verified Pre-Seeded Credentials (RBAC Matrix)

Use the built-in **Quick Demo Credentials (Autofill)** drawer on the login page or enter these verified seeded accounts:

| Operational Role | Verified Email | Password | Allowed Capabilities |
| :--- | :--- | :--- | :--- |
| **Consumer** | `demo@foodfresh.com` | `DemoPass123!` | Upload food images, view AI freshness classification & quality scores, run Arrhenius shelf-life simulator, storage recommendations |
| **Retailer** | `retailer@foodfresh.com` | `RetailerPass123!` | Store product catalog, stock level adjustments, 7-day FEFO expiry tracking, spoilage alerts, waste reduction analytics |
| **Warehouse Operator** | `warehouse@foodfresh.com` | `WarehousePass123!` | Cold bays & vaults, 24h temperature/humidity telemetry, hardware climate adjustment controller with safety limits, audit trails |
| **Food Quality Inspector** | `inspector@foodfresh.com` | `InspectorPass123!` | Produce inspection workbench, computer vision defect matrix, human review validation, batch quarantine flagging, storage compliance |
| **Administrator** | `admin@foodfresh.com` | `AdminPass123!` | Subsystem health probes, user RBAC role assignment & account status, AI telemetry, storage rule CRUD, security audit logs |

> **Note for Administrators:** The administrator workspace includes an interactive **Admin Persona Switcher** in the sidebar, allowing administrators to preview and test any of the 5 operational workspaces directly.

---

## 🧪 Automated Test Suite

To verify full API client compatibility, session authentication, and Streamlit component structures against the backend:

```powershell
.\.venv\Scripts\Activate.ps1
python -m unittest tests.test_streamlit_frontend -v
```

All 6 integration test suites validate:
1. `test_01_backend_health_probe`: Validates port 8000 readiness.
2. `test_02_consumer_login_and_token`: Validates JWT token generation and role retrieval.
3. `test_03_quick_scan_freshness_multipart`: Validates OpenCV food freshness analysis.
4. `test_04_retailer_dashboard_endpoints`: Validates retailer catalog and metrics.
5. `test_05_warehouse_zones_and_telemetry`: Validates cold-chain zones and temperature history.
6. `test_06_admin_users_and_health_probes`: Validates user RBAC queries and latency probes.

---

## 🛠️ Troubleshooting & Diagnostics

### Issue: `ERR_CONNECTION_REFUSED` on port 8765
- **Root Cause**: The backend runs on port **`8000`**, not 8765. Attempting to connect to 8765 results in a connection refused error.
- **Solution**: Ensure your backend command specifies `--port 8000` and `streamlit_app/config.py` targets `http://127.0.0.1:8000/api`.

### Issue: MongoDB Atlas SSL / IP Whitelist Error (`[SSL: TLSV1_ALERT_INTERNAL_ERROR]`)
- **Root Cause**: Your current outbound IP is not yet added to MongoDB Atlas Network Access.
- **Solution**: The backend automatically falls back to the verified local MongoDB instance running at `mongodb://127.0.0.1:27017/food_freshness_db`, ensuring uninterrupted development and testing.

### Issue: Streamlit session expiration
- If your JWT token expires, the interface will automatically catch HTTP 401, display a friendly session expiration alert, and route you back to the sign-in screen without crashing.
