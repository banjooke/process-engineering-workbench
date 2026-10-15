// Only this boundary imports the byte-for-byte validated engine. Forms depend on this API.
import engine from "./ww-engine.cjs";
import type { BasisInput, WaterInput, Quality, StandardKind, Standard, ComplianceResult } from "./types";
export const ENGINE_VERSION = `ww-engine/${engine.VERSION}`;
export const standards = engine.STANDARDS;
export const peakingMethods = engine.PF_METHODS;
export const summarise = engine.summarise;
function finiteInputs(values: Record<string, unknown>, allowBlank = false) {
  for (const value of Object.values(values)) {
    if (allowBlank && value === "") continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("Enter finite, non-negative numerical values.");
  }
}
function finiteResult(value: unknown): void {
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Inputs exceed the supported numerical range.");
  if (value && typeof value === "object") Object.values(value).forEach(finiteResult);
}
export function calculateBasis(input: BasisInput) {
  const { conc = {}, loadPF = {}, origin, pfMethod, minMethod, ...numbers } = input;
  if (origin && Object.values(origin).some(value => value !== "measured" && value !== "assumed")) throw new Error("Choose measured or assumed input provenance.");
  finiteInputs(numbers); finiteInputs(conc, true); finiteInputs(loadPF);
  if (pfMethod && ![...Object.keys(peakingMethods), "manual"].includes(pfMethod)) throw new Error("Choose a supported peaking method.");
  if (minMethod && !["log48", "manual"].includes(minMethod)) throw new Error("Choose a supported minimum-flow method.");
  const result = engine.designBasis(input);
  if (!(result.flows.Qavg > 0)) throw new Error("Enter a positive average flow or population and per-capita flow.");
  finiteResult(result);
  return result;
}
export function calculateWater(input: WaterInput) {
  finiteInputs(input);
  if (!(input.population && input.population > 0) || !(input.perCapita === undefined || input.perCapita > 0) || !(input.operatingHours === undefined || input.operatingHours > 0 && input.operatingHours <= 24)) throw new Error("Enter positive population and demand, and operating hours above zero and at most 24.");
  if ((input.lossesPct ?? 0) > 90) throw new Error("Losses must be between zero and 90 percent.");
  const result = engine.waterDemand(input);
  finiteResult(result);
  return result;
}
export function calculateStatistics(text: string) {
  const tokens = text.trim() ? text.trim().split(/[\s,;]+/) : [];
  const values = tokens.map(Number);
  finiteInputs(Object.fromEntries(values.map((value, index) => [index, value])));
  const result = engine.stats(values);
  finiteResult(result);
  return result;
}
export function checkCompliance(values: Quality, kind: StandardKind, id: string) {
  finiteInputs(values, true);
  if (!Object.hasOwn(standards[kind], id)) throw new Error("Choose a supported standard.");
  return engine.compliance(values, kind, id);
}
/** Custom criteria use the engine's existing range-check function; catalogue is never mutated. */
export function checkProjectLimits(values: Quality, standard: Standard): ComplianceResult {
  finiteInputs(values, true);
  if (!Object.keys(standard.limits).length) throw new Error("Enter at least one custom project limit.");
  const rows = Object.entries(standard.limits).map(([param, limit]) => {
    const range: [number | null, number | null] = typeof limit === "number" ? [null, limit] : [limit.min ?? null, limit.max ?? null];
    finiteInputs(Object.fromEntries(range.filter(value => value !== null).map((value, i) => [i, value])));
    if (range[0] !== null && range[1] !== null && range[0] > range[1]) throw new Error("Custom minimum exceeds maximum.");
    const value = values[param] === "" || values[param] == null ? null : Number(values[param]);
    return { param, label: standards.labels[param] ?? param, limit, value, status: engine.check(param, value, "", range, "User-entered project criteria", { hard: true }).status };
  });
  return { standard, rows };
}
