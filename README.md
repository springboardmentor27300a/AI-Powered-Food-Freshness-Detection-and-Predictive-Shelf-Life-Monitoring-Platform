FoodCare – AI-Powered Food Freshness Monitoring Platform

🌐 **Live Website:** [https://foodcare-frontend-2p8v.onrender.com/](https://foodcare-frontend.onrender.com)

🔗 **Backend API:** [https://foodcare-backend-9q9r.onrender.com/](https://foodcare-backend-9q9r.onrender.com)

📘 **API Documentation:** [https://foodcare-backend-9q9r.onrender.com/docs](https://foodcare-backend-9q9r.onrender.com)

---

## 📌 Project Overview

FoodCare is an AI-powered food freshness monitoring platform developed to support food quality management, shelf-life estimation, storage monitoring, inventory management, and food waste reduction.

The platform combines food image analysis, storage monitoring, freshness scoring, shelf-life estimation, recommendations, notifications, analytics, and reporting into a unified web application.

FoodCare provides an integrated workflow from food registration and batch management to freshness assessment, decision support, reporting, and cloud deployment.

---

## 🎯 Objectives

- Develop a centralized platform for food item and batch management.
- Provide image-based food freshness and quality assessment.
- Monitor storage conditions such as temperature and humidity.
- Estimate remaining shelf life and identify quality risks.
- Calculate an overall freshness score using multiple factors.
- Support FIFO-based inventory management.
- Provide recommendations for food handling, consumption, and waste reduction.
- Generate freshness, shelf-life, inventory, waste, and storage reports.
- Provide notifications and alerts for important food-quality events.
- Deploy the application using Docker and cloud infrastructure.

---

## ✨ Key Features

### 🔐 Authentication & Role-Based Access Control

FoodCare provides secure authentication and role-based access control for different users.

Supported roles:

- Administrator
- Retail Manager
- Warehouse Operator
- Food Quality Inspector
- Consumer

Each role has access to features according to its responsibilities.

### 📦 Food & Batch Management

Users can:

- Register food items
- Create and manage batches
- Store product and category information
- Track quantity and availability
- Record expiry information
- Monitor batch status

Batch information is used across inventory, freshness, shelf-life, and reporting workflows.

### 🔄 FIFO Inventory Management

FoodCare supports **First-In, First-Out (FIFO)** inventory management.

The system helps prioritize older batches before newer batches and provides inventory monitoring for:

- Stock levels
- Batch tracking
- Expiry information
- Low-stock conditions
- Inventory quality

### 🖼️ Food Image Analysis

Users can upload food images for visual quality analysis.

The image-analysis pipeline considers visible characteristics such as:

- Color condition
- Texture
- Surface appearance
- Visible spoilage indicators
- Physical damage
- Bruising and degradation

The platform integrates computer-vision processing using **OpenCV** together with a CNN-based analysis pipeline.

> A validated final CNN accuracy is not reported because a final trained model artifact and benchmark result were not available for this implementation.

### 🥬 Freshness Assessment

Food quality is classified into the following categories:

- **Fresh**
- **Good**
- **Acceptable**
- **Near Spoilage**
- **Spoiled**

Freshness assessment combines available visual, storage, shelf-life, and product-age information.

### ⏳ Shelf-Life Estimation

FoodCare provides remaining shelf-life estimation for food batches.

The system provides:

- Estimated remaining shelf life
- Expiry-related information
- Risk indication
- Shelf-life reports
- PDF, CSV, and Excel exports

### 🌡️ Storage Monitoring

The platform records environmental storage information including:

- Temperature
- Humidity
- Storage location
- Compliance status
- Recorded time

Storage information can be used together with freshness and shelf-life information for quality assessment and decision support.

### 📊 Freshness Scoring Model

FoodCare uses a weighted freshness scoring model:

| Factor | Weight |
|---|---:|
| Visual Condition | 40% |
| Storage Condition | 25% |
| Shelf-Life | 20% |
| Product Age | 15% |

text
Freshness Score =
    Visual Condition × 40%
  + Storage Condition × 25%
  + Shelf-Life × 20%
  + Product Age × 15%

This model combines multiple quality factors instead of relying only on expiry information or image appearance.

###💡 Recommendations

The platform provides recommendations related to:

Storage
Consumption
Inventory rotation
Food-quality improvement
Waste reduction

These recommendations help users take appropriate action based on available food-quality information.

🔔 Notifications & Alerts

FoodCare provides notifications for:

Freshness alerts
Shelf-life warnings
Spoilage risks
Storage-condition alerts
Inventory alerts
Platform notifications

Users can view unread notifications and mark notifications as read.

📈 Dashboard & Analytics

The dashboard provides an overview of important platform information, including:

Inventory summary
Food categories
Expiry and stock information
Freshness distribution
Average freshness score
Storage compliance
Average temperature
Average humidity
Expiry and waste risk
Platform-level information for administrators
📑 Reports & Data Export

FoodCare provides reports for:

Freshness
Shelf life
Inventory quality
Waste reduction
Storage compliance

Reports can be exported in:

PDF
CSV
Excel
🏗️ System Architecture
                         ┌─────────────────────┐
                         │    Users / Roles    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   React Frontend    │
                         │       Vite          │
                         └──────────┬──────────┘
                                    │ REST API
                                    ▼
                         ┌─────────────────────┐
                         │   FastAPI Backend   │
                         │    JWT + RBAC       │
                         └──────────┬──────────┘
                                    │
             ┌──────────────────────┼──────────────────────┐
             │                      │                      │
             ▼                      ▼                      ▼
    ┌────────────────┐    ┌─────────────────┐    ┌─────────────────┐
    │ Image Analysis │    │ Shelf-Life &    │    │ Analytics &     │
    │ OpenCV / CNN   │    │ Freshness       │    │ Reporting       │
    └────────────────┘    └─────────────────┘    └─────────────────┘
             │                      │                      │
             └──────────────────────┼──────────────────────┘
                                    ▼
                         ┌─────────────────────┐
                         │    PostgreSQL DB    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ Docker / Render     │
                         │ Cloud Deployment    │
                         └─────────────────────┘
🔄 Main Workflow
User Login
    ↓
Food Item Registration
    ↓
Batch Creation
    ↓
Inventory / FIFO Tracking
    ↓
Storage Monitoring
    ↓
Food Image Upload
    ↓
Visual Food Analysis
    ↓
Freshness Assessment
    ↓
Shelf-Life Estimation
    ↓
Freshness Score
    ↓
Recommendations & Alerts
    ↓
Dashboard & Analytics
    ↓
Reports & Export
🧮 Freshness Scoring Formula
Freshness Score =
    Visual Condition × 40%
  + Storage Condition × 25%
  + Shelf-Life × 20%
  + Product Age × 15%
🛠️ Technology Stack
Frontend
React
Vite
JavaScript
HTML
CSS
Backend
Python
FastAPI
SQLAlchemy
Pydantic
JWT Authentication
Database
PostgreSQL
AI & Computer Vision
Python
OpenCV
CNN-based analysis pipeline
NumPy
Pandas
Scikit-learn
Reporting
ReportLab
OpenPyXL
CSV
Testing
Pytest
HTTPX
Deployment
Docker
Docker Compose
Render
Version Control
Git
GitHub
🗂️ Project Structure
FoodCare-AI-Freshness-Monitoring/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── main.py
│   │   └── database.py
│   │
│   ├── tests/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── alembic.ini
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   └── App.jsx
│   │
│   ├── public/
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
├── .gitignore
└── README.md
🗄️ Database

FoodCare uses PostgreSQL for persistent application data.

Major entities include:

Users
Food Items
Batches
Food Images
Visual Analysis Results
CNN Predictions
Freshness Analyses
Freshness Reports
Shelf-Life Predictions
Storage Readings
Recommendations
Notifications

SQLAlchemy is used for database interaction and Alembic is used for database migrations.

🔌 Backend API

The backend is implemented using FastAPI and provides REST APIs for:

Authentication
Users and roles
Food items
Batches
Inventory
Image analysis
Freshness
Shelf life
Storage monitoring
Recommendations
Notifications
Analytics
Reports
Waste reduction
API Documentation

https://foodcare-backend-9q9r.onrender.com/docs

🧪 Testing & Validation

Automated backend tests were implemented using Pytest.

The test suite covers:

Health check
Authentication
Food item operations
Batch operations
Test Result

11 tests passed successfully.

Additional API and end-to-end workflow validation was performed during development.

🐳 Docker

FoodCare includes Docker configuration for the frontend and backend.

Main Docker files:

docker-compose.yml
backend/Dockerfile
frontend/Dockerfile

Docker Compose provides a convenient way to run the application components together.

☁️ Cloud Deployment

FoodCare is deployed using Render.

Frontend

React/Vite application deployed as a Render Static Site.

Backend

FastAPI application deployed as a Render Web Service.

Database

PostgreSQL database hosted through Render.

Live Application

🌐 https://foodcare-frontend.onrender.com

Backend

🔗 https://foodcare-backend-9q9r.onrender.com


The free cloud service may take some time to respond when waking from inactivity.

🔒 Security

The platform includes:

JWT-based authentication
Password hashing
Role-based access control
Protected API endpoints
Environment-based configuration
CORS configuration
Secrets excluded from source control

Sensitive credentials and environment variables are not stored directly in the repository.

📊 Project Outcomes

FoodCare provides an integrated workflow for:

Food inventory management
FIFO stock rotation
Food image analysis
Freshness assessment
Shelf-life estimation
Storage monitoring
Freshness scoring
Recommendations
Notifications
Analytics
Reporting
PDF/CSV/Excel export
Docker-based deployment
Cloud-hosted access

The project demonstrates the integration of computer vision, backend APIs, database systems, analytics, reporting, and cloud deployment for a practical food-quality monitoring application.

🚀 Future Enhancements
Train and benchmark a dedicated food-freshness CNN using a larger validated dataset.
Improve image-based spoilage detection.
Add real-time IoT sensor integration.
Improve shelf-life prediction using larger historical datasets.
Add advanced predictive analytics.
Integrate automated sensor alerts.
Add multilingual support.
Improve mobile responsiveness.
Develop dedicated mobile application support.
Enhance AI-based recommendations.
👩‍💻 Developer

Afiya Babarchi

Internship: Infosys Springboard

📚 Project Context

This project was developed as part of the Infosys Springboard Internship and follows the requirements of the AI-Powered Food Freshness Monitoring Platform project.

📄 License

This project was developed for academic and internship purposes.]
