import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as nextServer from 'next/server.js';

// Execute the actual handler, with only Supabase replaced; no server or network.
function loadHandler(error = null) {
  const calls = [];
  const exports = {};
  const source = readFileSync(new URL('../app/auth/callback/route.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports, URL,
    require(name) {
      if (name === 'next/server') return nextServer;
      if (name === '@/lib/supabase/server') return {
        createClient: async () => ({ auth: {
          exchangeCodeForSession: async (code) => { calls.push(code); return { error }; },
        } }),
      };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return { GET: exports.GET, calls };
}

async function redirect(next, { code, error, origin = 'https://workbench.test' } = {}) {
  const handler = loadHandler(error);
  const url = new URL('/auth/callback', origin);
  if (next !== undefined) url.searchParams.set('next', next);
  if (code) url.searchParams.set('code', code);
  const response = await handler.GET(new Request(url));
  assert.equal(response.status, 307);
  return { location: response.headers.get('location'), calls: handler.calls };
}

for (const next of [
  undefined, '', 'https://external.test/x', '//external.test/x', '//workbench.test/x',
  '\\external.test', '/\\external.test', '/%5cexternal.test',
  'javascript:alert(1)', 'data:text/plain,hello', 'ftp://workbench.test/x',
  'https://[broken', '/bad%zz', ' https://workbench.test/x',
  'https:/workbench.test/x', 'https:settings', 'https:///workbench.test/x',
  'https://workbench.test:444/x', 'http://workbench.test/x', '/a\nb',
]) {
  test(`unsafe or empty next falls back: ${JSON.stringify(next)}`, async () => {
    const result = await redirect(next);
    assert.equal(result.location, 'https://workbench.test/');
    assert.deepEqual(result.calls, []);
  });
}

for (const next of ['/update-password?mode=recovery#form', '/search?q=a%20b&x=1#results',
  'https://workbench.test/settings?q=1#profile', '/safe path?q=hello world#section']) {
  test(`preserves safe destination: ${next}`, async () => {
    assert.equal((await redirect(next)).location, new URL(next, 'https://workbench.test').href);
  });
}
test('allows same-origin HTTP in local development', async () => {
  assert.equal((await redirect('/settings?x=1#edit', { origin: 'http://localhost:3000' })).location,
    'http://localhost:3000/settings?x=1#edit');
});
test('successful exchange preserves destination and exchanges exactly once', async () => {
  const result = await redirect('/update-password#form', { code: 'test-code' });
  assert.equal(result.location, 'https://workbench.test/update-password#form');
  assert.deepEqual(result.calls, ['test-code']);
});
test('successful exchange cannot redirect externally', async () => {
  const result = await redirect('https://external.test', { code: 'test-code' });
  assert.equal(result.location, 'https://workbench.test/');
  assert.deepEqual(result.calls, ['test-code']);
});
test('failed exchange retains local error destination', async () => {
  const result = await redirect('https://external.test', { code: 'bad-code', error: {} });
  assert.equal(result.location, 'https://workbench.test/login?error=recovery-link-invalid');
  assert.deepEqual(result.calls, ['bad-code']);
});
