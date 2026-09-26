"""Focused Stage 1 regressions. No application startup or database connections."""
import importlib
import math
import os
from pathlib import Path
import runpy
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]


class EndpointAndReportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Import routes without loading real secrets or constructing a real DB engine.
        with patch('dotenv.load_dotenv'), patch('sqlmodel.create_engine'):
            cls.api = importlib.import_module('backend.main')
        cls.client = TestClient(cls.api.app)  # No context manager: no startup/create_all.
        cls.reports = importlib.import_module('reports.project_engineering_report')

    @classmethod
    def tearDownClass(cls):
        cls.client.close()

    def test_legacy_endpoint_numerical_regimes(self):
        for reynolds, regime, method in [
            (1000, 'Laminar', 'Laminar: 64/Re'),
            (3000, 'Transitional', 'Transition: Churchill'),
            (100000, 'Turbulent', 'Turbulent: Colebrook-White'),
        ]:
            with self.subTest(reynolds=reynolds):
                diameter, density, viscosity, length, roughness = 0.1, 1000, 0.001, 10, 0.000045
                velocity = reynolds * viscosity / (density * diameter)
                flow = velocity * math.pi * diameter ** 2 / 4 * 3600
                response = self.client.post('/calculate/pressure-drop', json={
                    'flow_rate_m3_h': flow, 'pipe_diameter_m': diameter,
                    'pipe_length_m': length, 'density_kg_m3': density,
                    'dynamic_viscosity_pa_s': viscosity, 'roughness_m': roughness,
                })
                self.assertEqual(response.status_code, 200, response.text)
                result = response.json()
                self.assertAlmostEqual(result['reynolds_number'], reynolds)
                self.assertEqual(result['flow_regime'], regime)
                self.assertEqual(result['friction_method'], method)
                friction = result['friction_factor']
                if reynolds == 1000:
                    self.assertAlmostEqual(friction, 0.064)
                elif reynolds == 3000:
                    self.assertTrue(0.04 < friction < 0.05)
                else:
                    # Independent check of the Colebrook equation residual.
                    residual = 1 / math.sqrt(friction) + 2 * math.log10(
                        roughness / diameter / 3.7 + 2.51 / (reynolds * math.sqrt(friction)))
                    self.assertAlmostEqual(residual, 0, places=6)
                expected_pa = friction * length / diameter * density * velocity ** 2 / 2
                self.assertAlmostEqual(result['pressure_drop_pa'], expected_pa)
                self.assertAlmostEqual(result['pressure_drop_bar'], expected_pa / 100000)

    def test_legacy_invalid_dimensions_rejected(self):
        response = self.client.post('/calculate/pressure-drop', json={
            'flow_rate_m3_h': 1, 'pipe_diameter_m': 0, 'pipe_length_m': 10,
            'density_kg_m3': 1000, 'dynamic_viscosity_pa_s': 0.001, 'roughness_m': 0,
        })
        self.assertEqual(response.status_code, 422)

    def test_main_solver_still_dispatches(self):
        with patch.object(self.api, 'solve_line', return_value={'total_dp_bar': 0.1}) as solve:
            response = self.client.post('/hydraulics/solve-line', json={
                'fluid_config': {'use_manual_properties': True}, 'flow_value': 1,
                'inlet_pressure_bar_a': 5, 'elements': [],
            })
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['total_dp_bar'], 0.1)
        solve.assert_called_once()

    def test_pump_summary_columns(self):
        scenario = {'name': 'Duty A', 'flow_value': 12, 'flow_unit': 'm3/h', 'result': {
            'pump_duty': {'required_differential_head_m': 11,
                          'required_differential_pressure_bar': 22,
                          'shaft_power_kw': 33, 'minimum_motor_rating_kw': 44},
            'npsha': {'available_head_m': 5.5}, 'warnings': ['one', 'two'],
        }}
        rows = self.reports._pump_summary_rows([scenario, {'name': 'Missing'}])
        self.assertTrue(all(len(row) == len(rows[0]) == 8 for row in rows))
        self.assertEqual(rows[1], ['Duty A', '12 m3/h', '11.000', '5.500',
                                   '22.0000', '33.0000', '44.0000', '2'])
        self.assertEqual(rows[2][3], '-')
        scenario['result']['npsha'] = {'available_head_m': 0}
        self.assertEqual(self.reports._pump_summary_rows([scenario])[1][3], '0.000')
        scenario['result']['npsha'] = None
        self.assertEqual(self.reports._pump_summary_rows([scenario])[1][3], '-')


class DatabaseConfigurationTests(unittest.TestCase):
    def load_configuration(self, dotenv_text='', environment=None):
        # Execute the actual module in a fixture repository, with real dotenv parsing.
        # Engine construction is intercepted; no connection or create_all is possible.
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'database').mkdir()
            module = root / 'database' / 'db.py'
            module.write_text((ROOT / 'database/db.py').read_text(encoding='utf-8'), encoding='utf-8')
            (root / '.env').write_text(dotenv_text, encoding='utf-8')
            from dotenv import load_dotenv
            with patch.dict(os.environ, environment or {}, clear=True), \
                 patch('dotenv.load_dotenv', wraps=load_dotenv) as loader, \
                 patch('sqlmodel.create_engine') as engine:
                namespace = runpy.run_path(str(module))
                loader.assert_called_once_with(root / '.env', override=False)
                self.assertEqual(engine.call_args.args[0], namespace['DATABASE_URL'])
                return namespace['DATABASE_URL'], engine.call_args.kwargs

    def test_dotenv_loaded_before_engine_and_postgres_normalized(self):
        for prefix in ['postgres://', 'postgresql://', 'postgresql+psycopg://']:
            with self.subTest(prefix=prefix):
                url, options = self.load_configuration(f'DATABASE_URL={prefix}test:test@localhost/test\n')
                self.assertEqual(url, 'postgresql+psycopg://test:test@localhost/test')
                self.assertTrue(options['pool_pre_ping'])

    def test_process_environment_wins(self):
        url, _ = self.load_configuration('DATABASE_URL=postgres://ignored/ignored\n',
                                         {'DATABASE_URL': 'sqlite:///:memory:'})
        self.assertEqual(url, 'sqlite:///:memory:')

    def test_sqlite_fallback(self):
        url, options = self.load_configuration()
        self.assertEqual(url, 'sqlite:///./process_engineering_workbench.db')
        self.assertEqual(options['connect_args'], {'check_same_thread': False})


if __name__ == '__main__':
    unittest.main()
