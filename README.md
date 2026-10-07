# 🥬 FreshSense AI — Food Freshness Monitoring Platform

> An AI-powered platform that uses image analysis, environmental data, and storage information to estimate food freshness, predict shelf life, detect spoilage, and generate smart storage recommendations.

---

## 📌 Week 1 — What Was Built

### ✅ 1. Project Foundation & Architecture
- Set up **FastAPI** backend with modular router structure (`auth`, `inventory`, `admin`)
- Configured **MongoDB Atlas** as primary cloud database
- Bootstrapped **React + Vite** frontend with UX-4G component library integration
- Defined environment-variable-driven config via **Pydantic Settings** (`.env` file)

---

### ✅ 2. User Authentication System
- **Registration** endpoint: accepts `name`, `email`, `password`, `role`
- **Login** endpoint: returns JWT access token (HS256, configurable expiry)
- **Password hashing** using `bcrypt` via `passlib`
- **JWT middleware** for protecting private routes

**How:** FastAPI `APIRouter` with dependency injection; `python-jose` for JWT encoding/decoding.

---

### ✅ 3. Email OTP Verification
- On registration, a **6-digit OTP** is generated and stored in MongoDB (`email_verifications` collection) with a **5-minute TTL**
- OTP is dispatched via **Gmail SMTP** (`smtplib` + `starttls`) using a real App Password
- User must verify the OTP before their account is fully activated
- Frontend provides a dedicated **OTP input screen** with resend support

**How:** `smtplib.SMTP` with `starttls()` on port 587; HTML-formatted email template with branded styling.

---

### ✅ 4. Role-Based Access Control (RBAC)
| Role | Permissions |
|------|------------|
| `admin` | Full access — manage users, inventory, reports |
| `retail_manager` | Manage inventory items for their store |
| `warehouse_operator` | View & update storage/freshness records |
| `food_quality_inspector` | Inspect & flag freshness assessments |
| `consumer` | View own food items & freshness scores |

**How:** FastAPI `Depends()` injected role-check functions; JWT payload carries `role` claim; each router validates role before executing business logic.

---

### ✅ 5. Inventory Management Endpoints
- `POST /inventory/` — Add a new food batch (role-gated)
- `GET /inventory/` — List food batches (filtered by role)
- `GET /inventory/{id}` — Fetch single batch
- `PUT /inventory/{id}` — Update freshness/storage info
- `DELETE /inventory/{id}` — Admin-only soft delete

---

### ✅ 6. Creative Landing Page & UI
- Animated **AI Freshness Scanner Simulator** with CSS laser-scan effect
- Dark-theme glassmorphism design with gradient accents (`#10b981` green palette)
- Smooth **framer-style CSS transitions** and hover micro-animations
- Fully responsive layout using UX-4G component primitives
- **Sign Up / Login** flow with OTP verification modal — no unauthenticated access to dashboards

---

## 🔄 Food Inventory Workflow

```
User Registers ──► OTP Email Sent ──► OTP Verified ──► Account Active
        │
        ▼
     Login ──► JWT Issued ──► Role Assigned
        │
        ▼
  Inventory Dashboard
        │
   ┌────┴────┐
   ▼         ▼
Add Batch  View Batches
   │              │
   ▼              ▼
Freshness    Spoilage Flag
Assessment   & Alert
   │
   ▼
Storage Recommendation
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python 3.11) |
| Database | MongoDB Atlas |
| Auth | JWT (python-jose) + bcrypt |
| Email | Gmail SMTP (smtplib, starttls) |
| Frontend | React 18 + Vite |
| UI Library | UX-4G Web Components |
| Hosting | Local dev (Uvicorn + Vite) |

---

## 🚀 Local Setup

```bash
# Backend
cd Backend
pip install -r requirements.txt
# Fill in your .env (see .env.example)
uvicorn app.main:app --reload --port 8000

# Frontend
cd Frontend
npm install
npm run dev   # Starts on http://localhost:3000
```

### Required `.env` Variables
```env
MONGODB_URL=<your_atlas_uri>
SECRET_KEY=<jwt_secret>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<gmail_address>
SMTP_PASSWORD=<gmail_app_password>
EMAILS_FROM_EMAIL=<from_address>
EMAILS_FROM_NAME=FreshSense AI
```

---
## 📌 Milestone 2 (Week 3–4) — Image Analysis & Freshness Assessment
- **Computer Vision Engine**: Visual defect identification (mold spots, surface bruising, epidermal skin breakdown) with coordinate bounding boxes.
- **Biochemical Color & Texture Decomposition**: Chlorophyll vitality vs browning oxidation index extraction; surface firmness estimation.
- **Consumer Freshness Scanner**: Interactive image upload, live camera feed, dataset presets, and instant safety verdicts (Safe to Consume, Consume Soon, Cook Only, Quarantine).

---

## 📌 Milestone 3 (Week 5–6) — Shelf-Life Prediction & Recommendations

### ✅ 1. Arrhenius & $Q_{10}$ Bio-Kinetic Shelf-Life Prediction
- Exponential temperature deterioration model based on category-specific $Q_{10}$ coefficients ($2.0 \le Q_{10} \le 2.8$).
- Multi-variable kinetic solver incorporating relative humidity transpirational stress, barrier packaging factors (MAP, Vacuum, Perforated), and positive-pressure airflow ventilation.
- 30-day day-by-day projected degradation curve generation with dual trace comparison (Current Storage vs Optimal Cold Chain).
- Endpoints: `POST /api/prediction/shelf-life`, `POST /api/prediction/simulate-conditions`, `GET /api/prediction/batch/{id}`.

### ✅ 2. Cold Storage Telemetry & Compliance Monitoring
- Real-time environmental monitoring across warehouse microclimate vaults (`ZONE-WH01-A`, `ZONE-WH01-B`, `ZONE-WH02-A`, `ZONE-WH03-A`).
- 24-hour historical telemetry tracking (hourly probe sampling) for temperature, relative humidity, and airflow CFM.
- Automated excursion detection flagging cold-chain violations with root cause diagnoses and 1-click remediation.
- Endpoints: `GET /api/storage/zones`, `GET /api/storage/telemetry/{id}`, `GET /api/storage/alerts`, `POST /api/storage/alerts/{id}/resolve`.

### ✅ 3. Recommendation & FEFO Rotation Engine
- **First-Expiry-First-Out (FEFO) Dispatch Queue**: Dynamically sorts active lots by shortest remaining days, prioritizing critical lots for front-shelf display.
- **Dynamic Markdown Pricing**: Automated markdown discount suggestions (-15%, -40%, -70%) to accelerate sell-through and prevent landfill write-offs.
- **Biological Ethylene Co-Location Matrix**: Enforces strict segregation between high ethylene emitters (Apples, Melons, Bananas) and sensitive produce (Leafy Greens, Carrots).
- Endpoints: `GET /api/recommendations/fefo-queue`, `GET /api/recommendations/markdowns`, `GET /api/recommendations/storage-matrix`, `GET /api/recommendations/overview`.

### ✅ 4. Freshness Analytics & Executive Dashboards
- Executive metrics: Total produce monitored, Economic Value at Risk ($), Landfill Waste Diverted ($ and kg), and Storage Network Compliance (%).
- 7-day category freshness degradation curves comparing Fruits, Vegetables, Dairy, and Meat.
- Shelf-life risk segmentation bars and category-by-category quality health matrix.
- Linear-aesthetic workspace: `FreshnessAnalyticsHub.jsx` with interactive SVG charts.

---

## 📁 Project Structure

```
FreshSense AI/
├── Backend/
│   ├── app/
│   │   ├── core/        # config, security, email
│   │   ├── models/      # Pydantic schemas (Milestone 1, 2, 3)
│   │   ├── routers/     # auth, inventory, prediction, storage, recommendations, analytics, reports
│   │   └── main.py
│   ├── .env
│   └── requirements.txt
├── Frontend/
│   ├── src/
│   │   ├── components/  # FreshnessAnalyticsHub, Warehouse, Retail, Consumer, Admin
│   │   ├── index.css    # Linear / Modern Design System
│   │   └── App.jsx
│   ├── Dockerfile       # Multi-stage Nginx production build (M4)
│   ├── nginx.conf       # SPA routing + API proxy config (M4)
│   └── package.json
├── docker-compose.yml                           # Full-stack deployment (M4)
├── azure-deploy.yml                             # Azure Container Apps manifest (M4)
├── .env.example                                 # Environment variables template (M4)
├── Food_Freshness_Monitoring_Platform_PRD.md
├── Milestone1_Documentation_and_Datasets.md
├── Milestone3_Documentation.md
├── Milestone4_Documentation.md                  # Analytics, Testing & Deployment (M4)
└── README.md
```

---

## 🚀 Milestone 4 — Deployment

### Local Docker Deployment

```bash
# 1. Copy environment template
cp .env.example .env
# 2. Fill in your MongoDB Atlas URL and Secret Key in .env

# 3. Build and start all containers
docker-compose up --build -d

# 4. Access the platform
# Frontend: http://localhost
# API docs: http://localhost:8000/docs
```

### Azure Container Apps Deployment

```bash
az login
az group create --name freshsense-rg --location eastus
az acr create --resource-group freshsense-rg --name freshsenseacr --sku Basic
az acr build --registry freshsenseacr --image freshsense-backend:latest ./Backend
az acr build --registry freshsenseacr --image freshsense-frontend:latest ./Frontend
# See azure-deploy.yml for full Container Apps configuration
```

### E2E Validation

```bash
cd Backend
python test_milestone4_e2e.py
# Expected: ALL 14 MILESTONE 4 WORKFLOW VALIDATION TESTS PASSED
```

---

*Milestone 4 (Week 7–8): Analytics, Testing & Deployment — **PRODUCTION READY** 🚀*
