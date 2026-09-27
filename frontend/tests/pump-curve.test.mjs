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

function loadModule(path) {
  const exports = {};
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Error });
  return exports;
}
const { requirePumpReportFluidConfig } = loadModule('../lib/pump-report.ts');
const { readApiError } = loadModule('../lib/api-error.ts');
const frozenSource = {
  phase_type: 'Liquid', fluid: 'Water', temperature_c: 25, use_manual_properties: true,
  density_kg_m3: 997, dynamic_viscosity_pa_s: 0.00089, vapor_pressure_bar_a: 0.0317,
};
const savedPumpScenario = {
  name: 'Source lift', flow_value: 5, flow_unit: 'm3/h', elements: [],
  calculation_intent: 'pressure_drop', inlet_pressure_bar_a: null,
  property_reference_pressure_bar_a: 1000,
  fluid_config: { mode: 'coolprop', selected_fluid: 'Water', phase_type: 'Liquid',
    temperature_c: 25, engineering_task: 'pump_sizing',
    coolprop_properties: { density_kg_m3: 1234 },
    pump_sizing: { source_pressure_bar_a: 1.2, destination_pressure_bar_a: 3,
      pump_efficiency: 0.7, motor_margin: 1.1, pump_after_element_index: 0 } },
};

async function runProjectReport(format, result, reportResponse) {
  const calls = [], errors = [], downloads = [], loading = [];
  const buildFluid = loadFunction('buildSolveFluidConfigForScenario', {
    apiFetch: async () => assert.fail('Must resolve properties in the pump solver at source pressure'),
  });
  const download = loadFunction('downloadEngineeringReport', {
    Error, readApiError, requirePumpReportFluidConfig,
    engineeringTask: 'pump_sizing', analysisType: 'scenario', wizardStep: 'overview',
    selectedProjectId: '1', selectedProject: { name: 'Pump project' },
    scenarios: [savedPumpScenario], scenarioDefinitionMode: null,
    setReportLoading: value => loading.push(value), setError: error => errors.push(error),
    setProjectStatus() {}, buildSolveFluidConfigForScenario: buildFluid,
    buildApiElementsForScenario: elements => elements,
    normalizeFlowUnit: value => value, sanitizeReportFilename: value => value,
    downloadBlob: (blob, filename) => downloads.push({ blob, filename }),
    API_BASE_URL: 'https://api.test',
    apiFetch: async (url, options) => {
      const payload = options?.body ? JSON.parse(options.body) : null;
      calls.push({ url, method: options?.method ?? 'GET', payload });
      if (url.endsWith('/scenarios')) return Response.json([savedPumpScenario]);
      if (url.endsWith('/hydraulics/pump-sizing')) return Response.json(result);
      assert.equal(url, `https://api.test/reports/pump-sizing/project/${format}`);
      return reportResponse ?? new Response('report');
    },
  });
  await download(format, 'project');
  return { calls, errors, downloads, loading };
}

for (const format of ['pdf', 'docx']) {
  test(`${format} project report includes the exact frozen automatic source configuration`, async () => {
    const result = { resolved_fluid_config: frozenSource, source_pressure_bar_a: 1.2 };
    const actual = await runProjectReport(format, result);
    assert.equal(actual.calls.length, 3);
    const calculation = actual.calls[1].payload;
    assert.equal(calculation.source_pressure_bar_a, 1.2);
    assert.equal(calculation.fluid_config.use_manual_properties, false);
    assert.equal(calculation.fluid_config.density_kg_m3, undefined);
    const report = actual.calls[2].payload.scenarios[0];
    assert.ok(Object.hasOwn(report, 'fluid_config'));
    assert.deepEqual(report.fluid_config, frozenSource);
    assert.deepEqual(report.result, result);
    assert.equal(actual.calls[2].method, 'POST');
    assert.equal(actual.downloads.length, 1);
    assert.ok(actual.downloads[0].filename.endsWith(`.${format}`));
    assert.deepEqual(actual.errors, ['']);
    assert.equal(actual.loading.at(-1), null);
  });

  test(`${format} legacy production response without resolved_fluid_config stops before report POST`, async () => {
    const actual = await runProjectReport(format, {
      source_pressure_bar_a: 1.2, reference_density_kg_m3: 997,
      reference_dynamic_viscosity_pa_s: 0.00089,
    });
    assert.equal(actual.calls.length, 2);
    assert.equal(actual.downloads.length, 0);
    assert.match(actual.errors.at(-1), /Scenario "Source lift".*missing a valid resolved_fluid_config/);
    assert.match(actual.errors.at(-1), /No report request was sent/);
    assert.equal(actual.loading.at(-1), null);
  });

  test(`${format} displays the FastAPI 422 location and message`, async () => {
    const actual = await runProjectReport(format, { resolved_fluid_config: frozenSource },
      Response.json({ detail: [{ loc: ['body', 'scenarios', 0, 'fluid_config'], msg: 'Field required', type: 'missing' }] }, { status: 422 }));
    assert.match(actual.errors.at(-1), /422.*body.scenarios.0.fluid_config: Field required/);
    assert.doesNotMatch(actual.errors.at(-1), /\[object Object\]/);
    assert.equal(actual.calls.length, 3); // No repeated mutation.
    assert.equal(actual.downloads.length, 0);
  });
}

for (const [name, config] of [
  ['null', null], ['empty', {}], ['automatic/unfrozen', { ...frozenSource, use_manual_properties: false }],
  ['missing density', { ...frozenSource, density_kg_m3: undefined }],
  ['missing viscosity', { ...frozenSource, dynamic_viscosity_pa_s: undefined }],
  ['missing vapor pressure', { ...frozenSource, vapor_pressure_bar_a: undefined }],
  ['zero density', { ...frozenSource, density_kg_m3: 0 }],
  ['negative vapor pressure', { ...frozenSource, vapor_pressure_bar_a: -1 }],
  ['nonfinite viscosity', { ...frozenSource, dynamic_viscosity_pa_s: Infinity }],
]) {
  test(`report refuses ${name} without inventing properties`, () => {
    assert.throws(() => requirePumpReportFluidConfig({ resolved_fluid_config: config }, 'Test'), /valid resolved_fluid_config/);
  });
}

test('validation detail formatter retains string errors and tolerates non-JSON errors', async () => {
  assert.equal(await readApiError(Response.json({ detail: 'Invalid fluid' }), 'Failed (400).'), 'Failed (400). Invalid fluid');
  assert.equal(await readApiError(new Response('Gateway failed'), 'Failed (502).'), 'Failed (502).');
});
