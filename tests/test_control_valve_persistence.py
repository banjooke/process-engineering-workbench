"""Existing project/scenario routes, real isolated SQLite, no external services."""
from copy import deepcopy
import importlib
import unittest
from unittest.mock import patch
from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy.pool import StaticPool


class ValvePersistenceTests(unittest.TestCase):
    def setUp(self):
        with patch("dotenv.load_dotenv"), patch("sqlmodel.create_engine"):
            projects = importlib.import_module("backend.projects")
            scenarios = importlib.import_module("backend.scenarios")
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        SQLModel.metadata.create_all(self.engine)
        app = FastAPI()
        app.include_router(projects.router)
        app.include_router(scenarios.router)
        self.user = UUID(int=1)
        app.dependency_overrides[projects.get_current_user_id] = lambda: self.user
        def session():
            with Session(self.engine) as db:
                yield db
        app.dependency_overrides[projects.get_session] = session
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        self.addCleanup(self.engine.dispose)
        self.project = self.client.post("/projects", json={"name": "Valve study", "description": "Isolation test"}).json()
        self.path = f"/projects/{self.project['id']}/scenarios"
        self.payload = dict(name="Normal service", description=None, calculation_intent="control_valve_sizing", flow_value=0,
                            flow_unit="m3/h", inlet_pressure_bar_a=None, property_reference_pressure_bar_a=None, elements=[],
                            fluid_config={"engineering_task": "control_valve_sizing", "control_valve": {
                                "schema_version": "control-valve-scenario/1", "calculation_version": "control-valve-liquid/1", "result": None,
                                "draft": {"fluid": "glycerol"}}})

    def create(self, payload=None):
        response = self.client.post(self.path, json=payload or self.payload)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_draft_create_read_update_list_delete_and_json_roundtrip(self):
        saved = self.create()
        self.assertEqual(saved["flow_value"], 0)
        self.assertIsNone(saved["inlet_pressure_bar_a"])
        body = deepcopy(self.payload)
        body["flow_value"] = 10
        body["fluid_config"]["control_valve"].update(result={"cases": [{"resolved_fluid_config": {"provenance": {"source": "thermo", "provider_fluid_id": "glycerol"}}}]}, calculated_at="2026-09-29T12:00:00Z")
        url = f"{self.path}/{saved['id']}"
        response = self.client.put(url, json=body)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.get(url).json()["fluid_config"], body["fluid_config"])
        self.assertEqual(len(self.client.get(self.path).json()), 1)
        self.assertEqual(self.client.delete(url).status_code, 200)
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_other_user_cannot_list_open_create_update_or_delete(self):
        saved = self.create()
        self.user = UUID(int=2)
        self.assertEqual(self.client.get("/projects").json(), [])
        self.assertEqual(self.client.get(f"/projects/{self.project['id']}").status_code, 404)
        self.assertEqual(self.client.get(self.path).status_code, 404)
        self.assertEqual(self.client.post(self.path, json=self.payload).status_code, 404)
        url = f"{self.path}/{saved['id']}"
        for method in ("GET", "PUT", "DELETE"):
            kwargs = {"json": self.payload} if method == "PUT" else {}
            self.assertEqual(self.client.request(method, url, **kwargs).status_code, 404)
        self.user = UUID(int=1)
        self.assertEqual(self.client.get(url).json()["name"], "Normal service")

    def test_wrong_project_scenario_cannot_be_overwritten(self):
        saved = self.create()
        other = self.client.post("/projects", json={"name": "Other"}).json()
        self.assertEqual(self.client.put(f"/projects/{other['id']}/scenarios/{saved['id']}", json=self.payload).status_code, 404)

    def test_cross_task_updates_rejected_in_both_directions(self):
        valve = self.create()
        for task in ("pump_sizing", "pressure_drop"):
            hydraulic = {**deepcopy(self.payload), "calculation_intent": "pressure_drop", "flow_value": 10, "fluid_config": {"engineering_task": task}}
            saved = self.create(hydraulic)
            self.assertEqual(self.client.put(f"{self.path}/{valve['id']}", json=hydraulic).status_code, 409)
            self.assertEqual(self.client.put(f"{self.path}/{saved['id']}", json=self.payload).status_code, 409)
            self.assertEqual(self.client.put(f"{self.path}/{saved['id']}", json=hydraulic).status_code, 200)

    def test_hydraulic_positive_flow_and_valve_task_validation(self):
        for task in ("pump_sizing", "pressure_drop"):
            body = {**deepcopy(self.payload), "calculation_intent": "pressure_drop", "fluid_config": {"engineering_task": task}}
            self.assertEqual(self.client.post(self.path, json=body).status_code, 422)
        body = deepcopy(self.payload)
        body["calculation_intent"] = "pressure_drop"
        self.assertEqual(self.client.post(self.path, json=body).status_code, 422)
        body = deepcopy(self.payload)
        body["fluid_config"]["control_valve"]["result"] = {"required_cv": 1}
        self.assertEqual(self.client.post(self.path, json=body).status_code, 422)

    def test_projects_refreshed_after_scenario_save_without_hydraulic_overwrite(self):
        before = self.client.get("/projects").json()[0]["updated_at"]
        self.create()
        after = self.client.get("/projects").json()[0]["updated_at"]
        self.assertGreaterEqual(after, before)
        self.assertEqual(self.client.get(f"/projects/{self.project['id']}/hydraulics").status_code, 404)
