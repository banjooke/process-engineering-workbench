import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const tree = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function loadFunction(name, bindings) {
  let found;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(found, `Missing function ${name}`);
  const js = ts.transpileModule(found.getText(tree), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return vm.runInNewContext(`${js}; ${name}`, bindings);
}

for (const pump of [true, false]) {
  test(`interactive curve sends ${pump ? 'frozen source properties' : 'ordinary inlet unchanged'}`, async () => {
    let request;
    const frozen = { use_manual_properties: true, density_kg_m3: 997 };
    const automatic = { use_manual_properties: false };
    const generate = loadFunction('generateSystemCurve', {
      setSystemCurveLoading() {}, setError(error) { assert.equal(error, ''); },
      setSystemCurve() {}, phaseType: 'Liquid', result: {},
      pumpResult: pump ? { resolved_fluid_config: frozen, source_pressure_bar_a: 1.2 } : null,
      inletPressure: '3', systemCurveMaxFactor: '2', systemCurvePoints: '5',
      API_BASE_URL: 'https://api.test', flowValue: '5', flowUnit: 'm³/h',
      buildReportFluidConfig: () => automatic, normalizeFlowUnit: v => v,
      buildApiElements: () => [],
      apiFetch: async (url, options) => {
        assert.equal(url, 'https://api.test/hydraulics/system-curve');
        request = JSON.parse(options.body);
        return { ok: true, json: async () => ({}) };
      },
    });
    await generate();
    assert.equal(request.inlet_pressure_bar_a, pump ? 1.2 : 3);
    assert.equal(request.pump_system, pump);
    assert.deepEqual(request.fluid_config, pump ? frozen : automatic);
  });
}

test('saved automatic pump scenario does not freeze at pressure-drop fallback', async () => {
  const build = loadFunction('buildSolveFluidConfigForScenario', {
    apiFetch: async () => { assert.fail('Must resolve at the pump source in the backend'); },
  });
  const result = await build({
    calculation_intent: 'pressure_drop', inlet_pressure_bar_a: null,
    property_reference_pressure_bar_a: 1000,
    fluid_config: { mode: 'coolprop', selected_fluid: 'Water', phase_type: 'Liquid',
      temperature_c: 25, engineering_task: 'pump_sizing', pump_sizing: { source_pressure_bar_a: 1.2 },
      coolprop_properties: { density_kg_m3: 1234 } },
  });
  assert.equal(result.use_manual_properties, false);
  assert.equal(result.fluid, 'Water');
  assert.equal(result.density_kg_m3, undefined);
});
