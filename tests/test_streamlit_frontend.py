"""
Integration and Unit Tests for Streamlit Frontend Architecture
Verifies config loading, API client request/error handling, RBAC normalization,
and component generation without modifying existing backend tests.
"""

import pytest
from unittest.mock import patch, MagicMock

try:
    from streamlit_app.config import config, StreamlitConfig
    from streamlit_app.api_client import ApiClient, ApiException
    from streamlit_app.components.charts import (
        render_freshness_donut_chart,
        render_arrhenius_degradation_chart,
        render_warehouse_telemetry_chart,
        render_defect_matrix_bar_chart,
    )
except ImportError:
    pytest.skip("streamlit_app module not present in this branch", allow_module_level=True)


def test_streamlit_config_defaults():
    """Verify default Streamlit configuration properties and role normalization."""
    assert "Food Freshness" in config.APP_NAME
    assert config.API_TIMEOUT_SECONDS >= 10
    assert config.API_BASE_URL.endswith("/api")

    # Role normalization tests
    assert config.normalize_role("Consumer") == "Consumer"
    assert config.normalize_role("consumer") == "Consumer"
    assert config.normalize_role("Retailer") == "Retailer"
    assert config.normalize_role("retail") == "Retailer"
    assert config.normalize_role("Warehouse Manager") == "Warehouse Operator"
    assert config.normalize_role("Supply Chain Operator") == "Warehouse Operator"
    assert config.normalize_role("Food Quality Inspector") == "Food Quality Inspector"
    assert config.normalize_role("Quality Inspector") == "Food Quality Inspector"
    assert config.normalize_role("Admin") == "Admin"
    assert config.normalize_role("Administrator") == "Admin"
    assert config.normalize_role(None) == "Consumer"


def test_api_client_initialization():
    """Verify ApiClient initialization and URL formatting."""
    client = ApiClient(base_url="http://127.0.0.1:8000/api", timeout=15)
    assert client.base_url == "http://127.0.0.1:8000/api"
    assert client.timeout == 15


def test_api_client_header_injection():
    """Verify Bearer token injection and header construction."""
    client = ApiClient()
    headers = client._build_headers(token="mock_jwt_token_123")
    assert headers["Authorization"] == "Bearer mock_jwt_token_123"
    assert headers["Content-Type"] == "application/json"

    # Multipart uploads should not force Content-Type
    multi_headers = client._build_headers(token="mock_jwt_token_123", is_multipart=True)
    assert "Content-Type" not in multi_headers
    assert multi_headers["Authorization"] == "Bearer mock_jwt_token_123"


def test_api_client_error_handling_401():
    """Verify that HTTP 401 raises ApiException with status 401."""
    client = ApiClient()
    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.ok = False
    mock_resp.json.return_value = {"detail": "Token expired or invalid"}

    with pytest.raises(ApiException) as exc_info:
        client._handle_response(mock_resp)
    assert exc_info.value.status_code == 401
    assert "Token expired" in str(exc_info.value)


def test_api_client_error_handling_422_pydantic():
    """Verify formatting of Pydantic validation error lists."""
    client = ApiClient()
    mock_resp = MagicMock()
    mock_resp.status_code = 422
    mock_resp.ok = False
    mock_resp.json.return_value = {
        "detail": [
            {"loc": ["body", "email"], "msg": "value is not a valid email address"},
            {"loc": ["body", "password"], "msg": "field required"}
        ]
    }

    with pytest.raises(ApiException) as exc_info:
        client._handle_response(mock_resp)
    assert exc_info.value.status_code == 422
    assert "email" in str(exc_info.value)
    assert "password" in str(exc_info.value)


def test_chart_component_generators():
    """Verify Plotly figure generation for dashboards."""
    # Donut chart
    donut = render_freshness_donut_chart(fresh_count=10, expiring_count=3, spoiled_count=1)
    assert donut is not None
    assert len(donut.data) == 1

    # Arrhenius degradation curve
    forecast = [
        {"day_offset": 1, "predicted_quality_score": 90.0},
        {"day_offset": 2, "predicted_quality_score": 82.0},
        {"day_offset": 3, "predicted_quality_score": 70.0},
    ]
    arrh = render_arrhenius_degradation_chart(forecast, current_score=95.0)
    assert arrh is not None
    assert len(arrh.data) == 1

    # Telemetry time series
    readings = [
        {"timestamp": "2026-10-18T10:00:00", "temperature": 3.8, "humidity": 86.0},
        {"timestamp": "2026-10-18T11:00:00", "temperature": 4.1, "humidity": 87.0},
    ]
    telemetry = render_warehouse_telemetry_chart(readings)
    assert telemetry is not None
    assert len(telemetry.data) == 2

    # Defect bar chart
    defects = {"Mold": 12.0, "Bruising": 35.0, "Oxidation": 20.0}
    bar = render_defect_matrix_bar_chart(defects)
    assert bar is not None
    assert len(bar.data) == 1


import unittest

class TestStreamlitFrontendSuite(unittest.TestCase):
    def test_streamlit_config(self):
        test_streamlit_config_defaults()

    def test_api_client_init(self):
        test_api_client_initialization()

    def test_api_client_headers(self):
        test_api_client_header_injection()

    def test_api_client_401(self):
        test_api_client_error_handling_401()

    def test_api_client_422(self):
        test_api_client_error_handling_422_pydantic()

    def test_charts(self):
        test_chart_component_generators()

