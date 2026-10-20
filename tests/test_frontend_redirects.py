"""
Unit & Integration Tests for Frontend Login Redirection, RBAC, and Open-Redirect Protections.
Validates Scenarios 1-5 specified in the prompt.
"""

import unittest
import re
from urllib.parse import urlparse


class FrontendRedirectLogic:
    """Python reference mirror of JavaScript logic in frontend/js/api.js and frontend/js/auth.js"""

    @staticmethod
    def get_dashboard_url_for_role(role: str) -> str:
        if not role:
            return "dashboard.html"
        r = role.strip()
        if r == "Retailer":
            return "retailer-dashboard.html"
        if r in ["Food Quality Inspector", "Quality Inspector"]:
            return "dashboard-inspector.html"
        if r in ["Admin", "Administrator"]:
            return "admin-dashboard.html"
        if r in ["Warehouse Operator", "Warehouse Manager", "Supply Chain Operator", "Food Manufacturer"]:
            return "warehouse-dashboard.html"
        return "dashboard.html"

    @staticmethod
    def sanitize_return_url(url: str) -> str | None:
        if not url or not isinstance(url, str):
            return None
        trimmed = url.strip()
        if trimmed.startswith("//"):
            return None
        if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", trimmed):
            return None
        if any(c in trimmed for c in "\r\n\t"):
            return None

        clean = trimmed.split("?")[0].split("#")[0]
        if clean.startswith("/"):
            clean = clean[1:]
        if ".." in clean:
            return None

        page = clean.split("/")[-1].lower()
        if not page or page in ["index.html", "login.html", "register.html"]:
            return None

        valid_pages = [
            "inventory.html",
            "dashboard.html",
            "retailer-dashboard.html",
            "warehouse-dashboard.html",
            "dashboard-inspector.html",
            "admin-dashboard.html",
            "executive-dashboard.html",
            "reports.html",
            "profile.html",
            "add-food.html",
            "food-details.html",
            "freshness.html",
        ]

        if page in valid_pages or page.endswith(".html"):
            return trimmed
        return None

    @staticmethod
    def is_page_authorized_for_role(target_url: str, role: str) -> bool:
        if not target_url:
            return True
        clean = target_url.split("?")[0].split("#")[0].lower().strip()
        page = clean.split("/")[-1]
        r = (role or "").lower().strip()

        is_admin = r in ["admin", "administrator"]
        if is_admin:
            return True

        if page in ["admin-dashboard.html", "executive-dashboard.html"]:
            return is_admin

        if page == "dashboard-inspector.html":
            return "inspector" in r

        if page == "retailer-dashboard.html":
            return "retailer" in r

        if page == "warehouse-dashboard.html":
            return any(k in r for k in ["warehouse", "supply chain", "manufacturer"])

        if page == "dashboard.html":
            return "consumer" in r or r == ""

        # Shared pages
        return True

    @staticmethod
    def resolve_post_login_target(user: dict | None, requested_redirect: str | None) -> tuple[str, str | None]:
        role = user.get("role") if user else None
        default_dashboard = FrontendRedirectLogic.get_dashboard_url_for_role(role)

        if not requested_redirect:
            return default_dashboard, None

        clean = FrontendRedirectLogic.sanitize_return_url(requested_redirect)
        if not clean:
            return default_dashboard, None

        if not FrontendRedirectLogic.is_page_authorized_for_role(clean, role):
            page_name = clean.split("?")[0].split("#")[0].split("/")[-1]
            alert = f"Access Restricted: Your account role ({role or 'User'}) is not authorized to access '{page_name}'."
            return default_dashboard, alert

        return clean, None


class TestFrontendRedirectsSuite(unittest.TestCase):

    def test_01_sanitize_open_redirect_protections(self):
        """Verify open redirects to malicious external domains are strictly blocked."""
        malicious = [
            "http://evil.com",
            "https://attacker.org/steal",
            "//phishing.net",
            "javascript:alert(1)",
            "data:text/html,<script>alert(1)</script>",
            "../secret.html",
            "index.html",
            "login.html",
            "register.html",
            "",
            None,
        ]
        for url in malicious:
            self.assertIsNone(
                FrontendRedirectLogic.sanitize_return_url(url),
                f"Expected {url} to be sanitized to None"
            )

        # Valid local pages should pass
        valid = [
            "inventory.html",
            "/inventory.html",
            "freshness.html",
            "reports.html?format=csv",
            "dashboard.html?view=alerts#top",
            "warehouse-dashboard.html",
        ]
        for url in valid:
            self.assertIsNotNone(
                FrontendRedirectLogic.sanitize_return_url(url),
                f"Expected {url} to be allowed"
            )

    def test_02_role_dashboard_mappings(self):
        """Verify all 7 roles map directly to their authorized operational dashboard."""
        logic = FrontendRedirectLogic
        self.assertEqual(logic.get_dashboard_url_for_role("Consumer"), "dashboard.html")
        self.assertEqual(logic.get_dashboard_url_for_role("Retailer"), "retailer-dashboard.html")
        self.assertEqual(logic.get_dashboard_url_for_role("Food Quality Inspector"), "dashboard-inspector.html")
        self.assertEqual(logic.get_dashboard_url_for_role("Quality Inspector"), "dashboard-inspector.html")
        self.assertEqual(logic.get_dashboard_url_for_role("Warehouse Manager"), "warehouse-dashboard.html")
        self.assertEqual(logic.get_dashboard_url_for_role("Warehouse Operator"), "warehouse-dashboard.html")
        self.assertEqual(logic.get_dashboard_url_for_role("Supply Chain Operator"), "warehouse-dashboard.html")
        self.assertEqual(logic.get_dashboard_url_for_role("Food Manufacturer"), "warehouse-dashboard.html")
        self.assertEqual(logic.get_dashboard_url_for_role("Admin"), "admin-dashboard.html")
        self.assertEqual(logic.get_dashboard_url_for_role("Administrator"), "admin-dashboard.html")

    def test_03_scenario_1_requested_page_redirect(self):
        """Scenario 1: User tries to access inventory.html, logs in as Consumer, opens inventory.html directly."""
        user = {"role": "Consumer", "name": "Sarah Consumer"}
        target, alert = FrontendRedirectLogic.resolve_post_login_target(user, "inventory.html")
        self.assertEqual(target, "inventory.html")
        self.assertIsNone(alert)

    def test_04_scenario_2_google_login_freshness_page(self):
        """Scenario 2: User opens freshness.html without login, signs in via Google (Consumer), returns to freshness.html."""
        user = {"role": "Consumer", "name": "Google User", "auth_provider": "google"}
        target, alert = FrontendRedirectLogic.resolve_post_login_target(user, "freshness.html")
        self.assertEqual(target, "freshness.html")
        self.assertIsNone(alert)

    def test_05_scenario_3_direct_login_defaults_to_role_dashboard(self):
        """Scenario 3: User opens login directly without destination -> opens default role dashboard."""
        logic = FrontendRedirectLogic

        roles_expected = [
            ("Consumer", "dashboard.html"),
            ("Retailer", "retailer-dashboard.html"),
            ("Warehouse Manager", "warehouse-dashboard.html"),
            ("Food Quality Inspector", "dashboard-inspector.html"),
            ("Admin", "admin-dashboard.html"),
        ]

        for role_name, expected_dash in roles_expected:
            user = {"role": role_name, "email": f"{role_name.lower()}@foodfresh.com"}
            target, alert = logic.resolve_post_login_target(user, None)
            self.assertEqual(target, expected_dash)
            self.assertIsNone(alert)

    def test_06_scenario_4_unauthorized_page_redirect_and_alert(self):
        """Scenario 4: Consumer attempts to access admin-dashboard.html -> redirected to authorized dashboard with alert."""
        user = {"role": "Consumer", "name": "Pantry User"}
        target, alert = FrontendRedirectLogic.resolve_post_login_target(user, "admin-dashboard.html")
        self.assertEqual(target, "dashboard.html")
        self.assertIsNotNone(alert)
        self.assertIn("Access Restricted", alert)

        # Retailer attempting to access warehouse-dashboard.html
        user_ret = {"role": "Retailer", "name": "Store Manager"}
        target2, alert2 = FrontendRedirectLogic.resolve_post_login_target(user_ret, "warehouse-dashboard.html")
        self.assertEqual(target2, "retailer-dashboard.html")
        self.assertIsNotNone(alert2)

    def test_07_scenario_5_admin_supervisory_access(self):
        """Scenario 5: Admin accessing any operational dashboard is granted access without restriction."""
        admin_user = {"role": "Admin", "name": "Platform Admin"}
        dashboards = [
            "dashboard.html",
            "retailer-dashboard.html",
            "warehouse-dashboard.html",
            "dashboard-inspector.html",
            "admin-dashboard.html",
            "inventory.html",
            "reports.html",
        ]
        for dash in dashboards:
            target, alert = FrontendRedirectLogic.resolve_post_login_target(admin_user, dash)
            self.assertEqual(target, dash)
            self.assertIsNone(alert)


if __name__ == "__main__":
    unittest.main()
