import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Frozen prototype sources are byte-pinned and exercised by water-treatment parity tests.
    "lib/water-treatment/ww-engine.cjs",
    "tests/fixtures/ww-validation.cjs",
  ]),
]);

export default eslintConfig;
