import type { BasisInput, WaterInput, Quality, StandardKind } from "./types";
export type Field = { key: string; label: string; unit: string; initial: string; optional?: boolean };
const field = (key: string, label: string, unit: string, initial: string, optional = false): Field => ({ key, label, unit, initial, optional });
export const flowFields = [
  field("population", "Population", "people", "151000"), field("perCapita", "Wastewater per capita", "L/c/d", "150"),
  field("industrialFlow", "Industrial flow", "m³/d", "0"), field("industrialPF", "Industrial peak factor", "×", "1"),
  field("industrialMinFactor", "Industrial minimum factor", "×", "1"), field("infiltration", "Infiltration / inflow (unpeaked)", "m³/d", "0"),
  field("avgFlowOverride", "Average flow override (blank = components)", "m³/d", "22700", true),
  field("pfManual", "Manual domestic peak factor", "×", "2.5"), field("maxDayFactor", "Domestic max day factor", "×", "1.5"),
  field("maxMonthFactor", "Domestic max month factor", "×", "1.25"), field("minFactorManual", "Manual domestic minimum factor", "×", "0.3"),
];
export const qualityFields = [
  field("BOD", "BOD5", "mg/L", "140", true), field("sBOD", "Soluble BOD5", "mg/L", "70", true),
  field("COD", "COD", "mg/L", "300", true), field("sCOD", "Soluble COD", "mg/L", "132", true),
  field("TSS", "TSS", "mg/L", "70", true), field("VSS", "VSS", "mg/L", "60", true),
  field("TKN", "TKN", "mg/L", "35", true), field("NH4N", "NH4-N", "mg/L", "25", true),
  field("TP", "Total P", "mg/L", "6", true), field("Alk", "Alkalinity as CaCO3", "mg/L", "140", true), field("FOG", "Oil & grease", "mg/L", "", true),
];
export const loadFields = [field("BOD", "BOD load peak / average", "×", "1.5"), field("TKN", "TKN load peak / average", "×", "1.5"), field("TSS", "TSS load peak / average", "×", "", true), field("TP", "TP load peak / average", "×", "", true)];
export const waterFields = [
  field("population", "Population served", "people", "50000"), field("perCapita", "Per-capita demand", "L/c/d", "120"),
  field("nonDomesticPct", "Non-domestic demand", "% domestic", "20"), field("lossesPct", "Non-revenue water losses", "%", "20"),
  field("maxDayFactor", "Maximum day factor", "× average", "1.5"), field("peakHourFactor", "Peak hour factor", "× max day", "1.5"),
  field("processWaterPct", "Process water", "%", "5"), field("operatingHours", "Plant operating hours", "h/d", "24"),
];
export type Draft = { kind: StandardKind; mode: "design" | "proposal" | "existing"; flows: Record<string, string>; conc: Record<string, string>; loads: Record<string, string>; water: Record<string, string>; origin: Record<string, "measured" | "assumed">; pfMethod: NonNullable<BasisInput["pfMethod"]>; minMethod: NonNullable<BasisInput["minMethod"]>; standardIds: Record<StandardKind, string>; predicted: Record<string, string>; data: string; projectCriteria?: { name: string; jurisdiction: string; limits: Record<string, { min: string; max: string }> } };
const initial = (fields: Field[]) => Object.fromEntries(fields.map(f => [f.key, f.initial]));
export function initialDraft(): Draft {
  return { kind: "effluent", mode: "design", flows: initial(flowFields), conc: initial(qualityFields), loads: initial(loadFields), water: initial(waterFields), origin: {}, pfMethod: "harmon", minMethod: "log48", standardIds: { effluent: "ZA_GN665_general", drinking: "NG_NIS554_2007" }, predicted: {}, data: "" };
}
export function mapNumbers(fields: Field[], values: Record<string, string>, keepBlank = false): Quality {
  const result: Quality = {};
  for (const f of fields) {
    const text = (values[f.key] ?? "").trim();
    if (!text) { if (!f.optional) throw new Error(`Enter ${f.label}.`); if (keepBlank) result[f.key] = ""; continue; }
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text) || !Number.isFinite(Number(text)) || Number(text) < 0) throw new Error(`Enter a finite, non-negative value for ${f.label}.`);
    result[f.key] = Number(text);
  }
  return result;
}
export function basisInput(draft: Draft): BasisInput {
  return { ...mapNumbers(flowFields, draft.flows), pfMethod: draft.pfMethod, minMethod: draft.minMethod, conc: mapNumbers(qualityFields, draft.conc, true), loadPF: mapNumbers(loadFields, draft.loads) as Record<string, number>, origin: draft.origin } as BasisInput;
}
export function waterInput(draft: Draft): WaterInput { return mapNumbers(waterFields, draft.water) as WaterInput; }
export function predictedInput(draft: Draft, keys: string[]): Quality {
  return mapNumbers(keys.map(key => field(key, key, "", "", true)), draft.predicted, true);
}
