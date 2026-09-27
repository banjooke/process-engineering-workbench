"""Authentication boundary tests: real dependency, mocked Supabase and work functions.

No startup/lifespan, database connection, paid AI call, or report file generation.
"""
from contextlib import ExitStack
import importlib
from pathlib import Path
import unittest
from unittest.mock import patch

import httpx
from fastapi import HTTPException
from fastapi.responses import Response
from fastapi.testclient import TestClient

USER_ID = '00000000-0000-0000-0000-000000000001'
FLUID = {'phase_type': 'Liquid', 'use_manual_properties': True}
LINE = {'fluid_config': FLUID, 'flow_value': 1, 'flow_unit': 'm3/h',
        'inlet_pressure_bar_a': 5, 'elements': []}
PUMP = {'fluid_config': FLUID, 'design_flow_value': 1, 'flow_unit': 'm3/h',
        'source_pressure_bar_a': 1, 'destination_pressure_bar_a': 2,
        'pump_efficiency': 0.7, 'motor_margin': 1.1, 'elements': []}
REPORT = {**LINE, 'result': {}}
PUMP_REPORT = {**REPORT, **PUMP}

CASES = [
    ('/assistant/interpret-hydraulics', {'prompt': 'Calculate water line losses', 'use_ai': True},
     'interpret_hydraulics_with_ai'),
    ('/fluids/properties', {'fluid': 'Water', 'temperature_c': 25, 'pressure_bar_a': 1},
     'get_fluid_properties'),
    ('/fittings/calculate-k', {'selection_label': 'test fitting', 'nominal_size_mm': 25},
     'calculate_fitting_k'),
    ('/calculate/velocity', {'flow_rate_m3_h': 1, 'pipe_diameter_m': 0.1}, 'calculate_velocity'),
    ('/calculate/pressure-drop', {'flow_rate_m3_h': 1, 'pipe_diameter_m': 0.1,
                                 'pipe_length_m': 10, 'density_kg_m3': 1000,
                                 'dynamic_viscosity_pa_s': 0.001, 'roughness_m': 0},
     'calculate_pressure_drop'),
    ('/hydraulics/solve-line', LINE, 'solve_line'),
    ('/hydraulics/system-curve', {**LINE, 'design_flow_value': 1}, 'build_system_curve'),
    ('/hydraulics/pump-sizing', PUMP, 'size_pump_duty'),
]
for module, payload, prefix in [
    ('hydraulics', REPORT, ''), ('pump-sizing', PUMP_REPORT, 'pump_'),
]:
    for extension in ['pdf', 'docx']:
        CASES.append((f'/reports/{module}/{extension}', payload,
                      f'create_{prefix}{extension}_report'))
        CASES.append((f'/reports/{module}/project/{extension}',
                      {'scenarios': [{**payload, 'name': 'Scenario A'}]},
                      f'create_{prefix}project_{extension}_report'))

WORK_RESULTS = {
    'interpret_hydraulics_with_ai': {}, 'interpret_hydraulics_prompt': {},
    'get_fluid_properties': {}, 'calculate_fitting_k': {},
    'calculate_velocity': 1.0, 'calculate_reynolds_number': 1000,
    'classify_flow': 'Laminar', 'engineering_friction_factor': (0.064, 'Laminar: 64/Re'),
    'calculate_pressure_drop': 100.0, 'solve_line': {},
    'build_system_curve': {}, 'size_pump_duty': {
        'resolved_fluid_config': {**FLUID, 'density_kg_m3': 997.0,
                                  'dynamic_viscosity_pa_s': 0.00089,
                                  'vapor_pressure_bar_a': 0.0317}},
    'freeze_pump_fluid_properties': FLUID, 'build_pump_system_curve': {},
}
for _, _, function in CASES:
    if function.startswith('create_'):
        WORK_RESULTS[function] = Path('unused-report-output')


class AuthenticationBoundaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch('dotenv.load_dotenv'), patch('sqlmodel.create_engine'):
            cls.api = importlib.import_module('backend.main')
        cls.auth = importlib.import_module('backend.auth')
        cls.client = TestClient(cls.api.app)  # Deliberately no lifespan/startup.

    @classmethod
    def tearDownClass(cls):
        cls.client.close()

    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.assertNotIn(self.api.get_current_user_id, self.api.app.dependency_overrides)
        self.settings = self.stack.enter_context(patch.object(
            self.auth, '_supabase_settings', return_value=('https://supabase.test', 'test-key')))
        self.verify = self.stack.enter_context(patch.object(self.auth.httpx, 'get'))
        self.work = {name: self.stack.enter_context(patch.object(self.api, name, return_value=result))
                     for name, result in WORK_RESULTS.items()}
        self.file_response = self.stack.enter_context(patch.object(
            self.api, 'FileResponse', return_value=Response(b'mocked report')))
        self.stack.enter_context(patch.object(self.api, 'automatic_properties_available', return_value=True))
        self.stack.enter_context(patch.object(self.api, 'ai_available', return_value=True))

    def check_case(self, path, payload, function, mode):
        headers = {'Authorization': 'Bearer test-token'}
        if mode == 'missing':
            headers = {}
        elif mode == 'invalid':
            self.verify.return_value = httpx.Response(401, json={'message': 'invalid token'})
        elif mode == 'unavailable':
            self.verify.side_effect = httpx.ConnectError('Supabase unavailable')
        elif mode == 'unconfigured':
            self.settings.side_effect = HTTPException(status_code=503, detail='Not configured')
        else:
            self.verify.return_value = httpx.Response(200, json={'id': USER_ID})

        # A body-provided identity must never bypass authentication.
        response = self.client.post(path, json={**payload, 'user_id': USER_ID}, headers=headers)
        expected = 200 if mode == 'valid' else 503 if mode in {'unavailable', 'unconfigured'} else 401
        self.assertEqual(response.status_code, expected, response.text)
        if mode == 'valid':
            self.work[function].assert_called_once()
            self.verify.assert_called_once_with(
                'https://supabase.test/auth/v1/user',
                headers={'apikey': 'test-key', 'Authorization': 'Bearer test-token'}, timeout=10.0)
        else:
            for mock in self.work.values():
                mock.assert_not_called()
            self.file_response.assert_not_called()
            if mode in {'missing', 'unconfigured'}:
                self.verify.assert_not_called()
            else:
                self.verify.assert_called_once()
            if expected == 401:
                self.assertEqual(response.headers.get('www-authenticate'), 'Bearer')

    def test_inventory_covers_all_main_post_routes(self):
        paths = {route.path for route in self.api.app.routes
                 if getattr(route, 'methods', None) and 'POST' in route.methods
                 and route.endpoint.__module__ == 'backend.main'}
        self.assertEqual(paths, {path for path, _, _ in CASES})
        self.assertEqual(len(paths), 16)

    def test_public_routes_remain_accessible(self):
        with patch.object(self.api, 'get_piping_catalog', return_value={}), \
             patch.object(self.api, 'get_fitting_catalog', return_value={}), \
             patch.object(self.api, 'get_database_info', return_value={}), \
             patch.object(self.api, 'get_fluid_catalogue', return_value=[]), \
             patch.object(self.api, 'search_fluids', return_value=[]):
            for path in ['/health', '/piping/catalog', '/fittings', '/fittings/info',
                         '/fluids', '/fluids/search?q=water', '/assistant/status',
                         '/docs', '/redoc', '/openapi.json']:
                with self.subTest(path=path):
                    self.assertEqual(self.client.get(path).status_code, 200)
        self.verify.assert_not_called()


def make_test(path, payload, function, mode):
    def test(self):
        self.check_case(path, payload, function, mode)
    return test


for path, payload, function in CASES:
    for mode in ['missing', 'invalid', 'unavailable', 'unconfigured', 'valid']:
        name = f'test_{path.strip("/").replace("/", "_").replace("-", "_")}_{mode}'
        setattr(AuthenticationBoundaryTests, name, make_test(path, payload, function, mode))


if __name__ == '__main__':
    unittest.main()
