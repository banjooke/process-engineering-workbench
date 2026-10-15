import { apiFetch } from "@/lib/api";
import { readApiError } from "@/lib/api-error";
import { downloadBlob } from "@/lib/download";
import type { ScenarioRecord } from "@/lib/projects";
export type Comparison = { scenario_ids: number[]; names: string[]; metrics: { label: string; values: (string | number | null)[]; lowest: number | null; highest: number | null }[] };
async function post(base: string, path: string, body: object) {
  const response = await apiFetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(response.status >= 500 ? "The report or scenario service could not complete this action. Saved inputs are unchanged. Refresh before retrying a save or duplicate." : await readApiError(response, `Action failed (${response.status}).`));
  return response;
}
export async function duplicateWaterScenario(base: string, projectId: number, id: number): Promise<ScenarioRecord> {
  return (await post(base, `/projects/${projectId}/scenarios/${id}/water-treatment/duplicate`, {})).json();
}
export async function compareWaterScenarios(base: string, projectId: number, ids: number[]): Promise<Comparison> {
  return (await post(base, `/projects/${projectId}/water-treatment/compare`, { scenario_ids: ids })).json();
}
export async function downloadWaterReport(base: string, projectId: number, id: number, format: "pdf" | "docx", comparisonIds: number[] = []) {
  const response = await post(base, `/projects/${projectId}/water-treatment/reports/${format}`, { scenario_id: id, comparison_ids: comparisonIds });
  const received = response.headers.get("Content-Disposition")?.match(/filename="([A-Za-z0-9_.-]{1,130})"/)?.[1];
  downloadBlob(await response.blob(), received ?? `design-basis.${format}`);
}
