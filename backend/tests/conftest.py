"""
Test setup: point the app at a throwaway SQLite file BEFORE the app is
imported, so tests never touch your PostgreSQL database or .env data.
"""
import os
import tempfile

_TMP = tempfile.mkdtemp(prefix="ff_tests_")
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(_TMP, 'test.db')}"
os.environ["JWT_SECRET_KEY"] = "test-only-secret-not-used-anywhere-else"
