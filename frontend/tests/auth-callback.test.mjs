import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as nextServer from 'next/server.js';

const destinationExports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/auth-destination.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: destinationExports, URL });

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
      if (name === '@/lib/auth-destination') return destinationExports;
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
    assert.equal(result.location, 'https://workbench.test/?workspace=home');
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
  assert.equal(result.location, 'https://workbench.test/?workspace=home');
  assert.deepEqual(result.calls, ['test-code']);
});
test('failed exchange retains local error destination', async () => {
  const result = await redirect('https://external.test', { code: 'bad-code', error: {} });
  assert.equal(result.location, 'https://workbench.test/login?error=recovery-link-invalid');
  assert.deepEqual(result.calls, ['bad-code']);
});

test('successful default callback selects Home', async () => {
  const result = await redirect(undefined, { code: 'signup-or-passwordless-code' });
  assert.equal(result.location, 'https://workbench.test/?workspace=home');
  assert.deepEqual(result.calls, ['signup-or-passwordless-code']);
});

test('root callback replaces conflicting workspace values and preserves unrelated URL state', async () => {
  const result = await redirect('/?workspace=general&workspace=other&keep=1#saved', { code: 'test-code' });
  assert.equal(result.location, 'https://workbench.test/?workspace=home&keep=1#saved');
});

function loadProxy(authenticated) {
  const exports = {};
  const source = readFileSync(new URL('../lib/supabase/proxy.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports, URL, process: { env: {} },
    require(name) {
      if (name === 'next/server') return nextServer;
      if (name === '@/lib/auth-destination') return destinationExports;
      if (name === '@supabase/ssr') return {
        createServerClient: () => ({ auth: { getClaims: async () => ({ data: authenticated ? { claims: {} } : null }) } }),
      };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports.updateSession;
}

test('Home signal does not bypass authentication for direct access', async () => {
  const response = await loadProxy(false)(new nextServer.NextRequest('https://workbench.test/?workspace=home'));
  const destination = new URL(response.headers.get('location'));
  assert.equal(destination.origin, 'https://workbench.test');
  assert.equal(destination.pathname, '/login');
  assert.equal(destination.searchParams.get('next'), '/');
});

const defaults = [undefined, '', '/', 'https://workbench.test', 'https://workbench.test/'];
const unsafe = ['https://external.test', '//external.test', '%2f%2fexternal.test', '/%2fexternal.test',
  '%68ttps%3a%2f%2fexternal.test', '/%252f%252fexternal.test', '/%5cexternal.test', '/bad%zz',
  'https://user:password@workbench.test/', '/a%0db', '/a/..//external.test'];
const meaningful = '/update-password?mode=recovery#form';
const cases = [...defaults, ...unsafe].map(next => [next, '/?workspace=home']);
cases.push([meaningful, meaningful], ['/?workspace=general&workspace=home&keep=1#saved', '/?workspace=home&keep=1#saved']);
for (const [next, expected] of cases) {
  test(`callback and authenticated login/signup proxy normalize ${JSON.stringify(next)}`, async () => {
    assert.equal((await redirect(next, { code: 'confirmation-code' })).location, `https://workbench.test${expected}`);
    for (const path of ['/login', '/signup']) {
      const url = new URL(path, 'https://workbench.test');
      if (next !== undefined) url.searchParams.set('next', next);
      url.searchParams.set('unrelatedLoginParameter', 'not-forwarded');
      const response = await loadProxy(true)(new nextServer.NextRequest(url));
      assert.equal(response.headers.get('location'), `https://workbench.test${expected}`);
    }
  });
}

test('authenticated root refresh is not redirected or given a fresh-login signal', async () => {
  const response = await loadProxy(true)(new nextServer.NextRequest('https://workbench.test/'));
  assert.equal(response.headers.get('location'), null);
});

test('unauthorized entry followed by a fresh authenticated login preserves the Home signal', async () => {
  const unauthorized = await loadProxy(false)(new nextServer.NextRequest('https://workbench.test/'));
  const loginUrl = unauthorized.headers.get('location');
  assert.equal(loginUrl, 'https://workbench.test/login?next=%2F');
  // The proxy can observe the new session before the password form navigates.
  const authenticated = await loadProxy(true)(new nextServer.NextRequest(loginUrl));
  const homeUrl = authenticated.headers.get('location');
  assert.equal(homeUrl, 'https://workbench.test/?workspace=home');
  const home = await loadProxy(true)(new nextServer.NextRequest(homeUrl));
  assert.equal(home.headers.get('location'), null, 'Home signal reaches the workspace unchanged');
});
