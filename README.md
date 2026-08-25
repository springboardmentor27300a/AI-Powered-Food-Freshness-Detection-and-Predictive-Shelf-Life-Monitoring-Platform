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

## 📁 Project Structure

```
FreshSense AI/
├── Backend/
│   ├── app/
│   │   ├── core/        # config, security, email
│   │   ├── models/      # Pydantic schemas
│   │   ├── routers/     # auth, inventory, admin
│   │   └── main.py
│   ├── .env
│   └── requirements.txt
└── Frontend/
    ├── src/
    │   ├── components/  # LandingAuthScreen, Dashboard, etc.
    │   ├── pages/
    │   └── App.jsx
    └── package.json
```

---

*Built during Week 1 of the FreshSense AI development sprint.*
