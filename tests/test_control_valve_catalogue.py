"""Shared catalogue and automatic property integration (installed local providers)."""
from copy import deepcopy
import unittest
from unittest.mock import patch
from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend.control_valves import EXAMPLE, router, get_current_user_id
from engineering import control_valve as cv, fluids, hydraulics


def request(fluid="Water", **changes):
    body = deepcopy(EXAMPLE)
    body["normal"].update(changes)
    body["normal"]["fluid_config"] = {
        "fluid": fluid, "phase_type": "Liquid", "temperature_c": 20.0,
        "use_manual_properties": False, "density_kg_m3": 9999.0,
        "dynamic_viscosity_pa_s": 1.0, "vapor_pressure_bar_a": None,
        "molecular_weight_kg_kmol": None, "compressibility_factor": None, "gamma": None,
    }
    return body


class CatalogueParityTests(unittest.TestCase):
    def test_shared_browse_identity_unchanged(self):
        rows = fluids.get_fluid_catalogue()
        self.assertEqual({r["id"] for r in rows}, {r["id"] for r in fluids.CURATED_FLUIDS})
        for row in rows:
            original = next(r for r in fluids.CURATED_FLUIDS if r["id"] == row["id"])
            for key in ("name", "category", "formula"):
                self.assertEqual(row[key], original[key])
            self.assertIn("liquid_capability", row)

    def test_additional_search_liquids_use_same_id_and_provider_as_pump(self):
        for query in ("glycerol", "ethylene glycol", "1-propanol"):
            with self.subTest(query=query):
                row = next(r for r in fluids.search_fluids(query) if r["id"] == query)
                self.assertTrue(row["liquid_capability"]["eligible"])
                self.assertNotIn(row["id"], {r["id"] for r in fluids.CURATED_FLUIDS})
                body = request(row["id"])
                resolved = cv.size_control_valve(body).cases[0].resolved_fluid_config
                expected = fluids.get_fluid_properties(row["id"], 20.0, 3.54)
                pump = hydraulics.freeze_pump_fluid_properties(body["normal"]["fluid_config"], 3.54)
                self.assertEqual(resolved.fluid, row["id"])
                self.assertAlmostEqual(resolved.density_kg_m3, pump["density_kg_m3"])
                self.assertAlmostEqual(resolved.dynamic_viscosity_pa_s, pump["dynamic_viscosity_pa_s"])
                self.assertEqual(resolved.provenance.source, expected["_property_provider"])
                self.assertEqual(resolved.provenance.provider_fluid_id, expected["_provider_fluid_id"])
                self.assertTrue(resolved.use_manual_properties)

    def test_api_accepts_pump_config_and_resolves_all_real_upstream_states(self):
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_current_user_id] = lambda: UUID(int=1)
        body = request("ethylene glycol", upstream_pressure=2.0, downstream_pressure=1.0,
                       pressure_basis="gauge", atmospheric_pressure_pa=101325.0,
                       temperature=86.0, temperature_unit="F")
        body["maximum"] = {**deepcopy(body["normal"]), "case_id": "maximum", "temperature": 104.0, "upstream_pressure": 4.0}
        with TestClient(app) as client, patch.object(fluids, "get_fluid_properties", wraps=fluids.get_fluid_properties) as resolver:
            response = client.post("/control-valves/liquid/size", json=body)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual([(c.kwargs["fluid"], c.kwargs["temperature_c"], c.kwargs["pressure_bar_a"]) for c in resolver.call_args_list],
                         [("ethylene glycol", 30.0, 3.01325), ("ethylene glycol", 40.0, 5.01325)])
        snapshot = response.json()["cases"][0]["resolved_fluid_config"]
        self.assertEqual(snapshot["temperature_c"], 30.0)
        self.assertEqual(snapshot["provenance"]["evaluation_pressure_pa_abs"], 301325.0)
        self.assertNotEqual(snapshot["density_kg_m3"], 9999.0)

    def test_actual_gas_steam_mixtures_and_unknown_fluids_rejected(self):
        for fluid, changes in (("Nitrogen", {}), ("Water", {"temperature": 200.0}),
                               ("Air", {}), ("R410A", {}), ("Water&Ethanol", {}),
                               ("unidentified slurry", {})):
            with self.subTest(fluid=fluid), self.assertRaises(ValueError):
                cv.size_control_valve(request(fluid, **changes))
        for fluid in ("Air", "R410A", "Water&Ethanol", "unidentified slurry"):
            self.assertFalse(fluids.get_liquid_capability(fluid)["eligible"])

    def test_unconfirmed_phase_and_missing_viscosity_fail_closed(self):
        raw = fluids.get_fluid_properties("Water", 20.0, 3.54)
        for changes in ({"phase_label": None}, {"phase_label": "supercritical_liquid"},
                        {"dynamic_viscosity_pa_s": None}):
            with patch.object(fluids, "get_fluid_properties", return_value={**raw, **changes}), self.assertRaises(ValueError):
                cv.size_control_valve(request())

    def test_no_separate_valve_catalogue(self):
        from pathlib import Path
        source = Path(cv.__file__).read_text(encoding="utf-8")
        self.assertNotIn("CURATED_FLUIDS", source)
        self.assertIn("fluids.get_fluid_properties", source)
        self.assertIn("fluids.get_liquid_capability", source)
