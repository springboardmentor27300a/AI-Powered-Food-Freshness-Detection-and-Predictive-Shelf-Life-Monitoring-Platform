# 🍎 Food Freshness Monitoring Platform

<p align="center">

# 🤖 AI-Powered Food Freshness, Shelf-Life & Storage Intelligence Platform

### Computer Vision • Deep Learning • Shelf-Life Prediction • Storage Intelligence • Inventory • Role-Based Dashboards • Analytics

</p>

<p align="center">

![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python)
![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?logo=postgresql)
![TensorFlow](https://img.shields.io/badge/TensorFlow-AI-FF6F00?logo=tensorflow)
![OpenCV](https://img.shields.io/badge/OpenCV-Computer%20Vision-5C3EE8?logo=opencv)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker)
![Render](https://img.shields.io/badge/Deployment-Render-46E3B7)
![License](https://img.shields.io/badge/Project-Academic%20%2F%20Portfolio-lightgrey)

</p>

---

# 🌟 Project at a Glance

The **Food Freshness Monitoring Platform** is a full-stack AI-powered web application developed to intelligently monitor and analyze food quality.

The platform combines:

- 🤖 Artificial Intelligence
- 🧠 Deep Learning
- 👁️ Computer Vision
- 🥬 Food Freshness Detection
- ⏳ Shelf-Life Prediction
- 🌡️ Storage Intelligence
- 📦 Inventory Management
- 📊 Analytics & Reports
- 🔔 Alerts & Notifications
- 👥 Role-Based Dashboards
- 💡 Recommendation Engine
- 📱 Responsive Device Support
- 🐳 Docker
- ☁️ Cloud Deployment

The platform goes beyond simply checking an expiry date.

It combines food image analysis, AI freshness prediction, visual condition, storage information, product age, expiry information and shelf-life intelligence to provide a broader understanding of food quality.

---

# 📑 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Project Vision](#3-project-vision)
4. [Project Objectives](#4-project-objectives)
5. [Complete Feature Overview](#5-complete-feature-overview)
6. [Project Development Journey](#6-project-development-journey)
7. [Milestone 1 - Core Platform](#7-milestone-1---core-platform)
8. [Milestone 2 - Platform Expansion](#8-milestone-2---platform-expansion)
9. [Milestone 3 - AI Food Intelligence](#9-milestone-3---ai-food-intelligence)
10. [Milestone 4 - Deployment](#10-milestone-4---deployment)
11. [Public Home Page](#11-public-home-page)
12. [Authentication System](#12-authentication-system)
13. [Role-Based Access Control](#13-role-based-access-control)
14. [Consumer Dashboard](#14-consumer-dashboard)
15. [Retail Manager Dashboard](#15-retail-manager-dashboard)
16. [Warehouse Operator Dashboard](#16-warehouse-operator-dashboard)
17. [Food Quality Inspector Dashboard](#17-food-quality-inspector-dashboard)
18. [Administrator Dashboard](#18-administrator-dashboard)
19. [Food Inventory Management](#19-food-inventory-management)
20. [Food Image Upload](#20-food-image-upload)
21. [AI Freshness Prediction](#21-ai-freshness-prediction)
22. [Computer Vision Analysis](#22-computer-vision-analysis)
23. [Freshness Scoring](#23-freshness-scoring)
24. [Storage Intelligence](#24-storage-intelligence)
25. [Shelf-Life Intelligence](#25-shelf-life-intelligence)
26. [Product Age Analysis](#26-product-age-analysis)
27. [Overall Food Health Score](#27-overall-food-health-score)
28. [Recommendation Engine](#28-recommendation-engine)
29. [Alerts & Notifications](#29-alerts--notifications)
30. [Reports & Analytics](#30-reports--analytics)
31. [PDF & Excel Export](#31-pdf--excel-export)
32. [Profile System](#32-profile-system)
33. [Responsive Device Compatibility](#33-responsive-device-compatibility)
34. [Complete AI Processing Flow](#34-complete-ai-processing-flow)
35. [System Architecture](#35-system-architecture)
36. [Technology Stack](#36-technology-stack)
37. [Backend Architecture](#37-backend-architecture)
38. [Frontend Architecture](#38-frontend-architecture)
39. [Database Architecture](#39-database-architecture)
40. [API Endpoints](#40-api-endpoints)
41. [Project Folder Structure](#41-project-folder-structure)
42. [Local Installation](#42-local-installation)
43. [Backend Setup](#43-backend-setup)
44. [Frontend Setup](#44-frontend-setup)
45. [Environment Variables](#45-environment-variables)
46. [Running the Application](#46-running-the-application)
47. [Docker Support](#47-docker-support)
48. [Production Deployment](#48-production-deployment)
49. [GitHub Development Workflow](#49-github-development-workflow)
50. [Security](#50-security)
51. [Testing Checklist](#51-testing-checklist)
52. [Current Limitations](#52-current-limitations)
53. [Future Enhancements](#53-future-enhancements)
54. [Complete User Journey](#54-complete-user-journey)
55. [Project Benefits](#55-project-benefits)
56. [Project Status](#56-project-status)
57. [Author](#57-author)

---

# 1. Project Overview

The **Food Freshness Monitoring Platform** is an AI-powered full-stack web application designed to monitor food freshness and quality.

Traditional food monitoring generally depends on:

- Manual inspection
- Printed expiry dates
- Human judgment
- Basic storage information

However, the actual condition of food can be influenced by many factors.

For example:

- Storage temperature can affect quality.
- Humidity can influence deterioration.
- Packaging can influence protection.
- Product age can affect remaining life.
- Physical damage can accelerate spoilage.
- Visible color and texture changes can indicate deterioration.

Therefore, this project combines multiple food-quality signals into one platform.

## Core Intelligence

```text
Food Image
    ↓
AI Freshness Prediction
    ↓
Computer Vision Analysis
    ↓
Storage Intelligence
    ↓
Shelf-Life Prediction
    ↓
Product Age Analysis
    ↓
Overall Health Score
    ↓
Risk Analysis
    ↓
Recommendations

2. Problem Statement
Food wastage is a major practical problem.
Food may become unusable because of:
- Poor storage
- Incorrect temperature
- Incorrect humidity
- Poor packaging
- Long storage duration
- Physical damage
- Visible spoilage
- Mold
- Bruising
- Product ageing
- Poor inventory rotation
A printed expiry date alone does not provide a complete picture of the current food condition.
For example:
Product
   ↓
Expiry Date is still valid
   ↓
But storage condition is poor
   ↓
Quality may deteriorate faster

Another product may have:
Product
   ↓
Good storage
   ↓
Good visual condition
   ↓
Lower immediate risk

The platform therefore attempts to provide a broader food-quality assessment by combining different available signals.
3. Project Vision
The vision of the project is:
To build an intelligent food-quality monitoring platform that helps users understand food freshness, remaining shelf life, storage quality, risk and recommended actions through AI and Computer Vision.

The platform is designed to support different operational environments.
It provides separate role-oriented experiences for:
- Consumers
- Retail Managers
- Warehouse Operators
- Food Quality Inspectors
- Administrators
The long-term concept is to create a unified food intelligence system where food condition, storage, shelf-life and inventory information can be understood from one platform.
4. Project Objectives
The project has been developed around the following objectives.
4.1 Full-Stack Application
Build a complete application containing:
- Frontend
- Backend
- Database
- AI processing
- Authentication
- Reporting
4.2 Authentication
Provide controlled access through registration and login.
4.3 Role-Based Platform
Provide different dashboards and functionality according to user roles.
4.4 Food Management
Allow users to add and manage food records.
4.5 Image Analysis
Allow food images to be uploaded and processed.
4.6 AI Prediction
Use a trained AI model for freshness classification.
4.7 Computer Vision
Add visual-condition analysis through OpenCV.
4.8 Freshness Scoring
Convert prediction information into a numeric freshness score.
4.9 Storage Intelligence
Analyze available storage information.
4.10 Shelf-Life Prediction
Estimate remaining shelf life.
4.11 Product Age
Measure the impact of product age.
4.12 Health Score
Combine major food-quality dimensions into an overall score.
4.13 Recommendations
Convert analysis into useful actions.
4.14 Inventory
Maintain food inventory information.
4.15 Alerts
Identify food requiring attention.
4.16 Reports
Provide structured analytical reports.
4.17 Export
Support PDF and Excel-compatible reports.
4.18 Responsive Design
Make the application usable across desktop, tablet and mobile devices.
4.19 Deployment
Support Docker and cloud deployment.
5. Complete Feature Overview
The platform is divided into multiple functional layers.
🔐 Authentication
The authentication layer provides:
- Registration
- Login
- JWT authentication
- Protected API requests
- Logout
- Role information
🤖 AI
The AI layer provides:
- Food image classification
- Freshness prediction
- Prediction confidence
- Freshness score
👁️ Computer Vision
The visual analysis layer evaluates:
- Color
- Color degradation
- Texture
- Surface changes
- Mold indicators
- Bruising
- Physical damage
🌡️ Storage Intelligence
Storage analysis considers:
- Temperature
- Humidity
- Packaging
- Storage duration
- Air circulation
- Light exposure
⏳ Shelf-Life Intelligence
The platform estimates:
- Total estimated shelf life
- Remaining shelf life
- Forecast expiry
- Confidence
- Risk
❤️ Food Health
The system calculates:
- Visual condition
- Storage compliance
- Shelf-life score
- Product age score
- Overall health score
📦 Inventory
Inventory includes:
- Food name
- Category
- Image
- Freshness
- Score
- Manufacturing date
- Expiry date
- Storage information
📊 Reports
Reports include:
- Freshness
- Shelf-Life
- Inventory Quality
- Waste Reduction
- Storage Compliance
- Role Analytics
🔔 Alerts
Alerts include:
- Expired food
- Spoiled food
- Near expiry
- Near spoilage
- High shelf-life risk
- Low storage compliance
6. Project Development Journey
The project was developed incrementally.
The overall development journey can be represented as:
Project Planning
       ↓
Core Full-Stack Platform
       ↓
Authentication
       ↓
Food Inventory
       ↓
AI Prediction
       ↓
Role-Based Platform
       ↓
Reports & Analytics
       ↓
Milestone 3 Intelligence
       ↓
Responsive UI
       ↓
Docker
       ↓
GitHub
       ↓
Cloud Deployment

Each milestone builds on the previous one.
The project development principle was to preserve existing working functionality while introducing new capabilities.
7. Milestone 1 - Core Platform
Milestone 1 established the basic full-stack application.
Frontend
The frontend provided:
- React application
- Login
- Registration
- Dashboard
- Food management interface
- API communication
Backend
The FastAPI backend provided:
- Authentication
- Food APIs
- Prediction API
- Image upload
- Database communication
Database
SQLAlchemy was used as the ORM.
The initial data model primarily revolved around:
User
  │
  └── Food

Objective
The main objective of Milestone 1 was to establish a working connection between:
React
   ↕
FastAPI
   ↕
Database

This became the foundation for all later milestones.
8. Milestone 2 - Platform Expansion
Milestone 2 expanded the basic application into a broader platform.
The major improvements included:
Role-Based Functionality
Different roles were introduced.
Dashboard Expansion
The dashboard became more informative and role-aware.
Inventory
Food inventory management was enhanced.
Image Workflow
Food images became part of the food-analysis workflow.
Profile
A dedicated profile experience was introduced.
Reports
Reporting functionality was added to convert food information into structured analytics.
UI Improvements
The frontend was progressively improved to provide a more polished and user-friendly interface.
9. Milestone 3 - AI Food Intelligence
Milestone 3 introduced the major intelligence layer.
The goal was to move beyond a simple AI prediction.
The processing architecture became:
AI Prediction
      +
Computer Vision
      +
Storage Intelligence
      +
Shelf-Life Intelligence
      +
Product Age
      +
Health Score
      +
Risk
      +
Recommendations

AI Model
The backend loads:
models/food_freshness_model.keras

and:
models/class_names.json

The model works with:
fresh
less_fresh
rotten

Visual Analysis
OpenCV provides additional visual-condition analysis.
Storage Analysis
Storage information is evaluated.
Shelf-Life
Remaining life is estimated.
Overall Health
Multiple scores are combined.
Recommendations
The final intelligence layer converts the analysis into actions.
Milestone 3 therefore transformed the platform into a broader food-intelligence system.
10. Milestone 4 - Deployment
Milestone 4 focuses on making the application deployable and accessible outside the local development environment.
The project includes:
- Dockerized backend
- Dockerized frontend
- Nginx frontend serving
- GitHub source control
- Production environment variables
- Cloud deployment
- Production CORS configuration
Deployment architecture:
Developer
    ↓
Git
    ↓
GitHub
    ↓
Cloud Deployment
    ↓
Frontend + Backend

The deployed platform can then be accessed through a browser without running the application directly from the developer's local computer.
11. Public Home Page
The application includes a public Home page.
The purpose of the Home page is to introduce the platform before a visitor enters the authenticated application.
The Home page explains:
- What the platform does
- Why food freshness monitoring is important
- AI capabilities
- Computer Vision
- Shelf-Life Intelligence
- Storage Intelligence
- Recommendations
- Role-based functionality
The visitor can then choose:
Login
   or
Create Account

This creates a public-to-authenticated application flow:
Public Home
     ↓
Login / Register
     ↓
Authenticated Dashboard

The Home page is designed as a premium presentation layer rather than simply a login screen.
12. Authentication System
Authentication controls access to the protected application.
Registration
A user can create an account by providing the required registration information.
The selected role is associated with the account.
Login
The user provides:
Email
Password

The backend verifies the credentials.
After successful authentication, the application receives an access token.
JWT Authentication
The platform uses JWT-based authentication.
Protected API requests use:
Authorization: Bearer <token>

Current User
The application can retrieve the authenticated user's information to determine:
- Identity
- Role
- Access context
Logout
During logout, the frontend clears the stored authentication token and returns the user to the public application flow.
13. Role-Based Access Control
The platform supports five main roles.
Role	Main Purpose
Consumer	Personal food monitoring
Retail Manager	Retail inventory quality
Warehouse Operator	Storage and warehouse health
Food Quality Inspector	Food-quality inspection
Administrator	Platform-level management


Role information affects the dashboard and reporting experience.
Why RBAC is important
A consumer does not need the same information as a warehouse operator.
For example:
Consumer
→ Personal food inventory

Warehouse Operator
→ Storage compliance + warehouse inventory

Quality Inspector
→ Detailed quality analysis

Administrator
→ Platform-level information

This makes the application more relevant to each user type.
14. Consumer Dashboard
The Consumer dashboard focuses on personal food monitoring.
It provides an overview of:
- Food inventory
- Freshness
- Food health
- Shelf life
- Alerts
- Recommendations
- Reports
Consumer Workflow
Consumer
   ↓
Add Food
   ↓
Upload Image
   ↓
AI Analysis
   ↓
Freshness Result
   ↓
Shelf-Life Result
   ↓
Storage Guidance
   ↓
Recommendation

The objective is to help a consumer make better decisions about stored food and reduce unnecessary food waste.
15. Retail Manager Dashboard
The Retail Manager dashboard focuses on retail inventory.
A retail manager needs to understand not just individual food items but the overall quality of inventory.
The dashboard therefore focuses on:
- Product freshness
- Inventory quality
- Shelf-life alerts
- Risk
- Waste reduction
- Analytics
Example
Inventory
    ↓
Identify low-quality products
    ↓
Check remaining shelf life
    ↓
Prioritize inventory
    ↓
Reduce avoidable waste

This makes the platform useful for retail-level food-quality monitoring.
16. Warehouse Operator Dashboard
The Warehouse Operator dashboard focuses on storage operations.
The important information includes:
- Storage compliance
- Inventory health
- Batch freshness
- Environmental conditions
- Shelf-life
- Risk
The purpose is to connect the warehouse environment with food quality.
For example:
Poor Storage
      ↓
Lower Storage Compliance
      ↓
Higher Quality Risk
      ↓
Potential Shelf-Life Reduction

This helps warehouse operators identify storage-related risks.
17. Food Quality Inspector Dashboard
The Food Quality Inspector receives a more detailed food-quality view.
The inspector can review:
- AI freshness score
- Freshness status
- Prediction confidence
- Visual condition
- Storage compliance
- Shelf life
- Product age
- Health score
- Risk
- Recommendations
- Reports
This provides an AI-assisted inspection workflow.
The system does not replace professional judgment; instead, it organizes multiple analytical signals into one interface.
18. Administrator Dashboard
The Administrator dashboard provides a broader platform-level view.
The administrator-oriented functionality focuses on:
- Platform analytics
- User-related information
- System monitoring
- Reports
- Administrative information
The administrator has a different objective from operational users.
Operational User
→ Monitor food

Administrator
→ Monitor platform

This separation is the reason the administrator dashboard has its own role-oriented workspace.
19. Food Inventory Management
Food inventory is one of the central parts of the platform.
A food record contains important information such as:
Food ID
User ID
Food Name
Freshness Status
Freshness Score
Image Path
Manufacturing Date
Expiry Date
Storage Condition
Created At

Adding Food
The user can create a food record.
Food Category
Food can be associated with categories such as:
- Fruits
- Vegetables
- Dairy
- Meat
- Seafood
- Bakery
- Beverage
Inventory Display
The inventory provides food-level information so that users can understand the condition of stored products.
Deletion
Food records can be deleted through the inventory interface.
20. Food Image Upload
Food image upload is an important part of the AI workflow.
The backend accepts supported image formats:
.jpg
.jpeg
.png
.webp

The upload process is:
Select Image
     ↓
Send to Backend
     ↓
Validate Extension
     ↓
Generate Unique Filename
     ↓
Save Image
     ↓
Return Image Path

The stored image path is later used by the prediction pipeline.
The backend also exposes uploaded files through its uploads route.
21. AI Freshness Prediction
AI Freshness Prediction is one of the core features.
The backend uses a trained TensorFlow/Keras model.
Model:
food_freshness_model.keras

Class information:
class_names.json

The current model classes are:
Class	Meaning
fresh	Fresh food condition
less_fresh	Reduced freshness
rotten	Strong spoilage condition


Image Preprocessing
The uploaded image is:
1. Loaded
2. Resized
3. Converted to an array
4. Expanded into model input shape
5. Converted to the expected numeric format
6. Passed into the trained model
The project uses:
224 × 224

as the image size.
Prediction
The model produces probabilities.
The highest-probability class becomes the predicted class.
The system also records prediction confidence.
22. Computer Vision Analysis
The AI model is supplemented by OpenCV analysis.
The purpose is to extract additional visual information.
Color Analysis
The system evaluates color characteristics of the food.
Color Degradation
Changes associated with deterioration are considered.
Texture Analysis
Surface texture is analyzed.
Surface Changes
The system evaluates unusual surface patterns.
Mold Detection
Visual patterns potentially associated with mold are considered.
Bruising Detection
Potential bruising areas are analyzed.
Physical Damage
Visible damage is considered.
The result is used as a supplementary visual-condition signal.
AI Model
   +
OpenCV
   ↓
More Complete Visual Assessment

23. Freshness Scoring
The platform converts the AI prediction into a freshness score between 0 and 100.
Fresh
The current scoring logic uses:
70 + (fresh_probability × 30)

Less Fresh
The current scoring logic uses:
40 + (less_fresh_probability × 30)

Rotten
The current scoring logic uses:
rotten_probability × 39

The result is clamped between:
0
-
100

Why a numeric score?
A classification such as:
Fresh

is useful, but a numeric score provides more granularity.
For example:
Fresh
Score: 94

can be differentiated from:
Fresh
Score: 73

The score can then be used by the dashboard, reports and intelligence layers.
24. Storage Intelligence
Storage Intelligence evaluates the conditions in which food is stored.
The system considers:
Temperature
Humidity
Packaging
Storage Duration
Air Circulation
Light Exposure

The objective is to determine whether the storage environment is favorable.
Temperature
Temperature is evaluated against category-specific expectations.
Humidity
The current category ranges include:
Category	Expected Range
Fruits / Vegetables	50–90%
Dairy	30–70%
Meat / Seafood	60–85%
Default	30–70%


Packaging
Packaging descriptions are interpreted according to their protective characteristics.
Examples:
Airtight
Sealed
Vacuum
Container
Box
Reusable
Covered
Plastic
Bag
Wrap

Air Circulation
Positive conditions include:
Good
Adequate
Proper
Ventilated

Risk conditions include:
Poor
Low
None
Blocked

Light
Low-light conditions include:
Dark
Low
Minimal
None

Higher-risk descriptions include:
Direct
High
Sunlight

Storage Compliance
The storage score uses:
Factor	Weight
Temperature	30%
Humidity	20%
Packaging	15%
Duration	15%
Air Circulation	10%
Light	10%


Classification:
85+  → Excellent
70+  → Good
50+  → Moderate
<50  → Poor

25. Shelf-Life Intelligence
Shelf-Life Intelligence estimates how much useful life may remain for a food item.
It combines multiple factors:
Base Shelf Life
Freshness
Visual Condition
Storage Condition
Product Age
Storage Duration
Expiry Date
Input Completeness

The system calculates:
- Estimated total life
- Remaining life
- Forecast expiry
- Confidence
- Risk
- Status
Freshness Multipliers
The current intelligence logic uses:
Prediction	Multiplier
Fresh	1.00
Less Fresh	0.78
Rotten	0.15
Default	0.85


Age Factor
Product age reduces the estimated condition factor as the product gets older.
Known Expiry
If an expiry date is available, the predicted remaining shelf life is capped against the known expiry.
Risk
The system can identify:
Low
Moderate
High
Critical
Expired

Rotten food is treated as a critical condition.
26. Product Age Analysis
Product age is an important part of shelf-life intelligence.
The system can derive age from:
- Manufacturing date
- Storage duration
- Baseline shelf life
The age is compared with the expected shelf-life baseline.
Conceptually:
Product Age increases
        ↓
Age Ratio increases
        ↓
Age Score decreases

When sufficient age information is not available, the system uses a fallback value instead of failing the complete analysis.
The product-age score later contributes to the overall food-health score.
27. Overall Food Health Score
The Overall Food Health Score combines four major dimensions.
The project uses:
Component	Weight
Visual Condition	40%
Storage Compliance	25%
Shelf-Life	20%
Product Age	15%


Formula
Overall Health Score
=
(Visual Condition × 0.40)
+
(Storage Compliance × 0.25)
+
(Shelf-Life Score × 0.20)
+
(Product Age Score × 0.15)

This is important because the final score is not based only on the AI classification.
A food item may have:
Good AI score
+
Poor storage
+
High product age

and therefore receive a different overall health assessment.
The score is used by:
- Dashboard
- Inventory
- Reports
- Risk Analysis
- Recommendation Engine
28. Recommendation Engine
The Recommendation Engine converts analytical information into practical actions.
The system can generate recommendations related to:
Storage
Recommendations can address:
- Temperature
- Humidity
- Packaging
- Air circulation
- Light
- Storage duration
Consumption
Food with reduced remaining shelf life can be prioritized for consumption.
Inventory Rotation
Products with shorter remaining shelf life can be given priority.
This supports FEFO-style thinking:
First Expire
     ↓
First Out

Waste Reduction
The system can identify food requiring attention before it becomes unusable.
Quality Improvement
Storage or handling improvements can be recommended where applicable.
The recommendation layer therefore transforms raw analytics into actionable information.
29. Alerts & Notifications
The dashboard generates alerts based on food conditions.
Expired Food
The product has passed its known expiry date.
Spoiled Food
The food is classified as spoiled or has a severe quality condition.
Near Expiry
The expiry date is approaching.
Near Spoilage
Freshness or shelf-life information indicates increased risk.
High Shelf-Life Risk
Remaining shelf life is significantly reduced.
Low Storage Compliance
Storage conditions are below the desired compliance level.
The dashboard provides a notification interface so that important food-quality conditions are not hidden inside the inventory.
30. Reports & Analytics
The Reports module converts food and intelligence information into structured reports.
Freshness Report
Provides information such as:
- Food freshness
- AI score
- Freshness status
- Food-level quality
Shelf-Life Report
Provides:
- Remaining shelf life
- Confidence
- Risk
- Forecast expiry
- Expiry information
Inventory Quality Report
The detailed inventory report includes information such as:
Food
Category
AI Score
Health
Quality
Remaining
Risk
Confidence
Expiry
Storage
Temperature
Humidity
Packaging
Duration
Air
Light
Storage Score

Waste Reduction Report
Highlights food that may require:
- Earlier consumption
- Inventory rotation
- Storage improvement
- Quality attention
Storage Compliance Report
Provides information about storage and environmental conditions.
Role Analytics
Different roles can receive metrics related to their operational responsibilities.
31. PDF & Excel Export
The reporting system supports export functionality.
PDF
The PDF workflow generates a print-ready report containing information such as:
- Summary
- Freshness
- Shelf-Life
- Storage
- Environmental information
- Inventory quality
- Role information
The application builds structured report HTML and uses the browser print workflow.
Excel-Compatible Export
The application generates spreadsheet-compatible report data.
The exported information can contain:
- Food
- Category
- Score
- Health
- Quality
- Shelf life
- Risk
- Storage
- Environmental information
This makes the information easier to:
- Share
- Archive
- Analyze
- Present
32. Profile System
The Profile page provides the authenticated user with account information.
The profile experience can display:
- User information
- Email
- Role
- Account status
- Role description
- Responsibilities
- Access-related information
The profile is role-aware so that the user can understand the purpose of their assigned role.
The Profile page was also made responsive so that the same information can be used across different device sizes.
33. Responsive Device Compatibility
The project has been adapted for multiple device sizes.
Supported layouts include:
Large Desktop
Desktop
Laptop
Tablet
Mobile
Small Mobile
Landscape Mobile

The objective was to preserve the existing UI while allowing the interface to adapt to smaller screens.
Responsive Improvements
The project includes:
- Flexible widths
- Responsive grids
- Flexible spacing
- Mobile-friendly controls
- Responsive forms
- Responsive dashboard
- Responsive reports
- Responsive profile
- Responsive inventory
- Responsive login
- Responsive registration
- Table scrolling
- Landscape handling
- Reduced-motion support
Tables
Large report tables are intentionally horizontally scrollable on small screens.
This is preferable to hiding important columns.
Desktop
──────────────────────────────────────
| Food | Score | Health | Risk | ... |
──────────────────────────────────────

Mobile
←──────── horizontal scroll ────────→

34. Complete AI Processing Flow
The complete food-analysis pipeline is:
                    USER
                      │
                      ▼
                 ADD FOOD
                      │
                      ▼
                UPLOAD IMAGE
                      │
                      ▼
              IMAGE VALIDATION
                      │
                      ▼
             IMAGE PREPROCESSING
                      │
                      ▼
          ┌────────────────────────┐
          │ TensorFlow / Keras AI  │
          └───────────┬────────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
        FRESH     LESS FRESH    ROTTEN
          │           │           │
          └───────────┼───────────┘
                      ▼
              FRESHNESS SCORE
                      │
                      ▼
          ┌────────────────────────┐
          │     OpenCV Layer       │
          └───────────┬────────────┘
                      │
                      ▼
             VISUAL CONDITION
                      │
                      ▼
           STORAGE INTELLIGENCE
                      │
       ┌──────────────┼──────────────┐
       ▼              ▼              ▼
 Temperature       Humidity       Packaging
       │              │              │
       └──────────────┼──────────────┘
                      │
              Duration / Air / Light
                      │
                      ▼
          STORAGE COMPLIANCE SCORE
                      │
                      ▼
            SHELF-LIFE PREDICTION
                      │
                      ▼
             PRODUCT AGE SCORE
                      │
                      ▼
            OVERALL HEALTH SCORE
                      │
                      ▼
                 RISK LEVEL
                      │
                      ▼
              RECOMMENDATIONS
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
      Dashboard    Inventory    Reports

This flow represents the complete intelligence journey from image input to actionable output.
35. System Architecture
The platform follows a layered architecture.
                         ┌──────────────┐
                         │     USER     │
                         └──────┬───────┘
                                │
                                ▼
                     ┌────────────────────┐
                     │   React Frontend   │
                     │      + Vite        │
                     └─────────┬──────────┘
                               │
                         REST API Calls
                               │
                               ▼
                     ┌────────────────────┐
                     │   FastAPI Backend  │
                     └─────────┬──────────┘
                               │
             ┌─────────────────┼──────────────────┐
             │                 │                  │
             ▼                 ▼                  ▼
       Authentication      Food Management    Image Upload
             │                 │                  │
             │                 │                  ▼
             │                 │             AI Prediction
             │                 │                  │
             │                 │          ┌───────┴────────┐
             │                 │          ▼                ▼
             │                 │     TensorFlow          OpenCV
             │                 │          │                │
             └─────────────────┼──────────┴────────────────┘
                               │
                               ▼
                    Food Intelligence Layer
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
      Shelf-Life           Storage          Recommendations
           │                   │                   │
           └───────────────────┼───────────────────┘
                               │
                               ▼
                          PostgreSQL

Each layer has a separate responsibility.
36. Technology Stack
Frontend
Technology	Purpose
React	User interface
Vite	Development and build system
JavaScript	Application logic
JSX	React component structure
CSS	UI styling and responsive design
Local Storage	Authentication token storage


Backend
Technology	Purpose
Python	Backend programming
FastAPI	REST API framework
Pydantic	Validation
SQLAlchemy	ORM
Uvicorn	Application server
JWT	Authentication


AI / Computer Vision
Technology	Purpose
TensorFlow	Deep Learning
Keras	Model loading and inference
OpenCV	Visual analysis
NumPy	Numerical processing


Database
PostgreSQL

Deployment
Docker
Nginx
Git
GitHub
Render

37. Backend Architecture
The backend follows a modular FastAPI structure.
backend/
└── app/
    ├── core/
    ├── models/
    ├── routers/
    ├── services/
    └── main.py

Core
The Core layer contains:
- Configuration
- Database connection
- Environment settings
- Authentication configuration
Models
Models represent database entities.
Main entities include:
User
Food

Routers
The application contains API areas for:
Authentication
Food
Prediction
Upload
Administration

Services
The services layer contains application logic such as:
Authentication Service
Prediction Service
Food Intelligence

Main Application
main.py connects the application components and configures:
- FastAPI
- Routers
- CORS
- Database initialization
- Static uploads
38. Frontend Architecture
The frontend is built using React.
The application is organized into reusable pages/components.
Representative structure:
frontend/
└── src/
    ├── App.jsx
    ├── App.css
    ├── api.js
    └── pages/

Important pages include:
Home.jsx
Login.jsx
Register.jsx
Dashboard.jsx
Profile.jsx
FoodInventory.jsx
FoodReport.jsx
AdministratorReports.jsx

App.jsx
Controls the high-level application page flow.
api.js
Centralizes backend API communication.
It also handles:
- API base URL
- Authorization header
- Token
- Error handling
Pages
Each page focuses on a particular application area while preserving the common application behavior.
39. Database Architecture
The application uses PostgreSQL.
SQLAlchemy is used as the ORM layer.
User Table
The User entity stores account information.
Important fields include:
id
email
password
role

Food Table
The Food entity contains:
id
user_id
food_name
freshness_status
freshness_score
image_path
manufacturing_date
expiry_date
storage_condition
created_at

Relationship
             USER
               │
               │ 1
               │
               │
               │ many
               ▼
             FOOD

Each food record is associated with its user through user_id.
This relationship allows the application to retrieve the authenticated user's food inventory.
40. API Endpoints
The FastAPI backend exposes REST APIs.
Root
GET /

The root endpoint verifies that the API is running.
Food
GET /foods

Returns food records associated with the authenticated user.
POST /foods

Creates a food record.
Prediction Health
GET /prediction/health

Checks whether the prediction module is working.
Prediction
POST /prediction/

Runs the food prediction and intelligence workflow.
Image Upload
POST /upload/food-image

Uploads a food image.
Uploaded Files
Uploaded files are served through:
/uploads/

Authentication
The authentication router handles the application's authentication-related operations, including registration, login and current-user functionality.
Administration
The admin router contains administrator-oriented backend functionality.
41. Project Folder Structure
The project is divided into backend and frontend.
Food-Freshness-Monitoring-Platform/
│
├── backend/
│   │
│   ├── app/
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   │
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   └── food.py
│   │   │
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── food.py
│   │   │   ├── prediction.py
│   │   │   ├── upload.py
│   │   │   └── admin.py
│   │   │
│   │   ├── services/
│   │   │   ├── auth.py
│   │   │   └── prediction.py
│   │   │
│   │   └── main.py
│   │
│   ├── models/
│   │   ├── food_freshness_model.keras
│   │   └── class_names.json
│   │
│   ├── uploads/
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   │
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Home.css
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── FoodInventory.jsx
│   │   │   ├── FoodReport.jsx
│   │   │   └── AdministratorReports.jsx
│   │   │
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── api.js
│   │
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
├── README.md
└── .gitignore

The exact project tree can evolve as new modules are added.
42. Local Installation
Requirements
Before running the project locally, install:
- Git
- Python 3.11+
- Node.js
- npm
- PostgreSQL
- Docker Desktop (optional)
Clone Repository
git clone https://github.com/Kkjha-bot/Food-Freshness-Monitoring-Platform.git

Move into the project:
cd Food-Freshness-Monitoring-Platform

The project contains separate frontend and backend applications.
43. Backend Setup
Create a Python virtual environment:
python -m venv .venv

Activate it:
.venv\Scripts\Activate.ps1

Move to backend:
cd backend

Install dependencies:
pip install -r requirements.txt

Configure the database and environment variables.
Then run:
uvicorn app.main:app --reload

The backend will start on the configured local port.
Default development address:
http://127.0.0.1:8000

44. Frontend Setup
Open a second terminal.
Move to frontend:
cd frontend

Install dependencies:
npm install

Run the development server:
npm run dev

Vite will provide the local frontend address.
The frontend communicates with the FastAPI backend through the configured API URL.
45. Environment Variables
The backend uses environment-based configuration.
Important configuration values include:
DATABASE_URL=your_database_url
SECRET_KEY=your_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

The frontend uses:
VITE_API_URL=http://127.0.0.1:8000

For production, the frontend API URL points to the deployed backend.
Example:
VITE_API_URL=<production-backend-url>

Important
Environment files containing secrets should not be committed to GitHub.
46. Running the Application
The application requires both frontend and backend services.
Terminal 1 - Backend
cd backend
uvicorn app.main:app --reload

Backend:
http://127.0.0.1:8000

FastAPI documentation:
http://127.0.0.1:8000/docs

Terminal 2 - Frontend
cd frontend
npm run dev

Open the Vite-provided frontend URL.
Complete Local Flow
Browser
   ↓
React/Vite
   ↓
FastAPI
   ↓
PostgreSQL
   ↓
AI / Computer Vision

47. Docker Support
The project includes Docker support.
Backend Dockerfile
The backend container:
1. Uses Python 3.11
2. Installs required system libraries
3. Installs Python dependencies
4. Copies backend code
5. Starts Uvicorn
The backend exposes:
8000

Frontend Dockerfile
The frontend uses a multi-stage Docker build.
Node.js
   ↓
npm install
   ↓
npm run build
   ↓
Nginx
   ↓
Production Frontend

The Vite production build is generated first.
Then the generated static files are served using Nginx.
Why Docker?
Docker provides:
- Consistent environment
- Easier deployment
- Reproducible builds
- Dependency isolation
- Easier cloud deployment
48. Production Deployment
The application has been deployed to Render.
Production Frontend
https://food-freshness-monitoring-platform-1.onrender.com

Production Backend
https://food-freshness-monitoring-platform-bzh9.onrender.com

Production Architecture
                 USER
                  │
                  ▼
        ┌──────────────────┐
        │ Render Frontend  │
        │ React + Nginx    │
        └────────┬─────────┘
                 │
                 ▼
        ┌──────────────────┐
        │ Render Backend   │
        │ FastAPI          │
        └────────┬─────────┘
                 │
          ┌──────┼───────┐
          ▼      ▼       ▼
       Database  AI    Uploads

The frontend uses the production backend URL through VITE_API_URL.
The backend also configures CORS to allow the production frontend.
49. GitHub Development Workflow
GitHub is used as the project's source-control system.
The standard workflow is:
Modify Code
    ↓
Test Locally
    ↓
git status
    ↓
git add
    ↓
git commit
    ↓
git push
    ↓
GitHub
    ↓
Cloud Deployment

Check Status
git status

Stage Files
Example:
git add README.md

Commit
git commit -m "Update project documentation"

Push
git push origin main

Important
Temporary files should not accidentally be committed.
Examples:
*.dump
*.zip
.env
temporary migration files
local backup files

The project should only commit files required for the application.
50. Security
Security is an important part of the application architecture.
JWT Authentication
The application uses JWT tokens for authenticated API requests.
Protected APIs
Food and other protected resources are accessed through authenticated requests.
User Association
Food records contain a user_id association.
This allows food inventory to be connected with the authenticated user.
Secret Management
Sensitive configuration such as:
DATABASE_URL
SECRET_KEY

should be stored through environment variables.
CORS
The backend configures allowed frontend origins.
File Validation
Uploaded images are restricted to supported image extensions.
Generated Upload Names
The upload system generates unique filenames rather than relying directly on the original uploaded filename.
51. Testing Checklist
Testing should cover the entire application.
Authentication
- [ ] Registration works
- [ ] Login works
- [ ] Invalid login is rejected
- [ ] Logout works
- [ ] Protected pages require authentication
- [ ] Role is correctly loaded
Food Inventory
- [ ] Food can be added
- [ ] Food appears in inventory
- [ ] Food image can be uploaded
- [ ] Food information is stored
- [ ] Food can be deleted
- [ ] User sees appropriate food records
AI
- [ ] Prediction health works
- [ ] Image preprocessing works
- [ ] Fresh prediction works
- [ ] Less Fresh prediction works
- [ ] Rotten prediction works
- [ ] Confidence is returned
- [ ] Freshness score is calculated
Computer Vision
- [ ] Image can be read by OpenCV
- [ ] Color analysis runs
- [ ] Texture analysis runs
- [ ] Mold analysis runs
- [ ] Bruising analysis runs
- [ ] Surface analysis runs
- [ ] Physical damage analysis runs
Intelligence
- [ ] Storage score works
- [ ] Shelf-life calculation works
- [ ] Product age calculation works
- [ ] Overall health score works
- [ ] Risk is generated
- [ ] Recommendations are generated
Reports
- [ ] Freshness report
- [ ] Shelf-life report
- [ ] Inventory report
- [ ] Waste reduction report
- [ ] Storage report
- [ ] Role analytics
- [ ] PDF export
- [ ] Excel export
Responsive Testing
Test on:
Desktop
Laptop
Tablet
Mobile
Small Mobile
Landscape Mobile

52. Current Limitations
Every production-style application has technical limitations.
52.1 Uploaded Image Persistence
The current upload workflow stores images in the backend upload directory.
Cloud environments with ephemeral filesystems can remove uploaded files during:
- Restart
- Redeployment
- Instance replacement
A persistent object-storage service would solve this limitation.
52.2 AI Model Classes
The current model uses three primary classes:
Fresh
Less Fresh
Rotten

Broader quality labels may be derived by application-level scoring and business logic.
52.3 Computer Vision
OpenCV is a supplementary analysis layer.
Visual analysis should be treated as an additional signal rather than a replacement for the trained AI model.
52.4 IoT Sensors
Automatic real-time sensor integration is not currently part of the implemented platform.
52.5 Real-Time Environmental Streaming
The current storage intelligence works with available food/storage input rather than a continuously streaming sensor network.
53. Future Enhancements
The project provides a strong foundation for future development.
☁️ Persistent Object Storage
Integrate:
- Amazon S3
- Google Cloud Storage
- Azure Blob Storage
- Cloudinary
This would make uploaded food images persistent in cloud deployment.
🌡️ IoT Integration
Future versions can connect:
- Temperature sensors
- Humidity sensors
- Refrigerator sensors
- Warehouse sensors
Architecture:
IoT Sensor
    ↓
Real-Time Data
    ↓
Backend
    ↓
Storage Intelligence
    ↓
Food Health
    ↓
Alert

🔔 Advanced Notifications
Future versions can add:
- Email alerts
- Push notifications
- Scheduled notifications
- Escalation notifications
🧠 Advanced AI
Possible improvements:
- Larger datasets
- More food categories
- Food-specific models
- Better spoilage detection
- Better confidence calibration
- Model retraining pipeline
📷 Barcode / QR
Future workflow:
Scan Barcode
     ↓
Identify Product
     ↓
Retrieve Product Information
     ↓
Create Inventory Record
     ↓
Monitor Shelf Life

📊 Advanced Analytics
Future analytics can include:
- Historical freshness trends
- Waste prediction
- Inventory turnover
- Batch analytics
- Category-level spoilage
- Storage performance trends
🔄 CI/CD
Future automation can include:
- GitHub Actions
- Automated tests
- Docker builds
- Automated deployment
54. Complete User Journey
The complete platform journey is:
                    PUBLIC HOME
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
           LOGIN                  REGISTER
             │                       │
             └───────────┬───────────┘
                         ▼
                 AUTHENTICATED USER
                         │
                         ▼
                  ROLE IDENTIFIED
                         │
                         ▼
                   ROLE DASHBOARD
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
      INVENTORY        PROFILE        REPORTS
          │
          ▼
       ADD FOOD
          │
          ▼
     UPLOAD IMAGE
          │
          ▼
   AI FRESHNESS MODEL
          │
          ▼
   FRESHNESS SCORE
          │
          ▼
   COMPUTER VISION
          │
          ▼
   VISUAL CONDITION
          │
          ▼
 STORAGE INTELLIGENCE
          │
          ▼
 STORAGE COMPLIANCE
          │
          ▼
 SHELF-LIFE ENGINE
          │
          ▼
 PRODUCT AGE
          │
          ▼
 OVERALL HEALTH
          │
          ▼
      RISK LEVEL
          │
          ▼
  RECOMMENDATION
          │
     ┌────┴────┐
     ▼         ▼
 DASHBOARD   REPORTS
                │
          ┌─────┴─────┐
          ▼           ▼
         PDF        EXCEL

The platform therefore provides an end-to-end journey:
Food
 ↓
Image
 ↓
AI
 ↓
Computer Vision
 ↓
Storage
 ↓
Shelf-Life
 ↓
Health
 ↓
Risk
 ↓
Recommendation
 ↓
Decision

55. Project Benefits
👤 Consumer
The platform helps consumers:
- Monitor food
- Understand freshness
- Track shelf life
- Review storage information
- Receive recommendations
- Reduce avoidable waste
🏪 Retail Manager
Retail managers can:
- Monitor inventory quality
- Identify risky products
- Track shelf life
- Improve inventory rotation
- Reduce waste
🏭 Warehouse Operator
Warehouse operators can:
- Monitor storage compliance
- Review environmental information
- Monitor inventory health
- Identify storage risks
- Track shelf-life conditions
🔍 Food Quality Inspector
Inspectors can:
- Review AI-assisted freshness
- Review visual condition
- Analyze storage compliance
- Evaluate food risk
- Generate reports
🛠️ Administrator
Administrators can:
- Review platform information
- Monitor analytics
- Review reports
- Monitor administrative information
- Understand platform-level activity
🌱 Overall Benefit
The larger goal is:
Better Monitoring
       ↓
Earlier Detection
       ↓
Better Decisions
       ↓
Better Inventory Rotation
       ↓
Reduced Avoidable Waste

56. Project Status
🚀 Current Status: Production Deployed
The project has progressed from a basic full-stack application into a broader AI-powered food intelligence platform.
Implemented Components
✅ React Frontend
✅ Vite
✅ FastAPI Backend
✅ PostgreSQL
✅ SQLAlchemy
✅ JWT Authentication
✅ Registration
✅ Login
✅ Logout
✅ Role-Based Functionality
✅ Consumer Dashboard
✅ Retail Manager Dashboard
✅ Warehouse Operator Dashboard
✅ Food Quality Inspector Dashboard
✅ Administrator Dashboard
✅ Profile
✅ Food Inventory
✅ Food Image Upload
✅ TensorFlow / Keras
✅ AI Freshness Prediction
✅ OpenCV Analysis
✅ Freshness Score
✅ Visual Condition Analysis
✅ Storage Intelligence
✅ Shelf-Life Intelligence
✅ Product Age Analysis
✅ Overall Health Score
✅ Risk Analysis
✅ Recommendation Engine
✅ Alerts
✅ Notifications
✅ Freshness Reports
✅ Shelf-Life Reports
✅ Inventory Quality Reports
✅ Waste Reduction Reports
✅ Storage Compliance Reports
✅ Role Analytics
✅ PDF Export
✅ Excel-Compatible Export
✅ Responsive UI
✅ Mobile Support
✅ Tablet Support
✅ Desktop Support
✅ Docker Support
✅ GitHub
✅ Render Deployment

Core Intelligence Formula
              VISUAL CONDITION
                     40%
                      │
                      ▼
STORAGE 25% ──► OVERALL HEALTH ◄── SHELF-LIFE 20%
                      ▲
                      │
                 AGE 15%

Overall Platform
                 🤖 AI
                  +
           👁️ Computer Vision
                  +
         🌡️ Storage Intelligence
                  +
           ⏳ Shelf-Life
                  +
            📅 Product Age
                  +
           ❤️ Health Score
                  +
            ⚠️ Risk Analysis
                  +
           💡 Recommendations
                  +
             📦 Inventory
                  +
             📊 Reports
                  +
          👥 Role-Based Access
                  +
             🔔 Alerts

57. Author
👨‍💻 Developer
Kundan Kumar Jha
📌 Project
Food Freshness Monitoring Platform
🎯 Project Focus
AI
+
Computer Vision
+
Food Freshness
+
Shelf-Life
+
Storage Intelligence
+
Inventory
+
Recommendations
+
Analytics

🛠️ Main Technologies
React
FastAPI
Python
PostgreSQL
SQLAlchemy
TensorFlow
Keras
OpenCV
NumPy
Docker
Nginx
Git
GitHub
Render

🍎 Final Project Summary
The Food Freshness Monitoring Platform combines AI, Computer Vision and food-management intelligence into a single platform.
The complete concept is:
                    FOOD
                      │
                      ▼
                 FOOD IMAGE
                      │
                      ▼
              AI CLASSIFICATION
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
        FRESH     LESS FRESH    ROTTEN
          │           │           │
          └───────────┼───────────┘
                      ▼
              FRESHNESS SCORE
                      │
                      ▼
            COMPUTER VISION
                      │
                      ▼
             VISUAL CONDITION
                      │
                      ▼
          STORAGE INTELLIGENCE
                      │
                      ▼
          STORAGE COMPLIANCE
                      │
                      ▼
           SHELF-LIFE ENGINE
                      │
                      ▼
            PRODUCT AGE SCORE
                      │
                      ▼
           OVERALL HEALTH SCORE
                      │
                      ▼
                RISK LEVEL
                      │
                      ▼
             RECOMMENDATION
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
      DASHBOARD    INVENTORY    REPORTS
          │           │           │
          └───────────┼───────────┘
                      ▼
              BETTER DECISIONS
                      │
                      ▼
               LESS WASTE

🌱 Project Mission
Monitor freshness. Understand quality. Predict shelf life. Improve storage. Reduce avoidable food waste.
