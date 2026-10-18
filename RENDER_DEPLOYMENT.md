# FreshGuard Render deployment

This is the active, no-Oracle deployment plan. The existing Modal entrypoint
and local Modal authorization remain preserved, but Modal is not used here.
The Render Blueprint uses two free services and the already-created Neon
PostgreSQL project; it does not create a second database.

## Architecture and free-tier limits

- `freshguard-frontend`: Render Free Static Site, React/Vite CDN, SPA rewrite to
  `index.html`. Its build receives the backend HTTPS URL through `VITE_API_URL`.
- `freshguard-api`: Render Free Web Service, FastAPI, CPU-only PyTorch, one
  Uvicorn worker, up to ten concurrent requests (including Render health
  probes), and at most one in-memory M3 pipeline at a time.
- Existing Neon project: Free plan must be confirmed in its console. Current
  published Free limits are 1 GB storage and 100 compute-unit hours per project
  per month; compute can scale to zero and is capped at 2 CU. The project is not
  replaced or reset by this plan.

Render's Free web service currently has 0.1 CPU and 512 MB RAM, sleeps after 15
minutes without inbound traffic, and can take about a minute to wake. It has no
persistent disk. Render provides 750 Free instance hours per workspace per
calendar month, shared by free web services. Static assets and services also
count against workspace bandwidth and build-pipeline allowances. If a payment
method is attached, overages for bandwidth or build minutes can be billed; with
no payment method, Render suspends affected services or disables new builds
when an allowance is exhausted. Do not add a payment method or upgrade. A usage
alert is not a billing cap.

Neon's Free quota is also finite. If its compute or storage allowance is
exhausted, database access may be paused or require a plan change. Confirm the
existing project's plan and usage before deploying; do not attach billing or
upgrade to resolve a limit.

Current provider sources (checked 2026-10-18):

- [Render Free services and overage behavior](https://render.com/docs/free)
- [Render Free CPU and RAM](https://render.com/docs/compute-plans)
- [Render Python version selection](https://render.com/docs/python-version)
- [Render Node.js version selection](https://render.com/docs/node-version)
- [Render Blueprint reference](https://render.com/docs/blueprint-spec)
- [Neon Free plan limits](https://neon.com/blog/neon-free-plan-1-gb-per-project)
- [Neon connection instructions](https://neon.com/docs/connect/connect-from-any-app)

## Memory and model behavior

Measured locally with Python 3.10 and the actual application:

- API import/startup RSS after lazy-loading M3 models: about 82 MiB.
- Tomato M3 inference after loading one real/traceable pipeline: about 168 MiB
  RSS, with exactly one M3 pipeline retained.
- Legacy freshness inference RSS after loading its actual checkpoint: about
  297 MiB peak.
- These local measurements leave headroom under 512 MiB, but Render's runtime
  overhead, 0.1 CPU performance, and real hosted requests are not verified yet.
  The Blueprint uses one worker and image limits of 10 MB, 4096 pixels per side,
  and 4 million decoded pixels to limit memory spikes.

The legacy freshness model recognizes six apple, banana, and orange labels; it
is not a general food freshness model and does not establish food safety. The
M2 v2 registry currently has no approved inference models, so M2 reports an
explicit `not_assessed` abstention while preserving visual metrics. M3's
synthetic-category models remain demonstrations, not validated shelf-life
claims. The real/traceable category models preserve their domain checks. M3
pipelines are lazy-loaded by category and only one is retained at once.

## Render setup

`render.yaml` defines the free API and static frontend on branch `Lakshana` in
this company repository. The currently running public services still deploy
from the original FreshGuard repository's `deploy/freshguard-free` branch; this
copy does not alter those services. If creating a Blueprint from this company
repository, connect the company repository and select `Lakshana`. Before
creating or linking services:

1. Connect Render to this company repository and choose `Lakshana` when creating
   a Blueprint from `render.yaml`.
2. Confirm the plan shown for `freshguard-api` is **Free** and keep the
   workspace on a free plan. Do not add a payment method. Before applying the
   Blueprint, verify no payment method is already linked to the workspace:
   Render can bill bandwidth/build-pipeline overages when one is attached. If one
   is present and removing it could affect another service, stop before creating
   anything and review the billing settings manually.
3. When prompted for `DATABASE_URL`, copy the existing Neon project's pooled
   connection URL from Neon **Connect**, retain TLS (`sslmode=require`), and use
   the SQLAlchemy prefix `postgresql+psycopg://`. Enter it only in Render's
   private environment-variable prompt. Do not send it in chat or commit it.
4. Keep Render's generated `JWT_SECRET`. Do not expose it in build logs or the
   browser bundle.
5. The existing production service URLs are
   `https://freshguard-frontend-qq1l.onrender.com` and
   `https://freshguard-api-mp6c.onrender.com`. Set `CORS_ORIGINS` on the API to
   the exact frontend origin and `VITE_API_URL` on the static site to the API
   origin. Restart/redeploy the API after changing CORS; rebuild/redeploy the
   static site after changing Vite's build-time value.

The API applies the existing Alembic migrations at service startup. The latest
M2 history migration is additive; no database reset or destructive migration is
part of this deployment. Do not change the database URL or reset the existing
Neon project when linking a deployment.

## Production hostname correction

The public frontend responds 200 and its built JavaScript uses the assigned API
hostname. The API `/health` and `/demo/health` routes respond 200. An empty JSON
POST to `/auth/login` returns 422 validation, confirming the route exists
without attempting real authentication. On 2026-10-18, CORS preflights for
authenticated GET and JSON POST requests returned 200 with the exact frontend
origin allowed. A protected GET with a dummy invalid token returned 401 and the
correct CORS header. No production credentials or accounts were used. A real
user login still requires an authorized test account and was not performed.

The Modal files are preserved, but this Render deployment does not invoke them.
