# Deployment

## 1. Local development

See [README](../README.md#quick-start-local-development). Backend on `:8000`,
Vite frontend on `:5173`, any MongoDB reachable via `backend/.env`.

## 2. Docker Compose (production-style stack)

Files: `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`,
`docker-compose.yml`, `.env.example`.

```bash
cp .env.example .env
# edit .env: set a real SECRET_KEY (required — compose refuses to start without it)
docker compose up --build
```

- **Frontend**: http://localhost:3000 (nginx; SPA fallback + `/api` reverse
  proxy to `backend:8000`, so no CORS configuration is needed in this mode)
- **Backend**: http://localhost:8000/api/health →
  `{"status":"ok","database":"connected","model_loaded":true,...}`
- **MongoDB** 7 with the `mongo_data` named volume (persists across restarts);
  uploaded scan images live in the `uploads_data` volume.
- Healthchecks: `mongosh` ping for mongo; the backend image defines a Docker
  `HEALTHCHECK` with a 90-second start period covering TensorFlow model load.
- Logs: `docker compose logs -f backend` — uvicorn access logs + structured
  app logging.

### Environment variables

All variables are documented in [.env.example](../.env.example):

| Variable | Purpose | Notes |
|---|---|---|
| `SECRET_KEY` | JWT signing secret | **Required** — compose fails fast (`:?`) and the app refuses to start when `ENVIRONMENT=production` without it. Generate: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `MONGO_URL` | Mongo connection string | Compose sets `mongodb://mongo:27017` for the backend |
| `ENVIRONMENT` | `development` / `production` | Compose defaults to `production` |
| `CORS_ORIGIN` | Comma-separated allowed origins | Default includes `http://localhost:3000` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT lifetime | Default 1440 (24 h) |
| `MONGO_TLS_ALLOW_INVALID` | Dev-only TLS opt-out | Leave `0`/unset in production (TLS validation is ON by default) |
| `VITE_API_BASE_URL` | Backend URL baked in at **frontend build time** | Compose build arg; default `http://localhost:8000` |

No secrets are hardcoded in source; images exclude `.env` via `.dockerignore`.

### Production build notes

- Backend image: `python:3.13-slim` + OpenCV runtime libs, non-root-friendly
  layout, model + code baked in, `uvicorn` behind whatever TLS terminator you
  use.
- Frontend image: multi-stage — `node:22-alpine` builds Vite, then serves the
  static bundle from `nginx:1.27-alpine`.
- For a real deployment, point `VITE_API_BASE_URL` at the public API origin at
  **build time** and set `CORS_ORIGIN` to the public frontend origin.

## 3. Cloud deployment options (guidance)

| Piece | Option A | Option B |
|---|---|---|
| Database | MongoDB Atlas free tier (`MONGO_URL=mongodb+srv://...`) | Compose-managed mongo on a VM |
| Backend | Render / Railway / Fly.io / VM + Docker Compose | Same container as compose |
| Frontend | Vercel / Netlify / Cloudflare Pages (static build) | nginx container next to backend |

Checklist for any target:

1. Set `ENVIRONMENT=production` and a strong `SECRET_KEY` (secret manager, not
   the repo).
2. Set `MONGO_URL` to the Atlas/managed connection string; keep TLS validation on.
3. Set `CORS_ORIGIN` to the exact frontend origin(s).
4. Build the frontend with the correct `VITE_API_BASE_URL`.
5. Verify `/api/health`, a login, a scan upload, and a report export on the
   deployed URL.
6. Confirm signed-out API calls return 401 and cross-role calls return 403.

## 4. Verification status (honest)

- Docker/compose files are **written and reviewed** but **not built on this
  machine**: Docker is not installed (`docker: command not found`), so
  `docker compose up --build`, in-container model load, volume persistence, and
  healthchecks have **not been executed locally**. Run the commands in
  section 2 on a Docker-capable host to close this out.
- **No cloud deployment has been performed**, so there is no deployed URL to
  report. Section 3 is a configuration guide, not a record of a live deploy.
