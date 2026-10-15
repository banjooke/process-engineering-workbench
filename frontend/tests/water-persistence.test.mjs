import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { waterLoader, plain } from './water-test-support.mjs';
const load = waterLoader();
const persistence = load('lib/water-treatment/persistence.ts');
const calculation = load('lib/water-treatment/calculation.ts');
const presentation = load('lib/water-treatment/presentation.ts');
const adapter = load('lib/water-treatment/adapter.ts');
const input = load('lib/water-treatment/input.ts');
const fixture = JSON.parse(readFileSync(new URL('../../tests/fixtures/water-scenario.json', import.meta.url), 'utf8'));
const row = (id = 1, project = 10) => ({ ...structuredClone(fixture.wastewater), id, project_id: project, created_at: '', updated_at: '' });

test('empty water draft saves without requiring any positive calculation input', () => {
  const session = persistence.newWaterSession(); session.draft.flows.population = ''; session.draft.flows.perCapita = ''; session.draft.flows.avgFlowOverride = '';
  const payload = persistence.waterScenarioPayload('Draft', '', session);
  assert.equal(payload.flow_value, 0); assert.equal(payload.calculation_intent, 'water_treatment');
  const restored = persistence.restoreWaterSession({ ...payload, id: 1, project_id: 10 });
  assert.equal(restored.result, null); assert.equal(restored.draft.flows.population, '');
});
test('complete inputs, criteria, outputs, checks and note round-trip against original engine', () => {
  const saved = row(); const original = structuredClone(saved);
  const session = persistence.restoreWaterSession(saved);
  assert.ok(session.result); assert.deepEqual(plain(session.result), plain(calculation.calculateDraft(session.draft)));
  const payload = persistence.waterScenarioPayload(saved.name, saved.description, session);
  assert.deepEqual(plain(payload), fixture.wastewater);
  assert.equal(payload.fluid_config.water_treatment.calculation_note, calculation.CALCULATION_NOTE);
  assert.deepEqual(saved, original);
});
test('changes to inputs or selected criteria invalidate results immediately', () => {
  const current = persistence.restoreWaterSession(row());
  for (const change of [draft => { draft.flows.population = '99999'; }, draft => { draft.standardIds.effluent = 'KE_2024_environment'; }, draft => { draft.conc.BOD = '333'; }]) {
    const draft = structuredClone(current.draft); change(draft);
    const edited = persistence.editWaterSession(current, draft);
    assert.equal(edited.result, null); assert.equal(edited.calculatedAt, null); assert.match(edited.staleReason, /Recalculate/);
  }
});
test('incompatible schema, engine, stale markers, missing fields and corrupted numerical results force recalculation', () => {
  for (const mutate of [d => { d.schema_version = 'future'; }, d => { d.engine_version = 'future'; }, d => { d.result_status = 'draft'; }, d => { d.stale = true; }, d => { d.calculated_at = 'nonsense'; }, d => { d.result.basis.flows.Qpeak += 1; }, d => { delete d.result.basis.loads.BOD; }, d => { d.checks = []; }, d => { d.calculation_note = ''; }, d => { d.draft.conc.BOD = '999'; }]) {
    const saved = row(); mutate(saved.fluid_config.water_treatment);
    assert.equal(persistence.restoreWaterSession(saved).result, null);
  }
  const session = persistence.restoreWaterSession(row()); session.result.basis.flows.Qavg = Infinity;
  assert.throws(() => persistence.waterScenarioPayload('Bad', '', session), /Recalculate/);
});
test('cross-task restore and malformed documents cannot overwrite water scenario state', () => {
  const saved = row(); saved.fluid_config.engineering_task = 'pump_sizing';
  assert.throws(() => persistence.restoreWaterSession(saved), /another engineering task/);
  assert.throws(() => persistence.restoreWaterSession({ ...row(), fluid_config: { engineering_task: 'water_treatment', water_treatment: { draft: {} } } }), /unsupported/);
});
test('two through five compatible scenarios compare read-only and values match stored calculations', () => {
  const rows = Array.from({ length: 5 }, (_, index) => row(index + 1)); const before = structuredClone(rows);
  for (let count = 2; count <= 5; count++) {
    const compared = persistence.comparisonRows(rows.slice(0, count), 10);
    assert.equal(compared.length, count);
    for (const item of compared) {
      assert.equal(item.values['Average flow (m³/d)'], fixture.wastewater.fluid_config.water_treatment.result.basis.flows.Qavg);
      assert.equal(item.values['BOD load (kg/d)'], fixture.wastewater.fluid_config.water_treatment.result.basis.loads.BOD);
    }
  }
  assert.deepEqual(rows, before);
  for (const rows of [[row()], [row(), row()], [row(), row(2, 999)], Array.from({ length: 6 }, (_, i) => row(i))]) assert.throws(() => persistence.comparisonRows(rows, 10));
  const stale = row(2); stale.fluid_config.water_treatment.stale = true;
  assert.throws(() => persistence.comparisonRows([row(), stale], 10));
});
test('custom project limits are user supplied and evaluated using existing engine checks', () => {
  const before = plain(adapter.standards);
  const draft = input.initialDraft(); draft.standardIds.effluent = 'custom';
  draft.projectCriteria = { name: 'Site target', jurisdiction: 'User-specified site', limits: { BOD: { min: '', max: '20' }, pH: { min: '6', max: '9' } } };
  draft.predicted = { BOD: '25', pH: '7' };
  const result = calculation.calculateDraft(draft);
  assert.equal(result.compliance.standard.status, 'user supplied');
  assert.equal(result.compliance.rows.find(r => r.param === 'BOD').status, 'fail');
  assert.match(presentation.standardMetadata('custom', result.compliance.standard).classification, /User-entered/);
  const session = { draft, result, calculatedAt: '2026-10-15T12:00:00Z', staleReason: null };
  assert.ok(persistence.restoreWaterSession({ ...persistence.waterScenarioPayload('Custom', '', session), id: 1, project_id: 10 }).result);
  draft.projectCriteria.limits.pH.min = '10'; assert.throws(() => calculation.calculateDraft(draft));
  assert.deepEqual(plain(adapter.standards), before);
});
test('status labels preserve engine statuses and mixed-country notes remain comparative guidance', () => {
  assert.deepEqual(plain(presentation.STATUS_LABELS), { pass: 'Within typical range', warn: 'Review', fail: 'Outside selected criterion', info: 'Information only' });
  const checks = calculation.calculateDraft({ ...input.initialDraft(), kind: 'drinking' }).water.checks;
  for (const check of checks.filter(c => /Nigeria.*Kenya|Kenya.*Mwache/.test(c.source))) assert.equal(presentation.checkReference(check).classification, 'Comparative published guidance');
  const result = calculation.calculateDraft(input.initialDraft());
  assert.ok(result.basis.checks.some(c => c.status === 'warn')); assert.ok(result.basis.checks.every(c => Object.hasOwn(presentation.STATUS_LABELS, c.status)));
});
test('backend frozen reference catalogue equals untouched engine catalogue exactly', () => {
  const frozen = JSON.parse(readFileSync(new URL('../../engineering/water_reference.json', import.meta.url), 'utf8'));
  assert.deepEqual(frozen, plain(adapter.standards));
});
test('authenticated report helper posts only IDs once and downloads the returned safe filename', async () => {
  const calls = [], downloads = [];
  const api = waterLoader({ '@/lib/api': { apiFetch: async (url, init) => { calls.push({ url, init }); return new Response(new Blob(['report']), { headers: { 'Content-Disposition': 'attachment; filename="Project_Scenario_design-basis.pdf"' } }); } }, '@/lib/download': { downloadBlob: (...args) => downloads.push(args) } })('lib/water-treatment/api.ts');
  await api.downloadWaterReport('https://service.test', 10, 1, 'pdf', [1, 2]);
  assert.equal(calls.length, 1); assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { scenario_id: 1, comparison_ids: [1, 2] });
  assert.equal(downloads[0][1], 'Project_Scenario_design-basis.pdf');
  assert.match(calls[0].url, /projects\/10\/water-treatment\/reports\/pdf$/);
});
test('report 422 details remain readable and report POST failures never retry', async () => {
  let calls = 0;
  const api = waterLoader({ '@/lib/api': { apiFetch: async () => { calls++; return new Response(JSON.stringify({ detail: [{ loc: ['body', 'scenario_id'], msg: 'Calculate and save first' }] }), { status: 422 }); } }, '@/lib/download': { downloadBlob: () => assert.fail('unexpected download') } })('lib/water-treatment/api.ts');
  await assert.rejects(api.downloadWaterReport('', 10, 1, 'docx'), /body.scenario_id: Calculate and save first/);
  assert.equal(calls, 1);
});

function mount() {
  const state = [], refs = [], dependencies = [], cleanups = []; let index = 0, refIndex = 0, effectIndex = 0, editor, guard = () => true, allowLeave = false, nextId = 1, createCount = 0;
  const saved = new Map(); const downloads = []; const projects = [{ id: 10, name: 'Water study', description: 'Existing project' }];
  const hooks = { useState(initial) { const i = index++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
    useRef(initial) { const i = refIndex++; return refs[i] ??= { current: initial }; },
    useEffect(callback, deps) { const i = effectIndex++; if (!dependencies[i] || deps.some((v, j) => !Object.is(v, dependencies[i][j]))) { cleanups[i]?.(); dependencies[i] = deps; cleanups[i] = callback(); } },
  };
  const actualProjects = load('lib/projects.ts');
  const projectsAPI = { ...actualProjects, listProjects: async () => projects, createProjectRecord: async (_base, name, description) => ({ id: 10, name, description }), openProjectRecord: async () => projects[0], listScenarioRecords: async () => [...saved.values()].map(structuredClone),
    saveScenarioRecord: async (_base, project, body, id) => { if (!id) createCount++; const record = { ...plain(body), id: id ?? nextId++, project_id: project }; saved.set(record.id, record); return structuredClone(record); },
    openScenarioRecord: async (_base, _project, id) => structuredClone(saved.get(id)), deleteScenarioRecord: async (_base, _project, id) => saved.delete(id), confirmScenarioDeletion: () => allowLeave,
  };
  const component = waterLoader({ react: hooks, '@/lib/projects': projectsAPI,
    '@/components/WaterDesignBasis': { __esModule: true, default: props => { editor = props; return React.createElement('p', null, 'Native editor'); } },
    '@/lib/water-treatment/api': { downloadWaterReport: async (...args) => downloads.push(args), duplicateWaterScenario: async (_base, project, id) => { const original = saved.get(id); return projectsAPI.saveScenarioRecord('', project, persistence.waterScenarioPayload(`Copy of ${original.name}`, '', { ...persistence.restoreWaterSession(original), result: null, calculatedAt: null, staleReason: 'Recalculate' })); }, compareWaterScenarios: async () => ({ scenario_ids: [], names: [], metrics: [] }) },
  }, { document: { addEventListener() {}, removeEventListener() {} }, window: { confirm: () => allowLeave, addEventListener() {}, removeEventListener() {} } })('components/WaterProjectWorkflow.tsx').default;
  const registerExitGuard = next => { guard = next; };
  const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : React.isValidElement(node) ? text(node.props.children) : '';
  function render() { index = refIndex = effectIndex = 0; return component({ apiBaseUrl: '/api', active: true, registerExitGuard }); }
  function expand(node) { if (Array.isArray(node)) return node.flatMap(expand); if (!React.isValidElement(node)) return []; if (typeof node.type === 'function') return expand(node.type(node.props)); return [node, ...expand(node.props.children)]; }
  const elements = () => expand(render());
  return {
    html: () => renderToStaticMarkup(render()),
    change(id, value) { const n = elements().find(n => n.props.id === id); assert.ok(n, id); n.props.onChange({ target: { value } }); },
    click(label) { const n = elements().find(n => n.type === 'button' && (text(n) === label || n.props['aria-label'] === label)); assert.ok(n, label); if (!n.props.disabled) n.props.onClick(); },
    openDownload() { elements().find(n => n.props['aria-haspopup'] === 'menu').props.onClick(); },
    closeDownload() { elements().find(n => n.props.className === 'relative' && n.props.onKeyDown).props.onKeyDown({ key: 'Escape', preventDefault() {}, stopPropagation() {} }); },
    clickTab(section) { elements().find(n => n.props.id === `water-tab-${section}`).props.onClick(); },
    panel(section) { return elements().find(n => n.props.id === `water-panel-${section}`); },
    calculate() { elements(); const draft = structuredClone(editor.initialValues); editor.onCalculated(draft, calculation.calculateDraft(draft)); },
    edit() { elements(); const draft = structuredClone(editor.initialValues); draft.flows.population = '999'; editor.onEdit(draft); },
    guard() { render(); return guard(); }, allowLeave() { allowLeave = true; }, saved, downloads, createCount: () => createCount,
  };
}
const flush = async () => { for (let i = 0; i < 15; i++) await new Promise(resolve => setImmediate(resolve)); };
test('project → draft → calculate → save → reopen, dirty guards, reports and duplicate use saved records', async () => {
  const h = mount(); await flush(); h.change('project-selector', '10'); h.click('Open project'); await flush();
  h.change('water-scenario-name', 'Basis A'); h.click('Create scenario'); h.click('Create scenario'); await flush();
  assert.equal(h.createCount(), 1); assert.equal(h.saved.size, 1); assert.equal(h.guard(), true);
  assert.match(h.html(), /Calculate and save the scenario first/);
  h.calculate(); assert.equal(h.guard(), false); h.click('Save scenario'); await flush();
  assert.equal(h.guard(), true); assert.ok(h.saved.get(1).fluid_config.water_treatment.result);
  h.openDownload(); h.click('Download PDF'); await flush(); assert.equal(h.downloads.length, 1); assert.equal(h.downloads[0][2], 1);
  h.click('Change scenario'); h.change('water-scenario-selector', '1'); h.click('Open scenario'); await flush();
  assert.match(h.html(), /Calculated \| Saved/);
  h.edit(); assert.equal(h.guard(), false); h.click('Change project'); assert.match(h.html(), /Project: /);
  h.allowLeave(); h.click('Duplicate saved scenario'); await flush();
  assert.equal(h.saved.size, 2); assert.ok(h.saved.get(1).fluid_config.water_treatment.result);
  assert.equal(h.saved.get(2).name, 'Copy of Basis A'); assert.equal(h.saved.get(2).fluid_config.water_treatment.result, null);
});


test('sticky toolbar exposes state, guarded actions and disabled download reasons before the editor', async () => {
  const h = mount(); await flush();
  h.openDownload(); assert.match(h.html(), /Create or open a Design Basis scenario first/); h.closeDownload();
  assert.match(h.html(), /aria-haspopup="menu"/);
  h.change('project-selector', '10'); h.click('Open project'); await flush();
  h.change('water-scenario-name', 'Toolbar basis'); h.click('Create scenario'); await flush();
  const initial = h.html();
  assert.match(initial, /Water Treatment \/ Design Basis/); assert.match(initial, /Toolbar basis/);
  assert.ok(initial.indexOf('Design Basis project and actions') < initial.indexOf('Native editor'));
  assert.match(initial, /sticky top-0/); assert.match(initial, /View/);
  h.calculate(); h.click('Save scenario'); await flush();
  h.openDownload(); h.click('Download Word'); await flush();
  assert.equal(h.downloads[0][3], 'docx');
  h.clickTab('inputs'); assert.match(h.html(), /aria-label="Input actions"/);
  h.clickTab('checks'); assert.doesNotMatch(h.html(), /aria-label="Input actions"/);
  h.clickTab('comparison'); assert.equal(h.panel('comparison').props.hidden, false);
  h.edit(); h.openDownload(); assert.match(h.html(), /Recalculate because inputs have changed/);
  const count = h.downloads.length;
  h.click('Download PDFRecalculate because inputs have changed, then save the scenario.');
  await flush(); assert.equal(h.downloads.length, count); assert.equal(h.guard(), false);
});
