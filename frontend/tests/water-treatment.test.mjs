import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { waterLoader } from './water-test-support.mjs';

const require = createRequire(import.meta.url);
const raw = require('../lib/water-treatment/ww-engine.cjs');
const validation = require('./fixtures/ww-validation.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
function load(path, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText,
    { exports, structuredClone, require: id => { assert.ok(id in imports, id); return imports[id]; }, ...globals });
  return exports;
}
const adapter = load('../lib/water-treatment/adapter.ts', { './ww-engine.cjs': raw });
const mapping = load('../lib/water-treatment/input.ts');
const formatting = load('../lib/water-treatment/format.ts');
const registry = load('../lib/module-registry.ts');
const preference = load('../lib/industry-preference.ts', { '@/lib/module-registry': registry });
const workspace = load('../components/ModuleWorkspace.tsx', { 'react/jsx-runtime': jsx, '@/lib/module-registry': registry }).default;
const selector = load('../components/IndustrySelector.tsx', { 'react/jsx-runtime': jsx, '@/lib/module-registry': registry }).default;
function nodes(node) { if (Array.isArray(node)) return node.flatMap(nodes); if (!React.isValidElement(node)) return []; return [node, ...nodes(node.props.children)]; }
const waterLoad = waterLoader();
const imports = { '@/lib/water-treatment/calculation': waterLoad('lib/water-treatment/calculation.ts'), '@/lib/water-treatment/presentation': waterLoad('lib/water-treatment/presentation.ts'), 'react/jsx-runtime': jsx, '@/lib/water-treatment/adapter': adapter, '@/lib/water-treatment/input': mapping, '@/lib/water-treatment/format': formatting };

test('vendored engine is the untouched validated ww-engine/0.2.0 reference', () => {
  assert.equal(adapter.ENGINE_VERSION, 'ww-engine/0.2.0');
  assert.equal(createHash('sha256').update(readFileSync(new URL('../lib/water-treatment/ww-engine.cjs', import.meta.url), 'utf8').replaceAll('\r\n', '\n')).digest('hex'), 'aa48292eb182e02e8c348ae85ff0e345ef6050bef7540f0e7113496866d66200');
  const result = validation.runAll(raw);
  assert.equal(result.passed, 18); assert.equal(result.checksPassed, 80);
});
for (const id of ['DB-1', 'G-1', 'G-2']) test(`original validated case ${id}`, () => {
  const c = validation.cases.find(c => c.id === id);
  const output = c.run(id === 'G-1' ? raw : { ...raw, designBasis: adapter.calculateBasis });
  for (const [key, [expected, tol]] of Object.entries(c.expect)) {
    assert.ok(Math.abs(output[key] - expected) <= Math.abs(expected) * tol + 1e-10, key);
  }
});
test('typed adapter matches reference engine across all methods, component flows, overrides, quality and water demand', () => {
  const referencePath = new URL('../../integration-source/water-treatment-release1/engine/ww-engine.js', import.meta.url);
  // The integration handoff is gitignored; its frozen engine bytes are pinned above for clean checkouts.
  const reference = existsSync(referencePath) ? require(referencePath.pathname.replace(/^\/(\w:)/, '$1')) : raw;
  for (const pfMethod of ['harmon', 'qasim45', 'babbitt', 'log47', 'manual']) for (const override of [false, true]) {
    const input = { population: 20000, perCapita: 380, industrialFlow: 100, industrialPF: 2, industrialMinFactor: 0.5, infiltration: 500, pfMethod, pfManual: 3, ...(override ? { avgFlowOverride: 9000 } : {}), conc: { BOD: 140, COD: 300, TSS: 70, TKN: 35 }, loadPF: { BOD: 1.5 }, origin: { BOD: 'measured' } };
    assert.deepEqual(plain(adapter.calculateBasis(input)), plain(reference.designBasis(input)));
  }
  const draft = mapping.initialDraft(), water = mapping.waterInput(draft);
  assert.deepEqual(plain(adapter.calculateWater(water)), plain(reference.waterDemand(water)));
  for (const kind of ['effluent', 'drinking']) for (const id of Object.keys(adapter.standards[kind])) assert.deepEqual(plain(adapter.checkCompliance({ BOD: 10, pH: 7 }, kind, id)), plain(reference.compliance({ BOD: 10, pH: 7 }, kind, id)));
});
test('domestic peaking leaves infiltration unpeaked and industrial peaking independent', () => {
  const input = { population: 10000, perCapita: 100, industrialFlow: 200, industrialPF: 4, infiltration: 300, pfMethod: 'manual', pfManual: 3, minMethod: 'manual', minFactorManual: 0.3, industrialMinFactor: 0.5 };
  const result = adapter.calculateBasis(input).flows;
  assert.equal(result.Qavg, 1500); assert.equal(result.Qpeak, 4100); assert.equal(result.Qmin, 700);
  assert.equal(adapter.calculateBasis({ ...input, pfManual: 5 }).flows.Qpeak - result.Qpeak, 2000);
  assert.equal(adapter.calculateBasis({ ...input, industrialPF: 5 }).flows.Qpeak - result.Qpeak, 200);
  assert.equal(adapter.calculateBasis({ ...input, infiltration: 400 }).flows.Qpeak - result.Qpeak, 100);
});
test('invalid numerical inputs are refused at form and service boundaries', () => {
  for (const invalid of ['NaN', 'Infinity', '-1', 'abc', '1x', '0x10', '1e999', '']) {
    const d = mapping.initialDraft(); d.flows.population = invalid;
    assert.throws(() => adapter.calculateBasis(mapping.basisInput(d)), undefined, invalid);
  }
  for (const value of [NaN, Infinity, -1, '100']) assert.throws(() => adapter.calculateBasis({ population: value, perCapita: 100 }));
  assert.throws(() => adapter.calculateBasis({ population: 0 }));
  assert.throws(() => adapter.calculateBasis({ population: 1000, perCapita: 100, pfMethod: 'constructor' }));
  assert.throws(() => adapter.calculateWater({ population: 1000, operatingHours: 0 }));
  assert.throws(() => adapter.calculateWater({ population: 1000, lossesPct: 91 }));
  assert.throws(() => adapter.checkCompliance({ BOD: Infinity }, 'effluent', 'ZA_GN665_general'));
  assert.throws(() => adapter.calculateStatistics('10,garbage,20'));
  assert.throws(() => adapter.calculateBasis({ avgFlowOverride: 1e308, pfMethod: 'manual', pfManual: 1, minMethod: 'manual', minFactorManual: 1, maxDayFactor: 1, maxMonthFactor: 1, conc: { BOD: 1e308 } }));
  assert.throws(() => adapter.calculateStatistics('1e308,1e308'));
});
test('empty pasted data has no fabricated zero; percentiles retain engine interpolation', () => {
  assert.equal(adapter.calculateStatistics(' \n ').n, 0);
  assert.deepEqual(plain(adapter.calculateStatistics('10,20;30\n40')), plain(raw.stats([10, 20, 30, 40])));
  assert.equal(adapter.calculateStatistics('10,20;30\n40').p95, 38.5);
});
test('every unverified standard stays visibly provisional with version and verification metadata', () => {
  const Component = load('../components/WaterDesignBasis.tsx', { ...imports, react: React });
  for (const kind of ['effluent', 'drinking']) for (const [id, standard] of Object.entries(adapter.standards[kind])) {
    if (standard.status !== 'to verify') continue;
    const html = renderToStaticMarkup(React.createElement(Component.CompliancePanel, { result: adapter.checkCompliance({ BOD: 10 }, kind, id) }));
    assert.match(html, /Provisional.*source verification required/); assert.match(html, /do not establish legal compliance/); assert.match(html, /provisional/);
    assert.ok(html.includes(standard.version.replaceAll('&', '&amp;'))); assert.ok(html.includes(standard.checked));
  }
});
test('Water workspace is selectable with exactly five tools and only Design Basis enabled', () => {
  const selected = [], actions = [];
  const buttons = nodes(selector({ selected: null, onSelect: id => selected.push(id) })).filter(n => n.type === 'button');
  buttons.forEach(n => n.props.onClick()); assert.deepEqual(selected, ['general', 'water-wastewater']);
  const tree = workspace({ industry: 'water-wastewater', onLaunch: action => actions.push(action), children: 'Hydraulic projects must be hidden' });
  const all = nodes(tree), enabled = all.filter(n => n.type === 'button'), disabled = all.filter(n => n.props['aria-disabled'] === 'true');
  assert.equal(registry.modulesForIndustry('water-wastewater').length, 5);
  assert.equal(enabled.length, 1); assert.equal(disabled.length, 4);
  enabled[0].props.onClick(); assert.deepEqual(actions, ['water_design_basis']);
  for (const card of disabled) { assert.equal(card.props.onClick, undefined); assert.match(card.props.className, /bg-gray-50/); assert.ok(!nodes(card).some(n => ['button', 'a'].includes(n.type))); }
  const html = renderToStaticMarkup(tree); assert.doesNotMatch(html, /Coming soon|Hydraulic projects must be hidden/);
  assert.equal(all.filter(n => n.props.id === 'module-availability-note').length, 1);
});
test('stored Water workspace restores; fresh authentication resets it to Home and Home guards can cancel', () => {
  let stored = 'water-wastewater';
  const store = preference.createIndustryPreference(() => ({ getItem: () => stored, setItem: (_key, value) => { stored = value; }, removeItem: () => { stored = null; } }));
  let view = null; const effects = [];
  const hooks = load('../lib/use-industry-workspace.ts', { '@/lib/module-registry': registry, '@/lib/industry-preference': { industryPreference: store }, react: {
    useState: initial => { view ??= typeof initial === 'function' ? initial() : initial; return [view, next => { view = next; }]; },
    useSyncExternalStore: (subscribe, snapshot) => { subscribe(() => {}); return snapshot(); }, useEffect: effect => effects.push(effect),
  } }, { URL, window: { location: { href: 'https://workbench.test/' } } });
  assert.equal(hooks.useIndustryWorkspace().industry, 'water-wastewater'); assert.equal(hooks.useIndustryWorkspace().view, 'modules');
  hooks.useIndustryWorkspace().enterModule(); hooks.useIndustryWorkspace().goHome(() => false); assert.equal(hooks.useIndustryWorkspace().view, 'module');
  hooks.useIndustryWorkspace().goHome(() => true); assert.equal(hooks.useIndustryWorkspace().view, 'industries');
  store.clear(); assert.equal(hooks.useIndustryWorkspace().view, 'industries'); assert.equal(stored, null);
  // Login/callback exact Home signal behavior is additionally exercised by industry-workspace/auth-callback suites.
});
test('fresh-login Home signal clears stored Water while preserving unrelated URL values', () => {
  let stored = 'water-wastewater'; let replaced; const effects = [];
  const store = preference.createIndustryPreference(() => ({ getItem: () => stored, removeItem: () => { stored = null; }, setItem() {} }));
  const hooks = load('../lib/use-industry-workspace.ts', { '@/lib/module-registry': registry, '@/lib/industry-preference': { industryPreference: store }, react: {
    useState: initial => [initial(), () => {}], useSyncExternalStore: (subscribe, snapshot) => { subscribe(() => {}); return snapshot(); }, useEffect: fn => effects.push(fn),
  } }, { URL, window: { location: { href: 'https://workbench.test/?workspace=home&keep=1#basis' }, history: { state: { existing: 1 }, replaceState: (_state, _title, url) => { replaced = url; } } } });
  assert.equal(hooks.useIndustryWorkspace().view, 'industries'); effects.forEach(fn => fn());
  assert.equal(stored, null); assert.equal(store.getSnapshot(), null); assert.equal(replaced, '/?keep=1#basis');
});
test('actual Home and sign-out delegate to the active Water or existing valve exit guard', () => {
  const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const definition = source.split('\n').find(line => line.includes('const canLeaveWorkspace ='));
  const code = ts.transpileModule(definition, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { workspace: { industry: 'water-wastewater' }, wizardStep: 'control_valve', waterExitGuard: { current: () => false }, valveExitGuard: { current: () => true } };
  assert.equal(vm.runInNewContext(`(() => { ${code}\nreturn canLeaveWorkspace(); })()`, context), false);
  context.workspace.industry = 'general'; assert.equal(vm.runInNewContext(`(() => { ${code}\nreturn canLeaveWorkspace(); })()`, context), true);
  context.valveExitGuard.current = () => false; assert.equal(vm.runInNewContext(`(() => { ${code}\nreturn canLeaveWorkspace(); })()`, context), false);
  context.wizardStep = 'engineering'; assert.equal(vm.runInNewContext(`(() => { ${code}\nreturn canLeaveWorkspace(); })()`, context), true);
  assert.match(source, /workspace.goHome\(canLeaveWorkspace\)/); assert.match(source, /beforeSignOut=\{canLeaveWorkspace\}/);
});

function mount() {
  const state = [], deps = [], cleanups = []; let index = 0, effectIndex = 0, guard = () => true, allow = false;
  const listeners = new Map();
  const hooks = { useState(initial) { const i = index++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
    useEffect(callback, next) { const i = effectIndex++; if (!deps[i] || next.some((value, j) => value !== deps[i][j])) { cleanups[i]?.(); deps[i] = next; cleanups[i] = callback(); } },
  };
  const component = load('../components/WaterDesignBasis.tsx', { ...imports, react: hooks }, { window: { confirm: () => allow, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) } }).default;
  const registerExitGuard = next => { guard = next; };
  let selectedSection = "inputs";
  function render() { index = 0; effectIndex = 0; return component({ active: true, registerExitGuard, section: selectedSection, onSectionChange: next => { selectedSection = next; } }); }
  function expand(node) { if (Array.isArray(node)) return node.flatMap(expand); if (!React.isValidElement(node)) return []; if (typeof node.type === 'function') return expand(node.type(node.props)); return [node, ...expand(node.props.children)]; }
  return { html: () => renderToStaticMarkup(render()),
    change(id, value) { const n = expand(render()).find(n => n.props.id === id); assert.ok(n, id); n.props.onChange({ target: { value } }); },
    calculate() { expand(render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); },
    view(section) { selectedSection = section; },
    currentSection: () => selectedSection,
    guard() { render(); return guard(); }, allow() { allow = true; }, listeners,
  };
}
test('native calculator runs, clears stale results, refuses invalid values, preserves drafts and guards exit', () => {
  const h = mount(); assert.equal(h.guard(), true);
  h.change('flow-avgFlowOverride', ''); h.change('flow-population', '20000'); h.change('flow-perCapita', '380'); h.calculate();
  assert.equal(h.currentSection(), "results");
  assert.match(h.html(), /7,600/); assert.match(h.html(), /assumed/); assert.equal(h.guard(), false);
  assert.match(h.html(), /<details[^>]*open=""[^>]*><summary[^>]*>Design checks<\/summary>/);
  assert.match(h.html(), /Method and references/);
  assert.match(h.html(), /These checks are engineering screening indicators and do not constitute regulatory approval/);
  assert.match(h.html(), /Within typical range/); assert.match(h.html(), /Review/);
  assert.ok(h.listeners.has('beforeunload')); h.allow(); assert.equal(h.guard(), true);
  h.change('flow-population', 'NaN'); assert.doesNotMatch(h.html(), /Result summary/); h.calculate();
  assert.equal(h.currentSection(), 'inputs');
  assert.match(h.html(), /Cannot calculate/); assert.match(h.html(), /value="NaN"/); assert.doesNotMatch(h.html(), /TypeError|stack|ww-engine.cjs/);
});


test('section switches preserve inputs, keep optional groups collapsed and identify stale results', () => {
  const h = mount(); h.change('flow-population', '12345');
  for (const section of ['results', 'checks', 'comparison', 'inputs']) h.view(section);
  assert.match(h.html(), /id="flow-population"[^>]*value="12345"/);
  assert.match(h.html(), /Reference standard or custom project criteria/);
  assert.match(h.html(), /<details class="[^"]*"><summary[^>]*>Pollutant concentrations and loads/);
  h.calculate(); assert.equal(h.currentSection(), 'results');
  assert.match(h.html(), /Key results/); assert.match(h.html(), /BOD load/);
  h.view('inputs'); h.change('flow-population', '999'); h.view('results');
  assert.match(h.html(), /Results are unavailable or stale/); assert.doesNotMatch(h.html(), /Key results/);
});
