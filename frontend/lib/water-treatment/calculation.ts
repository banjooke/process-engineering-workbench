import { calculateBasis, calculateWater, calculateStatistics, checkCompliance, checkProjectLimits, standards } from "./adapter";
import { basisInput, waterInput, predictedInput, mapNumbers, type Draft } from "./input";
import type { BasisResult, WaterResult, ComplianceResult, Statistics, Standard } from "./types";
export type Run = { kind: Draft["kind"]; basis?: BasisResult; water?: WaterResult; statistics: Statistics; compliance: ComplianceResult; input: Draft };
export const CALCULATION_NOTE = "SI units. Domestic peaking applies to domestic flow; industrial flow uses its independent factor and infiltration is unpeaked. Positive average-flow overrides replace the component model. Daily loads use average flow and entered concentrations; peak loads use separate load factors. PE uses 60 g BOD5/person/day. Percentiles use linear interpolation; standard deviation is the sample statistic. Water capacity includes losses, process water and operating hours. No treatment removal is predicted. Unmeasured inputs are assumptions. Confirm sources, permits and applicability independently.";
export function selectedStandard(draft: Draft): Standard {
  const id = draft.standardIds[draft.kind];
  if (id !== "custom") {
    if (!Object.hasOwn(standards[draft.kind], id)) throw new Error("Select a supported reference.");
    return standards[draft.kind][id];
  }
  const limits: Standard["limits"] = {};
  for (const [key, value] of Object.entries(draft.projectCriteria?.limits ?? {})) {
    if (!Object.hasOwn(standards.labels, key)) throw new Error("Choose a supported parameter.");
    const parsed = mapNumbers(["min", "max"].map(k => ({ key: k, label: `${key} ${k}`, unit: "", initial: "", optional: true })), value);
    if (Object.keys(parsed).length) limits[key] = parsed as { min?: number; max?: number };
  }
  return { name: draft.projectCriteria?.name.trim() || "Custom project limits", version: "User-supplied project criteria", checked: "Not independently verified", status: "user supplied", limits, note: `Jurisdiction: ${draft.projectCriteria?.jurisdiction || "Not specified"}. User-entered criteria, not regulatory approval.` };
}
export function calculateDraft(draft: Draft): Run {
  const standard = selectedStandard(draft);
  const predicted = predictedInput(draft, Object.keys(standard.limits));
  return { kind: draft.kind, ...(draft.kind === "effluent" ? { basis: calculateBasis(basisInput(draft)) } : { water: calculateWater(waterInput(draft)) }), statistics: calculateStatistics(draft.data), compliance: draft.standardIds[draft.kind] === "custom" ? checkProjectLimits(predicted, standard) : checkCompliance(predicted, draft.kind, draft.standardIds[draft.kind]), input: structuredClone(draft) };
}
