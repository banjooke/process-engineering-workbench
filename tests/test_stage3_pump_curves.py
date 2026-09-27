"""Pump properties must be resolved at the source, never the solver datum."""
from contextlib import ExitStack
from copy import deepcopy
import importlib
import unittest
from unittest.mock import patch
from uuid import UUID
from fastapi.testclient import TestClient
from fastapi.responses import Response

AUTO = {'phase_type': 'Liquid', 'fluid': 'Water', 'temperature_c': 25,
        'use_manual_properties': False}
PROPERTIES = {'density_kg_m3': 997.0, 'dynamic_viscosity_pa_s': 0.00089,
              'vapor_pressure_bar_a': 0.0317, 'phase_type': 'Liquid'}
MANUAL = {**AUTO, **PROPERTIES, 'use_manual_properties': True}
ELEMENTS = [{'type': 'Pipe', 'length_m': 20, 'id_mm': 50, 'roughness_mm': 0.045, 'dz_m': 30}]


class PumpCurveTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch('dotenv.load_dotenv'), patch('sqlmodel.create_engine'):
            cls.api = importlib.import_module('backend.main')
        cls.h = importlib.import_module('engineering.hydraulics')
        cls.client = TestClient(cls.api.app)  # No startup/database writes.

    @classmethod
    def tearDownClass(cls):
        cls.client.close()

    def setUp(self):
        stack = ExitStack()
        self.addCleanup(stack.close)
        stack.enter_context(patch.dict(self.api.app.dependency_overrides, {
            self.api.get_current_user_id: lambda: UUID(int=1)}))
        def provider(**kwargs):
            self.assertEqual(kwargs['pressure_bar_a'], 1.2)
            return dict(PROPERTIES)
        self.provider = stack.enter_context(patch.object(self.h, 'get_fluid_properties', side_effect=provider))

    def curve(self, fluid):
        return self.h.build_pump_system_curve(
            fluid, 5, 'm³/h', 1.2, deepcopy(ELEMENTS), max_flow_factor=2, number_points=5)

    def duty_payload(self, fluid=AUTO):
        return {'fluid_config': fluid, 'design_flow_value': 5, 'flow_unit': 'm³/h',
                'source_pressure_bar_a': 1.2, 'destination_pressure_bar_a': 1.2,
                'elements': deepcopy(ELEMENTS), 'pump_efficiency': 0.7, 'motor_margin': 1.1}

    def assert_curve(self, curve):
        point = next(p for p in curve['points'] if p['flow_value'] == 5)
        self.assertAlmostEqual(point['total_head_m'], curve['design_point']['total_head_m'])
        self.assertGreater(point['total_head_m'], 30)
        self.assertIsNone(point['outlet_pressure_bar_a'])
        self.assertEqual(curve['property_reference_pressure_bar_a'], 1.2)

    def test_source_lookup_once_static_lift_and_design_consistency(self):
        curve = self.curve(AUTO)
        self.provider.assert_called_once()
        self.assert_curve(curve)
        self.assertAlmostEqual(curve['points'][0]['total_head_m'], 30)

    def test_equivalent_manual_properties(self):
        automatic = self.curve(AUTO)
        manual = self.curve(MANUAL)
        self.provider.assert_called_once()
        self.assertEqual(automatic['points'], manual['points'])
        self.assertEqual(automatic['design_point'], manual['design_point'])

    def test_interactive_duty_then_curve_reuses_exact_state(self):
        response = self.client.post('/hydraulics/pump-sizing', json=self.duty_payload())
        self.assertEqual(response.status_code, 200, response.text)
        duty = response.json()
        self.provider.assert_called_once()
        curve_response = self.client.post('/hydraulics/system-curve', json={
            'pump_system': True, 'fluid_config': duty['resolved_fluid_config'],
            'design_flow_value': 5, 'flow_unit': 'm³/h', 'inlet_pressure_bar_a': 1.2,
            'elements': ELEMENTS, 'max_flow_factor': 2, 'number_points': 5})
        self.assertEqual(curve_response.status_code, 200, curve_response.text)
        self.provider.assert_called_once()  # No extra property lookup for the curve.
        curve = curve_response.json()
        self.assert_curve(curve)
        self.assertAlmostEqual(curve['design_point']['total_head_m'], duty['system']['total_head_m'])
        manual_duty = self.client.post('/hydraulics/pump-sizing', json=self.duty_payload(MANUAL)).json()
        self.assertEqual(duty['pump_duty'], manual_duty['pump_duty'])

    def test_direct_automatic_curve_api(self):
        response = self.client.post('/hydraulics/system-curve', json={
            'pump_system': True, 'fluid_config': AUTO, 'design_flow_value': 5,
            'flow_unit': 'm³/h', 'inlet_pressure_bar_a': 1.2, 'elements': ELEMENTS,
            'max_flow_factor': 2, 'number_points': 5})
        self.assertEqual(response.status_code, 200, response.text)
        self.provider.assert_called_once()
        self.assert_curve(response.json())

    def test_all_pump_report_routes_share_source_state(self):
        for project in [False, True]:
            for extension in ['pdf', 'docx']:
                with self.subTest(project=project, extension=extension):
                    self.provider.reset_mock()
                    scenario = {**self.duty_payload(), 'flow_value': 5, 'result': {},
                                'system_curve': {'max_flow_factor': 2, 'number_points': 5}, 'name': 'Lift'}
                    payload = {'scenarios': [scenario]} if project else scenario
                    name = f'create_pump_{"project_" if project else ""}{extension}_report'
                    path = f'/reports/pump-sizing/{"project/" if project else ""}{extension}'
                    with patch.object(self.api, name, return_value='unused') as writer, \
                         patch.object(self.api, 'FileResponse', return_value=Response(b'report')):
                        response = self.client.post(path, json=payload)
                    self.assertEqual(response.status_code, 200, response.text)
                    self.provider.assert_called_once()
                    prepared = writer.call_args.args[0]
                    prepared = prepared['scenarios'][0] if project else prepared
                    curve = prepared['system_curve']
                    self.assert_curve(curve)
                    self.assertAlmostEqual(curve['design_point']['total_head_m'],
                                           prepared['result']['system']['total_head_m'])
                    self.assertTrue(prepared['fluid_config']['use_manual_properties'])

    def test_current_report_preserves_resolution_and_project_keeps_cost_bound(self):
        for requested, expected in [(2, 2), (101, 101)]:
            with self.subTest(requested=requested):
                payload = {**self.duty_payload(MANUAL), 'flow_value': 5, 'result': {},
                           'system_curve': {'max_flow_factor': 2, 'number_points': requested}}
                current = self.api._prepare_pump_report_payload(deepcopy(payload))
                self.assertEqual(len(current['system_curve']['points']), expected)
                project = self.api._prepare_pump_report_payload(deepcopy(payload), include_curve=True)
                self.assertEqual(len(project['system_curve']['points']), max(5, min(requested, 21)))
        self.provider.assert_not_called()

    def test_project_report_generates_missing_curve(self):
        scenario = {**self.duty_payload(), 'flow_value': 5, 'result': {}, 'name': 'Lift'}
        request = self.api.PumpProjectScenarioReportRequest(scenarios=[scenario])
        result = self.api._prepare_pump_project_report_payload(request)['scenarios'][0]
        self.provider.assert_called_once()
        self.assertIsNotNone(result['system_curve'])
        self.assertAlmostEqual(result['result']['system']['total_head_m'],
                               result['system_curve']['design_point']['total_head_m'])

    def test_report_reuses_interactive_frozen_state_without_provider_call(self):
        duty = self.client.post('/hydraulics/pump-sizing', json=self.duty_payload()).json()
        self.provider.assert_called_once()
        scenario = {**self.duty_payload(duty['resolved_fluid_config']),
                    'flow_value': 5, 'result': duty, 'name': 'Saved lift'}
        request = self.api.PumpProjectScenarioReportRequest(scenarios=[scenario])
        prepared = self.api._prepare_pump_project_report_payload(request)['scenarios'][0]
        self.provider.assert_called_once()
        self.assertEqual(prepared['result']['pump_duty'], duty['pump_duty'])
        self.assertAlmostEqual(prepared['system_curve']['design_point']['total_head_m'],
                               duty['system']['total_head_m'])

    def test_ordinary_curve_dispatch_unchanged(self):
        with patch.object(self.api, 'build_system_curve', return_value={'ordinary': True}) as ordinary, \
             patch.object(self.api, 'build_pump_system_curve') as pump:
            response = self.client.post('/hydraulics/system-curve', json={
                'fluid_config': AUTO, 'design_flow_value': 5, 'inlet_pressure_bar_a': 1.2,
                'elements': ELEMENTS})
        self.assertEqual(response.json(), {'ordinary': True})
        ordinary.assert_called_once()
        self.assertFalse(ordinary.call_args.kwargs['fluid_config']['use_manual_properties'])
        self.assertEqual(ordinary.call_args.kwargs['inlet_pressure_bar_a'], 1.2)
        pump.assert_not_called()


    def test_calculation_response_to_pdf_and_docx_project_report(self):
        for extension in ['pdf', 'docx']:
            with self.subTest(extension=extension):
                self.provider.reset_mock()
                response = self.client.post('/hydraulics/pump-sizing', json=self.duty_payload())
                self.assertEqual(response.status_code, 200, response.text)
                duty = response.json()
                frozen = duty['resolved_fluid_config']
                self.assertTrue(frozen['use_manual_properties'])
                for field, value in PROPERTIES.items():
                    self.assertEqual(frozen[field], value)
                # Match the frontend project builder after JSON serialization.
                scenario = {**self.duty_payload(frozen), 'name': 'Source lift',
                            'flow_value': 5, 'result': duty, 'system_curve': None,
                            'engineering_task': 'pump_sizing'}
                payload = {'project_title': 'Pump project', 'scenarios': [scenario]}
                with patch.object(self.api, f'create_pump_project_{extension}_report',
                                  return_value='unused') as writer, \
                     patch.object(self.api, 'FileResponse', return_value=Response(b'report')):
                    report = self.client.post(f'/reports/pump-sizing/project/{extension}', json=payload)
                self.assertEqual(report.status_code, 200, report.text)
                prepared = writer.call_args.args[0]['scenarios'][0]
                self.assertEqual(prepared['fluid_config'], frozen)
                self.assertEqual(prepared['result']['pump_duty'], duty['pump_duty'])
                self.assertAlmostEqual(prepared['system_curve']['design_point']['total_head_m'],
                                       duty['system']['total_head_m'])
                self.provider.assert_called_once()  # Resolved only at the real 1.2-bar source.

    def test_production_missing_fluid_payload_reproduces_422(self):
        for extension in ['pdf', 'docx']:
            with self.subTest(extension=extension):
                scenario = {**self.duty_payload(), 'name': 'Source lift',
                            'flow_value': 5, 'result': {}}
                del scenario['fluid_config']  # JSON.stringify omitted undefined.
                response = self.client.post(f'/reports/pump-sizing/project/{extension}',
                                            json={'scenarios': [scenario]})
                self.assertEqual(response.status_code, 422)
                self.assertIn({'type': 'missing',
                               'loc': ['body', 'scenarios', 0, 'fluid_config'],
                               'msg': 'Field required'},
                              [{key: error[key] for key in ['type', 'loc', 'msg']}
                               for error in response.json()['detail']])
        self.provider.assert_not_called()

    def test_response_contract_rejects_missing_or_incomplete_frozen_config(self):
        from fastapi.exceptions import ResponseValidationError
        for result in [{}, {'resolved_fluid_config': {}},
                       {'resolved_fluid_config': {**MANUAL, 'vapor_pressure_bar_a': None}}]:
            with self.subTest(result=result), \
                 patch.object(self.api, 'size_pump_duty', return_value=result):
                with self.assertRaises(ResponseValidationError):
                    self.client.post('/hydraulics/pump-sizing', json=self.duty_payload())

    def test_openapi_requires_resolved_fluid_configuration(self):
        schemas = self.api.app.openapi()['components']['schemas']
        self.assertIn('resolved_fluid_config', schemas['PumpSizingResponse']['required'])
        for field in ['density_kg_m3', 'dynamic_viscosity_pa_s', 'vapor_pressure_bar_a']:
            self.assertIn(field, schemas['ResolvedPumpFluidConfig']['required'])


if __name__ == '__main__':
    unittest.main()
