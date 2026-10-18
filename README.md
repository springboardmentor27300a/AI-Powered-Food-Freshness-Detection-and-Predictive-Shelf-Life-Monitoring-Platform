# FreshGuard

This repository contains the FreshGuard full-stack application at the repository root: a React/Vite frontend, FastAPI backend, PostgreSQL migrations, ML model artifacts, tests, and deployment configuration.

The existing mentor-provided static demo remains intact in [`food-freshness-platform/`](food-freshness-platform/). It is a separate browser-only demo and was not overwritten by this transfer.

## Production URLs

- Frontend: https://freshguard-frontend-qq1l.onrender.com/
- API: https://freshguard-api-mp6c.onrender.com
- Health: https://freshguard-api-mp6c.onrender.com/health

These existing Render services currently deploy from the original FreshGuard repository. This company-repository branch does not change or redeploy them. Review [`RENDER_DEPLOYMENT.md`](RENDER_DEPLOYMENT.md) before linking this copy to another Render Blueprint.

## Local development

Install backend dependencies from `backend/requirements.txt`, install frontend dependencies with `npm ci` in `frontend/`, then use the documented environment values and `docker compose up --build`. See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the historical Modal draft and [`RENDER_DEPLOYMENT.md`](RENDER_DEPLOYMENT.md) for the active Render setup and production verification.
