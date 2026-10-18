# Food Freshness Monitoring Platform — REST API Documentation

## Overview

The Food Freshness Monitoring Platform exposes a contract-stable REST API powering web clients, IoT telemetry ingestors, and enterprise enterprise integrations.

- **Base URL**: `http://localhost:8000/api` (or `https://<domain>/api` in production)
- **Protocol**: HTTP/1.1 & HTTP/2 over TLS
- **Data Format**: `application/json` (or `multipart/form-data` for image uploads)
- **Authentication**: Bearer JWT tokens in `Authorization: Bearer <token>` header.
- **Interactive Documentation**: Swagger UI available at `/docs` and ReDoc at `/redoc`.

---

## Standard Error Response Format

All error responses return a standardized JSON structure:

```json
{
  "detail": "Descriptive explanation of the error condition."
}
```

Common HTTP status codes:
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Invalid payload or business logic violation.
- `401 Unauthorized`: Missing, invalid, or expired JWT token.
- `403 Forbidden`: Authenticated user lacks RBAC permissions for the requested resource.
- `404 Not Found`: Resource does not exist.
- `422 Unprocessable Entity`: Request body failed Pydantic schema validation.
- `500 Internal Server Error`: Unhandled server exception.

---

## 1. Authentication Endpoints

### 1.1 User Registration
- **Endpoint**: `POST /api/auth/register`
- **Access**: Public
- **Description**: Registers a new user account. Disallows direct registration for the `Admin` role (reserved for secure provisioning).

#### Request Body
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "SecurePassword123!",
  "confirm_password": "SecurePassword123!",
  "role": "Consumer",
  "organization": "Home Kitchen"
}
```

#### Response (201 Created)
```json
{
  "id": "670c538a0f8b1e42701e1a01",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "role": "Consumer",
  "organization": "Home Kitchen",
  "created_at": "2026-10-15T08:30:00Z"
}
```

---

### 1.2 User Login
- **Endpoint**: `POST /api/auth/login`
- **Access**: Public
- **Description**: Validates user credentials and returns a signed JWT token.

#### Request Body
```json
{
  "email": "jane@example.com",
  "password": "SecurePassword123!"
}
```

#### Response (200 OK)
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "670c538a0f8b1e42701e1a01",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "Consumer"
  }
}
```

---

### 1.3 Current User Identity
- **Endpoint**: `GET /api/auth/me`
- **Access**: Authenticated (Any role)
- **Description**: Returns the identity and authorization context of the authenticated user.

#### Response (200 OK)
```json
{
  "id": "670c538a0f8b1e42701e1a01",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "role": "Consumer",
  "organization": "Home Kitchen",
  "created_at": "2026-10-15T08:30:00Z"
}
```

---

## 2. User Administration Endpoints

### 2.1 List All Users
- **Endpoint**: `GET /api/users`
- **Access**: RBAC Restricted (`Admin` role only)
- **Description**: Retrieves a paginated list of registered platform users.

#### Response (200 OK)
```json
[
  {
    "id": "670c538a0f8b1e42701e1a01",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "Consumer",
    "is_active": true,
    "created_at": "2026-10-15T08:30:00Z"
  }
]
```

---

## 3. Food Inventory Management Endpoints

### 3.1 Create Inventory Item
- **Endpoint**: `POST /api/inventory`
- **Access**: Authenticated (All roles)
- **Description**: Enrolls a new food batch into inventory with storage constraints and purchase/expiry dates.

#### Request Body
```json
{
  "food_name": "Organic Strawberries",
  "category": "Fruits",
  "quantity": 10.0,
  "unit": "kg",
  "purchase_date": "2026-10-16",
  "expiry_date": "2026-10-23",
  "storage_type": "Refrigerated",
  "storage_temperature": 3.5,
  "storage_humidity": 90.0,
  "location": "Cold Room A - Bay 4",
  "batch_number": "STRAW-OCT-26",
  "image_url": "/uploads/food_images/straw_sample.jpg"
}
```

#### Response (201 Created)
```json
{
  "id": "670c541b0f8b1e42701e1a05",
  "food_name": "Organic Strawberries",
  "category": "Fruits",
  "quantity": 10.0,
  "unit": "kg",
  "purchase_date": "2026-10-16",
  "expiry_date": "2026-10-23",
  "storage_type": "Refrigerated",
  "storage_temperature": 3.5,
  "storage_humidity": 90.0,
  "location": "Cold Room A - Bay 4",
  "batch_number": "STRAW-OCT-26",
  "image_url": "/uploads/food_images/straw_sample.jpg",
  "freshness_status": "Not Analyzed",
  "freshness_score": null,
  "shelf_life_days": 7.0,
  "created_at": "2026-10-16T10:00:00Z"
}
```

---

### 3.2 List Inventory Items
- **Endpoint**: `GET /api/inventory`
- **Access**: Authenticated
- **Query Parameters**:
  - `category` (optional string): Filter by category (e.g. `Fruits`, `Dairy`).
  - `freshness_status` (optional string): Filter by status (`Fresh`, `Moderate`, `Expiring Soon`, `Spoiled`).
  - `search` (optional string): Substring search across `food_name` and `batch_number`.
  - `storage_type` (optional string): Filter by storage method.

#### Response (200 OK)
```json
[
  {
    "id": "670c541b0f8b1e42701e1a05",
    "food_name": "Organic Strawberries",
    "category": "Fruits",
    "quantity": 10.0,
    "unit": "kg",
    "purchase_date": "2026-10-16",
    "expiry_date": "2026-10-23",
    "storage_type": "Refrigerated",
    "freshness_status": "Fresh",
    "freshness_score": 91.5,
    "shelf_life_days": 6.8
  }
]
```

---

### 3.3 Upload Food Image
- **Endpoint**: `POST /api/inventory/upload-image`
- **Access**: Authenticated
- **Payload**: `multipart/form-data` with key `file`.
- **Supported Formats**: JPEG, JPG, PNG, WEBP. Maximum file size: 10 MB.

#### Response (200 OK)
```json
{
  "image_url": "/uploads/food_images/f3a479b12_strawberries.jpg",
  "filename": "f3a479b12_strawberries.jpg"
}
```

---

### 3.4 Inventory Item Details, Update & Delete
- `GET /api/inventory/{id}`: Returns complete item details, including latest AI diagnostics.
- `PUT /api/inventory/{id}`: Updates quantity, storage conditions, or location.
- `DELETE /api/inventory/{id}`: Permanently deletes the inventory record.

---

## 4. AI & Machine Learning Endpoints

### 4.1 Execute Freshness Analysis
- **Endpoint**: `POST /api/freshness/analyze`
- **Access**: Authenticated
- **Description**: Triggers the Computer Vision multi-spectral inspection pipeline to compute color degradation, browning, texture roughness, and overall quality score.

#### Request Body
```json
{
  "inventory_id": "670c541b0f8b1e42701e1a05",
  "image_url": "/uploads/food_images/straw_sample.jpg"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "inventory_id": "670c541b0f8b1e42701e1a05",
  "food_name": "Organic Strawberries",
  "analysis": {
    "visual_score": 91.5,
    "freshness_label": "Fresh",
    "spoilage_probability": 0.08,
    "color_score": 93.0,
    "texture_score": 90.0,
    "defect_score": 92.5,
    "browning_index": 4.2,
    "roughness_index": 28.5,
    "mold_coverage_percent": 0.0,
    "predicted_shelf_life": 6.5,
    "inspected_at": "2026-10-16T10:15:00Z"
  },
  "recommendations": [
    "Storage conditions within optimal boundaries (3.5°C).",
    "Rotate according to FEFO schedule within 6.5 days."
  ]
}
```

---

### 4.2 Predict Remaining Shelf Life (Arrhenius Kinetics)
- **Endpoint**: `POST /api/shelf-life/predict`
- **Access**: Authenticated
- **Description**: Computes kinetic degradation rate using the Arrhenius temperature acceleration model ($Q_{10}$) and relative humidity stress factors.

#### Request Body
```json
{
  "inventory_id": "670c541b0f8b1e42701e1a05",
  "current_temp": 4.0,
  "current_humidity": 85.0
}
```

#### Response (200 OK)
```json
{
  "inventory_id": "670c541b0f8b1e42701e1a05",
  "category": "Fruits",
  "baseline_shelf_life_days": 7.0,
  "predicted_remaining_days": 6.2,
  "daily_decay_rate": 0.161,
  "temperature_acceleration_factor": 1.05,
  "humidity_stress_factor": 1.02,
  "storage_recommendation": "Maintain cold chain at 3-4°C to preserve cellular turgidity."
}
```

---

### 4.3 Spoilage Detection
- **Endpoint**: `POST /api/spoilage/detect`
- **Access**: Authenticated
- **Description**: Evaluates spoilage risk by fusing visual defect indicators with gas sensor telemetry (e.g. ethylene, VOCs).

#### Request Body
```json
{
  "inventory_id": "670c541b0f8b1e42701e1a05",
  "gas_sensor_ppm": 14.5
}
```

#### Response (200 OK)
```json
{
  "inventory_id": "670c541b0f8b1e42701e1a05",
  "spoilage_detected": false,
  "spoilage_probability": 0.12,
  "risk_level": "Low",
  "gas_sensor_status": "Normal (14.5 ppm)",
  "recommended_action": "Standard storage maintenance."
}
```

---

### 4.4 Ingest & Retrieve IoT Storage Telemetry
- `POST /api/storage/conditions`: Ingests sensor reading (`temperature`, `humidity`, `gas_ppm`) for an inventory item.
- `GET /api/storage/conditions?inventory_id={id}`: Retrieves chronological timeseries history.

---

### 4.5 Get Prescriptive Item Recommendations
- **Endpoint**: `GET /api/recommendations/{id}`
- **Access**: Authenticated
- **Description**: Generates prescriptive FEFO actions, dynamic markdown clearance suggestions, and temperature stabilization rules.

#### Response (200 OK)
```json
{
  "inventory_id": "670c541b0f8b1e42701e1a05",
  "food_name": "Organic Strawberries",
  "freshness_status": "Fresh",
  "shelf_life_days": 6.2,
  "markdown_action": "None required - Item at peak freshness.",
  "storage_adjustment": "Keep at 3.5°C and 90% RH.",
  "priority_level": "Normal",
  "recommendations": [
    "Item in optimal state.",
    "No immediate price clearance action required."
  ]
}
```

---

## 5. Executive Analytics & Reporting Endpoints

### 5.1 Executive Analytics Aggregation
- **Endpoint**: `GET /api/analytics/executive`
- **Access**: Authorized roles (`Retailer`, `Restaurant`, `Warehouse Manager`, `Food Manufacturer`, `Supply Chain Operator`, `Admin`)
- **Query Parameters**:
  - `start_date` (optional ISO date): Filter start bound.
  - `end_date` (optional ISO date): Filter end bound.
  - `category` (optional string): Filter by food category.
  - `location` (optional string): Filter by storage bay.

#### Response (200 OK)
```json
{
  "kpis": {
    "total_inventory_items": 154,
    "total_quantity": 4820.5,
    "total_analyses": 89,
    "fresh_items": 112,
    "moderately_fresh_items": 28,
    "spoiled_high_risk_items": 14,
    "average_quality_score": 84.6,
    "average_shelf_life_days": 8.4,
    "items_approaching_expiry": 19,
    "active_storage_alerts": 3,
    "waste_avoidance_rate": 91.2
  },
  "charts": {
    "freshness_distribution": {
      "labels": ["Fresh", "Moderate", "Spoiled / High Risk", "Pending Analysis"],
      "data": [112, 28, 14, 0]
    },
    "category_analysis": {
      "categories": ["Fruits", "Vegetables", "Dairy", "Meat", "Fish", "Bakery"],
      "freshness_scores": [86.2, 88.0, 91.5, 78.4, 72.1, 80.5],
      "item_counts": [42, 38, 25, 18, 11, 20]
    },
    "shelf_life_distribution": {
      "ranges": ["0-2 Days", "3-5 Days", "6-10 Days", "11-20 Days", "20+ Days"],
      "counts": [14, 25, 48, 39, 28]
    },
    "storage_telemetry_trends": {
      "timestamps": ["2026-10-10", "2026-10-12", "2026-10-14", "2026-10-16"],
      "temperatures": [3.8, 4.1, 4.0, 3.9],
      "humidities": [88.5, 89.2, 90.1, 89.8]
    }
  },
  "operational_insights": [
    "Overall inventory health index is 84.6%, indicating strong stock quality.",
    "Meat & Fish category exhibits higher risk variance; recommend cold room calibration.",
    "FEFO dynamic markdowns on 14 items can recover an estimated 85% of potential waste value."
  ],
  "last_updated": "2026-10-16T12:00:00Z"
}
```

---

### 5.2 Quality Reports Summary & Export
- `GET /api/reports/summary`: Returns tabular batch data with quality scores, risk levels, and compliance status.
- `GET /api/reports/export-csv`: Streams a formatted `.csv` file download of active quality records.
- `GET /api/reports/batch/{id}`: Generates a serialized Quality Assurance Compliance Certificate payload for printable inspection certificates.

---

## 6. System Probes & Health Checks

### 6.1 Liveness Probe
- **Endpoint**: `GET /health` (or `GET /api/health`)
- **Access**: Public
- **Description**: Verifies container liveness and active MongoDB connection.

#### Response (200 OK)
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-10-16T12:00:00Z"
}
```

---

### 6.2 Readiness Probe
- **Endpoint**: `GET /ready` (or `GET /api/ready`)
- **Access**: Public
- **Description**: Verifies that the filesystem uploads directory is writable and the ML inference engines are loaded in memory.

#### Response (200 OK)
```json
{
  "status": "ready",
  "storage_writable": true,
  "ml_models_ready": true,
  "timestamp": "2026-10-16T12:00:00Z"
}
```

---

## 7. Retailer Role Endpoints (`/api/retailer/*`)

All `/api/retailer` endpoints are guarded by strict Role-Based Access Control (RBAC) permitting only users with the `Retailer` role (or platform `Admin`). Requests by `Consumer` or `Warehouse Manager` are rejected with `403 Forbidden`. Furthermore, all operations enforce multi-tenant item ownership so Retailer A cannot read, modify, adjust stock, or archive products belonging to Retailer B.

### 7.1 Retailer Dashboard Overview
- **Endpoint**: `GET /api/retailer/dashboard`
- **Access**: Retailer, Admin
- **Description**: Returns 5 top-level KPI metrics, a prioritized urgent action queue (expired, spoiling, or critical stock), and the 5 most recently updated inventory items for the authenticated retailer.

#### Response (200 OK)
```json
{
  "kpis": {
    "total_products": 7,
    "total_units": 209.0,
    "expiring_soon_count": 2,
    "active_alerts_count": 3,
    "waste_risk_count": 2
  },
  "priority_actions": [
    {
      "id": "670c538a0f8b1e42701e1a05",
      "food_name": "Premium Atlantic Salmon Fillet",
      "category": "Fish",
      "quantity": 8.0,
      "unit": "kg",
      "expiry_status": "expired",
      "freshness_status": "Spoiled",
      "priority_reason": "Expired product requiring urgent clearance or disposal."
    }
  ],
  "recent_items": [...]
}
```

---

### 7.2 Retailer Inventory Management

#### 7.2.1 List Inventory
- **Endpoint**: `GET /api/retailer/inventory`
- **Parameters**: `category` (optional), `freshness_status` (optional), `expiry_status` (optional: `safe`, `approaching_expiry`, `expired`), `search` (optional text search), `include_archived` (boolean, default `false`).
- **Description**: Returns the authenticated retailer's products with computed shelf life, compliance status, and quality scores.

#### 7.2.2 Create Product
- **Endpoint**: `POST /api/retailer/inventory`
- **Request Body**:
```json
{
  "food_name": "Organic Whole Milk 1L",
  "category": "Dairy",
  "quantity": 42.0,
  "unit": "bottles",
  "purchase_date": "2026-10-15",
  "expiry_date": "2026-10-22",
  "storage_type": "Refrigerated",
  "storage_temperature": 3.0,
  "storage_humidity": 60.0,
  "location": "Dairy Chiller Wall A",
  "batch_number": "MLK-ORG-2026",
  "low_stock_threshold": 50.0
}
```

#### 7.2.3 Stock Adjustment
- **Endpoint**: `PATCH /api/retailer/inventory/{id}/stock`
- **Description**: Modifies inventory quantity (`set`, `add`, or `deduct`). Enforces non-negative stock constraint (returns `422 Unprocessable Content` if deduction exceeds stock) and records audit trail in `stock_history`.
- **Request Body**:
```json
{
  "quantity": 10.0,
  "adjustment_type": "deduct",
  "reason": "Retail shelf restock sale"
}
```

#### 7.2.4 Archive / De-archive Product
- **Endpoint**: `PATCH /api/retailer/inventory/{id}/archive`
- **Request Body**: `{"is_archived": true}`

---

### 7.3 AI Freshness & Quality Diagnostics
- **Endpoint**: `POST /api/retailer/inventory/{id}/analyze`
- **Request Body**: `multipart/form-data` with `file` (image) and optional `notes`.
- **Description**: Evaluates food image using computer vision feature extraction (color, texture, defect area) and Arrhenius kinetics. Automatically updates the item's `freshness_status`, `freshness_score`, and remaining shelf life, logs a record in `freshness_records`, and generates alerts if spoilage is detected.

---

### 7.4 Expiry & Shelf-Life Kinetics
- **Endpoint**: `GET /api/retailer/expiry`: Categorizes inventory into `expired`, `approaching_expiry` (<=3 days), and `safe`, distinguishing manufacturer printed expiry from biological shelf life.
- **Endpoint**: `GET /api/retailer/shelf-life`: Computes dynamic kinetic shelf life based on real-time storage temperature vs optimal reference temperature with Arrhenius Q10 acceleration factors.

---

### 7.5 Spoilage & Storage Alerts
- **Endpoint**: `GET /api/retailer/alerts`: Returns active and acknowledged alerts for the retailer.
- **Endpoint**: `PATCH /api/retailer/alerts/{id}/acknowledge`: Marks an alert acknowledged with an optional resolution note.

---

### 7.6 Environmental Storage Compliance
- **Endpoint**: `GET /api/retailer/storage`: Audits display case and chiller conditions against food science category thresholds (`min_temp`, `max_temp`, `min_rh`, `max_rh`), returning temperature/humidity compliance flags and corrective advice.

---

### 7.7 Food Waste Reduction & FEFO Markdowns
- **Endpoint**: `GET /api/retailer/waste-reduction`: Applies FEFO (First-Expired, First-Out) algorithms to assign dynamic action priorities:
  - `URGENT_REMOVAL`: Expired or spoiled items.
  - `CRITICAL_MARKDOWN_50`: Shelf life <= 1 day (apply 50% clearance discount).
  - `MODERATE_MARKDOWN_30`: Shelf life <= 3 days (apply 30% discount).
  - `DONATION_CANDIDATE`: Approaching expiry but safe quality score (>60%).
  - `OPTIMAL`: Healthy shelf life.

---

### 7.8 Retail Analytics & Reports
- **Endpoint**: `GET /api/retailer/analytics`: Returns 11 dynamic MongoDB metrics and 4 Chart.js datasets (freshness distribution donut, stock by category bar, expiry horizon radar/line, and stock level vs threshold comparison).
- **Endpoint**: `GET /api/retailer/reports`: Summary table of inventory items with quality and compliance audit fields.
- **Endpoint**: `GET /api/retailer/reports/export-csv`: Streams an authorized `.csv` spreadsheet export with header `Content-Disposition: attachment; filename=retailer_inventory_report_<date>.csv`.

---

### 7.9 Retailer Operational Notifications
- **Endpoint**: `GET /api/retailer/notifications`: Returns retailer operational event notifications (spoilage alerts, low stock warnings, scan completions).
- **Endpoint**: `PATCH /api/retailer/notifications/{id}/read`: Marks a single notification as read.
- **Endpoint**: `PATCH /api/retailer/notifications/read-all`: Marks all retailer notifications as read.

---

## 8. Food Quality Inspector Endpoints (`/api/inspector/*`)

All `/api/inspector` endpoints enforce strict Role-Based Access Control (RBAC) permitting only users with the `Food Quality Inspector` role (and platform `Admin`). Requests by `Consumer`, `Retailer`, or `Warehouse Manager` return `403 Forbidden`. The Quality Inspector is a quality-control auditing role and cannot modify user accounts or system configurations.

### 8.1 Inspector Operational Dashboard
- **Endpoint**: `GET /api/inspector/dashboard`
- **Access**: Food Quality Inspector, Admin
- **Description**: Returns 6 top-level quality KPIs (*Today's Inspections*, *Pending Reviews*, *Fresh Items*, *Spoilage Alerts*, *Flagged Results*, *Average Quality Score & AI Confidence*), the 6 most recent inspections, pending review queue, and active quality alerts.

#### Response (200 OK)
```json
{
  "kpis": {
    "total_inspections": 5,
    "today_inspections": 3,
    "pending_reviews": 1,
    "fresh_items": 3,
    "moderate_items": 1,
    "spoiled_items": 1,
    "spoilage_alerts": 2,
    "flagged_results": 1,
    "average_quality_score": 70.3,
    "average_ai_confidence": 92.4
  },
  "recent_inspections": [...],
  "pending_reviews": [...],
  "active_alerts": [...]
}
```

---

### 8.2 Image-Based Inspection Submission
- **Endpoint**: `POST /api/inspector/inspections`
- **Format**: `multipart/form-data`
- **Fields**:
  - `product_name` (string, required)
  - `category` (string, required: `Fruits`, `Vegetables`, `Dairy`, `Meat`, `Fish`, `Bakery`, `Grains`, `Packaged Food`, `Other`)
  - `batch_number` (string, optional)
  - `storage_temperature` (float, optional: observed ambient °C)
  - `storage_humidity` (float, optional: observed ambient %RH)
  - `storage_location` (string, optional)
  - `notes` (string, optional)
  - `file` (binary image file, optional: `.jpg`, `.png`, `.webp`)
- **JSON Endpoint**: `POST /api/inspector/inspections/json` (accepts standard JSON payload with optional `image_url`).
- **Description**: Ingests food inspection data, runs live OpenCV multi-spectral analysis, evaluates storage conditions against food science tolerances, runs Arrhenius shelf-life kinetics, saves the record to `food_inspections`, and triggers automated alerts if spoilage or temperature violations are detected.

---

### 8.3 Quality Assessment & AI Result Validation
- **Endpoint**: `PATCH /api/inspector/inspections/{inspection_id}/review`
- **Description**: Records human quality controller validation decision (`Confirmed`, `Flagged`, or `Requires Further Inspection`).
- **Data Integrity Guarantee**: Preserves the original `ai_result` subdocument completely unmodified for legal traceability and audit logs. All human findings and shelf-life adjustments are stored in `inspector_review`.
- **Request Body**:
```json
{
  "decision": "Confirmed",
  "reason": "Meets Class-1 export quality specifications",
  "comments": "Inspected surface tissue integrity and firmness. Approved for distribution.",
  "adjusted_shelf_life": 12.0
}
```

---

### 8.4 Issue Identification & Product Flagging
- **Endpoint**: `PATCH /api/inspector/inspections/{inspection_id}/flag`
- **Description**: Flags a suspect product with categorized issue types (`Spoilage Suspected`, `Low Quality`, `Storage Violation`, `Short Remaining Shelf Life`, `AI Result Requires Review`, `Image Quality Problem`, `Other`) and severity levels (`Low`, `Medium`, `High`, `Critical`). Automatically creates an active alert in `alerts`.
- **Request Body**:
```json
{
  "issue_type": "Spoilage Suspected",
  "severity": "Critical",
  "reason": "Visible mycelial mold colonies and tissue softening observed.",
  "comments": "Immediate condemnation and disposal mandated."
}
```

---

### 8.5 Inspection History & Audit Trail
- **Endpoint**: `GET /api/inspector/inspections` (or `GET /api/inspector/inspection-history`)
- **Query Parameters**:
  - `category`: Filter by food category.
  - `freshness_status`: Filter by `Fresh`, `Moderate` / `Moderately Fresh`, `Spoiled`.
  - `status`: Filter by `Pending`, `Confirmed`, `Flagged`, `Requires Further Inspection`, `Under Review`.
  - `severity`: Filter by issue severity (`Low`, `Medium`, `High`, `Critical`).
  - `search`: Case-insensitive search on product name, batch code, or inspection ID.
  - `start_date` / `end_date`: Date range filters (`YYYY-MM-DD`).

---

### 8.6 Storage Condition Reference Review
- **Endpoint**: `GET /api/inspector/storage-review`
- **Query Parameters**: `category`, `temperature`, `humidity`
- **Description**: Audits observed environmental readings against category-specific optimal and permissible food science ranges, returning compliance findings and corrective action advice.

---

### 8.7 Quality Analytics & Trend Visualizations
- **Endpoint**: `GET /api/inspector/quality-analytics`
- **Description**: Aggregates real MongoDB data for quality metrics, freshness classification distribution (donut), 7-day quality score trends, spoilage and flagging trends, and daily inspection activity velocity.

---

### 8.8 Quality Alerts & Resolution
- **Endpoint**: `GET /api/inspector/alerts`: Lists active and resolved quality alerts.
- **Endpoint**: `PATCH /api/inspector/alerts/{alert_id}/resolve`: Resolves an active alert, recording corrective actions taken and inspector identity.
- **Request Body**:
```json
{
  "action_taken": "Quarantined and disposed",
  "resolution_notes": "Stock condemned and removed from sales floor."
}
```

---

### 8.9 Inspection Log CSV Export
- **Endpoint**: `GET /api/inspector/reports/export-csv`
- **Description**: Streams a formal `.csv` Quality Assurance Inspection Log spreadsheet with complete audit fields.


