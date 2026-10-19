# 🥗 Food Freshness Monitoring Platform

An AI-powered web application designed to monitor food freshness, estimate shelf life, manage inventory, monitor storage conditions, and help reduce food waste.

**Live Demo:** https://food-freshness-frontend-a337.onrender.com/

**Backend API:** https://food-freshness-backend-r79i.onrender.com/

**API Documentation:** https://food-freshness-backend-r79i.onrender.com/docs

---

## 📌 Project Overview

The Food Freshness Monitoring Platform combines machine learning, inventory management, shelf-life estimation, and storage monitoring to help users make better food-handling decisions.

The platform analyzes uploaded food images to classify freshness, estimates remaining shelf life using configured parameters, and helps users manage food items based on freshness, expiry dates, inventory, and storage conditions.

## ❗ Problem Statement

Food spoilage and inefficient inventory management can lead to food waste, financial losses, and potential food safety risks. Manual freshness assessment can also be time-consuming, while poor tracking of expiry dates and storage conditions may cause food items to be overlooked.

This project aims to provide a centralized platform for AI-assisted freshness assessment and food inventory monitoring.

## 🎯 Objectives

- Analyze food images using machine learning.
- Estimate the remaining shelf life of food items.
- Maintain food inventory and batch records.
- Identify items nearing expiry or requiring inspection.
- Support storage-condition monitoring.
- Generate food-analysis reports.
- Help reduce avoidable food waste through better inventory decisions.

## ✨ Key Features

### 1. AI-Based Freshness Analysis

Analyzes uploaded food images using a trained machine learning model to classify food into four categories: Fresh, Half Fresh, Rotten, and Spoiled. The results help users understand the visible condition of food and identify items that may need attention.

### 2. Food Inventory Management

Allows users to maintain food item and batch records, track available stock, and monitor freshness information. This helps organize inventory and identify items that should be used or sold first.

### 3. Shelf-Life Estimation

Estimates the remaining shelf life of food based on configured parameters such as food category, freshness score, temperature, humidity, and packaging conditions. This helps users identify items that may require priority handling.

### 4. Recommendations

Provides actionable suggestions based on available freshness, expiry, inventory, and storage information. It helps users prioritize items nearing expiry, identify food that needs inspection, and make better use-first or sell-first decisions.

### 5. Storage Monitoring

Supports monitoring of storage locations and environmental conditions, such as temperature and humidity where implemented. This helps users identify unsuitable storage conditions and maintain appropriate environments for different food categories.

### 6. Freshness Analytics and Dashboard

Presents food freshness and inventory information through an organized dashboard. Users can review freshness statuses, understand inventory conditions, and monitor available analysis results according to their roles.

### 7. Reports

Stores supported food-analysis records and allows users to retrieve reports through the application. These reports help users review previous analyses and track food freshness information.

### 8. Authentication and Role-Based Access

Provides user registration and login with JWT-based authentication and password hashing. Different user roles support access to relevant dashboards and functionality according to the application's configured permissions.

## 👥 User Roles

| Role | Description |
|---|---|
| **Consumer** | Can access relevant food freshness information to better understand the condition of food and make informed handling decisions. |
| **Retail Manager** | Can monitor food inventory, review freshness and expiry information, and prioritize stock that needs to be sold or handled first. |
| **Warehouse Operator** | Supports food-batch management and storage monitoring to help maintain suitable storage conditions and track inventory. |
| **Food Quality Inspector** | Can review freshness-analysis results and available reports to help identify food items that may require quality inspection. |
| **Administrator** | Supports administrative activities and user management according to the permissions provided by the application. |

*Note: The exact features available to each role depend on the application's implemented permissions and access controls.*

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| Frontend | React.js, Vite, JavaScript, CSS |
| Backend | Python, FastAPI |
| Database | PostgreSQL, SQLAlchemy |
| Machine Learning | TensorFlow, Keras |
| Authentication | JWT and password hashing |
| API Documentation | FastAPI / Swagger UI |
| Version Control | Git and GitHub |
| Deployment | Render |

## 🏗️ System Architecture

The application follows a frontend-backend-database architecture.

```text
                    USER
                      |
                      v
             React + Vite Frontend
                      |
                HTTP / REST API
                      |
                      v
                FastAPI Backend
                 /      |      \
                v       v       v
          PostgreSQL  ML Model  Business Logic
           Database   Analysis  Shelf-Life and
                                Inventory Rules
                 \      |      /
                  v     v     v
               Results and Reports
                      |
                      v
               Frontend Dashboard
```

### Workflow

1. The user registers or logs in.
2. The frontend communicates with the backend API.
3. The backend validates requests and processes application logic.
4. Food-image analysis uses the configured machine learning pipeline.
5. Inventory and report information is stored or retrieved from PostgreSQL where applicable.
6. Results are returned to the frontend for display.

## 🤖 Machine Learning Model

The project includes a Keras model for food freshness classification.

- **Model:** `Datasets/models/food_freshness_model.keras`
- **Class labels:** `Datasets/models/class_names.txt`
- **Analysis script:** `Datasets/analyze_food.py`

The configured class labels are:

- `fresh`
- `half_fresh`
- `rotten`
- `spoiled`

The backend uses the configured image-analysis pipeline to process food images and return supported classification results.

*Important: Freshness classification is an estimate and does not guarantee that food is safe to consume.*

## 📁 Project Structure

```text
Food-Freshness-Monitoring-Infosys/
│
├── backend-Infosys-FF/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── auth.py
│   ├── shelf_life.py
│   ├── recommendations.py
│   ├── feature_routes.py
│   ├── migration.sql
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── Datasets/
│   ├── analyze_food.py
│   └── models/
│       ├── food_freshness_model.keras
│       └── class_names.txt
│
├── models/
├── src/
├── dashboards/
├── test_images/
├── render.yaml
├── DEPLOYMENT.md
└── README.md
```

This is a high-level overview; the actual repository may contain additional files.

## ⚙️ Installation and Setup

### Prerequisites

- Python 3.11
- Node.js and npm
- PostgreSQL
- Git
- Visual Studio Code or another code editor

### Step 1: Clone the Repository

```bash
git clone -b Tusheet https://github.com/springboardmentor27300a/AI-Powered-Food-Freshness-Detection-and-Predictive-Shelf-Life-Monitoring-Platform.git
cd AI-Powered-Food-Freshness-Detection-and-Predictive-Shelf-Life-Monitoring-Platform
```

Replace the placeholder with your actual GitHub repository URL.

### Step 2: Set Up the Backend

Open a terminal in the project root:

```bash
cd backend-Infosys-FF
py -3.11 -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

If PowerShell blocks virtual-environment activation, use Command Prompt or activate the environment using the appropriate command for your terminal.

### Step 3: Configure the Database

Create a local PostgreSQL database:

```sql
CREATE DATABASE food_freshness_db;
```

Configure the database connection in the backend `.env` file using the variable expected by the application.

### Step 4: Start the Backend

From the `backend-Infosys-FF` directory:

```bash
uvicorn main:app --reload
```

Backend URL: http://127.0.0.1:8000

Local API documentation: http://127.0.0.1:8000/docs

### Step 5: Start the Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite, usually:

http://localhost:5173

Ensure that the frontend API configuration points to the correct backend URL.

## 🔌 Main API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Register a new user. |
| POST | `/auth/login` | Authenticate a user. |
| GET | `/auth/me` | Retrieve authenticated user information. |
| GET | `/analysis/reports` | Retrieve analysis reports. |
| GET | `/analysis/my-reports` | Retrieve the authenticated user's reports. |

Additional endpoints support inventory, batches, shelf-life estimation, and other features where implemented.

For the complete endpoint list, visit the [Live API Documentation](https://food-freshness-backend-r79i.onrender.com/docs).

## 🗄️ Database

The platform uses PostgreSQL to store structured application information, with SQLAlchemy for database operations.

Depending on the enabled features, records may include:

- User and authentication information.
- Food items and inventory batches.
- Freshness-analysis results.
- Analysis reports.
- Storage-related information.

The actual schema is defined by the backend models and database migrations.

## ☁️ Deployment

The application is deployed on Render.

- **Frontend:** https://food-freshness-frontend-a337.onrender.com/
- **Backend:** https://food-freshness-backend-r79i.onrender.com/
- **API Documentation:** https://food-freshness-backend-r79i.onrender.com/docs
- **Deployment configuration:** `render.yaml`

The `render.yaml` file describes the frontend and backend deployment configuration. Environment variables and production credentials should be configured securely through the deployment platform.

## 🎯 Conclusion

The Food Freshness Monitoring Platform combines AI-based image analysis, shelf-life estimation, inventory management, and storage monitoring to support better food-handling decisions. It aims to make food management more organized and efficient while helping reduce avoidable food waste.
