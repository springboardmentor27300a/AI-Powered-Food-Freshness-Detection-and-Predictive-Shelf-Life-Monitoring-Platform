# System Architecture Documentation

## Food Freshness Monitoring Platform — Milestone 4 Architecture

### 1. Architectural Overview

The **Food Freshness Monitoring Platform** is a scalable, cloud-ready, enterprise web platform engineered to automate food quality inspection, predict shelf life, mitigate supply chain waste, and deliver executive-grade visibility.

The architecture is organized into four decoupled tiers:
1. **Presentation Layer (Frontend)**: Native HTML5/CSS3 and Vanilla JavaScript (ES6+) with Chart.js for data visualization. Zero heavyweight framework dependencies.
2. **Application & API Layer (FastAPI REST Server)**: Asynchronous Python 3.11/3.13 backend using FastAPI, Pydantic data schemas, Uvicorn ASGI server, and PyJWT token security.
3. **AI & Analytic Inference Engine**: Computer Vision multi-spectral degradation pipeline (OpenCV / PIL / NumPy), Arrhenius kinetic shelf-life decay model, and prescriptive FEFO / markdown recommendation engine.
4. **Persistence & Telemetry Layer (MongoDB Atlas)**: Document database storing platform users, food inventories, multi-parameter freshness analyses, and IoT telemetry streams.

```mermaid
flowchart TD
    subgraph Client["1. Presentation Layer (Native Web Frontend)"]
        UI_DASH["User Dashboard (dashboard.html)"]
        UI_INV["Inventory Manager (inventory.html / add-food.html)"]
        UI_DETAIL["Food Inspector & AI Diagnostic (food-details.html)"]
        UI_EXEC["Executive Analytics & Chart.js (executive-dashboard.html)"]
        UI_REPORTS["Quality Reports & CSV/Certificates (reports.html)"]
        API_JS["Centralized API Client (api.js + Bearer Token)"]
    end

    subgraph Server["2. Application & Routing Layer (FastAPI REST Service)"]
        AUTH_ROUTER["/api/auth (Login, Register, Me)"]
        USER_ROUTER["/api/users (RBAC User Administration)"]
        INV_ROUTER["/api/inventory (CRUD, Uploads, Batch)"]
        AI_ROUTER["/api/freshness & /api/spoilage & /api/shelf-life"]
        ANALYTICS_ROUTER["/api/analytics/executive"]
        REPORT_ROUTER["/api/reports (Summary, CSV, Certificates)"]
        PROBES["/health & /ready Probes"]
        AUTH_MIDDLEWARE["Security & RBAC Enforcement (JWT HS256)"]
    end

    subgraph Inference["3. AI & Analytic Inference Engines"]
        CV_ENGINE["CV Analyzer (Color Degradation, Browning, Texture Roughness, Mold Segmentation)"]
        SHELF_ENGINE["Arrhenius Kinetic Shelf-Life Engine (Temperature Acceleration Q10, Humidity Stress)"]
        REC_ENGINE["Prescriptive Recommendation Engine (FEFO, Markdown Pricing, Storage Adjustments)"]
        REP_GEN["Compliance Report Generator"]
    end

    subgraph Storage["4. Persistence Layer (MongoDB Atlas)"]
        COL_USERS[("users Collection")]
        COL_INV[("inventory Collection")]
        COL_FRESH[("freshness_analyses Collection")]
        COL_READINGS[("storage_readings Collection")]
        MEDIA_STORE[("Local / Blob Object Store (/uploads/food_images)")]
    end

    UI_DASH --> API_JS
    UI_INV --> API_JS
    UI_DETAIL --> API_JS
    UI_EXEC --> API_JS
    UI_REPORTS --> API_JS

    API_JS -->|HTTP / JSON Requests with JWT| AUTH_MIDDLEWARE
    AUTH_MIDDLEWARE --> AUTH_ROUTER
    AUTH_MIDDLEWARE --> USER_ROUTER
    AUTH_MIDDLEWARE --> INV_ROUTER
    AUTH_MIDDLEWARE --> AI_ROUTER
    AUTH_MIDDLEWARE --> ANALYTICS_ROUTER
    AUTH_MIDDLEWARE --> REPORT_ROUTER

    AI_ROUTER --> CV_ENGINE
    AI_ROUTER --> SHELF_ENGINE
    AI_ROUTER --> REC_ENGINE
    REPORT_ROUTER --> REP_GEN

    INV_ROUTER --> MEDIA_STORE
    CV_ENGINE --> MEDIA_STORE

    AUTH_ROUTER --> COL_USERS
    USER_ROUTER --> COL_USERS
    INV_ROUTER --> COL_INV
    AI_ROUTER --> COL_FRESH
    AI_ROUTER --> COL_READINGS
    ANALYTICS_ROUTER --> COL_INV
    ANALYTICS_ROUTER --> COL_FRESH
    ANALYTICS_ROUTER --> COL_READINGS
    REPORT_ROUTER --> COL_INV
    REPORT_ROUTER --> COL_FRESH
```

---

### 2. Layered Responsibilities & Technology Stack

| Layer | Technologies | Responsibilities |
| :--- | :--- | :--- |
| **Presentation** | HTML5, CSS3, Vanilla JavaScript, Chart.js 4.4, Lucide Icons | Responsive UI rendering, state management, interactive charts, real-time client-side validation, JWT persistence in `localStorage`, export triggers. |
| **API & Routing** | FastAPI 0.115, Uvicorn 0.34, Pydantic v2 | Contract validation, route dispatching, dependency injection, CORS handling, JWT token decoding, role-based route guardrails. |
| **Business Logic** | Python 3.11+, PyJWT, Passlib/Bcrypt | User credential encryption, multi-tenant inventory scoping, batch aggregations, operational metric computations. |
| **Machine Learning** | OpenCV (`cv2`), Pillow (`PIL`), NumPy, Scikit-learn | Multi-spectral image color degradation, surface browning indices, Laplacian texture roughness, Arrhenius kinetic modeling, FEFO discount modeling. |
| **Persistence** | MongoDB 7.0/8.0+ or MongoDB Atlas Cluster | BSON document store, indexing (email, user_id, category, expiry_date, item_id), aggregation pipelines for analytics KPIs. |
| **Container & Ops** | Docker, Docker Compose, Linux base (Debian/Alpine) | Containerized packaging, non-root system isolation, health probes (`/health`, `/ready`), cloud portability (Azure Container Apps, AWS ECS). |

---

### 3. Comprehensive Data Flow Architecture

#### A. Food Intake & Initial Quality Inspection Workflow
```mermaid
sequenceDiagram
    autonumber
    actor User as User / Warehouse Operator
    participant UI as Frontend (add-food.html / inventory.js)
    participant API as FastAPI Backend (/api/inventory)
    participant CV as OpenCV Image Analyzer
    participant DB as MongoDB Atlas

    User->>UI: Select food category, batch, expiry, and upload photo
    UI->>API: POST /api/inventory/upload-image (multipart/form-data)
    API->>API: Validate file signature (JPEG, PNG, WebP) & sanitize filename
    API-->>UI: Return relative image URI (/uploads/food_images/xyz.jpg)
    UI->>API: POST /api/inventory (Food item payload + image URI)
    API->>DB: Insert into inventory collection
    DB-->>API: Return created document ID
    API-->>UI: 201 Created (Item initialized)
    UI->>API: POST /api/freshness/analyze (inventory_id)
    API->>CV: Execute color degradation & texture analysis
    CV-->>API: Visual score (0-100), freshness label, browning & defect metrics
    API->>DB: Record inspection in freshness_analyses collection
    API->>DB: Update inventory document with freshness_status & score
    API-->>UI: Return diagnostic results & prescriptive recommendations
    UI-->>User: Display quality scorecard, shelf-life badge, and action items
```

#### B. Arrhenius Shelf-Life Decay & IoT Telemetry Flow
```mermaid
sequenceDiagram
    autonumber
    actor Sensor as IoT Environmental Monitor
    participant API as FastAPI (/api/storage/conditions)
    participant Model as Arrhenius Kinetic Decay Engine
    participant DB as MongoDB (storage_readings)

    Sensor->>API: POST /api/storage/conditions (inventory_id, temp, humidity, gas_ppm)
    API->>DB: Store telemetry record in storage_readings
    API->>Model: Compute acceleration factor Q10 & remaining shelf life
    Model->>Model: Calculate delta against optimal category baseline (e.g., 4°C for Dairy)
    Model-->>API: Predicted shelf life days, expiration forecast, risk alerts
    API->>DB: Update inventory.shelf_life_days & storage alerts
    API-->>Sensor: 201 Created (telemetry acknowledged)
```

---

### 4. Role-Based Access Control (RBAC) Matrix

The system implements strict permission scoping based on user roles:

| Capability / Resource | Consumer | Retailer | Restaurant | Warehouse Manager | Food Manufacturer | Supply Chain Operator | Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Personal Dashboard** | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| **Manage Own Inventory** | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| **Upload Food Photos** | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| **Trigger AI Freshness Diagnostic** | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| **View Prescriptive Recommendations** | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| **View Cross-User Enterprise Inventory** | No | No | No | Yes | Yes | Yes | Yes |
| **Access Executive Analytics Dashboard** | No | Yes | Yes | Yes | Yes | Yes | Yes |
| **Generate Quality & Compliance Reports** | No | Yes | Yes | Yes | Yes | Yes | Yes |
| **Export Official Batch Certificates** | No | Yes | Yes | Yes | Yes | Yes | Yes |
| **User Administration & Role Assignment**| No | No | No | No | No | No | Yes |

---

### 5. Deployment & Cloud Architecture

```mermaid
flowchart LR
    subgraph Users["End Users & Operators"]
        WEB["Desktop / Mobile Browser"]
        IOT["IoT Cold-Chain Sensors"]
    end

    subgraph Cloud["Azure / AWS Cloud Environment"]
        INGRESS["Cloud Ingress / Load Balancer (HTTPS / TLS 1.3)"]
        
        subgraph AppContainer["Container App / ECS Task (Docker)"]
            APP["FastAPI Application (Port 8000)"]
            STATIC["Static Web Server (/frontend)"]
            UPLOADS_VOL["Persistent File Volume (/app/uploads)"]
        end
        
        subgraph ManagedDB["MongoDB Atlas Multi-AZ Cluster"]
            ATLAS_PRIMARY[("Primary Node")]
            ATLAS_SEC1[("Secondary Node")]
            ATLAS_SEC2[("Secondary Node")]
        end
    end

    WEB -->|HTTPS Port 443| INGRESS
    IOT -->|REST / JSON| INGRESS
    INGRESS --> APP
    APP --> STATIC
    APP --> UPLOADS_VOL
    APP -->|TLS / SCRAM-SHA-256| ATLAS_PRIMARY
    ATLAS_PRIMARY --- ATLAS_SEC1
    ATLAS_PRIMARY --- ATLAS_SEC2
```

---

### 6. Security & Hardening Architecture

1. **Authentication & Token Cryptography**:
   - JWT tokens signed with HMAC-SHA256 (`HS256`) using a minimum 32-character secret key.
   - User passwords salted and hashed with `bcrypt` (12 rounds) via `passlib`.
   - Token expiration set to configurable durations (default: 24 hours).
2. **Container Security**:
   - Container runs as unprivileged user `appuser` (UID 10001) to prevent root breakouts.
   - Clean `.dockerignore` file prevents leakage of `.env`, `.git`, or temporary artifacts into container images.
3. **Database Security**:
   - Mandatory TLS encryption in transit for MongoDB Atlas connections.
   - IP access control whitelist configured on Atlas cluster.
   - No database credentials committed in source code; managed via container environment variables.
4. **Resilience & Probes**:
   - `/health` endpoint executes live MongoDB ping verifying database connectivity.
   - `/ready` endpoint verifies AI inference pipelines and upload directory write readiness.
