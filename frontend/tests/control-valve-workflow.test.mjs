import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

function load(path, imports, window = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => { assert.ok(name in imports, name); return imports[name]; }, AbortController, Error, Date, Number, JSON, Intl, window });
  return exports;
}
const errors = load('../lib/api-error.ts', {});
const valve = load('../lib/control-valve.ts', { '@/lib/api': {}, '@/lib/api-error': errors });
const projects = load('../lib/projects.ts', { '@/lib/api': {}, '@/lib/api-error': errors });
const persistence = load('../lib/control-valve-persistence.ts', { '@/lib/control-valve': valve, '@/lib/projects': projects });
function draft() { const value = valve.initialDraft(); Object.assign(value.cases.normal, { flow: '10', upstream: '3.54', downstream: '2' }); return value; }
function result() {
  return { schema_version: persistence.CALCULATION_VERSION, cases: [{ case_id: 'normal', required_cv: 9, required_kv: 8,
    normalized: { differential_pressure_pa: 154000, upstream_pressure_pa_abs: 354000, downstream_pressure_pa_abs: 200000, temperature_k: 293.15, flow_m3_s: 0.002777 },
    resolved_fluid_config: { fluid: 'Water', use_manual_properties: true, density_kg_m3: 997, dynamic_viscosity_pa_s: 0.001,
      provenance: { source: 'CoolProp', provider_fluid_id: 'Water', provider_version: '8.0.0', origin: 'automatic', evaluation_pressure_pa_abs: 354000, evaluation_temperature_k: 293.15 } },
    pipe_reynolds_screening: { label: 'pipe Reynolds screening', classification: 'indeterminate', reynolds_number: null, policy: 'Screening only' },
    assumptions: ['Pure liquid'], limitations: ['Prototype only'], source_ids: ['T1'], equation_ids: ['E2k'], warnings: [],
  }], governing_case: 'normal', maximum_required_cv: 9, maximum_required_kv: 8, target_rated_cv: 9.9, target_rated_kv: 8.8, rating_margin: 0.1,
    display_basis: 'both', verification_status: 'prototype_correlated', final_selection_allowed: false, assessment_status: 'incomplete',
    vendor_confirmation: valve.VENDOR_WARNING, standard_limitation: valve.STANDARD_WARNING, warnings: [] };
}
function savedScenario(id = 1) { return { id, project_id: 1, ...persistence.valveScenarioPayload('Valve A', 'Description', persistence.calculatedValveSession(draft(), result())) }; }
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));

test('versioned JSON preserves all inputs, results and provenance and restores them', () => {
  const saved = savedScenario();
  const restored = persistence.restoreValveSession(plain(saved));
  assert.deepEqual(plain(restored.draft), plain(draft())); assert.deepEqual(plain(restored.result), result());
  assert.equal(saved.fluid_config.engineering_task, 'control_valve_sizing');
  assert.equal(saved.calculation_intent, 'control_valve_sizing');
  assert.equal(saved.fluid_config.control_valve.schema_version, 'control-valve-scenario/1');
  assert.equal(saved.fluid_config.control_valve.result.cases[0].resolved_fluid_config.provenance.source, 'CoolProp');
  assert.ok(saved.fluid_config.control_valve.calculated_at);
  assert.equal(saved.fluid_config.control_valve.request.normal.pressure_basis, 'absolute');
});

test('input edits clear stale results; recalculation restores readiness; save cannot persist mismatched results', () => {
  const ready = persistence.restoreValveSession(savedScenario());
  const edited = draft(); edited.cases.normal.flow = '12';
  const stale = persistence.editValveSession(ready, edited);
  assert.equal(stale.result, null); assert.match(stale.staleReason, /Recalculate/);
  const mismatched = persistence.valveScenarioPayload('A', '', { ...ready, draft: edited });
  assert.equal(mismatched.fluid_config.control_valve.result, null);
  const fresh = persistence.calculatedValveSession(edited, result());
  assert.equal(fresh.staleReason, null); assert.ok(fresh.result);
});

for (const mutation of [
  saved => { saved.schema_version = 'future/2'; }, saved => { saved.calculation_version = 'future/2'; },
  saved => { delete saved.result.cases[0].resolved_fluid_config.provenance; }, saved => { saved.result.cases = []; },
  saved => { saved.draft.cases.normal.temperature = '80'; }, saved => { saved.calculated_at = 'invalid'; },
]) test(`incompatible or incomplete saved result requires recalculation: ${mutation}`, () => {
  const saved = savedScenario(); mutation(saved.fluid_config.control_valve);
  const restored = persistence.restoreValveSession(saved);
  assert.equal(restored.result, null); assert.match(restored.staleReason, /Recalculate/);
  assert.equal(restored.draft.fluid, 'Water');
});

test('draft creation never invents operating flow or pressure and other tasks cannot restore', () => {
  const payload = persistence.valveScenarioPayload('Draft', '', persistence.newValveSession());
  assert.equal(payload.flow_value, 0); assert.equal(payload.inlet_pressure_bar_a, null);
  assert.equal(payload.fluid_config.control_valve.draft.cases.normal.flow, '');
  assert.equal(payload.fluid_config.control_valve.request, null);
  assert.throws(() => persistence.restoreValveSession({ fluid_config: { engineering_task: 'pump_sizing' } }), /another engineering task/);
});

function mount({ rows = [], intercept, confirm = true, onExit } = {}) {
  const calls = [], projectRows = [{ id: 1, name: 'Existing project', description: null }], scenarios = rows.map(plain);
  let next = 10, stateIndex = 0, refIndex = 0, effectIndex = 0;
  const state = [], refs = [], deps = [], cleanups = [], listeners = new Map();
  const window = { confirm: () => confirm, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
  async function fetcher(url, init) {
    const path = url.replace('https://api.test', ''), method = init.method ?? 'GET', body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ path, method, body, signal: init.signal });
    const override = intercept?.({ path, method, body }); if (override) return override;
    let data;
    if (path === '/projects') {
      if (method === 'POST') { data = { ...body, id: next++ }; projectRows.push(data); } else data = projectRows;
    } else if (/^\/projects\/\d+$/.test(path)) data = projectRows.find(row => row.id === Number(path.split('/')[2]));
    else if (/\/scenarios$/.test(path)) {
      if (method === 'POST') { data = { ...body, id: next++, project_id: Number(path.split('/')[2]) }; scenarios.push(data); } else data = scenarios;
    } else {
      const id = Number(path.split('/').at(-1));
      if (method === 'PUT') { data = { ...body, id, project_id: Number(path.split('/')[2]) }; scenarios[scenarios.findIndex(row => row.id === id)] = data; }
      else if (method === 'DELETE') { scenarios.splice(scenarios.findIndex(row => row.id === id), 1); data = { status: 'deleted' }; }
      else data = scenarios.find(row => row.id === id);
    }
    return new Response(JSON.stringify(data ?? { detail: 'Not found' }), { status: data ? 200 : 404 });
  }
  const api = load('../lib/projects.ts', { '@/lib/api': { apiFetch: fetcher }, '@/lib/api-error': errors }, window);
  const hooks = { ...React, useState(initial) { const i = stateIndex++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
    useRef(initial) { const i = refIndex++; return refs[i] ??= { current: initial }; },
    useEffect(fn, nextDeps) { const i = effectIndex++; if (!deps[i] || nextDeps.some((value, j) => !Object.is(value, deps[i][j]))) { cleanups[i]?.(); deps[i] = nextDeps; cleanups[i] = fn(); } } };
  function SizingStub() { return React.createElement('section', {}, 'Sizing form'); }
  const selector = load('../components/ProjectSelection.tsx', { 'react/jsx-runtime': jsx });
  const component = load('../components/ControlValveProjectWorkflow.tsx', { react: hooks, 'react/jsx-runtime': jsx,
    '@/components/ProjectSelection': selector, '@/components/ControlValveSizing': { default: SizingStub },
    '@/lib/control-valve': valve, '@/lib/projects': api, '@/lib/control-valve-persistence': persistence }, window);
  const exitGuard = { current: () => true };
  const render = () => { stateIndex = refIndex = effectIndex = 0; return component.default({ apiBaseUrl: 'https://api.test', fluids: [], onRetryFluids() {}, onExit, registerExitGuard: guard => { exitGuard.current = guard; } }); };
  function nodes(node) { if (Array.isArray(node)) return node.flatMap(nodes); if (!React.isValidElement(node)) return []; return [node, ...nodes(typeof node.type === 'function' ? node.type(node.props) : node.props.children)]; }
  const all = () => nodes(render());
  const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : React.isValidElement(node) ? text(node.props.children) : '';
  const find = predicate => { const found = all().find(predicate); assert.ok(found, 'Missing control'); return found; };
  return { calls, scenarios, exitGuard, listeners,
    html: () => renderToStaticMarkup(render()),
    async click(label) { find(node => node.type === 'button' && text(node).includes(label)).props.onClick(); await tick(); },
    change(id, value) { find(node => node.props.id === id).props.onChange({ target: { value } }); },
    sizing: () => find(node => node.type === SizingStub).props,
    async openProject() { this.html(); await tick(); this.change('project-selector', '1'); await this.click('Open project'); },
    async openScenario(id = 1) { await this.openProject(); this.change('valve-scenario-selector', String(id)); await this.click('Open scenario'); },
    unmount() { cleanups.forEach(fn => fn?.()); },
  };
}

test('project-first UI hides sizing until a project and scenario are opened', async () => {
  const h = mount({ rows: [savedScenario()] });
  assert.match(h.html(), /Create New Project/); assert.doesNotMatch(h.html(), /Sizing form/);
  await h.openProject(); assert.match(h.html(), /Create New Scenario/); assert.doesNotMatch(h.html(), /Sizing form/);
  h.change('valve-scenario-selector', '1'); await h.click('Open scenario');
  assert.match(h.html(), /Sizing form/); assert.deepEqual(plain(h.sizing().initialValues), plain(draft()));
  assert.deepEqual(plain(h.sizing().initialResult), result()); assert.equal(h.sizing().view, 'results'); h.unmount();
});

test('create project uses shared API and refreshes list, then creates a valve draft', async () => {
  const h = mount(); h.html(); await tick(); h.change('project-name', 'New study'); h.change('project-description', 'Notes'); await h.click('Create Project');
  const post = h.calls.find(c => c.path === '/projects' && c.method === 'POST');
  assert.deepEqual(post.body, { name: 'New study', description: 'Notes' });
  assert.ok(h.calls.filter(c => c.path === '/projects' && c.method === 'GET').length >= 2);
  h.change('valve-scenario-name', 'New valve'); await h.click('Create scenario');
  const saved = h.calls.find(c => c.path.endsWith('/scenarios') && c.method === 'POST');
  assert.equal(saved.body.fluid_config.engineering_task, 'control_valve_sizing'); assert.match(h.html(), /Sizing form/); h.unmount();
});

test('valve workflow excludes pump and pressure-drop scenarios', async () => {
  const h = mount({ rows: [savedScenario(), { ...savedScenario(2), name: 'Pump hidden', fluid_config: { engineering_task: 'pump_sizing' } }, { ...savedScenario(3), name: 'Pressure hidden', fluid_config: {} }] });
  await h.openProject(); assert.match(h.html(), /Valve A/); assert.doesNotMatch(h.html(), /Pump hidden|Pressure hidden/); h.unmount();
});

test('edits mark dirty/stale, save drops old result, recalculation saves frozen provenance', async () => {
  const h = mount({ rows: [savedScenario()], confirm: false }); await h.openScenario();
  const changed = draft(); changed.cases.normal.flow = '12'; h.sizing().onEdit(changed);
  assert.match(h.html(), /Unsaved changes/); assert.match(h.html(), /Recalculate/);
  assert.equal(h.exitGuard.current(), false); assert.ok(h.listeners.has('beforeunload'));
  await h.click('Change project'); assert.match(h.html(), /Sizing form/);
  await h.click('Save scenario'); assert.equal(h.calls.find(c => c.method === 'PUT').body.fluid_config.control_valve.result, null);
  h.sizing().onCalculated(changed, result()); assert.doesNotMatch(h.html(), /Inputs changed/);
  await h.click('Save scenario'); const saved = h.calls.filter(c => c.method === 'PUT').at(-1).body;
  assert.equal(saved.fluid_config.control_valve.result.cases[0].resolved_fluid_config.provenance.source, 'CoolProp');
  assert.match(h.html(), /Inputs and preliminary results saved/); assert.doesNotMatch(h.html(), /Unsaved changes/); h.unmount();
});

test('duplicate project creates blocked while pending', async () => {
  let release; const h = mount({ intercept: c => c.path === '/projects' && c.method === 'POST' ? new Promise(resolve => { release = resolve; }) : null });
  h.html(); await tick(); h.change('project-name', 'Pending'); await h.click('Create Project'); await h.click('Create Project');
  assert.equal(h.calls.filter(c => c.method === 'POST').length, 1);
  release(new Response(JSON.stringify({ id: 1, name: 'Pending' }))); await tick(); h.unmount();
});

test('duplicate saves blocked and failures keep inputs', async () => {
  let release; const h = mount({ rows: [savedScenario()], intercept: c => c.method === 'PUT' ? new Promise(resolve => { release = resolve; }) : null });
  await h.openScenario(); const changed = draft(); changed.cases.normal.flow = '12'; h.sizing().onEdit(changed);
  await h.click('Save scenario'); await h.click('Save scenario'); assert.equal(h.calls.filter(c => c.method === 'PUT').length, 1);
  release(new Response(JSON.stringify({ detail: 'Save unavailable' }), { status: 503 })); await tick();
  assert.match(h.html(), /Scenario save failed/); assert.match(h.html(), /Unsaved changes/); assert.equal(h.sizing().initialValues.cases.normal.flow, '12'); h.unmount();
});

for (const status of [401, 500]) test(`project error ${status} keeps entered values and never repeats POST`, async () => {
  const h = mount({ intercept: c => c.method === 'POST' ? new Response(JSON.stringify({ detail: 'Project request failed' }), { status }) : null });
  h.html(); await tick(); h.change('project-name', 'Retain me'); await h.click('Create Project');
  assert.match(h.html(), /value="Retain me"/); assert.match(h.html(), status === 401 ? /Sign-in required/ : /Project creation failed/);
  assert.equal(h.calls.filter(c => c.method === 'POST').length, 1); h.unmount();
});

test('deletion uses existing confirmation and retains scenario when cancelled', async () => {
  const h = mount({ rows: [savedScenario()], confirm: false }); await h.openScenario(); await h.click('Delete scenario');
  assert.equal(h.calls.filter(c => c.method === 'DELETE').length, 0); assert.match(h.html(), /Sizing form/); h.unmount();
});

test('pump and pressure-drop share project selector and exclude valve JSON from hydraulic workflows', () => {
  const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /<ProjectSelection projects=\{projects\}/); assert.match(source, /await listProjects\(API_BASE_URL, signal\)/);
  assert.match(source, /!isValveScenario\(row\)/); assert.match(source, /createProjectRecord\(API_BASE_URL/);
  assert.doesNotMatch(source, /control-valve-scenario\/1/);
});


test('duplicate scenario creation blocked while pending', async () => {
  let release;
  const h = mount({ intercept: c => c.path.endsWith('/scenarios') && c.method === 'POST' ? new Promise(resolve => { release = resolve; }) : null });
  await h.openProject(); h.change('valve-scenario-name', 'Pending valve'); await h.click('Create scenario'); await h.click('Create scenario');
  assert.equal(h.calls.filter(c => c.method === 'POST').length, 1);
  release(new Response(JSON.stringify({ ...savedScenario(), name: 'Pending valve' }))); await tick(); h.unmount();
});

test('starting recalculation invalidates prior saved result even if calculation fails', async () => {
  const h = mount({ rows: [savedScenario()] }); await h.openScenario();
  h.sizing().onPendingChange(true); assert.match(h.html(), /Recalculate to obtain/);
  h.sizing().onPendingChange(false); await h.click('Save scenario');
  assert.equal(h.calls.find(c => c.method === 'PUT').body.fluid_config.control_valve.result, null); h.unmount();
});

test('confirmed deletion refreshes scenario list', async () => {
  const h = mount({ rows: [savedScenario()] }); await h.openScenario(); await h.click('Delete scenario');
  assert.equal(h.calls.filter(c => c.method === 'DELETE').length, 1);
  assert.doesNotMatch(h.html(), /Sizing form/); assert.match(h.html(), /No saved control-valve scenarios/); h.unmount();
});


test('legacy direct-pressure mode fields normalize without losing inputs or current results', () => {
  const saved = savedScenario();
  saved.fluid_config.control_valve.draft.sizing_mode = 'direct_pressure';
  saved.fluid_config.control_valve.sizingMode = 'direct';
  saved.fluid_config.control_valve.calculated_inputs = persistence.inputSignature(saved.fluid_config.control_valve.draft);
  const restored = persistence.restoreValveSession(saved);
  assert.deepEqual(plain(restored.draft), plain(draft())); assert.ok(restored.result);
  assert.equal(restored.calculatedInputs, persistence.inputSignature(restored.draft));
  const resaved = persistence.valveScenarioPayload('Valve A', '', restored);
  assert.equal(resaved.fluid_config.control_valve.sizing_mode, 'direct_pressure');
  assert.ok(resaved.fluid_config.control_valve.result);
  assert.equal(resaved.fluid_config.control_valve.request.normal.upstream_pressure, 3.54);
  assert.equal(saved.fluid_config.control_valve.draft.sizing_mode, 'direct_pressure');
});

test('obsolete piping mode retains inputs but cannot restore a current result', () => {
  const saved = savedScenario(); saved.fluid_config.control_valve.sizing_mode = 'piping_system';
  const restored = persistence.restoreValveSession(saved);
  assert.deepEqual(plain(restored.draft), plain(draft())); assert.equal(restored.result, null);
  assert.match(restored.staleReason, /Recalculate/);
});


test('returning to module workspace preserves dirty valve inputs and exit guard', async () => {
  let returned = false;
  const h = mount({ rows: [savedScenario()], confirm: false, onExit: () => { returned = true; } });
  await h.openScenario(); const changed = draft(); changed.cases.normal.flow = '12'; h.sizing().onEdit(changed);
  await h.click('Back to modules'); assert.equal(returned, true);
  assert.match(h.html(), /Unsaved changes/); assert.equal(h.sizing().initialValues.cases.normal.flow, '12');
  assert.equal(h.exitGuard.current(), false); h.unmount();
});
