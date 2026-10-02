# 🥑 Food Freshness Monitoring Platform

> **AI-Powered Multi-Factor Quality & Shelf-Life Platform**  
> Built as part of the Infosys Springboard Internship Project.

**🌐 Live Demo:** [http://3.26.74.160](http://3.26.74.160)

---

## 📸 Overview

The Food Freshness Monitoring Platform is a full-stack web application that uses computer vision and machine learning to analyze the freshness of food items from photos. It provides role-based dashboards for consumers, retail managers, warehouse operators, food inspectors, and administrators.

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python, FastAPI, SQLAlchemy, PostgreSQL |
| **Frontend** | React (Vite), CSS |
| **AI / CV** | TensorFlow-CPU, MobileNetV2, OpenCV |
| **Auth** | JWT (python-jose), bcrypt |
| **Deployment** | AWS EC2, Docker, Docker Compose |
| **CI/CD** | GitHub Actions |
| **IaC** | Terraform |

---

## ✨ Key Features

### 🔬 Section 4.7 — Weighted AI Freshness Scoring Engine
Combines four factors into a comprehensive 0–100 Quality Score:
- **Visual Condition (40%)** — MobileNetV2 CNN image classification
- **Storage Conditions (25%)** — Temperature, humidity, packaging analysis
- **Shelf-Life Prediction (20%)** — Expiry-date-based remaining life estimate
- **Product Age (15%)** — Days since registration decay factor

### 🧠 Computer Vision Analysis
- Color degradation detection
- Mold spot anomaly detection
- Surface bruising & texture variance analysis
- 5-tier classification: `Fresh` → `Good` → `Acceptable` → `Near Spoilage` → `Spoiled`
- Risk level assessment: `Low Risk` / `Medium Risk` / `High Risk`

### 👥 Role-Based Access Control (RBAC)
| Role | Access |
|---|---|
| **Consumer** | Own inventory only |
| **Retail Manager** | Global inventory + Waste reduction insights |
| **Warehouse Operator** | Global inventory + Compliance analytics |
| **Food Inspector** | Global inventory + Audit mode |
| **Admin** | Full access + User management + Performance metrics |

### 📊 Analytics & Reporting
- Historical freshness scan log with filters (Waste, Compliance, Category)
- Per-item trend bar charts
- AI-powered recommendations (Storage, Consumption, Waste Reduction)
- Excel export of full freshness reports
- Printable single-page Executive PDF Quality Certificate
- Expiry date tracking with color-coded badges

### 🔔 Notifications & Storage Logging
- In-app alerts for expiring and spoiled items
- Storage condition logging (temperature, humidity, air circulation, light exposure)

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│                    AWS EC2 (t3.micro)                │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  Nginx      │  │  FastAPI     │  │ PostgreSQL │  │
│  │  (React)    │  │  Backend     │  │    DB      │  │
│  │  Port 80    │  │  Port 8000   │  │  Port 5432 │  │
│  └─────────────┘  └──────────────┘  └────────────┘  │
│         └────────────── Docker Compose ──────────────┘
└──────────────────────────────────────────────────────┘
```

---

## 🧪 Testing

**23/23 tests passing** ✅

```bash
cd food-freshness-backend
pytest test_main.py -v
```

Test coverage includes:
- Authentication (register, login, token validation)
- Food CRUD operations
- Role-based access control
- Analytics endpoints
- Notification generation

---

## 🐳 Running with Docker (Recommended)

```bash
git clone https://github.com/dee-5/food-freshness-monitoring-platform.git
cd food-freshness-monitoring-platform
docker compose up -d --build
```

- Frontend: [http://localhost](http://localhost)
- Backend API: [http://localhost:8000](http://localhost:8000)
- API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 💻 Running Locally (Development)

### Backend
```bash
cd food-freshness-backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd food-freshness-frontend
npm install
npm run dev
```

- Backend: `http://127.0.0.1:8000`
- Frontend: `http://localhost:5173`
- API Docs: `http://127.0.0.1:8000/docs`

---

## 📁 Project Structure

```
food-freshness-monitoring-platform/
├── food-freshness-backend/
│   ├── main.py              # FastAPI app + all endpoints
│   ├── test_main.py         # Pytest test suite (23 tests)
│   ├── requirements.txt
│   └── Dockerfile
├── food-freshness-frontend/
│   ├── src/
│   │   └── App.jsx          # Main React application
│   └── Dockerfile
├── terraform/
│   ├── main.tf              # AWS EC2 infrastructure
│   └── terraform.tfvars.example
├── .github/
│   └── workflows/
│       └── deploy.yml       # CI/CD pipeline
├── docker-compose.yml
└── README.md
```

---

## 🌐 Deployment

The app is deployed on **AWS EC2** using Docker Compose.

**Live URL:** [http://3.26.74.160](http://3.26.74.160)

CI/CD is configured via **GitHub Actions** — pushing to `main` automatically runs tests and deploys to EC2 on success.

---

## 📄 License

Built for the **Infosys Springboard Internship Program**.