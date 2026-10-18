# Workflow Documentation

## Food Freshness Monitoring Platform — Workflows

---

### 1. Milestone 1 Implemented Workflow

The operational flow implemented and validated in **Milestone 1** handles user onboarding, role enforcement, and food inventory lifecycle management:

```mermaid
flowchart TD
    A[Visitor Arrives on Landing Page] --> B{Authenticated?}
    B -- No --> C[Registration or Login]
    B -- Yes --> E[Role Verification & Token Validation]

    C -->|Submit Registration| C1[FastAPI /api/auth/register]
    C1 -->|Hash Password & Validate Role| C2[(MongoDB users Collection)]
    C2 --> C3[Redirect to Login]

    C -->|Submit Login Credentials| D1[FastAPI /api/auth/login]
    D1 -->|Verify Bcrypt Hash| D2[Generate Signed JWT Token]
    D2 -->|Store in localStorage| E

    E --> F[Dashboard /api/dashboard/stats]
    F --> G[Render KPIs: Total Items, Expiring Soon, Pending AI, Storage Alerts]

    G --> H[Inventory Management]
    H --> I[Add Food Item /api/inventory POST]
    I -->|Validate Schema & Dates| I1[(MongoDB inventory Collection)]
    
    H --> J[View Inventory /api/inventory GET]
    J -->|Search, Category, Expiry Filters| K[Render Interactive Inventory Table]
    
    K --> L[View Food Details]
    L --> M[Display Properties: Freshness Status: Not Analyzed, AI: Pending]

    K --> N[Edit Food Item /api/inventory PUT]
    K --> O[Delete Food Item /api/inventory DELETE]
```

#### Detailed Steps:
1. **User Registration / Authentication**:
   - User submits Full Name, Email, Password, and Role (Consumer, Retailer, Restaurant, Warehouse Manager, etc.).
   - Password is confirmed and securely hashed with `bcrypt`.
   - On login, a signed JWT token is issued containing user ID, email, and role.
2. **Dashboard Initialization**:
   - The frontend issues an authenticated request to `GET /api/dashboard/stats`.
   - Real-time aggregation calculates totals, items nearing expiration (< 3 days), unanalyzed items, and storage anomalies.
3. **Food Inventory Intake**:
   - User inputs food details (name, category, quantity, unit, purchase/expiry dates, storage type, temperature, humidity, location, batch number, optional photo).
   - System validates that expiry date is not earlier than purchase date and quantity is positive.
   - Record is stored with initial `freshness_status = "Not Analyzed"`.
4. **Food Inspection & Maintenance**:
   - Users can search by name/batch, filter by category or expiry status, sort by dates, edit records, or delete items.

---

### 2. Future AI & IoT Workflow (Milestones 2 & 3)

The project architecture has been specifically decoupled so the upcoming AI and IoT pipelines can plug in without rewriting the existing database or frontend foundations:

```mermaid
flowchart TD
    subgraph Data_Acquisition["1. Multi-Modal Data Acquisition"]
        IMG[User Captures Food Photograph]
        IOT[IoT Sensor Telemetry: Temperature, Humidity, Ethylene Gas]
    end

    subgraph Preprocessing["2. Preprocessing & Augmentation"]
        IMG_PREP[Image Resizing 224x224, Normalization, Color Histogram Extraction]
        SENSOR_PREP[Sensor Rolling Mean, Anomaly Thresholding]
    end

    subgraph Deep_Learning["3. Vision AI & Predictive Inference Pipeline"]
        CNN[Deep CNN / Vision Transformer Backbone]
        CLASSIFY[Freshness Classification: Fresh, Moderate, Spoiled]
        SCORE[Continuous Freshness Score: 0 - 100%]
        SPOILAGE[Spoilage Probability & Microbial Risk Assessment]
        REGRESS[Kinetic Shelf-Life Decay Curve Predictor]
    end

    subgraph Storage_Preservation["4. Results Persistence & Automation"]
        FRESH_REC[(MongoDB freshness_records Collection)]
        ENV_REC[(MongoDB storage_conditions Collection)]
        INV_UPDATE[(Update inventory.freshness_score & status)]
    end

    subgraph Actionable_Output["5. Actionable UI & Alerts"]
        DASH[Dynamic Visual Dashboard Heatmaps]
        ALERTS[Push / SMS Notification: Spoilage Imminent, Consume Within 24h]
        REC[Storage Temperature Adjustment Recommendations]
    end

    IMG --> IMG_PREP
    IOT --> SENSOR_PREP
    IMG_PREP --> CNN
    CNN --> CLASSIFY
    CNN --> SCORE
    CNN --> SPOILAGE
    SENSOR_PREP --> REGRESS
    SCORE --> REGRESS

    CLASSIFY --> INV_UPDATE
    SCORE --> FRESH_REC
    SPOILAGE --> FRESH_REC
    REGRESS --> FRESH_REC
    SENSOR_PREP --> ENV_REC

    INV_UPDATE --> DASH
    FRESH_REC --> DASH
    SPOILAGE --> ALERTS
    REGRESS --> REC
```

#### Planned Capabilities:
1. **AI Freshness Scoring**: Convolutional neural networks will assign a 0–100% quality score based on surface discoloration, bruising, and texture indicators.
2. **Spoilage Early Warning**: Fusion of ethylene gas sensors and computer vision will identify rotting before visible surface mold appears.
3. **Dynamic Shelf-Life Decay Curves**: Machine learning regressors will model remaining shelf life as a dynamic function of actual ambient storage temperature and humidity history.
4. **Automated Preservation Recommendations**: The system will recommend moving items between pantry, refrigeration, or freezer to maximize lifespan.
