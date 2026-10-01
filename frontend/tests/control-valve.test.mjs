import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
function load(path, requires) {
  const exports = {};
  vm.runInNewContext(compile(path), { exports, require: name => { assert.ok(name in requires, name); return requires[name]; },
    AbortController, Error, Number, Intl, JSON, window: { setTimeout, clearTimeout } });
  return exports;
}
const errors = load('../lib/api-error.ts', {});
function lib(fetcher = async () => new Response(JSON.stringify(result()))) {
  return load('../lib/control-valve.ts', { '@/lib/api': { apiFetch: fetcher }, '@/lib/api-error': errors });
}
const catalogue = load('../lib/fluid-catalogue.ts', { '@/lib/api': { apiFetch: async () => { throw new Error('unexpected catalogue fetch'); } }, '@/lib/api-error': errors });
const helper = lib();
const liquid = { phase_type: 'Liquid', phase_label: 'liquid', density_kg_m3: 997, dynamic_viscosity_pa_s: 0.001 };
const water = { id: 'Water', name: 'Water', formula: 'H2O', category: 'Common Process Fluids', aliases: [], liquid_capability: { eligible: true, reason: 'Check actual state' } };
function valid() {
  const draft = helper.initialDraft();
  Object.assign(draft.cases.normal, { flow: '10', upstream: '3.54', downstream: '2', diameter: '50' });
  return draft;
}
function result(display = 'both', classification = 'Turbulent') {
  return { cases: [{ case_id: 'normal', required_cv: 9.316, required_kv: 8.058229640253803,
    normalized: { differential_pressure_pa: 154000, upstream_pressure_pa_abs: 354000, downstream_pressure_pa_abs: 200000, temperature_k: 293.15, flow_m3_s: 0.002777 },
    resolved_fluid_config: { density_kg_m3: 1000, dynamic_viscosity_pa_s: 0.001,
      provenance: { source: 'CoolProp', origin: 'automatic', evaluation_pressure_pa_abs: 354000, evaluation_temperature_k: 293.15 } },
    pipe_reynolds_screening: { label: 'pipe Reynolds screening', classification, reynolds_number: 70735.5, policy: 'Not valve turbulence proof.' },
    assumptions: ['Base equation only.'], limitations: ['No completed choking assessment.'], warnings: [], source_ids: ['T1'], equation_ids: ['E2k'],
  }], governing_case: 'normal', maximum_required_cv: 9.316, maximum_required_kv: 8.058229640253803,
    target_rated_cv: 10.2476, target_rated_kv: 8.864052604279184, rating_margin: 0.1,
    display_basis: display, verification_status: 'prototype_correlated', final_selection_allowed: false,
    assessment_status: 'incomplete', vendor_confirmation: helper.VENDOR_WARNING, standard_limitation: helper.STANDARD_WARNING,
    warnings: [{ case_id: 'normal', code: 'TEST', message: 'Manufacturer confirmation required.' }] };
}
// Existing repository uses node:test + transpilation + React server rendering.
// This hook harness exercises actual component handlers and rerenders without new dependencies.
function mount(fetcher = async () => new Response(JSON.stringify(result())), props = {}, catalogueFetcher) {
  const withPreview = (url, init) => url.endsWith('/fluids/properties') ? Promise.resolve(new Response(JSON.stringify(liquid))) : fetcher(url, init);
  const state = [], refs = [], cleanups = [], effectDeps = [];
  let index = 0, refIndex = 0, effectIndex = 0;
  const hooks = { ...React,
    useState(initial) { const i = index++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
    useRef(initial) { const i = refIndex++; return refs[i] ??= { current: initial }; },
    useEffect(callback, deps) {
      const i = effectIndex++;
      if (!effectDeps[i] || deps.some((value, j) => !Object.is(value, effectDeps[i][j]))) {
        cleanups[i]?.(); effectDeps[i] = deps; cleanups[i] = callback();
      }
    },
  };
  const shared = catalogueFetcher ? load('../lib/fluid-catalogue.ts', { '@/lib/api': { apiFetch: catalogueFetcher }, '@/lib/api-error': errors }) : catalogue;
  const component = load('../components/ControlValveSizing.tsx', { react: hooks, 'react/jsx-runtime': jsx, '@/lib/control-valve': lib(withPreview), '@/lib/fluid-catalogue': shared });
  function render() { index = 0; refIndex = 0; effectIndex = 0; return component.default({ apiBaseUrl: 'https://api.test', fluids: [water], onRetryFluids() {}, ...props }); }
  function expand(node) {
    if (Array.isArray(node)) return node.flatMap(expand);
    if (!React.isValidElement(node)) return [];
    if (typeof node.type === 'function') return expand(node.type(node.props));
    return [node, ...expand(node.props.children)];
  }
  const nodes = () => expand(render());
  const find = predicate => { const node = nodes().find(predicate); assert.ok(node, 'Missing matching control'); return node; };
  const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : React.isValidElement(node) ? text(node.props.children) : '';
  return {
    html: () => renderToStaticMarkup(render()),
    change(id, value) { find(node => node.props.id === id).props.onChange({ target: { value } }); },
    click(label) { find(node => node.type === 'button' && text(node).includes(label)).props.onClick(); },
    submit() { return find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); },
    fill() { this.change('valve-normal-flow', '10'); this.change('valve-normal-upstream', '3.54'); this.change('valve-normal-downstream', '2'); },
    unmount() { cleanups.forEach(fn => fn?.()); },
  };
}

test('task selector integrates the dedicated project-first workflow', () => {
  const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /<ModuleWorkspace/);
  assert.match(readFileSync(new URL('../lib/module-registry.ts', import.meta.url), 'utf8'), /Control Valve Sizing/);
  assert.match(source, /setWizardStep\("control_valve"\)/);
  assert.match(source, /<ControlValveProjectWorkflow[^\n]*apiBaseUrl=\{API_BASE_URL\} fluids=\{availableFluids\}/);
  assert.doesNotMatch(source, /control-valves\/liquid\/size/);
});

test('normal default, mandatory warnings, no unsupported interactive controls', () => {
  const html = mount().html();
  assert.match(html, /Normal operating case/);
  assert.doesNotMatch(html, /Minimum operating case|Maximum operating case/);
  assert.match(html, /upstream and downstream pressures directly across the valve/);
  assert.doesNotMatch(html, /Sizing mode|Calculate from piping system|Coming later|Direct valve pressures.*selected/);
  assert.match(html, /Not verified against the complete IEC\/ISA/);
  assert.match(html, /Confirm final sizing and valve selection/);
  assert.doesNotMatch(html, />Gas<|>Steam<|Download|Save project|name="FL"/);
});

for (const id of ['minimum', 'maximum']) test(`${id} can be added and removed`, () => {
  const h = mount(); h.click(`Add ${id} case`);
  assert.match(h.html(), new RegExp(`${id[0].toUpperCase() + id.slice(1)} operating case`));
  h.click(`Remove ${id} case`);
  assert.doesNotMatch(h.html(), new RegExp(`${id[0].toUpperCase() + id.slice(1)} operating case`));
});

test('absolute request, fluid mapping, units, diameter and default margin', () => {
  const p = helper.buildValveRequest(valid());
  assert.equal(p.normal.upstream_pressure, 3.54); assert.equal(p.normal.downstream_pressure, 2);
  assert.equal(p.normal.flow_unit, 'm³/h'); assert.equal(p.normal.upstream_pipe_id_m, 0.05);
  assert.equal(p.normal.fluid_config.use_manual_properties, false);
  assert.equal(p.normal.fluid_config.fluid, 'Water'); assert.equal(p.normal.fluid_config.composition, 'pure');
  assert.equal(p.rating_margin, 0.1); assert.equal(p.display_basis, 'both');
  assert.ok(!('atmospheric_pressure_pa' in p.normal));
});

test('gauge request carries explicit atmospheric Pa and original gauge values', () => {
  const d = valid(); Object.assign(d.cases.normal, { pressureBasis: 'gauge', atmosphere: '101325', upstream: '-0.1', downstream: '-0.2' });
  const p = helper.buildValveRequest(d);
  assert.equal(p.normal.pressure_basis, 'gauge'); assert.equal(p.normal.atmospheric_pressure_pa, 101325);
  assert.equal(p.normal.upstream_pressure, -0.1);
});

test('custom margin and display mapping do not change case inputs', () => {
  const d = valid(), baseline = helper.buildValveRequest(d);
  for (const basis of ['Cv', 'Kv', 'both']) {
    d.margin = '25'; d.display = basis;
    const p = helper.buildValveRequest(d); assert.equal(p.rating_margin, 0.25); assert.equal(p.display_basis, basis);
    assert.deepEqual(p.normal, baseline.normal);
  }
});

test('field validation rejects incomplete, nonfinite and physically invalid input', () => {
  for (const [field, value] of [['flow', ''], ['flow', '-1'], ['flow', 'Infinity'], ['temperature', '-273.15'], ['upstream', '0'], ['downstream', '4'], ['diameter', '-1']]) {
    const d = valid(); d.cases.normal[field] = value; assert.ok(helper.validateDraft(d)[`normal.${field}`]);
  }
  const d = valid(); d.fluid = ''; d.margin = '-1'; d.cases.normal.pressureBasis = 'gauge';
  assert.ok(helper.validateDraft(d).fluid); assert.ok(helper.validateDraft(d).margin); assert.ok(helper.validateDraft(d)['normal.atmosphere']);
});

test('invalid ordering prevents submission and preserves field errors', async () => {
  let calls = 0; const h = mount(async () => { calls++; }); h.fill(); h.change('valve-normal-downstream', '4');
  await h.submit(); assert.equal(calls, 0); assert.match(h.html(), /Downstream pressure must be below/); assert.match(h.html(), /aria-invalid="true"/);
});

test('incomplete optional case prevents submission', async () => {
  let calls = 0; const h = mount(async () => { calls++; }); h.fill(); h.click('Add maximum case');
  await h.submit(); assert.equal(calls, 0); assert.match(h.html(), /Enter a positive volumetric flow/);
});

test('POST goes through apiFetch once with JSON body and cancellation signal', async () => {
  const calls = []; const l = lib(async (...args) => { calls.push(args); return new Response(JSON.stringify(args[0].endsWith('/fluids/properties') ? liquid : result())); });
  const controller = new AbortController(); await l.requestValve('https://api.test', valid(), controller.signal);
  assert.equal(calls.length, 2); assert.equal(calls.shift()[0], 'https://api.test/fluids/properties'); assert.equal(calls[0][0], 'https://api.test/control-valves/liquid/size');
  assert.equal(calls[0][1].method, 'POST'); assert.equal(calls[0][1].signal, controller.signal);
  assert.equal(JSON.parse(calls[0][1].body).normal.case_id, 'normal');
});

test('duplicate submissions prevented while pending and results render', async () => {
  let calls = 0, finish; const h = mount(() => { calls++; return new Promise(resolve => { finish = resolve; }); }); h.fill();
  const first = h.submit(); await new Promise(resolve => setImmediate(resolve)); await h.submit(); assert.equal(calls, 1); assert.match(h.html(), /Calculating…/); assert.match(h.html(), /will not be automatically retried/);
  finish(new Response(JSON.stringify(result()))); await first;
  assert.match(h.html(), /Required Cv/); assert.match(h.html(), /Required Kv/); assert.match(h.html(), /8\.058/);
  assert.match(h.html(), /Governing case: <strong>Normal/); assert.match(h.html(), /Operating-case comparison/);
  assert.doesNotMatch(h.html(), /CoolProp|\bthermo\b/); assert.match(h.html(), /Properties calculated automatically/); assert.match(h.html(), /354,000 Pa absolute/);
  assert.match(h.html(), /Final valve selection: blocked/); assert.match(h.html(), /prototype_correlated/);
  h.change('valve-normal-flow', '12'); assert.doesNotMatch(h.html(), /Preliminary sizing results/);
});

for (const basis of ['Cv', 'Kv', 'both']) test(`result display respects ${basis}`, () => {
  const component = load('../components/ControlValveSizing.tsx', { react: React, 'react/jsx-runtime': jsx, '@/lib/control-valve': helper, '@/lib/fluid-catalogue': catalogue });
  const html = renderToStaticMarkup(React.createElement(component.ValveResults, { result: result(basis) }));
  assert.equal(html.includes('Required Cv'), basis !== 'Kv'); assert.equal(html.includes('Required Kv'), basis !== 'Cv');
  assert.match(html, /Selected valve coefficient: not supported/);
});

test('laminar/transitional warnings, API assumptions and limitations are visible', () => {
  const component = load('../components/ControlValveSizing.tsx', { react: React, 'react/jsx-runtime': jsx, '@/lib/control-valve': helper, '@/lib/fluid-catalogue': catalogue });
  for (const classification of ['Laminar', 'Transitional']) {
    const html = renderToStaticMarkup(React.createElement(component.ValveResults, { result: result('both', classification) }));
    assert.match(html, /No viscosity correction has been applied/); assert.match(html, /Base equation only/);
    assert.match(html, /No completed choking assessment/); assert.match(html, /Manufacturer confirmation required/);
  }
});

test('engineering formatting does not round stored API values', () => {
  const raw = 8.058229640253803; assert.equal(helper.formatEngineering(raw), '8.058'); assert.equal(raw, 8.058229640253803);
  assert.equal(helper.formatEngineering(0.000001234567), '0.000001235'); assert.equal(helper.formatEngineering(null), 'Unavailable');
});

for (const [status, detail, title] of [[422, [{loc: ['body','normal','flow_value'], msg: 'Must be positive'}], 'Check the calculation inputs'], [401, 'Session expired', 'Sign-in required'], [422, 'Unsupported fluid', 'Unsupported prototype capability'], [500, 'Calculation failed', 'Engineering service error']]) {
  test(`HTTP ${status} readable ${title}`, async () => {
    const h = mount(async () => new Response(JSON.stringify({detail}), {status, headers:{'content-type':'application/json'}})); h.fill(); await h.submit();
    assert.match(h.html(), new RegExp(title));
    if (status === 422 && Array.isArray(detail)) assert.match(h.html(), /body.normal.flow_value: Must be positive/);
    if (status === 401) assert.match(h.html(), /Sign in again/);
    assert.match(h.html(), /value="10"/);
  });
}

test('backend unreachable shown with deliberate retry and no automatic resubmit', async () => {
  let calls = 0; const h = mount(async () => { calls++; throw new Error('The engineering service could not confirm the action. The action was not automatically retried.'); });
  h.fill(); await h.submit(); assert.equal(calls, 1); assert.match(h.html(), /Engineering service unavailable/); assert.match(h.html(), /retry deliberately/);
  await h.submit(); assert.equal(calls, 2);
});

test('unmount aborts pending request', async () => {
  let signal, finish; const h = mount((_url, init) => { signal = init.signal; return new Promise(resolve => {finish = resolve;}); });
  h.fill(); const work = h.submit(); await new Promise(resolve => setImmediate(resolve)); h.unmount(); assert.equal(signal.aborted, true); finish(new Response(JSON.stringify(result()))); await work;
  assert.doesNotMatch(h.html(), /Preliminary sizing results/);
});


test('shared browse and search preserve catalogue identity, names, categories and cold-start transport', async () => {
  const calls = [];
  const rows = [water, { ...water, id: 'glycerol', name: 'glycerol', category: 'Other Chemicals' }];
  const shared = load('../lib/fluid-catalogue.ts', { '@/lib/api': { apiFetch: async (url, init) => {
    calls.push([url, init]); return new Response(JSON.stringify({ catalogue: rows, fluids: rows }));
  } }, '@/lib/api-error': errors });
  const signal = new AbortController().signal;
  assert.deepEqual(JSON.parse(JSON.stringify(await shared.loadFluidCatalogue('https://api.test', signal))), rows);
  assert.deepEqual(JSON.parse(JSON.stringify(await shared.loadFluidCatalogue('https://api.test', signal, 'ethylene glycol'))), rows);
  assert.equal(calls[0][0], 'https://api.test/fluids');
  assert.equal(calls[1][0], 'https://api.test/fluids/search?q=ethylene%20glycol&limit=30');
  assert.equal(calls[0][1].signal, signal);
  const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const valve = readFileSync(new URL('../components/ControlValveSizing.tsx', import.meta.url), 'utf8');
  assert.match(page, /loadFluidCatalogue\(API_BASE_URL, controller.signal, query\)/);
  assert.match(valve, /loadFluidCatalogue\(apiBaseUrl, request.signal, query.trim\(\)\)/);
  assert.doesNotMatch(valve, /CURATED|\["Water",/);
});

test('catalogue failures are readable and unsupported entries cannot be submitted', async () => {
  const shared = load('../lib/fluid-catalogue.ts', { '@/lib/api': { apiFetch: async () => new Response(JSON.stringify({ detail: 'No property engine available' }), { status: 503 }) }, '@/lib/api-error': errors });
  await assert.rejects(shared.loadFluidCatalogue('https://api.test', new AbortController().signal), /503.*No property engine available/);
  let calls = 0;
  const h = mount(async () => { calls++; }, { fluids: [{ ...water, liquid_capability: { eligible: false, reason: 'Mixtures are unsupported' } }], catalogueError: 'Fluid catalogue loading failed (503).' });
  h.fill(); await h.submit(); assert.equal(calls, 0);
  assert.match(h.html(), /Mixtures are unsupported/);
  assert.match(h.html(), /Fluid catalogue loading failed \(503\)/);
  assert.match(h.html(), /<option[^>]*value="Water"[^>]*disabled=""/);
  assert.ok(catalogue.liquidEligibilityError({ ...water, liquid_capability: undefined }));
});

test('search-selected IDs and real gauge pressure/temperature reach shared property API', async () => {
  for (const id of ['glycerol', 'ethylene glycol', '1-propanol']) {
    const d = valid(); d.fluid = id;
    Object.assign(d.cases.normal, { upstream: '2', downstream: '1', pressureBasis: 'gauge', atmosphere: '101325', temperature: '86', temperatureUnit: 'F' });
    const calls = [];
    const l = lib(async (url, init) => { calls.push([url, JSON.parse(init.body)]); return new Response(JSON.stringify(url.endsWith('/fluids/properties') ? liquid : result())); });
    await l.requestValve('https://api.test', d, new AbortController().signal);
    assert.deepEqual(calls[0][1], { fluid: id, temperature_c: 30, pressure_bar_a: 3.01325 });
    assert.equal(calls[1][1].normal.fluid_config.fluid, id);
  }
});

for (const phase of ['Gas', 'Two-phase', 'Supercritical', 'Solid', null]) test(`unsupported ${phase} state blocks sizing submission`, async () => {
  const urls = [];
  const l = lib(async url => { urls.push(url); return new Response(JSON.stringify({ ...liquid, phase_type: phase })); });
  await assert.rejects(l.requestValve('https://api.test', valid(), new AbortController().signal), /Gas, steam, mixtures/);
  assert.deepEqual(urls, ['https://api.test/fluids/properties']);
});


test('search UI selects additional shared liquid IDs without a private list', async () => {
  const requests = [];
  const h = mount(async (url, init) => { requests.push(JSON.parse(init.body)); return new Response(JSON.stringify(result())); }, {},
    async () => new Response(JSON.stringify({ fluids: [{ ...water, id: 'glycerol', name: 'glycerol', category: 'Other Chemicals' }] })));
  h.change('valve-fluid-search', 'glycerol');
  assert.match(h.html(), /Loading workbench fluids/);
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.match(h.html(), /optgroup label="Other Chemicals"/);
  h.change('valve-fluid', 'glycerol'); h.fill(); await h.submit();
  assert.equal(requests[0].normal.fluid_config.fluid, 'glycerol');
  h.unmount();
});

test('search UI shows catalogue error without silently selecting water', async () => {
  const h = mount(undefined, {}, async () => new Response(JSON.stringify({ detail: 'Search unavailable' }), { status: 503 }));
  h.change('valve-fluid-search', 'glycerol'); h.html();
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.match(h.html(), /Fluid catalogue loading failed.*Search unavailable/);
  assert.doesNotMatch(h.html(), /value="Water"/);
  h.unmount();
});


test('provider names stay internal in result cards, warnings and error messages', async () => {
  const fixture = result();
  fixture.warnings.push({ case_id: 'normal', code: 'INTERNAL', message: 'CoolProp could not evaluate viscosity' });
  fixture.cases[0].limitations.push('thermo model limitation');
  const h = mount(async () => new Response(JSON.stringify(fixture))); h.fill(); await h.submit();
  assert.doesNotMatch(h.html(), /CoolProp|\bthermo\b|_provider_fluid_id/);
  assert.match(h.html(), /Automatic fluid properties/);
  assert.match(h.html(), /Evaluated at the operating temperature and upstream pressure/);
  assert.equal(fixture.cases[0].resolved_fluid_config.provenance.source, 'CoolProp');
  const broken = mount(async () => new Response(JSON.stringify({ detail: 'CoolProp PropsSI failure' }), { status: 422 }));
  broken.fill(); await broken.submit(); assert.doesNotMatch(broken.html(), /CoolProp|PropsSI/);
  assert.match(broken.html(), /Check the selected liquid and operating conditions/);
});
