# 🌿 FreshSense AI – AI-Powered Food Freshness Monitoring Platform

An enterprise full-stack platform for food freshness assessment, automated shelf-life forecasting, environmental storage condition tracking, FEFO-driven inventory management, real-time quality alerting, and compliance auditing.

---

## 📌 Executive Architecture & Highlights

- **AI Inference Engine:** MobileNetV2 Transfer Learning (`freshness_model.keras`, 224×224×3 RGB) trained on 3,214 images (1,607 Fresh, 1,607 Spoiled).
- **Computer Vision Feature Heuristics:** Transparent rule-based surface heuristics (HSV color deviation, local binary/Laplacian texture entropy, surface discoloration and mold cluster detection).
- **5-Tier Quality Classification:**
  1. `Fresh` (≥ 85.0% score)
  2. `Good` (70.0% – 84.9% score)
  3. `Acceptable` (50.0% – 69.9% score)
  4. `Near Spoilage` (25.0% – 49.9% score)
  5. `Spoiled` (< 25.0% score)
- **Kinetic Shelf-Life Engine:** Q10 temperature coefficient and Arrhenius thermal degradation kinetic modeling per food category (Fruits, Vegetables, Dairy, Meat, Seafood, Bakery, Prepared Meals, Beverages).
- **Storage Condition Matrix:** Real-time temperature, relative humidity, light exposure, and ventilation evaluation with safe tolerance ranges.
- **FEFO Inventory Management:** First-Expired, First-Out rotation queuing, batch traceability, and automated markdown/disposal flags.
- **Enterprise Reporting:**
  - **PDF Export:** Built with `ReportLab` — multi-section audit certificate with executive metrics, FEFO risk table, and regulatory disclaimers.
  - **Excel Export (.xlsx):** Built with `OpenPyXL` — multi-sheet styled workbook (Inventory & FEFO, Inspection Logs, Quality Analytics).
  - **CSV Export:** Fast raw data streaming for external BI tooling.
- **Role-Based Access Control (RBAC):**
  - `Consumer`: Household freshness management and food preservation guidance.
  - `Retail Manager`: Supermarket FEFO rotation, near-expiry alerts, and markdown priority.
  - `Warehouse Operator`: Cold chain telemetry, storage environmental compliance, batch logs.
  - `Food Quality Inspector`: 5-tier classification audits, surface defect validation, laboratory compliance reports.
  - `Administrator`: Full system oversight, user account management (activate/deactivate), telemetry monitoring.

---

## 🛠️ Technology Stack

| Layer | Component | Specification |
|---|---|---|
| **Backend Framework** | FastAPI | Asynchronous RESTful API, Python 3.11/3.13 |
| **Database** | PostgreSQL | Relational storage for users, predictions, and inventory |
| **ORM** | SQLAlchemy | Connection pooling with `pool_pre_ping=True` |
| **Deep Learning** | TensorFlow / Keras | MobileNetV2 Transfer Learning (`freshness_model.keras`) |
| **Image Processing** | Pillow (PIL) / NumPy | High-speed RGB transformation and histogram analysis |
| **Report Generators** | ReportLab & OpenPyXL | Programmatic PDF audits and multi-tab styled `.xlsx` |
| **Frontend** | Vanilla HTML5 / CSS3 / ES6 | Multi-page responsive dashboard, Chart.js visualizations |
| **Containerization** | Docker & Docker Compose | Multi-container architecture with healthchecks |

---

## 📂 Multi-Page Frontend Architecture

The frontend is structured into 11 standalone, dedicated views:

1. `index.html` — Landing page with authentication modals (Login & Register with Role selection).
2. `dashboard.html` — Executive overview, 9 summary KPI metrics, role-specific focus card, and grade charts.
3. `inspection.html` — Drag-and-drop food image inspection with instant visual feedback and 5-tier classification.
4. `storage.html` — Environmental chamber telemetry matrix (temperature, humidity, ventilation, light).
5. `shelf-life.html` — Kinetic degradation simulator and expiration countdown.
6. `inventory.html` — FEFO inventory manager with batch search, category filters, and modal CRUD operations.
7. `alerts.html` — Real-time risk cards categorized into Critical (Expired) and High (Near-Expiry/Degraded).
8. `analytics.html` — Interactive Chart.js analytics (5-tier grade distribution, temporal trends, category breakdowns).
9. `reports.html` — Audit compliance center with PDF, Excel (.xlsx), and CSV export actions.
10. `profile.html` — Authenticated user identity and role assignment overview.
11. `admin.html` — Administrator Control Center for user access management and system diagnostics.

---

## 🚀 Local Running Instructions

### 1. Database Configuration
Ensure PostgreSQL is active on `localhost:5432` with database `freshsense`:
```sql
CREATE DATABASE freshsense;
```
Environment variables or defaults in `backend/database.py`:
- `DB_USER`: `postgres`
- `DB_PASSWORD`: `jahnavi`
- `DB_HOST`: `localhost`
- `DB_PORT`: `5432`
- `DB_NAME`: `freshsense`

### 2. Start the Backend API (Port 8001)
```powershell
cd backend
.\venv313\Scripts\Activate.ps1
uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```
API Documentation (Swagger UI): `http://127.0.0.1:8001/docs`

### 3. Start the Frontend Server (Port 5500)
```powershell
cd frontend
python -m http.server 5500 --bind 127.0.0.1
```
Open your browser at: `http://127.0.0.1:5500`

---

## 🐳 Docker Deployment

To launch the full system with PostgreSQL, FastAPI backend, and Nginx frontend in isolated containers:

```bash
docker-compose up --build
```

- **Frontend:** `http://localhost:5500`
- **Backend API:** `http://localhost:8001`
- **PostgreSQL:** Port `5432`

---

## 🧪 Verification & Test Suites

The project includes 3 automated test suites:

### 1. Full End-to-End Integration Test (22 Checks)
```powershell
& ".\backend\venv313\Scripts\python.exe" backend/test_e2e_full.py
```
Validates frontend pages, AI inference, PostgreSQL persistence, shelf-life models, inventory CRUD, PDF & Excel generation, and Admin control APIs.

### 2. Security Hardening Suite
```powershell
& ".\backend\venv313\Scripts\python.exe" backend/test_security.py
```
Validates authentication input boundaries, password hash privacy, account deactivation lockout, and file upload safety.

### 3. Performance & Latency Benchmarks
```powershell
& ".\backend\venv313\Scripts\python.exe" backend/test_performance.py
```
Benchmarks round-trip latency across neural inference, analytical queries, and document generation against defined SLAs.

---

## 📜 Regulatory & Safety Disclaimer
*FreshSense AI provides AI-assisted computer vision heuristics and sensory degradation models. It is designed as a food-waste prevention and quality-tracking tool and does not replace official microbiological or laboratory food-safety certifications.*
