import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { waterLoader } from './water-test-support.mjs';

function elements(node) { if (Array.isArray(node)) return node.flatMap(elements); if (!React.isValidElement(node)) return []; return [node, ...elements(node.props.children)]; }
function event(key, currentTarget, target = currentTarget) { return { key, currentTarget, target, preventDefault() {}, stopPropagation() {} }; }
test('tabs expose selection, panel relationships, mobile selector and arrow/Home/End navigation', () => {
  const controls = waterLoader()('components/WaterWorkflowControls.tsx');
  const changes = [];
  const tree = controls.WaterSectionNavigation({ section: 'inputs', onChange: next => changes.push(next), hasScenario: true, hasProject: true, checkSummary: '6 within typical range | 2 review | 1 outside selected criterion' });
  const all = elements(tree), tabs = all.filter(n => n.props.role === 'tab');
  assert.equal(tabs.length, 4); assert.equal(tabs[0].props['aria-selected'], true); assert.equal(tabs[1].props.tabIndex, -1);
  assert.equal(tabs[2].props['aria-controls'], 'water-panel-checks');
  assert.match(renderToStaticMarkup(tree), /6 within typical range/); assert.match(renderToStaticMarkup(tree), /sm:hidden/);
  let focused;
  const buttons = tabs.map((n, index) => ({ disabled: n.props.disabled, focus: () => { focused = index; } }));
  const target = { parentElement: { querySelectorAll: () => buttons } };
  tabs[0].props.onKeyDown(event('ArrowRight', target)); assert.equal(changes.at(-1), 'results'); assert.equal(focused, 1);
  tabs[0].props.onKeyDown(event('ArrowLeft', target)); assert.equal(changes.at(-1), 'comparison'); assert.equal(focused, 3);
  tabs[1].props.onKeyDown(event('Home', target)); assert.equal(changes.at(-1), 'inputs');
  tabs[1].props.onKeyDown(event('End', target)); assert.equal(changes.at(-1), 'comparison');
  all.find(n => n.type === 'select').props.onChange({ target: { value: 'checks' } }); assert.equal(changes.at(-1), 'checks');
});
test('tab keyboard navigation skips unavailable sections', () => {
  const controls = waterLoader()('components/WaterWorkflowControls.tsx'); let selected;
  const tree = controls.WaterSectionNavigation({ section: 'inputs', onChange: next => { selected = next; }, hasScenario: false, hasProject: true, checkSummary: '' });
  const tabs = elements(tree).filter(n => n.props.role === 'tab');
  const buttons = tabs.map(n => ({ disabled: n.props.disabled, focus() {} }));
  tabs[0].props.onKeyDown(event('ArrowRight', { parentElement: { querySelectorAll: () => buttons } }));
  assert.equal(selected, 'comparison');
});
test('download menu handles focus, arrows, Escape, Tab, outside click and disabled reasons', () => {
  let open = false, refIndex = 0, effect, cleaned = false, focused = '', selected = '', outside;
  const trigger = { focus: () => { focused = 'trigger'; } };
  const items = Array.from({ length: 4 }, (_, i) => ({ focus: () => { focused = i; } }));
  const refs = [trigger, { querySelectorAll: () => items }, { contains: target => target === 'inside' }, false].map(current => ({ current }));
  const hooks = { useState: () => [open, next => { open = typeof next === 'function' ? next(open) : next; }], useRef: () => refs[refIndex++], useEffect: fn => { effect = fn; } };
  const controls = waterLoader({ react: hooks }, { document: { addEventListener: (_name, fn) => { outside = fn; }, removeEventListener: () => { cleaned = true; } } })('components/WaterWorkflowControls.tsx');
  const props = { busy: false, options: ['PDF', 'Word', 'comparison PDF', 'comparison Word'].map((name, i) => ({ id: `download-${i}`, label: `Download ${name}`, disabled: i === 0, reason: 'Calculate and save the scenario first.', onSelect: () => { selected = name; } })) };
  function render() { refIndex = 0; return controls.WaterDownloadMenu(props); }
  let tree = render(), button = elements(tree).find(n => n.props['aria-haspopup'] === 'menu');
  assert.equal(button.props['aria-expanded'], false); button.props.onClick();
  tree = render(); const cleanup = effect(); assert.equal(focused, 0);
  let options = elements(tree).filter(n => n.props.role === 'menuitem');
  assert.equal(options[0].props['aria-disabled'], true); assert.equal(options[0].props['aria-describedby'], 'download-0-reason');
  options[0].props.onClick(); assert.equal(selected, ''); assert.equal(open, true);
  tree.props.onKeyDown(event('ArrowDown', null, items[0])); assert.equal(focused, 1);
  tree.props.onKeyDown(event('End', null, items[0])); assert.equal(focused, 3);
  tree.props.onKeyDown(event('Home', null, items[3])); assert.equal(focused, 0);
  tree.props.onKeyDown(event('Escape')); assert.equal(open, false); assert.equal(focused, 'trigger');
  button.props.onKeyDown(event('ArrowUp')); tree = render(); effect(); assert.equal(focused, 3);
  tree.props.onKeyDown(event('Tab')); assert.equal(open, false); assert.equal(focused, 'trigger');
  button.props.onClick(); tree = render(); effect(); outside({ target: 'outside' }); assert.equal(open, false);
  button.props.onClick(); tree = render(); effect(); options = elements(tree).filter(n => n.props.role === 'menuitem');
  options[1].props.onClick(); assert.equal(selected, 'Word'); assert.equal(open, false);
  cleanup(); assert.equal(cleaned, true);
});
