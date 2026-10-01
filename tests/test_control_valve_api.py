"""Authenticated prototype transport tests, no lifespan/database/property network."""
from contextlib import ExitStack
from copy import deepcopy
import importlib
import json
import unittest
from unittest.mock import patch
from uuid import UUID

import httpx
from fastapi.testclient import TestClient
from engineering import control_valve as engine
from backend import control_valves as endpoint

PATH = '/control-valves/liquid/size'
ORIGIN = 'https://process-engineering-workbench.vercel.app'
PROPS = dict(density_kg_m3=1000.0, dynamic_viscosity_pa_s=0.001,
             phase_type='Liquid', phase_label='liquid', _property_provider='CoolProp',
             _provider_fluid_id='Water', vapor_pressure_bar_a=0.023)


def payload():
    return deepcopy(endpoint.EXAMPLE)


class ControlValveAPITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch('dotenv.load_dotenv'), patch('sqlmodel.create_engine'):
            cls.api = importlib.import_module('backend.main')
        cls.auth = importlib.import_module('backend.auth')
        cls.client = TestClient(cls.api.app, raise_server_exceptions=False)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()

    def setUp(self):
        stack = ExitStack()
        self.addCleanup(stack.close)
        self.settings = stack.enter_context(patch.object(self.auth, '_supabase_settings',
            return_value=('https://supabase.test', 'test-key')))
        self.verify = stack.enter_context(patch.object(self.auth.httpx, 'get',
            return_value=httpx.Response(200, json={'id': str(UUID(int=1))})))
        self.provider = stack.enter_context(patch.object(engine.fluids, 'get_fluid_properties', return_value=deepcopy(PROPS)))
        self.session = stack.enter_context(patch('sqlmodel.Session'))
        self.create_tables = stack.enter_context(patch.object(self.api, 'create_db_and_tables'))

    def post(self, body=None, **kwargs):
        return self.client.post(PATH, json=payload() if body is None else body,
                                headers={'Authorization': 'Bearer test-token'}, **kwargs)

    def assert_invalid(self, body, expected_loc=None):
        response = self.post(body)
        self.assertEqual(response.status_code, 422, response.text)
        errors = response.json()['detail']
        self.assertIsInstance(errors, list)
        self.assertTrue(all(error['msg'] and error['loc'][0] == 'body' for error in errors))
        if expected_loc:
            self.assertIn(expected_loc, [error['loc'] for error in errors])
        return response

    def test_authenticated_normal_success(self):
        response = self.post()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(response.json()['cases']), 1)
        self.verify.assert_called_once_with('https://supabase.test/auth/v1/user',
            headers={'apikey': 'test-key', 'Authorization': 'Bearer test-token'}, timeout=10.0)

    def test_multiple_cases_numerical_governing_and_margin(self):
        data = payload()
        for name, flow in [('minimum', 20.0), ('maximum', 5.0)]:
            data[name] = {**deepcopy(data['normal']), 'case_id': name, 'flow_value': flow}
        data['rating_margin'] = 0.25
        response = self.post(data)
        self.assertEqual(response.status_code, 200, response.text)
        r = response.json()
        self.assertEqual(len(r['cases']), 3)
        self.assertEqual(r['governing_case'], 'minimum')
        self.assertAlmostEqual(r['maximum_required_kv'], 16.116459280507606)
        self.assertAlmostEqual(r['target_rated_kv'], 16.116459280507606 * 1.25)

    def test_missing_auth(self):
        response = self.client.post(PATH, json=payload())
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.headers['www-authenticate'], 'Bearer')
        self.provider.assert_not_called()
        self.verify.assert_not_called()

    def test_invalid_token(self):
        self.verify.return_value = httpx.Response(401, json={})
        response = self.post()
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()['detail'], 'The login session is invalid or has expired.')
        self.provider.assert_not_called()

    def test_auth_service_unavailable(self):
        self.verify.side_effect = httpx.ConnectError('private details')
        response = self.post()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private details', response.text)
        self.provider.assert_not_called()

    def test_dependency_override_supported(self):
        with patch.dict(self.api.app.dependency_overrides, {self.auth.get_current_user_id: lambda: UUID(int=1)}):
            response = self.client.post(PATH, json=payload())
        self.assertEqual(response.status_code, 200, response.text)
        self.verify.assert_not_called()

    def test_production_and_local_preflight_before_auth(self):
        for origin in (ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'):
            response = self.client.options(PATH, headers={'Origin': origin,
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'authorization,content-type'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['access-control-allow-origin'], origin)
            self.assertEqual(response.headers['access-control-allow-credentials'], 'true')
        self.verify.assert_not_called()
        self.settings.assert_not_called()
        self.provider.assert_not_called()

    def test_disallowed_cors_origin(self):
        response = self.client.options(PATH, headers={'Origin': 'https://untrusted.example',
            'Access-Control-Request-Method': 'POST'})
        self.assertEqual(response.status_code, 400)
        self.assertNotIn('access-control-allow-origin', response.headers)

    def test_error_response_has_production_cors_header(self):
        response = self.client.post(PATH, json=payload(), headers={'Origin': ORIGIN})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.headers['access-control-allow-origin'], ORIGIN)

    def test_published_benchmark_and_direct_engine_parity(self):
        # B15 arithmetic only; inlet state is synthetic fixture context.
        data = payload()
        direct = engine.size_control_valve(data)
        response = self.post(data)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), direct.model_dump(mode='json'))
        self.assertLessEqual(abs(response.json()['maximum_required_kv'] - 8.06), 0.005)

    def test_real_pressure_temperature_and_provenance(self):
        data = payload()
        data['normal'].update(pressure_basis='gauge', upstream_pressure=2.54,
                              downstream_pressure=1.0, atmospheric_pressure_pa=100000.0)
        response = self.post(data)
        self.assertEqual(response.status_code, 200, response.text)
        self.provider.assert_called_once_with(fluid='Water', temperature_c=20.0, pressure_bar_a=3.54)
        case = response.json()['cases'][0]
        self.assertEqual(case['normalized']['upstream_pressure_pa_abs'], 354000.0)
        self.assertEqual(case['normalized']['differential_pressure_pa'], 154000.0)
        self.assertEqual(case['resolved_fluid_config']['provenance']['source'], 'CoolProp')
        self.assertEqual(case['resolved_fluid_config']['provenance']['origin'], 'automatic')
        self.assertEqual(case['resolved_fluid_config']['provenance']['evaluation_pressure_pa_abs'], 354000.0)

    def test_manual_property_contract(self):
        data = payload()
        data['normal']['fluid_config'].update(use_manual_properties=True, density_kg_m3=1000.0,
            manual_source={'source': 'Synthetic test fixture', 'reference_edition': '1',
                           'reason': 'Arithmetic comparison', 'actor': 'test',
                           'evaluation_pressure_pa_abs': 354000.0, 'evaluation_temperature_k': 293.15})
        response = self.post(data)
        self.assertEqual(response.status_code, 200, response.text)
        self.provider.assert_not_called()
        self.assertEqual(response.json()['cases'][0]['resolved_fluid_config']['provenance']['origin'], 'manual')

    def test_missing_required_field_location(self):
        data = payload()
        del data['normal']['flow_value']
        self.assert_invalid(data, ['body', 'normal', 'flow_value'])

    def test_missing_normal(self):
        self.assert_invalid({}, ['body', 'normal'])

    def test_invalid_units(self):
        for field, value in [('flow_unit', 'kg/h'), ('pressure_unit', 'barg'), ('temperature_unit', 'invalid')]:
            data = payload()
            data['normal'][field] = value
            self.assert_invalid(data, ['body', 'normal', field])

    def test_zero_negative_flow(self):
        for value in (0, -1):
            data = payload()
            data['normal']['flow_value'] = value
            self.assert_invalid(data, ['body', 'normal', 'flow_value'])

    def test_invalid_pressure_order(self):
        for value in (3.54, 4.0):
            data = payload()
            data['normal']['downstream_pressure'] = value
            self.assert_invalid(data, ['body', 'normal', 'downstream_pressure'])

    def test_nonfinite_numeric_input(self):
        for token in ('NaN', 'Infinity', '-Infinity', '1e999'):
            body = json.dumps(payload()).replace('"flow_value": 10.0', '"flow_value": ' + token)
            response = self.client.post(PATH, content=body, headers={
                'Authorization': 'Bearer test-token', 'Content-Type': 'application/json'})
            self.assertEqual(response.status_code, 422, response.text)
            self.assertEqual(response.json()['detail'][0]['loc'], ['body', 'normal', 'flow_value'])
            self.assertNotIn('input', response.json()['detail'][0])

    def test_unsupported_services(self):
        for field, value in [('phase_type', 'Gas'), ('phase_type', 'Steam'), ('phase_type', 'Slurry'),
                             ('phase_type', 'Two-phase'), ('composition', 'mixture'), ('rheology', 'non-Newtonian')]:
            data = payload()
            data['normal']['fluid_config'][field] = value
            self.assert_invalid(data, ['body', 'normal', 'fluid_config', field])
        self.provider.assert_not_called()

    def test_unsupported_corrections_and_system_inputs(self):
        for field in ('FL', 'Fd', 'Fp', 'FLP', 'attached_fittings', 'elements', 'selected_cv', 'choking_correction'):
            data = payload()
            data['normal'][field] = 1.0
            self.assert_invalid(data, ['body', 'normal', field])
        self.provider.assert_not_called()

    def test_unknown_schema_and_identity_injection(self):
        data = payload()
        data['schema_version'] = 'future'
        self.assert_invalid(data, ['body', 'schema_version'])
        data = payload()
        data['user_id'] = str(UUID(int=1))
        self.assert_invalid(data, ['body', 'user_id'])

    def test_cross_case_validation(self):
        for changes in ({'case_id': 'maximum'}, {'enabled': False}):
            data = payload()
            data['normal'].update(changes)
            self.assert_invalid(data)
        self.provider.assert_not_called()

    def test_unavailable_properties(self):
        self.provider.side_effect = ValueError('Liquid properties unavailable at requested state.')
        response = self.assert_invalid(payload())
        self.assertIn('Liquid properties unavailable', response.text)

    def test_unexpected_error_sanitized(self):
        with patch.object(engine, 'size_control_valve', side_effect=RuntimeError('secret traceback')):
            response = self.post()
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()['detail'], 'Control-valve prototype calculation failed.')
        self.assertNotIn('secret', response.text)

    def test_mandatory_warnings_and_selection_blocked(self):
        result = self.post().json()
        for item in (result, result['cases'][0]):
            self.assertEqual(item['verification_status'], 'prototype_correlated')
            self.assertFalse(item['final_selection_allowed'])
            self.assertEqual(item['assessment_status'], 'incomplete')
            self.assertEqual(item['vendor_confirmation'], engine.VENDOR_CONFIRMATION)
            self.assertEqual(item['standard_limitation'], engine.STANDARD_LIMITATION)
        self.assertTrue(result['cases'][0]['limitations'])
        self.assertTrue(result['cases'][0]['equation_ids'])
        self.assertTrue(result['cases'][0]['source_ids'])

    def test_existing_protected_endpoints_unchanged(self):
        for path in ('/hydraulics/solve-line', '/hydraulics/pump-sizing', '/fluids/properties'):
            response = self.client.post(path, json={})
            self.assertEqual(response.status_code, 401, response.text)
        self.assertEqual(self.client.get('/projects').status_code, 401)

    def test_no_database_or_persistence_dependency(self):
        self.assertEqual(self.post().status_code, 200)
        self.session.assert_not_called()
        self.create_tables.assert_not_called()
        route = next(r for r in endpoint.router.routes if r.path == PATH)
        self.assertEqual([d.call for d in route.dependant.dependencies], [self.auth.get_current_user_id])

    def test_openapi_and_example(self):
        response = self.client.get('/openapi.json')
        self.assertEqual(response.status_code, 200)
        schema = response.json()
        operation = schema['paths'][PATH]['post']
        for text in ('Prototype-only', 'non-choked', 'IEC/ISA', 'safety-critical', 'Manufacturer'):
            self.assertIn(text, operation['description'])
        example = operation['requestBody']['content']['application/json']['examples']['water']['value']
        self.assertEqual(self.post(example).status_code, 200)
        request_schema = schema['components']['schemas']['LiquidSizingRequest']
        self.assertFalse(request_schema['additionalProperties'])
        self.assertIn('normal', request_schema['required'])
        response_ref = operation['responses']['200']['content']['application/json']['schema']['$ref']
        self.assertTrue(response_ref.endswith('/SizingResult'))


if __name__ == '__main__':
    unittest.main()
