# Food Freshness Monitoring Platform — User Guide

Welcome to the **Food Freshness Monitoring Platform**! This guide covers everything you need to operate the system, fulfilling all requirements through **Module 12**.

---

## 1. Getting Started

### 1.1 Local Development Mode (No Docker)
If you do not have Docker installed, you can start the platform directly from your terminal.

**1. Start the Backend API (FastAPI):**
```powershell
cd "c:\Users\arunk\Desktop\food-freshness-monitoring-platform\food-freshness-backend"
uvicorn main:app --reload --port 8000
```
*The API will be available at http://localhost:8000. You can view the automated Swagger Documentation at http://localhost:8000/docs.*

**2. Start the Frontend UI (React):**
Open a new PowerShell window and run:
```powershell
cd "c:\Users\arunk\Desktop\food-freshness-monitoring-platform\food-freshness-frontend"
npm run dev
```
*The User Interface will be available at http://localhost:5173.*

### 1.2 Production Mode (Docker)
If you have Docker Desktop installed, you can launch the containerized platform:
```powershell
cd "c:\Users\arunk\Desktop\food-freshness-monitoring-platform"
docker-compose up --build -d
```
*Wait 1-2 minutes for the containers to initialize, then open http://localhost:5173.*

---

## 2. Using the Platform Features

### 2.1 Role-Based Dashboards (Module 9)
When you log in, your view changes entirely based on your assigned role:
- **Consumer:** Shows standard freshness scans and expiration alerts.
- **Retail Manager:** Includes quick-access filters for *Shelf-Life Alerts* and *Waste Reduction Insights*.
- **Warehouse Operator:** Emphasizes batch tracking, temperature/humidity logging, and storage compliance.
- **Admin:** Displays a global system overview, total usage metrics, and a platform users table.

### 2.2 Freshness Scanning Engine (Modules 3, 4, 7)
1. Navigate to your Inventory list on the dashboard.
2. Under a food item, click **📷 Choose Food Image** to upload a photo of the produce.
3. Click **⚡ Run Section 4.7 AI Scan**.
4. The system runs both OpenCV feature extraction (color, mold, bruising) and MobileNetV2 classification to generate a comprehensive 0-100 quality score and Risk Level (Low/Medium/High).

### 2.3 Smart Notifications (Module 10)
Click the **🔔 Bell Icon** in the top navigation bar to open your Notification Center. The system automatically scans your database and generates real-time alerts for:
- 🚨 **Danger:** Items that are expired or confirmed spoiled by an AI scan.
- ⚠️ **Warning:** Items expiring within 2 days, or displaying near-spoilage characteristics.
- 📅 **Info:** Items expiring within 5 days.

### 2.4 Reports & Data Export (Module 11)
- **Single-Page PDF:** On any analyzed food item, click `📄 View Single-Page Executive PDF Report` to generate a formatted printable report.
- **Excel Historical Export:** Click the `📊 Analytics & Reports` button in the header, then click `📥 Export Excel` to download a fully formatted `.xlsx` workbook containing your entire AI scan history.

---

## 3. Platform Administration (Module 12)

### Automated Testing
Automated API and Security tests have been implemented via `pytest`. To run the test suite manually:
```powershell
cd "c:\Users\arunk\Desktop\food-freshness-monitoring-platform\food-freshness-backend"
pytest test_main.py -v
```

### Logging & Performance Monitoring
- **GZip Compression** is enabled on the backend API, reducing network payload sizes by over 60%.
- **System Logs** are automatically captured locally inside `food-freshness-backend/app.log`, containing diagnostic and startup events.
