"""Modal entry point for a single-origin FreshGuard deployment.

The React build is served by FastAPI, so browser requests remain same-origin.
Production secrets must be configured in Modal as ``freshguard-production``.
"""

from pathlib import Path

import modal


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FRONTEND_DIST = ROOT / "frontend" / "dist"
REMOTE_BACKEND = "/root/freshguard/backend"
REMOTE_FRONTEND = "/root/freshguard/frontend/dist"

if not (FRONTEND_DIST / "index.html").is_file():
    raise RuntimeError("Build frontend first: npm ci && npm run build with VITE_API_URL empty")

image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("libgl1", "libglib2.0-0")
    .run_commands(
        "pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu "
        "torch==2.1.1+cpu torchvision==0.16.1+cpu"
    )
    .pip_install_from_requirements(str(BACKEND / "requirements.txt"))
    .add_local_dir(
        str(BACKEND / "app"),
        f"{REMOTE_BACKEND}/app",
        copy=True,
        ignore=["**/__pycache__/**", "**/*.pyc", "**/test_*.py"],
    )
    .add_local_dir(str(BACKEND / "alembic"), f"{REMOTE_BACKEND}/alembic", copy=True)
    .add_local_file(str(BACKEND / "alembic.ini"), f"{REMOTE_BACKEND}/alembic.ini", copy=True)
    .add_local_dir(str(FRONTEND_DIST), REMOTE_FRONTEND, copy=True)
)

modal_app = modal.App("freshguard")


@modal_app.function(
    image=image,
    cpu=2,
    memory=4096,
    timeout=150,
    scaledown_window=60,
    max_containers=1,
    secrets=[modal.Secret.from_name("freshguard-production")],
)
@modal.asgi_app()
def freshguard_web():
    import os
    import subprocess
    import sys

    from fastapi import HTTPException
    from fastapi.responses import FileResponse
    from fastapi.staticfiles import StaticFiles

    database_url = os.getenv("DATABASE_URL", "")
    jwt_secret = os.getenv("JWT_SECRET", "")
    if not database_url.startswith("postgresql+psycopg://"):
        raise RuntimeError("DATABASE_URL must be a PostgreSQL psycopg URL")
    if len(jwt_secret) < 32:
        raise RuntimeError("JWT_SECRET must contain at least 32 characters")

    backend_path = REMOTE_BACKEND
    sys.path.insert(0, backend_path)
    subprocess.run(
        ["alembic", "-c", f"{REMOTE_BACKEND}/alembic.ini", "upgrade", "head"],
        cwd=backend_path,
        check=True,
    )

    from app.main import app as api

    frontend_path = Path(REMOTE_FRONTEND)
    index_path = frontend_path / "index.html"
    api.mount(
        "/assets",
        StaticFiles(directory=str(frontend_path / "assets")),
        name="frontend-assets",
    )

    api_roots = {"notifications"}
    for route in api.routes:
        route_path = getattr(route, "path", "")
        if route_path.startswith("/") and route_path != "/":
            root = route_path.strip("/").split("/", 1)[0]
            if root and not root.startswith("{"):
                api_roots.add(root)

    @api.get("/", include_in_schema=False)
    async def frontend_index():
        return FileResponse(index_path)

    @api.get("/{path:path}", include_in_schema=False)
    async def frontend_routes(path: str):
        if path.split("/", 1)[0] in api_roots:
            raise HTTPException(status_code=404, detail="Not found")
        requested = (frontend_path / path).resolve()
        if requested.is_relative_to(frontend_path) and requested.is_file():
            return FileResponse(requested)
        return FileResponse(index_path)

    return api
