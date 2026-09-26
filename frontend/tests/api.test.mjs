import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

function compile(path) {
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
}
function harness(fetcher, tokens = ['token']) {
  const exports = {};
  const calls = [];
  const timers = new Map();
  let now = 0, timerId = 0, sessionCalls = 0;
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  vm.runInNewContext(compile('../lib/api.ts'), {
    exports, Headers, AbortController, Error, URL,
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, time: now + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch: async (url, options) => { calls.push({ url, options }); return fetcher(url, options, calls.length); },
    require(name) {
      assert.equal(name, '@/lib/supabase/client');
      return { createClient: () => ({ auth: { getSession: async () => ({
        data: { session: { access_token: tokens[Math.min(sessionCalls++, tokens.length - 1)] } }, error: null,
      }) } }) };
    },
  });
  async function advance(ms) {
    const end = now + ms;
    await flush();
    while (true) {
      const next = [...timers].filter(([, t]) => t.time <= end).sort((a, b) => a[1].time - b[1].time)[0];
      if (!next) break;
      now = next[1].time;
      timers.delete(next[0]);
      next[1].fn();
      await flush();
    }
    now = end;
    await flush();
  }
  function render() {
    const component = {};
    vm.runInNewContext(compile('../components/EngineeringServiceStatus.tsx'), {
      exports: component,
      require(name) {
        if (name === 'react') return { ...React, useSyncExternalStore: (_subscribe, get) => get() };
        if (name === 'react/jsx-runtime') return jsx;
        if (name === '@/lib/api') return exports;
        throw new Error(name);
      },
    });
    return renderToStaticMarkup(React.createElement(component.default, { onRetryLoads() {} }));
  }
  return { api: exports, calls, timers, advance, flush, render };
}
const ok = () => new Response('{}', { headers: { 'content-type': 'application/json' } });
const offline = () => { throw new TypeError('Failed to fetch'); };

test('safe GET retries then succeeds, preserving and refreshing authorization and custom headers', async () => {
  const h = harness((_url, _options, n) => n === 1 ? offline() : ok(), ['first-token', 'refreshed-token']);
  const request = h.api.apiFetch('/projects', { headers: { 'X-Request': 'preserved' } });
  await h.flush();
  assert.match(h.render(), /The engineering service is waking up/);
  assert.match(h.render(), /role="status"/);
  assert.equal(h.calls.length, 1);
  await h.advance(5000);
  assert.equal((await request).status, 200);
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[0].options.headers.get('authorization'), 'Bearer first-token');
  assert.equal(h.calls[1].options.headers.get('authorization'), 'Bearer refreshed-token');
  for (const call of h.calls) assert.equal(call.options.headers.get('x-request'), 'preserved');
  assert.equal(h.render(), '');
  assert.equal(h.timers.size, 0);
});

test('GET retry exhaustion is bounded and offers deliberate loading recovery', async () => {
  const h = harness(offline);
  const rejection = assert.rejects(h.api.apiFetch('/projects'), /still unreachable/);
  await h.advance(65000);
  await rejection;
  assert.equal(h.calls.length, 5);
  assert.match(h.render(), /Retry loading data/);
  assert.doesNotMatch(h.render(), /waking up/);
  await h.advance(100000);
  assert.equal(h.calls.length, 5);
  assert.equal(h.timers.size, 0);
});

for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
  test(`${method} network failure is never automatically retried`, async () => {
    const h = harness(offline);
    await assert.rejects(h.api.apiFetch('/projects', { method }), /may have completed/);
    await h.advance(100000);
    assert.equal(h.calls.length, 1);
    assert.match(h.render(), /not automatically retried/);
    assert.doesNotMatch(h.render(), /Retry loading data/);
  });
}

test('slow first request shows waking state before it fails, then clears on success', async () => {
  let finish;
  const h = harness(() => new Promise(resolve => { finish = resolve; }));
  const request = h.api.apiFetch('/piping/catalog');
  await h.advance(3000);
  assert.match(h.render(), /This may take up to one minute/);
  finish(ok());
  await request;
  assert.equal(h.render(), '');
});

test('hung GET attempts time out and stop after 95 seconds', async () => {
  const h = harness((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  const rejection = assert.rejects(h.api.apiFetch('/fluids'), /still unreachable/);
  await h.advance(95000);
  await rejection;
  assert.equal(h.calls.length, 5);
  assert.equal(h.timers.size, 0);
});

for (const status of [401, 403, 422, 500, 503]) {
  test(`structured HTTP ${status} is not retried or mislabeled as waking`, async () => {
    const h = harness(() => new Response('{"detail":"Specific API error"}', {
      status, headers: { 'content-type': 'application/json' },
    }));
    const response = await h.api.apiFetch('/projects');
    assert.equal(response.status, status);
    assert.equal((await response.json()).detail, 'Specific API error');
    assert.equal(h.calls.length, 1);
    assert.equal(h.api.getServiceStatus()[0].kind, status < 404 ? 'authentication' : 'api');
    assert.doesNotMatch(h.render(), /waking up/);
  });
}

for (const status of [502, 503, 504]) {
  test(`gateway ${status} GET retries; POST does not`, async () => {
    const h = harness((_url, _options, n) => n === 1 ? new Response('Gateway unavailable', { status }) : ok());
    const request = h.api.apiFetch('/fluids');
    await h.advance(5000);
    assert.equal((await request).status, 200);
    assert.equal(h.calls.length, 2);
    const mutation = harness(() => new Response('Gateway unavailable', { status }));
    await assert.rejects(mutation.api.apiFetch('/reports', { method: 'POST' }), /not automatically retried/);
    assert.equal(mutation.calls.length, 1);
  });
}

test('cancel during backoff stops retries and clears waking state', async () => {
  const h = harness(offline);
  const controller = new AbortController();
  const rejection = assert.rejects(h.api.apiFetch('/projects', { signal: controller.signal }));
  await h.flush();
  controller.abort();
  await rejection;
  await h.advance(100000);
  assert.equal(h.calls.length, 1);
  assert.equal(h.render(), '');
  assert.equal(h.timers.size, 0);
});

test('one concurrent success does not hide another pending or failed request', async () => {
  const h = harness(url => url === '/fluids' ? ok() : offline());
  const rejection = assert.rejects(h.api.apiFetch('/projects'), /unreachable/);
  await h.flush();
  await h.api.apiFetch('/fluids');
  assert.match(h.render(), /waking up/);
  await h.advance(65000);
  await rejection;
  await h.api.apiFetch('/fluids');
  assert.match(h.render(), /still unreachable/);
});

test('immediate gateway failures still allow recovery after a minute', async () => {
  const h = harness((_url, _options, n) => n < 5 ? new Response('Starting', { status: 503 }) : ok());
  const request = h.api.apiFetch('/piping/catalog');
  await h.advance(60000);
  assert.equal(h.calls.length, 4);
  assert.match(h.render(), /waking up/);
  await h.advance(5000);
  assert.equal((await request).status, 200);
  assert.equal(h.calls.length, 5);
});

test('a hanging mutation times out once and never replays', async () => {
  const h = harness((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  const rejection = assert.rejects(h.api.apiFetch('/reports', { method: 'POST' }), /may have completed/);
  await h.advance(90000);
  await rejection;
  assert.equal(h.calls.length, 1);
  assert.equal(h.timers.size, 0);
});

test('explicit Authorization is preserved when no session token is available', async () => {
  const h = harness((_url, _options, n) => n === 1 ? offline() : ok(), [undefined]);
  const request = h.api.apiFetch('/projects', { headers: { Authorization: 'Bearer provided' } });
  await h.advance(5000);
  await request;
  for (const call of h.calls) assert.equal(call.options.headers.get('authorization'), 'Bearer provided');
});

test('cancelling an active request does not retry or report backend failure', async () => {
  const h = harness((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  const controller = new AbortController();
  const rejection = assert.rejects(h.api.apiFetch('/fluids', { signal: controller.signal }));
  await h.advance(3000);
  controller.abort();
  await rejection;
  await h.advance(100000);
  assert.equal(h.calls.length, 1);
  assert.equal(h.render(), '');
});
