# Food Freshness Monitoring Platform

## Project Overview
The Food Freshness Monitoring Platform helps monitor food freshness, estimate shelf life, manage food inventory, and support food storage decisions.

## Technology Stack
- Frontend: React with Vite
- Backend: Python with FastAPI
- Database: PostgreSQL
- Deployment: Render
- Version Control: Git and GitHub

## Deployment
The application is deployed on Render.

- **Frontend:** https://food-freshness-frontend-a337.onrender.com
- **Backend API:** https://food-freshness-backend-r79i.onrender.com
- **API Documentation:** https://food-freshness-backend-r79i.onrender.com/docs

## Project Structure
- `frontend/` — React frontend application
- `backend-Infosys-FF/` — FastAPI backend application
- `render.yaml` — Render service configuration

## Local Development
1. Clone the repository.
2. Install the frontend dependencies using `npm install` inside the `frontend` directory.
3. Install backend dependencies using `pip install -r requirements.txt` inside `backend-Infosys-FF`.
4. Configure the required environment variables locally.
5. Start the frontend and backend services.

## Environment Variables
Configure database credentials and other required settings through environment variables. Never commit passwords, secret keys, or database credentials to GitHub.

## Important Note
The `render.yaml` file describes the deployment configuration. Review it against the existing Render service settings before applying it as a Blueprint.
