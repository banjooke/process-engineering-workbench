import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
export function waterLoader(overrides = {}, globals = {}) {
  const cache = new Map();
  function load(relative) {
    const path = resolve(root, relative);
    if (cache.has(path)) return cache.get(path);
    const exports = {}; cache.set(path, exports);
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { exports, structuredClone, Date, URL, AbortController, Error, Blob, setTimeout, clearTimeout, ...globals, require: id => {
      if (id in overrides) return overrides[id];
      if (id.endsWith('.cjs')) return require(resolve(dirname(path), id));
      if (id.startsWith('@/')) return load(id.slice(2) + (id.startsWith('@/components/') ? '.tsx' : '.ts'));
      if (id.startsWith('.')) return load(resolve(dirname(path), `${id}.ts`));
      return require(id);
    } });
    return exports;
  }
  return load;
}
export const plain = value => JSON.parse(JSON.stringify(value));
