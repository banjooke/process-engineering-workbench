import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

function load(path, imports = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: id => { assert.ok(id in imports, id); return imports[id]; }, ...globals });
  return exports;
}
const registry = load('../lib/module-registry.ts');
const preference = load('../lib/industry-preference.ts', { '@/lib/module-registry': registry });
const Selector = load('../components/IndustrySelector.tsx', { '@/lib/module-registry': registry, 'react/jsx-runtime': jsx }).default;
const Workspace = load('../components/ModuleWorkspace.tsx', { '@/lib/module-registry': registry, 'react/jsx-runtime': jsx }).default;
const plain = value => JSON.parse(JSON.stringify(value));
function nodes(node) { if (Array.isArray(node)) return node.flatMap(nodes); return React.isValidElement(node) ? [node, ...nodes(node.props.children)] : []; }
function storage(initial) { let value = initial; return { getItem(key) { assert.equal(key, preference.INDUSTRY_STORAGE_KEY); return value; }, setItem(key, next) { assert.equal(key, preference.INDUSTRY_STORAGE_KEY); value = next; } }; }

test('all seven industries have stable unique identities', () => {
  assert.deepEqual(plain(registry.INDUSTRIES.map(row => row.title)), ['General Process Engineering', 'Pharmaceuticals', 'Food & Beverage', 'Water & Wastewater', 'Oil & Gas', 'Chemicals', 'Energy & Utilities']);
  assert.equal(new Set(registry.INDUSTRIES.map(row => row.id)).size, 7);
  assert.equal(new Set(registry.MODULES.map(row => row.id)).size, registry.MODULES.length);
});

test('general includes all working modules, including the existing system curve generator', () => {
  const modules = registry.modulesForIndustry('general').filter(row => row.action);
  assert.deepEqual(plain(modules.map(row => row.action)), ['pressure_drop', 'pump_sizing', 'control_valve', 'system_curve']);
  for (const entry of modules) assert.ok(entry.title && entry.description && entry.category && entry.availability);
});

test('specialist tags remain internal and disabled workspaces expose no modules or actions', () => {
  for (const industry of registry.INDUSTRIES.filter(row => row.id !== 'general')) {
    assert.equal(registry.isSelectableIndustry(industry.id), false);
    assert.equal(registry.modulesForIndustry(industry.id).length, 0);
    assert.equal(Workspace({ industry: industry.id, onLaunch: () => assert.fail('launch'), onResume: () => assert.fail('resume') }), null);
  }
  assert.ok(registry.MODULES.find(row => row.id === 'pharmaceutical-tools').industries.includes('pharmaceuticals'));
});

test('coming-soon cards have no launch event and working cards keep existing action identifiers', () => {
  const actions = [];
  const tree = Workspace({ industry: 'general', onLaunch: action => actions.push(action) });
  const elements = nodes(tree), articles = elements.filter(node => node.props.role === 'group');
  assert.equal(articles.length, 8);
  for (const article of articles) { assert.equal(article.props.onClick, undefined); assert.ok(!nodes(article).some(node => node.type === 'button' || node.type === 'a')); }
  for (const entry of registry.MODULES.filter(row => row.availability === 'coming-soon')) assert.equal(registry.moduleAction(entry.id), null);
  assert.equal(registry.moduleAction('missing-module'), null);
  elements.filter(node => node.type === 'button').forEach(node => node.props.onClick());
  assert.deepEqual(actions, ['pressure_drop', 'pump_sizing', 'system_curve', 'control_valve']);
});

test('only General is selectable and all six specialist cards are inert and explained', () => {
  const selected = [];
  const tree = Selector({ selected: 'general', onSelect: id => selected.push(id) });
  const elements = nodes(tree), buttons = elements.filter(node => node.type === 'button');
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].props['aria-pressed'], true);
  buttons[0].props.onClick(); assert.deepEqual(selected, ['general']);
  const cards = elements.filter(node => node.props.role === 'group'); assert.equal(cards.length, 6);
  for (const [index, card] of cards.entries()) {
    assert.equal(card.props['aria-disabled'], 'true');
    assert.equal(card.props['aria-labelledby'], `${registry.INDUSTRIES[index + 1].id}-title`);
    assert.equal(card.props['aria-describedby'], 'industry-availability-note');
    for (const node of nodes(card)) {
      assert.ok(!['button', 'a'].includes(node.type));
      for (const prop of ['onClick', 'onKeyDown', 'onKeyUp', 'tabIndex']) assert.equal(node.props[prop], undefined);
    }
    assert.doesNotMatch(renderToStaticMarkup(card), /Coming soon|Unavailable|not available yet/i);
    assert.deepEqual(nodes(card).slice(1).map(node => node.type), ['h3', 'p']);
    assert.doesNotMatch(card.props.className, /hover:|active:|cursor-pointer|shadow/);
    assert.match(card.props.className, /bg-gray-50/);
  }
  const notes = elements.filter(node => node.props.id === 'industry-availability-note');
  assert.equal(notes.length, 1);
  assert.equal(notes[0].props.children, 'Additional industry workspaces will be introduced progressively.');
  assert.doesNotMatch(renderToStaticMarkup(tree), /Available workspace|Industry workspaces|Coming soon/);
  const grid = nodes(tree).find(node => node.props.className?.includes('grid '));
  assert.equal(grid.props.children.length, 7);
  assert.match(renderToStaticMarkup(tree), /Choose your workspace/);
});

test('disabled selections never write storage or notify subscribers', () => {
  let writes = 0, changes = 0;
  const store = preference.createIndustryPreference(() => ({ getItem: () => 'general', setItem: () => writes++ }));
  store.subscribe(() => changes++);
  for (const industry of registry.INDUSTRIES.slice(1)) store.select(industry.id);
  assert.equal(store.getSnapshot(), 'general'); assert.equal(writes, 0); assert.equal(changes, 0);
});

test('valid preference restored only after client subscription and persisted across reloads', () => {
  const local = storage('general'); let reads = 0;
  const store = preference.createIndustryPreference(() => { reads++; return local; });
  assert.equal(store.getSnapshot(), null); assert.equal(store.getServerSnapshot(), null); assert.equal(reads, 0);
  const unsubscribe = store.subscribe(() => {}); assert.equal(store.getSnapshot(), 'general');
  store.select('general'); assert.equal(store.getSnapshot(), 'general'); unsubscribe();
  const reloaded = preference.createIndustryPreference(() => local); reloaded.subscribe(() => {});
  assert.equal(reloaded.getSnapshot(), 'general');
});

for (const value of [null, '', 'obsolete', 'constructor', '{"industry":"general"}', ...registry.INDUSTRIES.slice(1).map(row => row.id)]) test(`invalid stored industry safely falls back: ${value}`, () => {
  const store = preference.createIndustryPreference(() => storage(value)); store.subscribe(() => {}); assert.equal(store.getSnapshot(), null);
});

test('blocked browser storage retains a usable in-memory selection', () => {
  const store = preference.createIndustryPreference(() => { throw new Error('Storage blocked'); });
  let changes = 0; store.subscribe(() => changes++); store.select('general');
  assert.equal(store.getSnapshot(), 'general'); assert.equal(changes, 1);
  store.select('invalid'); assert.equal(store.getSnapshot(), 'general');
});

test('server rendering does not access localStorage and renders a deterministic selector', () => {
  const store = preference.createIndustryPreference(() => { throw new Error('Server must never read storage'); });
  const hooks = load('../lib/use-industry-workspace.ts', { react: React, '@/lib/module-registry': registry, '@/lib/industry-preference': { industryPreference: store } });
  function Page() { const state = hooks.useIndustryWorkspace(); return React.createElement(Selector, { selected: state.industry, onSelect: state.chooseIndustry }); }
  assert.match(renderToStaticMarkup(React.createElement(Page)), /Choose your workspace/);
  assert.equal(store.getSnapshot(), null);
});

test('industry switches and module/workspace navigation preserve the active workflow', () => {
  const store = preference.createIndustryPreference(() => storage(null)); let view = null;
  const react = { useSyncExternalStore(subscribe, getSnapshot) { subscribe(() => {}); return getSnapshot(); }, useState: () => [view, value => { view = value; }] };
  const hooks = load('../lib/use-industry-workspace.ts', { react, '@/lib/module-registry': registry, '@/lib/industry-preference': { industryPreference: store } });
  const current = () => hooks.useIndustryWorkspace();
  assert.equal(current().view, 'industries'); current().chooseIndustry('general'); assert.equal(current().view, 'modules');
  current().enterModule(); assert.equal(current().view, 'module'); current().goHome(() => false); assert.equal(current().view, 'module');
  current().goHome(() => true); assert.equal(current().view, 'industries'); assert.equal(current().industry, 'general');
  for (const industry of registry.INDUSTRIES.slice(1)) { current().chooseIndustry(industry.id); assert.equal(current().industry, 'general'); assert.equal(current().view, 'industries'); }
  current().chooseIndustry('general'); assert.equal(current().view, 'modules');
  current().enterModule(); assert.equal(current().view, 'module'); current().showModules(); assert.equal(current().view, 'modules');
  const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /<div hidden=\{workspace.view !== "module"\}>/);
  assert.match(source, /onResume=\{wizardStep !== "tasks" \? workspace.enterModule : undefined\}/);
  assert.match(source, /onExit=\{\(\) => workspace.showModules\(\)\}/);
  assert.match(source, /<UserAccount beforeSignOut=/);
  assert.doesNotMatch(source, /projects.filter\([^)]*industry/);
});

function launcher(overrides = {}) {
  const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('  function launchModule('), end = source.indexOf('  // ===', start);
  const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const calls = [], context = { wizardStep: 'tasks', engineeringTask: null, workspace: { enterModule: () => calls.push(['enter']) }, valveExitGuard: { current: () => true },
    setEngineeringTask: value => calls.push(['task', value]), setWizardStep: value => calls.push(['step', value]), setAnalysisType: value => calls.push(['analysis', value]), setPumpResult: value => calls.push(['pumpResult', value]), window: { scrollTo() {} }, ...overrides };
  vm.createContext(context); vm.runInContext(code, context);
  return { calls, launch: context.launchModule };
}
for (const action of ['pressure_drop', 'pump_sizing', 'system_curve', 'control_valve']) test(`existing module action opens its workflow: ${action}`, () => {
  const h = launcher(); h.launch(action);
  assert.ok(h.calls.some(([key, value]) => key === 'step' && value === (action === 'control_valve' ? 'control_valve' : 'project')));
  assert.ok(h.calls.some(([key]) => key === 'enter'));
});

test('resuming a module does not reset inputs; leaving a valve module respects its guard', () => {
  const resume = launcher({ wizardStep: 'control_valve' }); resume.launch('control_valve'); assert.deepEqual(resume.calls, [['enter']]);
  const cancel = launcher({ wizardStep: 'control_valve', valveExitGuard: { current: () => false } }); cancel.launch('pump_sizing'); assert.deepEqual(cancel.calls, []);
});

test('Home is guarded and preserves account controls', () => {
  const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Change industry/);
  assert.ok(source.includes('onClick={() => workspace.goHome(() => wizardStep !== "control_valve" || valveExitGuard.current())}'));
  assert.match(source, />Home<\/button>/);
  assert.match(source, /<UserAccount beforeSignOut=/);
});

test('typed module categories render dividers and placeholders stay visible and disabled without status badges', () => {
  const tree = Workspace({ industry: 'general', onLaunch: () => assert.fail('unexpected launch') });
  const elements = nodes(tree);
  for (const entry of registry.MODULES) assert.ok(registry.MODULE_CATEGORIES.includes(entry.category));
  const sections = elements.filter(node => node.type === 'section' && node.props['aria-labelledby']?.startsWith('category-'));
  assert.equal(sections.length, registry.MODULE_CATEGORIES.length);
  for (const section of sections) assert.match(section.props.className, /border-t/);
  for (const category of registry.MODULE_CATEGORIES) assert.ok(elements.some(node => node.type === 'h3' && node.props.children === category));
  assert.doesNotMatch(renderToStaticMarkup(tree), /Coming soon|Unavailable/);
  assert.equal(elements.filter(node => node.props.id === 'module-availability-note').length, 1);
  for (const card of elements.filter(node => node.props.role === 'group')) {
    assert.equal(card.props['aria-disabled'], 'true');
    assert.match(card.props.className, /bg-gray-50/);
    assert.doesNotMatch(card.props.className, /hover:|active:|cursor-pointer|shadow/);
    for (const node of nodes(card)) {
      for (const prop of ['onClick', 'onKeyDown', 'onKeyUp', 'tabIndex']) assert.equal(node.props[prop], undefined);
      assert.ok(!['button', 'a'].includes(node.type));
    }
  }
  for (const button of elements.filter(node => node.type === 'button')) assert.match(button.props.className, /hover:border-teal-700/);
  for (const entry of registry.MODULES) assert.equal(elements.filter(node => node.type === 'h4' && node.props.children === entry.title).length, 1);
});
