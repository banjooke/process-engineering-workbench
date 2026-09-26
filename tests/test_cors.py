"""Exercise the actual application CORS policy without database or network I/O."""
from contextlib import ExitStack
import importlib
import unittest
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient


PRODUCTION_ORIGIN = "https://process-engineering-workbench.vercel.app"


class CorsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch("dotenv.load_dotenv"), patch("sqlmodel.create_engine"):
            cls.api = importlib.import_module("backend.main")
        cls.auth = importlib.import_module("backend.auth")
        # No lifespan: these tests must not initialize the production database.
        cls.client = TestClient(cls.api.app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()

    def setUp(self):
        stack = ExitStack()
        self.addCleanup(stack.close)
        self.assertNotIn(self.api.get_current_user_id, self.api.app.dependency_overrides)
        self.settings = stack.enter_context(patch.object(
            self.auth, "_supabase_settings",
            return_value=("https://supabase.test", "test-key"),
        ))
        self.verify = stack.enter_context(patch.object(self.auth.httpx, "get"))

    def preflight(self, path, origin):
        return self.client.options(path, headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type",
        })

    def assert_allowed(self, response, origin):
        self.assertEqual(response.headers.get("access-control-allow-origin"), origin)
        self.assertEqual(response.headers.get("access-control-allow-credentials"), "true")
        self.assertIn("Origin", response.headers.get("vary", ""))

    def check_preflight(self, origin):
        for path in ("/fluids", "/projects"):
            with self.subTest(path=path, origin=origin):
                response = self.preflight(path, origin)
                self.assertEqual(response.status_code, 200, response.text)
                self.assert_allowed(response, origin)
                self.assertIn("GET", response.headers["access-control-allow-methods"])
                headers = response.headers["access-control-allow-headers"].lower()
                self.assertIn("authorization", headers)
                self.assertIn("content-type", headers)
        # Preflight does not run the authentication dependency at all.
        self.settings.assert_not_called()
        self.verify.assert_not_called()

    def test_production_preflight_before_authentication(self):
        self.check_preflight(PRODUCTION_ORIGIN)

    def test_local_development_preflight(self):
        for origin in ("http://localhost:3000", "http://127.0.0.1:3000",
                       "http://192.168.0.253:3000"):
            self.check_preflight(origin)

    def test_disallowed_origin_preflight(self):
        for origin in ("https://untrusted.example", "null",
                       PRODUCTION_ORIGIN + ".untrusted.example"):
            for path in ("/fluids", "/projects"):
                with self.subTest(origin=origin, path=path):
                    response = self.preflight(path, origin)
                    self.assertEqual(response.status_code, 400)
                    self.assertNotIn("access-control-allow-origin", response.headers)
        self.verify.assert_not_called()

    def test_projects_without_token_remains_protected(self):
        for origin in (PRODUCTION_ORIGIN, "http://localhost:3000"):
            with self.subTest(origin=origin):
                response = self.client.get("/projects", headers={"Origin": origin})
                self.assertEqual(response.status_code, 401)
                self.assertEqual(response.headers.get("www-authenticate"), "Bearer")
                self.assert_allowed(response, origin)
        self.verify.assert_not_called()

    def test_projects_with_invalid_token_remains_protected(self):
        self.verify.return_value = httpx.Response(401, json={"message": "invalid"})
        response = self.client.get("/projects", headers={
            "Origin": PRODUCTION_ORIGIN, "Authorization": "Bearer invalid-token",
        })
        self.assertEqual(response.status_code, 401)
        self.assert_allowed(response, PRODUCTION_ORIGIN)
        self.verify.assert_called_once()

    def test_disallowed_origin_does_not_bypass_authentication(self):
        response = self.client.get("/projects", headers={"Origin": "https://untrusted.example"})
        self.assertEqual(response.status_code, 401)
        self.assertNotIn("access-control-allow-origin", response.headers)
        self.verify.assert_not_called()

    def test_valid_token_still_reaches_protected_endpoint(self):
        self.verify.return_value = httpx.Response(200, json={
            "id": "00000000-0000-0000-0000-000000000001",
        })
        with patch.object(self.api, "calculate_velocity", return_value=1.0) as work:
            response = self.client.post("/calculate/velocity", headers={
                "Origin": PRODUCTION_ORIGIN, "Authorization": "Bearer valid-token",
            }, json={"flow_rate_m3_h": 1, "pipe_diameter_m": 0.1})
        self.assertEqual(response.status_code, 200)
        self.assert_allowed(response, PRODUCTION_ORIGIN)
        self.verify.assert_called_once()
        work.assert_called_once()

    def test_public_fluids_response_has_cors_headers(self):
        with patch.object(self.api, "automatic_properties_available", return_value=True), \
             patch.object(self.api, "get_fluid_catalogue", return_value=[]):
            response = self.client.get("/fluids", headers={"Origin": PRODUCTION_ORIGIN})
        self.assertEqual(response.status_code, 200)
        self.assert_allowed(response, PRODUCTION_ORIGIN)
        self.verify.assert_not_called()


if __name__ == "__main__":
    unittest.main()
