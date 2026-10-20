"""
Food Freshness Monitoring Platform - Central API Client
Communicates with FastAPI backend on port 8000.
"""

import logging
from typing import Dict, Any, Optional, List
import requests

from streamlit_app.config import config

logger = logging.getLogger(__name__)


class ApiException(Exception):
    def __init__(self, message: str, status_code: int = 500, detail: Any = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.detail = detail

    def __str__(self):
        return f"[HTTP {self.status_code}] {self.message}"


class ApiClient:
    def __init__(self, base_url: Optional[str] = None, timeout: Optional[int] = None):
        self.base_url = (base_url or config.API_BASE_URL).rstrip("/")
        self.timeout = timeout or config.API_TIMEOUT_SECONDS

    def _get_token(self, override_token: Optional[str] = None) -> Optional[str]:
        if override_token:
            return override_token
        try:
            import streamlit as st
            return st.session_state.get("token")
        except Exception:
            return None

    def _build_headers(
        self,
        token: Optional[str] = None,
        custom_headers: Optional[Dict[str, str]] = None,
        is_multipart: bool = False
    ) -> Dict[str, str]:
        headers = {}
        if not is_multipart:
            headers["Content-Type"] = "application/json"

        jwt_token = self._get_token(token)
        if jwt_token:
            headers["Authorization"] = f"Bearer {jwt_token}"

        if custom_headers:
            headers.update(custom_headers)
        return headers

    def _handle_response(self, response: requests.Response) -> Any:
        if response.status_code == 401:
            try:
                import streamlit as st
                st.session_state["session_expired"] = True
            except Exception:
                pass
            try:
                err_json = response.json()
                msg = err_json.get("detail", "Session expired or invalid credentials. Please log in.")
            except Exception:
                msg = "Authentication failed. Session expired or unauthorized."
            raise ApiException(msg, status_code=401)

        if response.status_code == 204:
            return None

        try:
            data = response.json()
        except Exception:
            data = {"raw": response.text}

        if not response.ok:
            error_msg = f"Request failed with status {response.status_code}."
            if isinstance(data, dict):
                detail = data.get("detail")
                if detail:
                    if isinstance(detail, list):
                        parts = []
                        for d in detail:
                            loc = " -> ".join(str(x) for x in d.get("loc", []))
                            parts.append(f"{loc}: {d.get('msg', '')}")
                        error_msg = "; ".join(parts)
                    else:
                        error_msg = str(detail)
                elif data.get("message"):
                    error_msg = str(data["message"])

            raise ApiException(error_msg, status_code=response.status_code, detail=data)

        return data

    def request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Any] = None,
        data: Optional[Any] = None,
        files: Optional[Any] = None,
        token: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[int] = None
    ) -> Any:
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        is_multipart = files is not None
        req_headers = self._build_headers(token=token, custom_headers=headers, is_multipart=is_multipart)
        req_timeout = timeout or self.timeout

        try:
            resp = requests.request(
                method=method.upper(),
                url=url,
                params=params,
                json=json,
                data=data,
                files=files,
                headers=req_headers,
                timeout=req_timeout
            )
            return self._handle_response(resp)
        except requests.exceptions.ConnectionError:
            msg = f"Unable to connect to backend at {self.base_url}. Ensure FastAPI is running on port 8000."
            logger.error("ConnectionError: %s", msg)
            raise ApiException(msg, status_code=503)
        except requests.exceptions.Timeout:
            msg = f"Request timed out after {req_timeout}s at {endpoint}."
            logger.error("Timeout: %s", msg)
            raise ApiException(msg, status_code=504)
        except ApiException:
            raise
        except Exception as e:
            msg = f"Unexpected communication error: {str(e)}"
            logger.exception("Unexpected API request exception")
            raise ApiException(msg, status_code=500)

    def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None, **kwargs) -> Any:
        return self.request("GET", endpoint, params=params, **kwargs)

    def post(self, endpoint: str, json: Optional[Any] = None, **kwargs) -> Any:
        return self.request("POST", endpoint, json=json, **kwargs)

    def put(self, endpoint: str, json: Optional[Any] = None, **kwargs) -> Any:
        return self.request("PUT", endpoint, json=json, **kwargs)

    def patch(self, endpoint: str, json: Optional[Any] = None, **kwargs) -> Any:
        return self.request("PATCH", endpoint, json=json, **kwargs)

    def delete(self, endpoint: str, **kwargs) -> Any:
        return self.request("DELETE", endpoint, **kwargs)

    def check_health(self) -> Dict[str, Any]:
        root_url = self.base_url.replace("/api", "")
        try:
            res = requests.get(f"{root_url}/health", timeout=5)
            if res.ok:
                return res.json()
        except Exception:
            pass
        return self.get("/health")

    # Authentication
    def login(self, email: str, password: str) -> Dict[str, Any]:
        return self.post("/auth/login", json={"email": email.strip(), "password": password})

    def register(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        return self.post("/auth/register", json=user_data)

    def get_me(self) -> Dict[str, Any]:
        return self.get("/auth/me")

    def get_dashboard_access(self) -> Dict[str, Any]:
        return self.get("/auth/dashboard-access")

    # AI Freshness, Spoilage & Shelf-Life
    def quick_scan_food(
        self,
        file_bytes: Optional[bytes] = None,
        file_name: Optional[str] = None,
        image_url: Optional[str] = None,
        category: str = "Fruits",
        food_name: str = "Food Item",
        storage_temp: Optional[float] = None,
        storage_humidity: Optional[float] = None
    ) -> Dict[str, Any]:
        data = {"category": category, "food_name": food_name or "Food Item"}
        if image_url:
            data["image_url"] = image_url
        if storage_temp is not None:
            data["storage_temperature"] = str(storage_temp)
        if storage_humidity is not None:
            data["storage_humidity"] = str(storage_humidity)

        files = None
        if file_bytes and file_name:
            files = {"file": (file_name, file_bytes, "image/jpeg")}

        return self.request("POST", "/freshness/quick-scan", data=data, files=files)

    def analyze_freshness(self, inventory_id: str, image_url: Optional[str] = None) -> Dict[str, Any]:
        payload = {"inventory_id": inventory_id}
        if image_url:
            payload["image_url"] = image_url
        return self.post("/freshness/analyze", json=payload)

    def detect_spoilage(self, inventory_id: str, gas_sensor_ppm: float = 0.0) -> Dict[str, Any]:
        return self.post("/spoilage/detect", json={"inventory_id": inventory_id, "gas_sensor_ppm": gas_sensor_ppm})

    def predict_shelf_life(
        self,
        inventory_id: str,
        current_temp: Optional[float] = None,
        current_humidity: Optional[float] = None,
        packaging_type: str = "Standard Pack"
    ) -> Dict[str, Any]:
        payload = {
            "inventory_id": inventory_id,
            "current_temp": current_temp,
            "current_humidity": current_humidity,
            "packaging_type": packaging_type,
        }
        return self.post("/shelf-life/predict", json=payload)

    def simulate_shelf_life(
        self,
        category: str,
        food_name: str,
        storage_temp: float,
        storage_humidity: float,
        current_freshness_score: float = 90.0,
        packaging_type: str = "Standard Pack"
    ) -> Dict[str, Any]:
        payload = {
            "category": category,
            "food_name": food_name,
            "storage_temperature": storage_temp,
            "storage_humidity": storage_humidity,
            "current_freshness_score": current_freshness_score,
            "packaging_type": packaging_type,
        }
        return self.post("/shelf-life/simulate", json=payload)

    def get_recommendations(self, inventory_id: str) -> Dict[str, Any]:
        return self.get(f"/recommendations/{inventory_id}")

    def get_recommendations_by_category(self, category: str) -> Dict[str, Any]:
        return self.get(f"/recommendations/by-category/{category}")

    def get_freshness_history(self, inventory_id: Optional[str] = None, limit: int = 50, skip: int = 0) -> List[Dict[str, Any]]:
        if inventory_id:
            return self.get(f"/freshness/history/{inventory_id}")
        return self.get("/freshness/history", params={"limit": limit, "skip": skip})

    def get_freshness_summary(self) -> Dict[str, Any]:
        return self.get("/freshness/summary")

    def get_shelf_life_commodities(self) -> Dict[str, Any]:
        return self.get("/shelf-life/commodities")

    def get_storage_guidelines(self) -> Dict[str, Any]:
        return self.get("/freshness/storage-guidelines")

    # Inventory
    def get_inventory(
        self,
        category: Optional[str] = None,
        freshness_status: Optional[str] = None,
        storage_type: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        params = {"limit": limit, "skip": skip}
        if category and category != "All": params["category"] = category
        if freshness_status and freshness_status != "All": params["freshness_status"] = freshness_status
        if storage_type and storage_type != "All": params["storage_type"] = storage_type
        if search: params["search"] = search
        return self.get("/inventory", params=params)

    def get_inventory_item(self, item_id: str) -> Dict[str, Any]:
        return self.get(f"/inventory/{item_id}")

    def create_inventory_item(self, item_data: Dict[str, Any]) -> Dict[str, Any]:
        return self.post("/inventory", json=item_data)

    def update_inventory_item(self, item_id: str, item_data: Dict[str, Any]) -> Dict[str, Any]:
        return self.put(f"/inventory/{item_id}", json=item_data)

    def delete_inventory_item(self, item_id: str) -> Dict[str, Any]:
        return self.delete(f"/inventory/{item_id}")

    # Retailer
    def get_retailer_dashboard(self) -> Dict[str, Any]:
        return self.get("/retailer/dashboard")

    def get_retailer_inventory(
        self,
        category: Optional[str] = None,
        freshness: Optional[str] = None,
        stock_status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        page: int = 1
    ) -> Dict[str, Any]:
        params = {"limit": limit, "page": page}
        if category and category != "All": params["category"] = category
        if freshness and freshness != "All": params["freshness"] = freshness
        if stock_status and stock_status != "All": params["stock_status"] = stock_status
        if search: params["search"] = search
        return self.get("/retailer/inventory", params=params)

    def get_retailer_product(self, product_id: str) -> Dict[str, Any]:
        return self.get(f"/retailer/inventory/{product_id}")

    def create_retailer_product(self, product_data: Dict[str, Any]) -> Dict[str, Any]:
        return self.post("/retailer/inventory", json=product_data)

    def update_retailer_product(self, product_id: str, product_data: Dict[str, Any]) -> Dict[str, Any]:
        return self.put(f"/retailer/inventory/{product_id}", json=product_data)

    def update_retailer_stock(self, product_id: str, stock_data: Dict[str, Any]) -> Dict[str, Any]:
        return self.patch(f"/retailer/inventory/{product_id}/stock", json=stock_data)

    def archive_retailer_product(self, product_id: str, is_archived: bool, reason: str = "") -> Dict[str, Any]:
        return self.patch(f"/retailer/inventory/{product_id}/archive", json={"is_archived": is_archived, "reason": reason})

    def delete_retailer_product(self, product_id: str) -> Dict[str, Any]:
        return self.delete(f"/retailer/inventory/{product_id}")

    def analyze_retailer_product(self, product_id: str, image_url: Optional[str] = None) -> Dict[str, Any]:
        return self.post(f"/retailer/inventory/{product_id}/analyze", json={"image_url": image_url})

    def get_retailer_expiry(self, threshold_days: int = 7) -> Dict[str, Any]:
        return self.get("/retailer/expiry", params={"threshold_days": threshold_days})

    def get_retailer_shelf_life(self) -> Dict[str, Any]:
        return self.get("/retailer/shelf-life")

    def get_retailer_alerts(self, status_filter: str = "Active") -> Dict[str, Any]:
        return self.get("/retailer/alerts", params={"status_filter": status_filter})

    def acknowledge_retailer_alert(self, alert_id: str, note: str = "") -> Dict[str, Any]:
        return self.patch(f"/retailer/alerts/{alert_id}/acknowledge", json={"note": note})

    def get_retailer_storage(self) -> Dict[str, Any]:
        return self.get("/retailer/storage")

    def get_retailer_waste_reduction(self) -> Dict[str, Any]:
        return self.get("/retailer/waste-reduction")

    def get_retailer_analytics(self) -> Dict[str, Any]:
        return self.get("/retailer/analytics")

    def get_retailer_notifications(self) -> Dict[str, Any]:
        return self.get("/retailer/notifications")

    # Warehouse Operator
    def get_warehouse_dashboard(self) -> Dict[str, Any]:
        return self.get("/warehouse/dashboard")

    def get_warehouse_zones(self) -> List[Dict[str, Any]]:
        return self.get("/warehouse/zones")

    def get_warehouse_zone(self, zone_id: str) -> Dict[str, Any]:
        return self.get(f"/warehouse/zones/{zone_id}")

    def get_warehouse_zone_telemetry(self, zone_id: str) -> Dict[str, Any]:
        return self.get(f"/warehouse/zones/{zone_id}/temperature")

    def get_warehouse_zone_history(self, zone_id: str, hours: int = 24) -> Dict[str, Any]:
        return self.get(f"/warehouse/zones/{zone_id}/temperature/history", params={"hours": hours})

    def submit_warehouse_temperature_command(
        self,
        zone_id: str,
        requested_temp: float,
        reason: str,
        force_override: bool = False
    ) -> Dict[str, Any]:
        payload = {"requested_temperature": float(requested_temp), "reason": reason, "force_override": force_override}
        return self.post(f"/warehouse/zones/{zone_id}/temperature/commands", json=payload)

    def get_warehouse_command_status(self, command_id: str) -> Dict[str, Any]:
        return self.get(f"/warehouse/temperature/commands/{command_id}")

    def get_warehouse_alerts(self, zone_id: Optional[str] = None, severity: Optional[str] = None) -> List[Dict[str, Any]]:
        params = {}
        if zone_id and zone_id != "All": params["zone_id"] = zone_id
        if severity and severity != "All": params["severity"] = severity
        return self.get("/warehouse/alerts", params=params)

    def get_warehouse_audit_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        return self.get("/warehouse/audit-logs", params={"limit": limit})

    # Food Quality Inspector
    def get_inspector_dashboard(self) -> Dict[str, Any]:
        return self.get("/inspector/dashboard")

    def get_inspector_inspections(
        self,
        status: Optional[str] = None,
        grade: Optional[str] = None,
        batch_id: Optional[str] = None,
        limit: int = 50,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        params = {"limit": limit, "skip": skip}
        if status and status != "All": params["status"] = status
        if grade and grade != "All": params["grade"] = grade
        if batch_id: params["batch_id"] = batch_id
        return self.get("/inspector/inspections", params=params)

    def create_inspector_inspection(
        self,
        file_bytes: Optional[bytes] = None,
        file_name: Optional[str] = None,
        product_name: str = "Food Item",
        food_name: Optional[str] = None,
        category: str = "Fruits",
        batch_number: Optional[str] = None,
        inventory_id: Optional[str] = None,
        storage_temperature: Optional[float] = None,
        storage_humidity: Optional[float] = None,
        storage_location: Optional[str] = None,
        notes: str = "",
        image_url: Optional[str] = None
    ) -> Dict[str, Any]:
        p_name = food_name or product_name or "Food Item"
        data = {
            "product_name": p_name,
            "category": category,
            "batch_number": batch_number or f"BATCH-{category[:3].upper()}-01",
            "storage_location": storage_location or "Cold Bay 1",
            "notes": notes,
        }
        if inventory_id:
            data["inventory_id"] = inventory_id
        if storage_temperature is not None:
            data["storage_temperature"] = str(storage_temperature)
        if storage_humidity is not None:
            data["storage_humidity"] = str(storage_humidity)
        if image_url:
            data["image_url"] = image_url

        files = None
        if file_bytes and file_name:
            files = {"file": (file_name, file_bytes, "image/jpeg")}
        return self.request("POST", "/inspector/inspections", data=data, files=files)

    def get_inspector_inspection(self, inspection_id: str) -> Dict[str, Any]:
        return self.get(f"/inspector/inspections/{inspection_id}")

    def review_inspector_inspection(
        self,
        inspection_id: str,
        decision: str,
        reason: str = "",
        comments: str = "",
        adjusted_shelf_life: Optional[float] = None
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"decision": decision, "reason": reason, "comments": comments}
        if adjusted_shelf_life is not None:
            payload["adjusted_shelf_life"] = adjusted_shelf_life
        return self.patch(f"/inspector/inspections/{inspection_id}/review", json=payload)

    def flag_inspector_inspection(
        self,
        inspection_id: str,
        reason: str,
        issue_type: str = "Low Quality",
        severity: str = "Medium",
        comments: str = ""
    ) -> Dict[str, Any]:
        payload = {
            "issue_type": issue_type,
            "severity": severity,
            "reason": reason,
            "comments": comments,
        }
        return self.patch(f"/inspector/inspections/{inspection_id}/flag", json=payload)

    def get_inspector_history(self, category: Optional[str] = None, limit: int = 50, skip: int = 0) -> List[Dict[str, Any]]:
        params = {"limit": limit, "skip": skip}
        if category and category != "All": params["category"] = category
        return self.get("/inspector/inspection-history", params=params)

    def get_inspector_quality_analytics(self) -> Dict[str, Any]:
        return self.get("/inspector/quality-analytics")

    def get_inspector_alerts(self, status: str = "all") -> List[Dict[str, Any]]:
        return self.get("/inspector/alerts", params={"status": status})

    def resolve_inspector_alert(self, alert_id: str, resolution_notes: str, action_taken: str) -> Dict[str, Any]:
        return self.patch(f"/inspector/alerts/{alert_id}/resolve", json={"resolution_notes": resolution_notes, "action_taken": action_taken})

    def get_inspector_storage_review(self, category: str, temperature: Optional[float] = None, humidity: Optional[float] = None) -> Dict[str, Any]:
        params = {"category": category}
        if temperature is not None: params["temperature"] = temperature
        if humidity is not None: params["humidity"] = humidity
        return self.get("/inspector/storage-review", params=params)

    # Administrator
    def get_admin_dashboard(self) -> Dict[str, Any]:
        return self.get("/admin/dashboard")

    def get_admin_users(self, role: Optional[str] = None, status: Optional[str] = None, search: Optional[str] = None, limit: int = 50, skip: int = 0) -> List[Dict[str, Any]]:
        params = {"limit": limit, "skip": skip}
        if role and role != "All": params["role"] = role
        if status and status != "All": params["status"] = status
        if search: params["search"] = search
        return self.get("/admin/users", params=params)

    def get_admin_user(self, user_id: str) -> Dict[str, Any]:
        return self.get(f"/admin/users/{user_id}")

    def update_user_role(self, user_id: str, new_role: str) -> Dict[str, Any]:
        return self.patch(f"/admin/users/{user_id}/role", json={"role": new_role})

    def activate_user(self, user_id: str, reason: Optional[str] = None) -> Dict[str, Any]:
        return self.patch(f"/admin/users/{user_id}/activate", json={"status": "active", "reason": reason})

    def deactivate_user(self, user_id: str, reason: Optional[str] = None) -> Dict[str, Any]:
        return self.patch(f"/admin/users/{user_id}/deactivate", json={"status": "deactivated", "reason": reason})

    def get_admin_ai_stats(self) -> Dict[str, Any]:
        return self.get("/admin/ai/statistics")

    def get_admin_audit_logs(self, action: Optional[str] = None, user_id: Optional[str] = None, limit: int = 50, skip: int = 0) -> List[Dict[str, Any]]:
        params = {"limit": limit, "skip": skip}
        if action and action != "All": params["action"] = action
        if user_id: params["user_id"] = user_id
        return self.get("/admin/audit-logs", params=params)

    def get_admin_storage_rules(self) -> List[Dict[str, Any]]:
        return self.get("/admin/storage-rules")

    def create_admin_storage_rule(self, rule_data: Dict[str, Any]) -> Dict[str, Any]:
        return self.post("/admin/storage-rules", json=rule_data)

    def delete_admin_storage_rule(self, rule_id: str) -> Dict[str, Any]:
        return self.delete(f"/admin/storage-rules/{rule_id}")

    def get_admin_system_health(self) -> Dict[str, Any]:
        return self.get("/admin/system/health")

    def get_admin_system_config(self) -> Dict[str, Any]:
        return self.get("/admin/system/config")

    def update_admin_system_config(self, config_data: Dict[str, Any]) -> Dict[str, Any]:
        return self.put("/admin/system/config", json=config_data)

    # Notifications & Alerts
    def get_notifications(self, limit: int = 50) -> List[Dict[str, Any]]:
        return self.get("/notifications", params={"limit": limit})

    def get_unread_notifications_count(self) -> int:
        res = self.get("/notifications/unread-count")
        return int(res.get("unread_count", 0)) if isinstance(res, dict) else 0

    def mark_all_notifications_read(self) -> Dict[str, Any]:
        return self.post("/notifications/read-all")

    def acknowledge_alert(self, alert_id: str, note: str = "") -> Dict[str, Any]:
        return self.post(f"/alerts/{alert_id}/acknowledge", json={"note": note})

    # Reports
    def get_freshness_report(self) -> Dict[str, Any]:
        return self.get("/reports/freshness")

    def get_shelf_life_report(self) -> Dict[str, Any]:
        return self.get("/reports/shelf-life")

    def get_inventory_quality_report(self) -> Dict[str, Any]:
        return self.get("/reports/inventory-quality")

    def get_waste_reduction_report(self) -> Dict[str, Any]:
        return self.get("/reports/waste-reduction")

    def get_storage_compliance_report(self) -> Dict[str, Any]:
        return self.get("/reports/storage-compliance")


api_client = ApiClient()
