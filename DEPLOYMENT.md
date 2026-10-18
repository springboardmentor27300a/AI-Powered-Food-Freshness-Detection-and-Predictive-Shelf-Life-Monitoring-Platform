# FreshGuard deployment plan

> Historical Modal deployment draft, retained for reference. The current
> deployment target is Render Free with the existing Neon project; see
> [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md). `deploy/modal_app.py` is
> preserved but must not be deployed for the Render setup.

## Selected no-Oracle route

- **Application and ML API:** Modal Starter, using the included `deploy/modal_app.py`
  ASGI entry point to run FastAPI and serve the built React files from the same
  origin. This avoids a separate frontend account and cross-origin requests.
- **Database:** Neon Free PostgreSQL, using a pooled SSL connection string. The
  app applies Alembic migrations when the Modal worker starts.
- **Cost guard:** Modal currently lists $30/month in compute credits on Starter,
  but Starter is pay-as-you-go after credits. Set the Modal workspace spend limit
  to **$0** before deployment. The spend limit stops work that would create an
  out-of-pocket charge; when the free allowance is used, the app can stop
  responding until the next cycle. Do not enable a paid plan or increase the
  spend limit.

This is a low-traffic demo architecture, not an always-on service guarantee.
Modal scales idle workers down; the first request after idle can have a cold
start. The function is limited to 2 vCPU, 4 GiB RAM, one container, and a
150-second request timeout. Monitor the $30 monthly compute allowance. Modal's
Starter plan includes 1 TiB/month egress and a 1 TiB volume allowance, but this
deployment does not need a persistent volume. The Neon database is capped at
1 GB and 100 compute-unit hours per project per month; it can scale to zero.
Neon's instant restore window is limited and is not a backup. Export periodic
`pg_dump` backups and verify restores separately.

Render's free web service has 0.1 CPU, 512 MB RAM and sleeps after 15 idle
minutes; its free PostgreSQL expires after 30 days. It is too small for this ML
backend and unsuitable for persistent app data. Hugging Face reports 2 vCPU and
16 GB RAM for CPU Basic, but creating a Gradio or Docker Space requires a paid
plan for personal accounts. Cloud Run and similar metered cloud products can
bill when quotas are exceeded, so they are not selected here.

Provider limits checked against current official documentation on 2026-10-18:

- [Modal pricing and Starter credits](https://modal.com/pricing)
- [Modal spend limits](https://modal.com/docs/guide/budgets)
- [Modal FastAPI/ASGI web functions](https://modal.com/docs/guide/webhooks)
- [Neon pricing and free quotas](https://neon.com/pricing)
- [Neon connection instructions](https://neon.com/docs/connect/connect-from-any-app)
- [Render free service limits](https://render.com/docs/free)
- [Render free CPU and RAM](https://render.com/docs/compute-plans)
- [Hugging Face Spaces limits and account requirements](https://huggingface.co/docs/hub/spaces-overview)

## Manual setup required

Modal browser authorization is complete for the `lakshana-2007` workspace, and
the local CLI is installed in `deploy/.venv-modal`. The workspace currently has
no secrets and the CLI-readable workspace settings do not show a spend cap. Its
usage summary currently reports $0. Before deployment:

1. In Modal **Usage & Billing**, confirm/set the workspace spend limit to **$0**.
   Leave the Starter plan and do not add a paid service or raise this limit.
2. In the Modal console, create a secret named `freshguard-production` with
   `DATABASE_URL` and `JWT_SECRET`. Keep the values in the secret form only.
3. In Neon Console, open **Connect**, select the project branch/database/role,
   and use the pooled connection option. Neon requires TLS. Keep its URL private;
   set it as `DATABASE_URL` with the SQLAlchemy driver prefix
   `postgresql+psycopg://` and retain `sslmode=require`. Set a random `JWT_SECRET`
   of at least 32 characters directly in the Modal secret form.
4. Once the zero-spend cap and secret are configured, deploy from the repository
   root with `deploy/.venv-modal/Scripts/modal.exe deploy deploy/modal_app.py`.

The Modal function serves the React bundle and API from one origin, so normal
frontend API calls are same-origin and do not require a permissive CORS rule.
If a separate frontend host is added later, set `CORS_ORIGINS` to its exact
HTTPS origin in the Modal secret.

## Build and deploy

Run from the repository root in PowerShell after Modal authorization. The
frontend build must use a blank `VITE_API_URL` so production API calls are
relative to the same origin:

```powershell
cd frontend
npm ci
$env:VITE_API_URL = ""
npm run build
Remove-Item Env:VITE_API_URL
cd ..
python -m pip install "modal>=1.6,<2"
modal deploy deploy/modal_app.py
```

`deploy/modal_app.py` builds a CPU-only Python 3.10 image remotely, includes the
production backend code, Alembic migrations, required model files, and
`frontend/dist`, then starts FastAPI behind Modal's HTTPS endpoint. The existing
Dockerfile remains available for Docker-based hosting; this route does not
require the local Docker daemon.

Neon provides a pooled connection string by default in its Connect dialog and
requires TLS. The application needs `DATABASE_URL` and a random `JWT_SECRET` of
at least 32 characters. No real credentials belong in source control or logs.
The app applies migrations on worker startup and fails startup if the database
URL is missing or is not PostgreSQL with the psycopg driver.

## Model behavior and known limitations

- The deployment keeps the legacy 10 MB freshness model and the M3 shelf-life
  artifacts; it excludes unapproved candidate checkpoints and training data.
- The M2 v2 approval registry has no approved models. Its workflow must abstain
  and explain that no approved model is available.
- The legacy MobileNetV2 classifier was trained for six apple, banana, and
  orange labels. It is not a general food freshness or food-safety classifier.
- Synthetic M3 category models remain demonstrations, not validated shelf-life
  claims.
- Modal workers are ephemeral and scale to zero. Persist user data only in
  Neon; do not rely on local container files for uploads or database state.
- Image upload, authentication, inventory persistence, and all ML workflows
  remain unverified against a real hosted service.

## Verification status

- Local and published GitHub branch/commit: `deploy/freshguard-free` at
  `08d682444a9babd78bde531e0b82b884d07348f6` (verified with `git ls-remote`).
- Frontend production build with blank `VITE_API_URL`: passed locally.
- Backend suite: NOT PASS. Test collection stops because `h5py` is missing;
  excluding two nested candidate tests, 32 tests passed and the suite failed on
  the missing `/notifications` endpoint (expected 200, received 404).
- Local Docker build: NOT TESTED; Docker Desktop daemon is unavailable.
- Modal remote image build, Neon connection, public health check, browser CORS,
  registration/login, role authorization, inventory persistence, image
  analysis, shelf-life workflows, logs, and restart behavior: NOT TESTED.
- Modal authorization: verified; workspace usage summary reports $0.
- Spend cap: NOT VERIFIED. Production secret: NOT CONFIGURED. No public URL has
  been created.

After authorization and deployment, verify `/health` and `/docs`, open the React
page, register a synthetic test user, exercise role checks and inventory CRUD,
test accepted/rejected image uploads, test supported and unsupported
shelf-life categories, and confirm data survives a worker restart. Do not call
the deployment successful until those checks pass.

## Redeploy and rollback

Redeploy with `modal deploy deploy/modal_app.py` from a reviewed local commit.
Rollback by deploying the previously verified commit. Export the Neon database
before schema changes; do not delete or reset the production database as a
rollback step.
