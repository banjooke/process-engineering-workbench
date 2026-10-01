import { initialDraft, validateDraft, buildValveRequest, type Draft, type ValveResult } from "@/lib/control-valve";
import { isValveScenario, type ScenarioRecord, type ScenarioPayload } from "@/lib/projects";

export const VALVE_TASK = "control_valve_sizing";
export const SCENARIO_VERSION = "control-valve-scenario/1";
export const CALCULATION_VERSION = "control-valve-liquid/1";
export type ValveSession = { draft: Draft; result: ValveResult | null; calculatedAt: string | null; calculatedInputs: string | null; staleReason: string | null };
export const newValveSession = (): ValveSession => ({ draft: initialDraft(), result: null, calculatedAt: null, calculatedInputs: null, staleReason: "Calculate to review preliminary results." });
export function inputSignature(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(inputSignature).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${inputSignature(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const positive = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0;
function isDraft(value: unknown): value is Draft {
  if (!record(value) || typeof value.fluid !== "string" || typeof value.margin !== "string" || !["Cv", "Kv", "both"].includes(String(value.display)) || !record(value.cases) || !value.cases.normal) return false;
  return Object.entries(value.cases).every(([id, c]) => ["minimum", "normal", "maximum"].includes(id) && record(c) &&
    ["flow", "upstream", "downstream", "atmosphere", "temperature", "diameter"].every(key => typeof c[key] === "string") &&
    ["m³/h", "m³/s", "L/s", "L/min", "US gpm"].includes(String(c.flowUnit)) &&
    ["Pa", "kPa", "bar", "psi"].includes(String(c.pressureUnit)) && ["absolute", "gauge"].includes(String(c.pressureBasis)) && ["C", "F", "K"].includes(String(c.temperatureUnit)));
}
const strings = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === "string");
const warnings = (value: unknown) => Array.isArray(value) && value.every(item => record(item) && typeof item.code === "string" && typeof item.message === "string");
export function completeValveResult(value: unknown, draft: Draft): value is ValveResult {
  if (!record(value) || value.schema_version !== CALCULATION_VERSION || value.verification_status !== "prototype_correlated" || value.final_selection_allowed !== false || value.assessment_status !== "incomplete" ||
    !["Cv", "Kv", "both"].includes(String(value.display_basis)) || !positive(value.maximum_required_cv) || !positive(value.maximum_required_kv) ||
    !positive(value.target_rated_cv) || !positive(value.target_rated_kv) || !Number.isFinite(value.rating_margin) ||
    typeof value.vendor_confirmation !== "string" || typeof value.standard_limitation !== "string" || !warnings(value.warnings) || !Array.isArray(value.cases)) return false;
  const ids = Object.keys(draft.cases).sort();
  if (!ids.includes(String(value.governing_case)) || value.cases.length !== ids.length || inputSignature(value.cases.map(c => c?.case_id).sort()) !== inputSignature(ids)) return false;
  return value.cases.every(c => record(c) && positive(c.required_cv) && positive(c.required_kv) && record(c.normalized) &&
    ["flow_m3_s", "upstream_pressure_pa_abs", "downstream_pressure_pa_abs", "differential_pressure_pa", "temperature_k"].every(key => positive(c.normalized && (c.normalized as Record<string, unknown>)[key])) &&
    record(c.resolved_fluid_config) && positive(c.resolved_fluid_config.density_kg_m3) && positive(c.resolved_fluid_config.dynamic_viscosity_pa_s) &&
    c.resolved_fluid_config.fluid === draft.fluid && c.resolved_fluid_config.use_manual_properties === true && record(c.resolved_fluid_config.provenance) &&
    typeof c.resolved_fluid_config.provenance.source === "string" && typeof c.resolved_fluid_config.provenance.provider_fluid_id === "string" &&
    positive(c.resolved_fluid_config.provenance.evaluation_pressure_pa_abs) && positive(c.resolved_fluid_config.provenance.evaluation_temperature_k) &&
    record(c.pipe_reynolds_screening) && typeof c.pipe_reynolds_screening.label === "string" && typeof c.pipe_reynolds_screening.policy === "string" &&
    typeof c.pipe_reynolds_screening.classification === "string" && (c.pipe_reynolds_screening.reynolds_number === null || positive(c.pipe_reynolds_screening.reynolds_number)) &&
    strings(c.assumptions) && strings(c.limitations) && strings(c.source_ids) && strings(c.equation_ids) && warnings(c.warnings));
}
export function editValveSession(session: ValveSession, draft: Draft): ValveSession {
  return { ...session, draft, result: null, calculatedInputs: null, calculatedAt: null, staleReason: "Inputs changed. Recalculate before using or saving results." };
}
export function calculatedValveSession(draft: Draft, result: ValveResult, now = new Date().toISOString()): ValveSession {
  if (!completeValveResult(result, draft)) throw new Error("The calculation response is incomplete. Recalculate before saving results.");
  return { draft, result, calculatedAt: now, calculatedInputs: inputSignature(draft), staleReason: null };
}
export function restoreValveSession(scenario: ScenarioRecord): ValveSession {
  if (!isValveScenario(scenario)) throw new Error("This scenario belongs to another engineering task.");
  const saved = scenario.fluid_config.control_valve;
  if (!record(saved) || !isDraft(saved.draft)) throw new Error("Saved valve inputs are incomplete or unsupported. The saved scenario has not been overwritten.");
  // Legacy mode fields are UI metadata, never engineering-engine arguments.
  const draft = { ...saved.draft } as Draft & Record<string, unknown>;
  const modes = [saved.sizing_mode, saved.sizingMode, draft.sizing_mode, draft.sizingMode,
    scenario.fluid_config.sizing_mode, scenario.fluid_config.sizingMode].filter(value => value !== undefined);
  delete draft.sizing_mode;
  delete draft.sizingMode;
  const direct = modes.every(value => ["direct", "direct_pressure", "direct_pressures"].includes(String(value)));

  const compatible = saved.schema_version === SCENARIO_VERSION && saved.calculation_version === CALCULATION_VERSION;
  const current = compatible && direct && saved.calculated_inputs === inputSignature(saved.draft) && typeof saved.calculated_at === "string" && Number.isFinite(Date.parse(saved.calculated_at)) && !Object.keys(validateDraft(draft)).length && completeValveResult(saved.result, draft);
  return { draft, result: current ? saved.result as ValveResult : null, calculatedAt: current ? saved.calculated_at as string : null,
    calculatedInputs: current ? inputSignature(draft) : null,
    staleReason: current ? null : compatible ? "Saved result is missing, incomplete or out of date. Recalculate." : "Saved schema or calculation version differs. Recalculate before using results." };
}
export function valveScenarioPayload(name: string, description: string, session: ValveSession): ScenarioPayload {
  if (!name.trim()) throw new Error("Enter a scenario name before saving.");
  const valid = !Object.keys(validateDraft(session.draft)).length;
  const ready = valid && session.calculatedInputs === inputSignature(session.draft) && session.calculatedAt && completeValveResult(session.result, session.draft);
  const flow = Number(session.draft.cases.normal.flow);
  return { name: name.trim(), description: description.trim() || null, calculation_intent: VALVE_TASK,
    flow_value: Number.isFinite(flow) && flow > 0 ? flow : 0, flow_unit: session.draft.cases.normal.flowUnit,
    inlet_pressure_bar_a: null, property_reference_pressure_bar_a: null, elements: [],
    fluid_config: { engineering_task: VALVE_TASK, fluid: session.draft.fluid, use_manual_properties: false, phase_type: "Liquid",
      control_valve: { sizing_mode: "direct_pressure", schema_version: SCENARIO_VERSION, calculation_version: CALCULATION_VERSION, draft: session.draft,
        request: valid ? buildValveRequest(session.draft) : null, result: ready ? session.result : null,
        calculated_inputs: ready ? session.calculatedInputs : null, calculated_at: ready ? session.calculatedAt : null,
        result_status: ready ? "current" : "recalculate" } } };
}
