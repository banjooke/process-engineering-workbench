"""Deterministic prototype regressions; no API, database or live property calls.

B15 is arithmetic-only: P/T in the harness are synthetic, not source data.
"""
from copy import deepcopy
import math
import unittest
from unittest.mock import patch

from pydantic import ValidationError
from engineering import control_valve as cv


def case(name="normal", **changes):
    data = dict(
        case_id=name, flow_value=10.0, flow_unit="m³/h",
        upstream_pressure=3.54, downstream_pressure=2.0, pressure_unit="bar",
        pressure_basis="absolute", temperature=20.0, temperature_unit="C",
        fluid_config=dict(
            fluid="Water", phase_type="Liquid", composition="pure", rheology="Newtonian",
            use_manual_properties=True, density_kg_m3=1000.0,
            dynamic_viscosity_pa_s=0.001,
            manual_source=dict(source="Synthetic software fixture", reason="Arithmetic parity only",
                               actor="test", reference_edition="fixture/1",
                               evaluation_pressure_pa_abs=354000.0, evaluation_temperature_k=293.15),
        ),
    )
    data.update(changes)
    return data


def automatic(**changes):
    c = case(**changes)
    c['fluid_config'] = dict(fluid="Water", phase_type="Liquid", composition="pure",
                             rheology="Newtonian", use_manual_properties=False)
    return c


PROPERTIES = dict(density_kg_m3=997.0, dynamic_viscosity_pa_s=0.00089,
                  vapor_pressure_bar_a=0.023, critical_pressure_bar_a=220.64,
                  phase_type="Liquid", phase_label="liquid", _property_provider="CoolProp",
                  _provider_fluid_id="Water")


class ControlValveTests(unittest.TestCase):
    def result(self, c=None, **kwargs):
        return cv.size_control_valve(dict(normal=c or case(), **kwargs))

    def test_published_spirax_benchmark(self):
        # Independent published value, not produced by code under test.
        self.assertLessEqual(abs(self.result().maximum_required_kv - 8.06), 0.005)

    def test_recorded_full_precision_arithmetic(self):
        self.assertTrue(math.isclose(self.result().maximum_required_kv, 8.058229640253803, rel_tol=1e-12))

    def test_exact_conversion_multiplier(self):
        self.assertEqual(cv.CV_TO_KV, 0.8649776554423018)
        self.assertEqual(cv.cv_to_kv(1.0), 0.8649776554423018)
        self.assertEqual(cv.kv_to_cv(1.0), 1 / 0.8649776554423018)

    def test_reciprocal_round_trips(self):
        for n in (1e-6, 1.0, 8.06, 100.0, 1e6):
            with self.subTest(n=n):
                self.assertTrue(math.isclose(cv.kv_to_cv(cv.cv_to_kv(n)), n, rel_tol=1e-12))
                self.assertTrue(math.isclose(cv.cv_to_kv(cv.kv_to_cv(n)), n, rel_tol=1e-12))

    def test_defining_identities(self):
        for q, unit, dp, punit, attr in (
            (1.0, "m³/h", 1.0, "bar", "required_kv"),
            (1.0, "US gpm", 1.0, "psi", "required_cv"),
        ):
            c = automatic(flow_value=q, flow_unit=unit, upstream_pressure=21.0,
                          downstream_pressure=20.0, pressure_unit=punit)
            with patch.object(cv.fluids, 'get_fluid_properties', return_value={**PROPERTIES, 'density_kg_m3': 1000.0}):
                self.assertTrue(math.isclose(getattr(self.result(c).cases[0], attr), 1.0, rel_tol=1e-12))

    def test_equivalent_flow_units(self):
        for unit, value in (("m³/h", 10.0), ("m3/h", 10.0), ("m³/s", 10/3600),
                            ("m3/s", 10/3600), ("L/s", 10/3.6), ("L/min", 10000/60),
                            ("US gpm", 10/(60*0.003785411784))):
            with self.subTest(unit=unit):
                self.assertTrue(math.isclose(self.result(case(flow_unit=unit, flow_value=value)).maximum_required_kv,
                                             8.058229640253803, rel_tol=1e-12))

    def test_equivalent_pressure_units(self):
        for unit, factor in (("Pa", 1), ("kPa", 1000), ("bar", 100000),
                             ("psi", 6894.757293168361)):
            with self.subTest(unit=unit):
                r = self.result(case(pressure_unit=unit, upstream_pressure=354000/factor,
                                     downstream_pressure=200000/factor))
                self.assertTrue(math.isclose(r.maximum_required_kv, 8.058229640253803, rel_tol=1e-12))

    def test_temperature_units(self):
        for unit, temp in (("C", 20.0), ("°C", 20.0), ("F", 68.0), ("°F", 68.0), ("K", 293.15)):
            self.assertAlmostEqual(self.result(case(temperature=temp, temperature_unit=unit)).cases[0].normalized.temperature_k, 293.15)

    def test_absolute_pressure(self):
        si = self.result().cases[0].normalized
        self.assertEqual(si.upstream_pressure_pa_abs, 354000.0)
        self.assertEqual(si.downstream_pressure_pa_abs, 200000.0)
        self.assertEqual(si.differential_pressure_pa, 154000.0)

    def test_gauge_conversion_with_explicit_atmosphere(self):
        c = case(upstream_pressure=2.54, downstream_pressure=1.0,
                 pressure_basis="gauge", atmospheric_pressure_pa=100000.0)
        self.assertEqual(self.result(c).cases[0].normalized, self.result().cases[0].normalized.model_copy(update={'atmospheric_pressure_pa': 100000.0}))

    def test_gauge_missing_atmosphere_and_absolute_redundancy(self):
        for changes in ({'pressure_basis': 'gauge'}, {'atmospheric_pressure_pa': 100000.0}):
            with self.assertRaises(ValueError):
                self.result(case(**changes))

    def test_negative_gauge_valid_when_absolute_positive(self):
        c = automatic(upstream_pressure=-0.1, downstream_pressure=-0.2,
                      pressure_basis="gauge", atmospheric_pressure_pa=100000.0)
        with patch.object(cv.fluids, 'get_fluid_properties', return_value=PROPERTIES):
            self.assertEqual(self.result(c).cases[0].normalized.upstream_pressure_pa_abs, 90000.0)

    def test_real_upstream_property_resolution_and_freeze(self):
        raw = deepcopy(PROPERTIES)
        c = automatic(pressure_basis="gauge", upstream_pressure=2.54,
                      downstream_pressure=1.0, atmospheric_pressure_pa=100000.0)
        original = deepcopy(c)
        with patch.object(cv.fluids, 'get_fluid_properties', return_value=raw) as resolver:
            result = self.result(c)
        resolver.assert_called_once_with(fluid="Water", temperature_c=20.0, pressure_bar_a=3.54)
        props = result.cases[0].resolved_fluid_config
        self.assertEqual(props.provenance.evaluation_pressure_pa_abs, 354000.0)
        self.assertEqual(props.provenance.evaluation_temperature_k, 293.15)
        self.assertEqual(props.provenance.origin, 'automatic')
        self.assertEqual(props.provenance.source, 'CoolProp')
        self.assertEqual(props.provenance.provider_fluid_id, 'Water')
        self.assertTrue(props.use_manual_properties)
        self.assertEqual(c, original)
        raw['density_kg_m3'] = 500.0
        self.assertEqual(props.density_kg_m3, 997.0)
        with self.assertRaises(ValidationError):
            props.density_kg_m3 = 500.0

    def test_manual_traceability(self):
        with patch.object(cv.fluids, 'get_fluid_properties') as resolver:
            props = self.result().cases[0].resolved_fluid_config
        resolver.assert_not_called()
        self.assertEqual(props.provenance.manual_source.reason, 'Arithmetic parity only')
        self.assertEqual(props.provenance.origin, 'manual')

    def test_manual_source_required_and_state_must_match(self):
        for field in ('manual_source', 'density_kg_m3'):
            c = case()
            del c['fluid_config'][field]
            with self.assertRaises(ValueError):
                self.result(c)
        c = case()
        c['fluid_config']['manual_source']['evaluation_pressure_pa_abs'] = 1e8
        with self.assertRaisesRegex(ValueError, 'real upstream'):
            self.result(c)

    def test_explicit_sg_reference(self):
        c = case()
        del c['fluid_config']['density_kg_m3']
        c['fluid_config'].update(specific_gravity=2.0, sg_reference_density_kg_m3=500.0)
        self.assertEqual(self.result(c).maximum_required_kv, self.result().maximum_required_kv)
        del c['fluid_config']['sg_reference_density_kg_m3']
        with self.assertRaises(ValueError):
            self.result(c)

    def test_no_silent_manual_automatic_blending(self):
        c = automatic()
        c['fluid_config']['density_kg_m3'] = 1000.0
        with self.assertRaises(ValueError):
            self.result(c)

    def test_normal_only(self):
        r = self.result()
        self.assertEqual(len(r.cases), 1)
        self.assertEqual(r.governing_case, 'normal')

    def test_three_cases_numerical_governing(self):
        r = self.result(minimum=case('minimum', flow_value=20.0), maximum=case('maximum', flow_value=5.0))
        self.assertEqual([c.case_id for c in r.cases], ['minimum', 'normal', 'maximum'])
        self.assertEqual(r.governing_case, 'minimum')
        self.assertAlmostEqual(r.maximum_required_kv, 16.116459280507606)

    def test_disabled_optional_case_omitted(self):
        with patch.object(cv.fluids, 'get_fluid_properties') as resolver:
            r = self.result(maximum=automatic(case_id='maximum', enabled=False))
        resolver.assert_not_called()
        self.assertEqual(len(r.cases), 1)

    def test_normal_required_enabled_and_ids_match(self):
        for payload in ({}, {'normal': case(enabled=False)}, {'normal': case('maximum')},
                        {'normal': case(), 'maximum': case('minimum')}):
            with self.assertRaises(ValueError):
                cv.size_control_valve(payload)

    def test_default_and_custom_margin_only(self):
        baseline = self.result()
        self.assertEqual(baseline.rating_margin, 0.10)
        for margin in (0.0, 0.1, 0.25):
            r = self.result(rating_margin=margin)
            self.assertEqual(r.cases, baseline.cases)
            self.assertEqual(r.maximum_required_kv, baseline.maximum_required_kv)
            self.assertAlmostEqual(r.target_rated_kv, baseline.maximum_required_kv*(1+margin))
            self.assertAlmostEqual(r.target_rated_cv, baseline.maximum_required_cv*(1+margin))

    def test_zero_negative_and_floor_flow(self):
        for value in (0.0, -1.0, 1e-9):
            with self.assertRaises(ValueError):
                self.result(case(flow_value=value, flow_unit='m³/s'))

    def test_zero_negative_and_floor_pressure_drop(self):
        for p2 in (354000.0, 354001.0, 353999.0):
            with self.assertRaises(ValueError):
                self.result(case(upstream_pressure=354000.0, downstream_pressure=p2, pressure_unit='Pa'))

    def test_invalid_absolute_pressure_temperature_and_diameter(self):
        for changes in ({'downstream_pressure': 0.0}, {'upstream_pressure': -1.0},
                        {'temperature': 0.0, 'temperature_unit': 'K'}, {'upstream_pipe_id_m': 0.0}):
            with self.assertRaises(ValueError):
                self.result(case(**changes))

    def test_missing_invalid_provider_density(self):
        for rho in (None, 0.0, -1.0, float('nan'), float('inf'), '1000'):
            with self.subTest(rho=rho), patch.object(cv.fluids, 'get_fluid_properties', return_value={**PROPERTIES, 'density_kg_m3': rho}):
                with self.assertRaises(ValueError):
                    self.result(automatic())

    def test_unsupported_services(self):
        for field, values in (('phase_type', ('Gas', 'Steam', 'Two-phase', 'Slurry')),
                              ('composition', ('mixture',)), ('rheology', ('non-Newtonian',))):
            for value in values:
                c = case()
                c['fluid_config'][field] = value
                with self.subTest(value=value), self.assertRaises(ValueError):
                    self.result(c)
        with self.assertRaises(ValueError):
            self.result(case(known_choked=True))

    def test_provider_phase_rejected(self):
        for phase in ('Gas', 'Two-phase', None, 'Supercritical'):
            with patch.object(cv.fluids, 'get_fluid_properties', return_value={**PROPERTIES, 'phase_type': phase}):
                with self.assertRaises(ValueError):
                    self.result(automatic())

    def test_pipe_reynolds_screening(self):
        r = self.result(case(upstream_pipe_id_m=0.05)).cases[0]
        self.assertAlmostEqual(r.pipe_reynolds_screening.reynolds_number, 70735.5302630646, places=7)
        self.assertEqual(r.pipe_reynolds_screening.classification, 'Turbulent')
        self.assertEqual(r.pipe_reynolds_screening.label, 'pipe Reynolds screening')
        self.assertIn('Not IEC/ISA', r.pipe_reynolds_screening.policy)
        self.assertFalse(r.final_selection_allowed)

    def test_indeterminate_without_diameter_or_viscosity(self):
        for diameter, viscosity in ((None, 0.001), (0.05, None)):
            c = case(upstream_pipe_id_m=diameter)
            c['fluid_config']['dynamic_viscosity_pa_s'] = viscosity
            r = self.result(c).cases[0]
            self.assertEqual(r.pipe_reynolds_screening.classification, 'indeterminate')
            self.assertIsNone(r.pipe_reynolds_screening.reynolds_number)

    def test_laminar_transitional_no_correction(self):
        for viscosity, classification in ((0.1, 'Laminar'), (0.025, 'Transitional')):
            c = case(upstream_pipe_id_m=0.05)
            c['fluid_config']['dynamic_viscosity_pa_s'] = viscosity
            r = self.result(c).cases[0]
            self.assertEqual(r.pipe_reynolds_screening.classification, classification)
            self.assertEqual(r.required_kv, self.result().maximum_required_kv)
            self.assertIn('LOW_RE_LIMITATION', [w.code for w in r.warnings])
            self.assertIn('valve-specific Fd', ' '.join(r.limitations))
            self.assertFalse(r.final_selection_allowed)

    def test_nonfinite_inputs_every_numeric_layer(self):
        for value in (float('nan'), float('inf'), -float('inf')):
            for field in ('flow_value', 'upstream_pressure', 'downstream_pressure', 'temperature', 'upstream_pipe_id_m'):
                with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                    self.result(case(**{field: value}))
            with self.assertRaises(ValueError):
                self.result(rating_margin=value)
            c = case()
            c['fluid_config']['manual_source']['evaluation_temperature_k'] = value
            with self.assertRaises(ValueError):
                self.result(c)

    def test_strict_versions_unknown_fields_and_mass_flow(self):
        for changes in ({'schema_version': 'future'}, {'flow_unit': 'kg/h'}, {'flow_unit': 'gpm'},
                        {'flow_value': '10'}, {'flow_value': True}, {'FL': 0.9}):
            with self.assertRaises(ValueError):
                self.result(case(**changes))

    def test_provider_failure_no_manual_fallback(self):
        with patch.object(cv.fluids, 'get_fluid_properties', side_effect=ValueError('unsupported state')):
            with self.assertRaisesRegex(ValueError, 'normal: unsupported state'):
                self.result(automatic())

    def test_vapor_boundary_and_missing_properties_no_completed_assessment(self):
        c = case()
        c['fluid_config']['vapor_pressure_bar_a'] = 2.0
        r = self.result(c).cases[0]
        self.assertIn('VAPOR_BOUNDARY', [w.code for w in r.warnings])
        c['fluid_config']['vapor_pressure_bar_a'] = 3.54
        with self.assertRaises(ValueError):
            self.result(c)
        self.assertIn('VAPOR_PRESSURE_UNKNOWN', [w.code for w in self.result().warnings])

    def test_mandatory_warnings_and_blocked_outputs(self):
        r = self.result()
        for item in (r, r.cases[0]):
            self.assertEqual(item.verification_status, 'prototype_correlated')
            self.assertEqual(item.vendor_confirmation, cv.VENDOR_CONFIRMATION)
            self.assertEqual(item.standard_limitation, cv.STANDARD_LIMITATION)
            self.assertEqual(item.assessment_status, 'incomplete')
            self.assertFalse(item.final_selection_allowed)
            for blocked in ('FL', 'Fd', 'Fp', 'FLP', 'corrected_cv', 'valve_reynolds', 'opening'):
                self.assertNotIn(blocked, item.model_dump())
        self.assertIn('CAVITATION_INDETERMINATE', [w.code for w in r.warnings])
        self.assertIn('CHOKING_INCOMPLETE', [w.code for w in r.warnings])

    def test_serialization_round_trip(self):
        r = self.result()
        self.assertEqual(cv.SizingResult.model_validate_json(r.model_dump_json()), r)

    def test_invalid_enabled_case_cannot_be_silently_dropped(self):
        with self.assertRaisesRegex(ValueError, 'maximum'):
            self.result(maximum=case('maximum', downstream_pressure=5.0))

    def test_overflow_never_returns_nonfinite_result(self):
        with self.assertRaises((ValueError, OverflowError)):
            self.result(case(flow_value=1e308, flow_unit='m³/s'))
        with self.assertRaises(ValueError):
            self.result(rating_margin=1e308)

    def test_invalid_optional_properties_are_not_treated_as_missing(self):
        for key in ('dynamic_viscosity_pa_s', 'vapor_pressure_bar_a', 'critical_pressure_bar_a'):
            for value in (0.0, -1.0, float('nan'), float('inf')):
                with self.subTest(key=key, value=value):
                    c = case()
                    c['fluid_config'][key] = value
                    with self.assertRaises(ValueError):
                        self.result(c)
                    with patch.object(cv.fluids, 'get_fluid_properties', return_value={**PROPERTIES, key: value}):
                        with self.assertRaises(ValueError):
                            self.result(automatic())

    def test_pipe_screening_threshold_boundaries_reuse_existing_policy(self):
        # Isolate the classification boundary from floating-point geometry rounding.
        for re, expected in ((2299.999, 'Laminar'), (2300.0, 'Transitional'),
                             (3999.999, 'Transitional'), (4000.0, 'Turbulent')):
            with patch.object(cv, 'calculate_reynolds_number', return_value=re):
                result = self.result(case(upstream_pipe_id_m=0.05)).cases[0]
            self.assertEqual(result.pipe_reynolds_screening.classification, expected)
            self.assertFalse(result.final_selection_allowed)

    def test_each_enabled_case_resolved_once_at_its_own_state(self):
        with patch.object(cv.fluids, 'get_fluid_properties', return_value=PROPERTIES) as resolver:
            r = self.result(automatic(), minimum=automatic(case_id='minimum', upstream_pressure=4.0),
                            maximum=automatic(case_id='maximum', upstream_pressure=5.0, temperature=30.0))
        self.assertEqual(resolver.call_count, 3)
        self.assertEqual([call.kwargs['pressure_bar_a'] for call in resolver.call_args_list], [4.0, 3.54, 5.0])
        self.assertEqual([call.kwargs['temperature_c'] for call in resolver.call_args_list], [20.0, 20.0, 30.0])
        self.assertEqual([c.resolved_fluid_config.provenance.evaluation_pressure_pa_abs for c in r.cases],
                         [400000.0, 354000.0, 500000.0])

    def test_unchecked_model_copy_revalidated(self):
        request = cv.SizingRequest(normal=cv.OperatingCase(**case()))
        changed = request.model_copy(update={'rating_margin': float('nan')})
        with self.assertRaises(ValueError):
            cv.size_control_valve(changed)


if __name__ == '__main__':
    unittest.main()
