# Comprehensive Testing Guide

## Food Freshness Monitoring Platform — Quality Assurance

### 1. Testing Philosophy & Strategy

The platform maintains a robust, automated quality assurance suite built on **Pytest** and FastAPI's **TestClient** (backed by Starlette & HTTPX).

The testing pyramid ensures:
1. **Schema & Validation Integrity**: Verifies Pydantic schemas enforce type constraints, date logic, and bounds before hitting database persistence.
2. **Authentication & RBAC Security**: Validates password salting/hashing, JWT token encoding/decoding, token expiry, and strict permission segregation across all 7 user roles.
3. **Core Business Logic & CRUD**: Validates inventory lifecycle management (creation, listing, filtering, pagination, updating, deletion).
4. **AI & ML Inference**: Asserts that computer vision algorithms, Arrhenius kinetic shelf-life decay, and recommendation engines return valid quantitative bounds without exceptions.
5. **Analytics & Aggregation**: Validates that all dashboard KPIs and Chart.js datasets are dynamically aggregated from live database records.

---

## 2. Test Suite Organization

All automated test specifications reside in the root `tests/` directory:

| Test File | Target Subsystem | Key Scenarios Tested |
| :--- | :--- | :--- |
| [`test_auth.py`](file:///tests/test_auth.py) | User Authentication & JWT | Registration, duplicate email rejection, password validation, login, token structure, `/api/auth/me`. |
| [`test_users.py`](file:///tests/test_users.py) | User Administration & RBAC | Admin user listing, Consumer access rejection (403), user profile self-inspection. |
| [`test_inventory.py`](file:///tests/test_inventory.py) | Inventory Management | Valid creation, invalid date validation (expiry < purchase), negative quantity rejection, category filters, item update, item deletion. |
| [`test_image_upload.py`](file:///tests/test_image_upload.py) | Media Upload & Security | Valid PNG/JPEG file upload, non-image format rejection (`.txt`), file size bounds. |
| [`test_freshness_analysis.py`](file:///tests/test_freshness_analysis.py) | Computer Vision Analysis | Real OpenCV feature analysis on inventory item, 404 response for nonexistent IDs, visual score computation. |
| [`test_shelf_life.py`](file:///tests/test_shelf_life.py) | Arrhenius Kinetics | Shelf-life decay calculation, temperature acceleration factor, humidity stress, spoilage detection with gas sensor telemetry. |
| [`test_storage.py`](file:///tests/test_storage.py) | IoT Storage Telemetry | Ingestion of temperature/humidity readings, threshold violation alert generation, historical retrieval. |
| [`test_recommendations.py`](file:///tests/test_recommendations.py) | Prescriptive Engine | FEFO picking recommendation generation, dynamic discount clearance markdown advice, priority level calculation. |
| [`test_analytics.py`](file:///tests/test_analytics.py) | Executive Analytics | Calculation of 11 real database KPIs, Chart.js dataset formatting, multi-attribute date/category/location filtering. |
| [`test_reports.py`](file:///tests/test_reports.py) | Compliance & Reports | Summary table generation, CSV data streaming, printable batch certificate payload serialization. |
| [`test_milestone1.py`](file:///tests/test_milestone1.py) | Regression & Baseline | Baseline health probe, end-to-end integration across early milestone capabilities. |

---

## 3. Running Automated Tests

### 3.1 Execute Full Test Suite
To run all 34 tests across all test modules:
```bash
# Windows PowerShell / CMD
& ".venv/Scripts/python.exe" -m pytest tests/ -v

# Linux / macOS
pytest tests/ -v
```

### 3.2 Run Specific Module
```bash
# Test only AI Freshness analysis and Shelf Life
pytest tests/test_freshness_analysis.py tests/test_shelf_life.py -v

# Test only Executive Analytics and Reporting
pytest tests/test_analytics.py tests/test_reports.py -v
```

### 3.3 Run with Coverage Analysis
```bash
pytest --cov=backend/app --cov-report=term-missing tests/
```
