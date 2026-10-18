import sys
from pathlib import Path

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pytest
from backend.app.database import connect_to_mongo, close_mongo_connection

@pytest.fixture(scope="session", autouse=True)
def setup_mongo_session():
    connect_to_mongo()
    yield
    close_mongo_connection()
