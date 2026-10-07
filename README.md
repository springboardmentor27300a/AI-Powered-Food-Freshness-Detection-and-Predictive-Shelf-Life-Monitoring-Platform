# 🥬 Food Freshness Monitoring Platform

## AI-Powered Food Freshness Detection & Predictive Shelf-Life Monitoring Platform

An intelligent web-based platform designed to analyze food freshness using **Artificial Intelligence, Computer Vision, image analysis, and food storage intelligence**.

The platform helps users monitor food freshness, estimate remaining shelf life, understand storage conditions, and receive intelligent recommendations for better food management.

---

## 📌 Project Overview

Food wastage is a major problem caused by improper storage, lack of freshness awareness, and difficulty in identifying food spoilage at an early stage.

The **Food Freshness Monitoring Platform** addresses this problem by combining:

- 🤖 Artificial Intelligence
- 👁️ Computer Vision
- 📷 Food Image Analysis
- 🧠 Freshness Prediction
- ⏳ Predictive Shelf-Life Monitoring
- 🌡️ Storage Intelligence
- 💡 Recommendation Engine
- 👤 User & Role Management
- 🗄️ PostgreSQL Database

The platform allows users to add food items, provide relevant food and storage information, upload food images, and obtain freshness-related insights through the prediction and analysis pipeline.

---

# 🎯 Objectives

The major objectives of the project are:

1. Detect and estimate the freshness condition of food.
2. Analyze food images using Computer Vision.
3. Provide a freshness score for food items.
4. Estimate remaining shelf life.
5. Monitor storage-related conditions.
6. Identify possible spoilage indicators.
7. Provide storage and food-management recommendations.
8. Maintain a personalized food inventory.
9. Provide role-based functionality.
10. Reduce unnecessary food wastage through intelligent monitoring.

---

# 🚀 Key Features

## 🔐 Authentication & User Management

- User registration
- User login
- Secure authentication
- JWT-based authentication
- Protected API routes
- User-specific food inventory
- User profile management
- Role-based functionality

---

## 👤 Role-Based Functionality

The platform supports role-based access and functionality.

Depending on the assigned role, users can access the relevant dashboard and platform features.

Role-based functionality helps organize the platform according to different user requirements while keeping the existing food monitoring workflow intact.

---

# 🏠 Dashboard

The dashboard provides an overview of the user's food inventory and freshness information.

It includes:

- Total food items
- Fresh food count
- Pending items
- Food inventory overview
- Food freshness information
- Navigation to major platform sections
- Profile access
- Add Food functionality

The dashboard is designed to provide a quick overview of the user's current food status.

---

# 🍎 Food Inventory Management

Users can add and manage food items through the platform.

Food records can contain information such as:

- Food name
- Food category
- Freshness status
- Freshness score
- Food image
- Manufacturing date
- Expiry date
- Storage condition
- Storage temperature
- Storage humidity
- Packaging type
- Storage duration
- Air circulation
- Light exposure
- Remaining shelf life
- Shelf-life confidence
- Shelf-life risk
- Storage compliance score
- Overall health score

Users can view their food inventory and manage individual food records.

---

# 📷 Food Image Upload

The platform supports food image uploads for freshness analysis.

Supported image formats include:

- `.jpg`
- `.jpeg`
- `.png`
- `.webp`

Uploaded images are processed through the food freshness analysis pipeline.

---

# 🤖 AI-Based Freshness Prediction

The platform uses a trained Machine Learning / Deep Learning model for food freshness classification.

The model works with the following freshness classes:

- 🟢 `fresh`
- 🟡 `less_fresh`
- 🔴 `rotten`

The prediction pipeline processes the food image and generates a freshness-related result.

---

# 📊 Freshness Score

A freshness score is generated from the prediction probabilities.

The score is normalized to a range of:

```text
0 - 100
