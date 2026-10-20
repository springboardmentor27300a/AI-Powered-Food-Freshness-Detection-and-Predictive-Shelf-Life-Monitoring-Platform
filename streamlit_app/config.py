"""
Food Freshness Monitoring Platform - Streamlit Frontend Configuration
"""

import os
from pathlib import Path
from dotenv import load_dotenv

STREAMLIT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = STREAMLIT_DIR.parent

# Priority: streamlit_app/.env -> root .env
if (STREAMLIT_DIR / ".env").exists():
    load_dotenv(dotenv_path=STREAMLIT_DIR / ".env", override=True)
elif (PROJECT_ROOT / ".env").exists():
    load_dotenv(dotenv_path=PROJECT_ROOT / ".env")


class StreamlitConfig:
    APP_NAME: str = "Food Freshness Intelligence Platform"
    APP_TAGLINE: str = "Multi-Spectral AI Freshness & Cold Chain Integrity"
    APP_VERSION: str = "2.0.0 (Streamlit Edition)"

    # Backend runs on port 8000
    _default_url = f"http://127.0.0.1:{os.getenv('PORT', '8000')}/api"
    API_BASE_URL: str = os.getenv("API_BASE_URL", _default_url).rstrip("/")
    if not API_BASE_URL.endswith("/api") and not "/api/" in API_BASE_URL:
        API_BASE_URL = f"{API_BASE_URL}/api"

    API_TIMEOUT_SECONDS: int = int(os.getenv("API_TIMEOUT_SECONDS", "30"))

    # Authoritative Role Normalization Helper
    @staticmethod
    def normalize_role(role_name: str) -> str:
        if not role_name:
            return "Consumer"
        r = role_name.strip()
        lower = r.lower()
        if "admin" in lower:
            return "Admin"
        if "retail" in lower:
            return "Retailer"
        if "warehouse" in lower or "supply" in lower or "logistics" in lower:
            return "Warehouse Operator"
        if "inspect" in lower or "qa" in lower or "quality" in lower:
            return "Food Quality Inspector"
        return "Consumer"

    COLOR_PRIMARY = "#059669"
    COLOR_SECONDARY = "#0284c7"
    COLOR_SUCCESS = "#10b981"
    COLOR_WARNING = "#f59e0b"
    COLOR_DANGER = "#ef4444"
    COLOR_DARK = "#0f172a"
    COLOR_LIGHT = "#f8fafc"


config = StreamlitConfig()
