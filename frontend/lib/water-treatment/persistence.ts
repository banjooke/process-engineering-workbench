import { ENGINE_VERSION } from "./adapter";
import { calculateDraft, CALCULATION_NOTE, type Run } from "./calculation";
import { initialDraft, type Draft } from "./input";
import type { ScenarioPayload, ScenarioRecord } from "@/lib/projects";
export const WATER_TASK = "water_treatment";
export const WATER_SCHEMA = "water-treatment-scenario/1";
export type WaterSession = { draft: Draft; result: Run | null; calculatedAt: string | null; staleReason: string | null };
export const newWaterSession = (): WaterSession => ({ draft: initialDraft(), result: null, calculatedAt: null, staleReason: "Calculate and save before comparing or reporting." });
export function signature(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(signature).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${signature((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export const isWaterScenario = (row: { fluid_config: Record<string, unknown> }) => row.fluid_config.engineering_task === WATER_TASK;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
export function isWaterDraft(value: unknown): value is Draft {
  if (!record(value) || !["effluent", "drinking"].includes(String(value.kind)) || !["design", "proposal", "existing"].includes(String(value.mode)) || typeof value.data !== "string") return false;
  if (!["harmon", "qasim45", "babbitt", "log47", "manual"].includes(String(value.pfMethod)) || !["log48", "manual"].includes(String(value.minMethod))) return false;
  if (!["flows", "conc", "loads", "water", "predicted", "standardIds"].every(key => record(value[key]) && Object.values(value[key]).every(item => typeof item === "string"))) return false;
  return record(value.origin) && Object.values(value.origin).every(item => item === "measured" || item === "assumed") &&
    (!value.projectCriteria || record(value.projectCriteria) && typeof value.projectCriteria.name === "string" && typeof value.projectCriteria.jurisdiction === "string" && record(value.projectCriteria.limits) && Object.values(value.projectCriteria.limits).every(item => record(item) && typeof item.min === "string" && typeof item.max === "string"));
}
export function currentWaterResult(draft: Draft, result: unknown): result is Run {
  try { return !!result && signature(result) === signature(calculateDraft(draft)); } catch { return false; }
}
export function restoreWaterSession(row: ScenarioRecord): WaterSession {
  if (!isWaterScenario(row)) throw new Error("This scenario belongs to another engineering task.");
  const saved = row.fluid_config.water_treatment;
  if (!record(saved) || !isWaterDraft(saved.draft)) throw new Error("Saved inputs are unsupported. The original scenario has not been overwritten.");
  const compatible = saved.schema_version === WATER_SCHEMA && saved.engine_version === ENGINE_VERSION && saved.tool === "design_basis";
  const current = compatible && saved.result_status === "calculated" && saved.stale === false && saved.calculated_inputs === signature(saved.draft) && typeof saved.calculated_at === "string" && Number.isFinite(Date.parse(saved.calculated_at)) &&
    saved.calculation_note === CALCULATION_NOTE && currentWaterResult(saved.draft, saved.result) && signature(saved.checks) === signature(saved.result.basis?.checks ?? saved.result.water?.checks ?? []);
  return { draft: structuredClone(saved.draft), result: current ? saved.result as Run : null, calculatedAt: current ? saved.calculated_at as string : null, staleReason: current ? null : "Saved result is incomplete, stale or incompatible. Recalculate and save." };
}
export function waterScenarioPayload(name: string, description: string, session: WaterSession): ScenarioPayload {
  if (!name.trim()) throw new Error("Enter a scenario name.");
  if (!isWaterDraft(session.draft)) throw new Error("Unsupported input document.");
  const current = !session.staleReason && !!session.calculatedAt && Number.isFinite(Date.parse(session.calculatedAt)) && currentWaterResult(session.draft, session.result);
  if (session.result && !current) throw new Error("Results are incomplete or out of date. Recalculate before saving results.");
  const flow = current ? session.result?.basis?.flows.Qavg ?? session.result?.water?.avgProduction ?? 0 : 0;
  return { name: name.trim(), description: description.trim() || null, calculation_intent: WATER_TASK, flow_value: flow, flow_unit: "m³/d", inlet_pressure_bar_a: null, property_reference_pressure_bar_a: null, elements: [],
    fluid_config: { engineering_task: WATER_TASK, water_treatment: { schema_version: WATER_SCHEMA, engine_version: ENGINE_VERSION, tool: "design_basis", draft: session.draft,
      result: current ? session.result : null, checks: current ? session.result?.basis?.checks ?? session.result?.water?.checks : [], calculation_note: CALCULATION_NOTE,
      calculated_inputs: current ? signature(session.draft) : null, calculated_at: current ? session.calculatedAt : null, result_status: current ? "calculated" : "draft", stale: !current } } };
}
export const editWaterSession = (session: WaterSession, draft: Draft): WaterSession => ({ ...session, draft, result: null, calculatedAt: null, staleReason: "Inputs or criteria changed. Recalculate and save." });
export function comparisonRows(rows: ScenarioRecord[], projectId: number) {
  if (rows.length < 2 || rows.length > 5 || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error("Select two to five distinct calculated scenarios.");
  return rows.map(row => {
    if (row.project_id !== projectId) throw new Error("Comparison must use this project's scenarios.");
    const session = restoreWaterSession(row);
    if (!session.result) throw new Error("Comparison requires compatible calculated scenarios.");
    const r = session.result, f = r.basis?.flows, l = r.basis?.loads;
    return { id: row.id, name: row.name, values: {
      "Basis type": r.kind, "Population (people)": Number(r.kind === "effluent" ? session.draft.flows.population : session.draft.water.population),
      "Average flow (m³/d)": f?.Qavg ?? r.water?.avgProduction, "Minimum flow (m³/d)": f?.Qmin, "Peak flow (m³/d)": f?.Qpeak ?? r.water?.peakHour,
      "Domestic peak factor": f?.pf, "Domestic contribution (m³/d)": f?.Qdom ?? r.water?.domestic, "Industrial contribution (m³/d)": f?.Qind, "Infiltration (m³/d)": f?.Qinf,
      "BOD load (kg/d)": l?.BOD, "COD load (kg/d)": l?.COD, "TSS load (kg/d)": l?.TSS, "Nitrogen TKN load (kg/d)": l?.TKN, "Phosphorus TP load (kg/d)": l?.TP,
      "Population equivalent": r.basis?.PE, "Plant capacity (m³/d)": r.water?.plantCapacity,
      "Selected criterion": r.compliance.standard?.name, "Criterion screening": r.compliance.rows.map(item => `${item.label}: ${item.status}`).join("; "),
    } };
  });
}
