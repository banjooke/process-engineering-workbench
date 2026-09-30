import { apiFetch } from "@/lib/api";
import { readApiError } from "@/lib/api-error";

export type ProjectSummary = { id: number; name: string; description: string | null; created_at: string; updated_at: string };
export type ScenarioRecord<Element = Record<string, unknown>> = {
  id: number; project_id: number; name: string; description: string | null;
  calculation_intent: "pressure_drop" | "outlet_pressure" | "pressure_profile" | "control_valve_sizing";
  flow_value: number; flow_unit: string; inlet_pressure_bar_a: number | null;
  property_reference_pressure_bar_a: number | null; fluid_config: Record<string, unknown>;
  elements: Element[]; created_at: string; updated_at: string;
};
export type ScenarioPayload = Omit<ScenarioRecord, "id" | "project_id" | "created_at" | "updated_at">;
export class ProjectApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
async function request<T>(base: string, path: string, action: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await apiFetch(`${base}${path}`, { method, signal,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  if (!response.ok) throw new ProjectApiError(response.status, await readApiError(response, `${action} failed (${response.status}).`));
  const data = await response.json();
  signal?.throwIfAborted();
  return data;
}
export const listProjects = (base: string, signal?: AbortSignal) => request<ProjectSummary[]>(base, "/projects", "Loading projects", "GET", undefined, signal);
export const createProjectRecord = (base: string, name: string, description: string | null) => request<ProjectSummary>(base, "/projects", "Project creation", "POST", { name, description });
export const openProjectRecord = (base: string, id: number) => request<ProjectSummary>(base, `/projects/${id}`, "Opening project");
export const listScenarioRecords = <Element = Record<string, unknown>>(base: string, id: number, signal?: AbortSignal) => request<ScenarioRecord<Element>[]>(base, `/projects/${id}/scenarios`, "Loading scenarios", "GET", undefined, signal);
export const openScenarioRecord = (base: string, project: number, id: number) => request<ScenarioRecord>(base, `/projects/${project}/scenarios/${id}`, "Opening scenario");
export const saveScenarioRecord = (base: string, project: number, payload: ScenarioPayload, id?: number) => request<ScenarioRecord>(base, `/projects/${project}/scenarios${id === undefined ? "" : `/${id}`}`, "Scenario save", id === undefined ? "POST" : "PUT", payload);
export const deleteScenarioRecord = (base: string, project: number, id: number) => request(base, `/projects/${project}/scenarios/${id}`, "Scenario deletion", "DELETE");
export const confirmScenarioDeletion = (name: string) => window.confirm(`Delete scenario "${name}"? This removes only this design case and cannot be undone.`);
export const isValveScenario = (row: { fluid_config: Record<string, unknown> }) => row.fluid_config.engineering_task === "control_valve_sizing";
