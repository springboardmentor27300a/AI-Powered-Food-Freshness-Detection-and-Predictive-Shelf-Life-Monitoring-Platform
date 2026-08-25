# FreshSense AI: Milestone 1 Implementation, Database Schema & Dataset Guide

## 1. Milestone 1 Implementation Overview

As outlined in the **Food Freshness Monitoring Platform Product Requirements Document (PRD)**, **Milestone 1 (Week 1–2): Project Initialization, Design & Core Setup** focuses on establishing the project architecture, implementing dynamic role-based access control, deploying Cloud MongoDB database schemas, building food inventory management workflows with multi-warehouse batch tagging, and organizing AI image datasets.

### Core Achievements
1. **Dynamic Multi-Role Auth System**:
   - Web interface supporting dynamic login and registration for all 5 PRD personas: `Consumer`, `Retail Manager`, `Warehouse Operator`, `Food Quality Inspector`, `Administrator`.
   - Dynamic form fields based on role selection (e.g. warehouse selection for operators, store name for retailers, inspector badge ID, and admin key).
   - Password hashing via Passlib/Bcrypt and JWT security tokens.

2. **Cloud MongoDB Atlas Integration**:
   - Connection established with Cloud MongoDB Atlas (`freshsense_db`).
   - Document collections for `users`, `warehouses`, `categories`, `food_batches`, and `transactions`.
   - Automated startup seeding of initial multi-location cold storage warehouses (*GreenValley Central Cold Storage*, *Pacific Fresh Logistics*, *Sunshine Valley Produce Hub*) and standard product categories.

3. **Backend API Microservices (FastAPI)**:
   - `POST /api/auth/register` & `POST /api/auth/login`: Dynamic user authentication.
   - `POST /api/inventory/register-batch`: Batch registration by Warehouse Operators with Batch ID tags (`BATCH-YYYYMMDD-XXX`), harvest dates, expiry dates, temperature/humidity metrics, and visual freshness scores.
   - `GET /api/inventory/batches`: Query and filter food inventory across multi-warehouses and categories.
   - `POST /api/inventory/batches/{id}/buy`: Retail Manager procurement endpoint that atomically locks batch status to **`"Sold - Purchased by [Store Name]"`** and prevents double-buying.
   - `GET /api/analytics/dashboard`: Aggregated platform metrics and total transaction revenue.

4. **Interactive Glassmorphism Frontend**:
   - Developed using React and Vite with clean Glassmorphic CSS design tokens, dark/light theme options, real-time status badges, and role-based workspace navigation.

---

## 2. Cloud MongoDB Database Schema

```
Database: freshsense_db (MongoDB Atlas)
├── users
├── warehouses
├── categories
├── food_batches
└── transactions
```

### Collection Schemas

#### 1. `users`
```json
{
  "_id": "ObjectId",
  "name": "Alice Smith",
  "email": "alice@retailmart.com",
  "password_hash": "$2b$12$...",
  "role": "Retail Manager",
  "organization": "FreshMart Superstores #104",
  "warehouse_id": "WH-CENTRAL-01",
  "warehouse_name": "GreenValley Central Cold Storage",
  "badge_id": "INSP-99201",
  "phone": "+1 (555) 234-5678",
  "created_at": "ISODate"
}
```

#### 2. `warehouses`
```json
{
  "_id": "ObjectId",
  "name": "GreenValley Central Cold Storage",
  "code": "WH-CENTRAL-01",
  "location": "Agri Hub Sector 4, California, USA",
  "capacity_kg": 50000,
  "current_utilization_kg": 12400,
  "temperature_range_c": "2°C - 4°C",
  "humidity_range_pct": "85% - 90%",
  "created_at": "ISODate"
}
```

#### 3. `food_batches`
```json
{
  "_id": "ObjectId",
  "batch_id": "BATCH-20260825-APL01",
  "product_name": "Organic Royal Gala Apples",
  "category": "Fruits",
  "warehouse_id": "WH-CENTRAL-01",
  "warehouse_name": "GreenValley Central Cold Storage",
  "quantity_kg": 500.0,
  "initial_quantity_kg": 500.0,
  "unit_price_per_kg": 2.40,
  "harvest_date": "2026-08-20",
  "registered_date": "2026-08-25T19:50:00.000Z",
  "expiry_date": "2026-09-20",
  "freshness_score": 94,
  "freshness_status": "Fresh",
  "spoilage_indicators": ["Surface Integrity 100%", "No Bruises Detected"],
  "storage_temp_celsius": 3.2,
  "storage_humidity_percent": 87.5,
  "image_url": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6",
  "registered_by": "Operator John (WH-01)",
  "status": "Available",
  "purchased_by_user_id": null,
  "purchased_by_name": null,
  "purchased_by_store": null,
  "purchase_date": null
}
```

---

## 3. Food Freshness AI Datasets Guide

To support the computer vision freshness detection and spoilage classification planned in Milestone 2, the following primary datasets are integrated into the project pipeline:

| Dataset Name | Primary Purpose | Samples / Scope | Recommended Annotations |
|---|---|---|---|
| **Fruits Freshness Dataset (Kaggle)** | Fresh vs. Spoiled binary classification for Apples, Bananas, and Oranges | 13,500+ high-res images | Bounding boxes, spoilage probability (0-100%) |
| **Vegetable Quality & Freshness Dataset** | Leafy greens (spinach, lettuce) and root vegetables decay tracking | 8,200+ images | Surface discoloration, wilt percentage, mold spots |
| **Food-101 Multi-Class Dataset** | Broad product taxonomy and sub-category classification | 101,000 images across 101 categories | Category tags (Fruits, Vegetables, Prepared) |

### Dataset Directory Layout
```
/data
├── raw
│   ├── fruits_freshness/ (fresh_apple, spoiled_apple, fresh_banana, spoiled_banana)
│   ├── vegetable_freshness/ (fresh_spinach, wilted_spinach, fresh_tomato, spoiled_tomato)
│   └── food_101/
└── processed
    ├── train/
    ├── val/
    └── test/
```

---

## 4. Milestone 1 PPT Presentation Structure

Use this 10-slide outline for presenting Milestone 1 progress to project advisors and stakeholders:

- **Slide 1: Title & Overview**  
  *FreshSense AI: AI-Powered Food Freshness & Cold-Chain Inventory Monitoring Platform.*
- **Slide 2: Problem Statement & Value Proposition**  
  *Addressing global food waste and supply chain opacity through automated freshness scoring and batch tracking.*
- **Slide 3: High-Level System Architecture**  
  *FastAPI Async Backend Microservices + Cloud MongoDB Atlas Document Layer + React Glassmorphism Frontend.*
- **Slide 4: Role-Based User Personas**  
  *Demonstration of 5 distinct roles: Consumer, Retail Manager, Warehouse Operator, Quality Inspector, Admin.*
- **Slide 5: Food Batch & Multi-Warehouse Workflow**  
  *Batch ID tagging (`BATCH-YYYYMMDD-XXX`), harvest dates, expiry dates, temperature (°C) & humidity (%) tracking.*
- **Slide 6: Retail Procurement & Double-Buy Prevention**  
  *Real-time marketplace view, "Buy Batch" execution, instant status update to `"Sold"`, preventing double-purchases.*
- **Slide 7: Computer Vision Datasets & AI Freshness Matrix**  
  *Weighted Freshness Score Model (Visual 40%, Storage 25%, Shelf-life 20%, Age 15%) & Kaggle/Food-101 dataset layout.*
- **Slide 8: Cloud MongoDB Schema Design**  
  *Document structures for users, multi-location cold warehouses, product categories, and food item batches.*
- **Slide 9: Milestone 1 Accomplishments Demo**  
  *Live walkthrough of dynamic registration, batch entry, and retail purchase locking.*
- **Slide 10: Milestone 2 Roadmap & Next Steps**  
  *Deep Learning model training (PyTorch/YOLO) for automated mold detection and shelf-life prediction algorithms.*
