import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

const cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path);
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, encodeURIComponent, URL, require(id) {
    if (id === 'react/jsx-runtime') return jsx;
    if (id === 'next/link') return { default: 'a' };
    if (id === 'react') return { ...React, useState: initial => [initial, () => {}], useEffect() {} };
    if (id === 'next/navigation') return { useRouter: () => ({}) };
    if (id === '@/lib/supabase/client') return { createClient() { throw Error('render must not authenticate'); } };
    if (id.startsWith('@/')) return load(`${id.slice(2)}${id.includes('/components/') ? '.tsx' : '.ts'}`);
    throw Error(`Unexpected import ${id}`);
  } });
  cache.set(path, exports); return exports;
}
const config = load('lib/site-config.ts');
const html = path => renderToStaticMarkup(React.createElement(load(path).default));

test('shared beta badge and footer expose only fixed public navigation', () => {
  assert.match(html('components/BetaBadge.tsx'), />BETA</);
  const footer = html('components/SiteFooter.tsx');
  for (const route of ['/privacy', '/terms', config.contactHref, config.siteConfig.feedbackFormUrl]) assert.ok(footer.includes(`href="${route}"`));
  assert.match(footer, /2026 BAFED Services/);
  assert.match(footer, /href="https:\/\/tally\.so\/r\/dWBBZo" target="_blank" rel="noopener noreferrer">Send feedback<\/a>/);
  assert.ok(!footer.includes('>https://tally.so'));
  assert.equal(config.contactHref, 'mailto:consultancy@bafedservices.com');
  assert.equal(config.deletionHref, 'mailto:consultancy@bafedservices.com?subject=Account%20deletion%20request');
  assert.equal(config.siteConfig.feedbackFormUrl, 'https://tally.so/r/dWBBZo');
  assert.deepEqual([...new URL(config.siteConfig.feedbackFormUrl).searchParams.keys()], []);
  const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /\{children\}<SiteFooter \/>/);
});

test('all authentication brands render Beta and signup links its acknowledgement without consent fields', () => {
  for (const name of ['login', 'signup', 'forgot-password', 'update-password']) {
    const markup = html(`app/${name}/page.tsx`);
    assert.equal((markup.match(/>BETA</g) ?? []).length, 2, name);
  }
  const signup = html('app/signup/page.tsx');
  assert.match(signup, /By creating an account, you acknowledge/);
  assert.match(signup, /href="\/terms">Beta Terms of Use/);
  assert.match(signup, /href="\/privacy">Privacy Notice/);
  assert.ok(signup.includes(config.confidentialityWarning));
  assert.doesNotMatch(signup, /type="checkbox"|GDPR consent/);
});

test('privacy renders operator, retention, rights, storage and deletion guidance with metadata', () => {
  const markup = html('app/privacy/page.tsx');
  for (const value of [config.siteConfig.operatorName, config.siteConfig.enterpriseNumber, config.siteConfig.contactEmail, config.siteConfig.effectiveDate, '30 days', '12 months', 'access', 'correction', 'deletion', 'restriction', 'portability', 'object', 'withdraw', 'Belgian Data Protection Authority', 'no self-service', 'Supabase', 'Vercel', 'Render', 'One.com', 'Tally', 'voluntary-feedback form']) assert.ok(markup.toLowerCase().includes(value.toLowerCase()), value);
  assert.ok(markup.includes(config.deletionHref));
  assert.match(load('app/privacy/page.tsx').metadata.title, /Privacy Notice/);
  assert.ok(load('app/privacy/page.tsx').metadata.description);
  assert.doesNotMatch(markup, /GDPR compliant|certified|street address/i);
});

test('terms render proportionate beta and engineering limitations with privacy link and metadata', () => {
  const markup = html('app/terms/page.tsx');
  for (const value of ['preliminary engineering calculations', 'not certified designs', 'competent engineering review', 'safety-critical', 'Belgian law', 'permitted by applicable law', 'retain ownership', 'href="/privacy"']) assert.ok(markup.includes(value), value);
  assert.match(load('app/terms/page.tsx').metadata.title, /Beta Terms/);
  assert.ok(load('app/terms/page.tsx').metadata.description);
  assert.doesNotMatch(markup, /GDPR compliant|reviewed by a lawyer/i);
});

test('workspace shows persistent guidance and Home feedback without modifying navigation handlers', () => {
  const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /\{siteConfig.applicationName\} <BetaBadge \/>/);
  assert.match(source, /\{engineeringDisclaimer\}<\/p>\s*<\/header>/);
  assert.match(source, /workspace.view === "industries"[\s\S]*?\{confidentialityWarning\}[\s\S]*?href=\{siteConfig.feedbackFormUrl\} target="_blank" rel="noopener noreferrer"/);
});
