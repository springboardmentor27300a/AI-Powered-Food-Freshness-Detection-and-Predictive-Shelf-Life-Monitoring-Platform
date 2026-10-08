"""
Container entrypoint: make the backend safe to start with `docker compose up`.

Steps (no application logic changes - only startup orchestration):
  1. Wait until PostgreSQL is reachable (compose may still be starting it).
  2. Create missing tables (same call FastAPI already performs on startup).
  3. Run the existing idempotent seed script so demo logins work immediately.
  4. Start uvicorn with the existing application entry point.

Written in Python (instead of a shell script) so it behaves identically on
Windows and Linux hosts regardless of line endings.
"""
import subprocess
import sys
import time

from sqlalchemy import create_engine

from app.config import settings

DB_WAIT_ATTEMPTS = 30
DB_WAIT_SECONDS = 2


def wait_for_database() -> None:
    for attempt in range(1, DB_WAIT_ATTEMPTS + 1):
        try:
            create_engine(settings.DATABASE_URL).connect().close()
            print("database is reachable", flush=True)
            return
        except Exception as exc:  # pragma: no cover - startup only
            print(f"waiting for database ({attempt}/{DB_WAIT_ATTEMPTS}): {exc}", flush=True)
            time.sleep(DB_WAIT_SECONDS)
    sys.exit("database is not reachable - aborting startup")


def prepare_database() -> None:
    from app.database import Base, engine

    Base.metadata.create_all(bind=engine)
    # Existing, idempotent seed script (skips when demo users already exist).
    result = subprocess.run([sys.executable, "seed.py"], check=False)
    if result.returncode != 0:
        print("warning: seed script returned a non-zero exit code (continuing)", flush=True)


def main() -> None:
    wait_for_database()
    prepare_database()
    sys.exit(
        subprocess.call(
            ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
        )
    )


if __name__ == "__main__":
    main()
