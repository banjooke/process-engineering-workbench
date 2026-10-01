import { apiFetch } from "@/lib/api";
import { readApiError } from "@/lib/api-error";

export const VENDOR_WARNING = "Prototype preliminary sizing based on publicly available manufacturer methodology. Confirm final sizing and valve selection with the valve manufacturer.";
export const STANDARD_WARNING = "Not verified against the complete IEC/ISA standard. Not for final design, procurement or safety-critical decisions.";
export type CaseId = "minimum" | "normal" | "maximum";
export type DisplayBasis = "Cv" | "Kv" | "both";
export type CaseDraft = {
  flow: string; flowUnit: "m³/h" | "m³/s" | "L/s" | "L/min" | "US gpm";
  upstream: string; downstream: string; pressureUnit: "bar" | "kPa" | "Pa" | "psi";
  pressureBasis: "absolute" | "gauge"; atmosphere: string;
  temperature: string; temperatureUnit: "C" | "F" | "K"; diameter: string;
};
export type Draft = { fluid: string; cases: Partial<Record<CaseId, CaseDraft>> & { normal: CaseDraft }; margin: string; display: DisplayBasis };
export const emptyCase = (): CaseDraft => ({ flow: "", flowUnit: "m³/h", upstream: "", downstream: "", pressureUnit: "bar", pressureBasis: "absolute", atmosphere: "", temperature: "20", temperatureUnit: "C", diameter: "" });
export const initialDraft = (): Draft => ({ fluid: "Water", cases: { normal: emptyCase() }, margin: "10", display: "both" });
export type FieldErrors = Record<string, string>;
const number = (value: string) => value.trim() === "" ? NaN : Number(value);

/** Input validation/transport only; all coefficient/property calculations stay in Python. */
export function validateDraft(draft: Draft): FieldErrors {
  const errors: FieldErrors = {};
  if (!draft.fluid.trim()) errors.fluid = "Select a fluid.";
  if (!Number.isFinite(number(draft.margin)) || number(draft.margin) < 0) errors.margin = "Enter a finite, non-negative margin.";
  for (const [id, c] of Object.entries(draft.cases)) {
    if (!c) continue;
    const add = (key: keyof CaseDraft, message: string) => { errors[`${id}.${key}`] = message; };
    if (!Number.isFinite(number(c.flow)) || number(c.flow) <= 0) add("flow", "Enter a positive volumetric flow.");
    const temperature = number(c.temperature);
    const lower = c.temperatureUnit === "K" ? 0 : c.temperatureUnit === "C" ? -273.15 : -459.67;
    if (!Number.isFinite(temperature) || temperature <= lower) add("temperature", "Enter a temperature above absolute zero.");
    const atmosphere = c.pressureBasis === "gauge" ? number(c.atmosphere) : 0;
    if (c.pressureBasis === "gauge" && (!Number.isFinite(atmosphere) || atmosphere <= 0)) add("atmosphere", "Enter positive atmospheric pressure in Pa.");
    // Unit normalization here validates positive absolute boundaries only, not sizing.
    const factor = { Pa: 1, kPa: 1000, bar: 100000, psi: 6894.757293168361 }[c.pressureUnit];
    for (const key of ["upstream", "downstream"] as const) {
      const pressure = number(c[key]);
      if (!Number.isFinite(pressure) || (Number.isFinite(atmosphere) && pressure * factor + atmosphere <= 0)) add(key, "Enter a pressure that is positive on an absolute basis.");
    }
    if (Number.isFinite(number(c.upstream)) && Number.isFinite(number(c.downstream)) && number(c.downstream) >= number(c.upstream)) add("downstream", "Downstream pressure must be below upstream pressure.");
    if (c.diameter.trim() && (!Number.isFinite(number(c.diameter)) || number(c.diameter) <= 0)) add("diameter", "Enter a positive internal diameter or leave blank.");
  }
  return errors;
}

export function buildValveRequest(draft: Draft) {
  if (Object.keys(validateDraft(draft)).length) throw new Error("Correct the highlighted fields before calculating.");
  return {
    schema_version: "control-valve-liquid/1", rating_margin: number(draft.margin) / 100, display_basis: draft.display,
    ...Object.fromEntries(Object.entries(draft.cases).filter(([, c]) => c).map(([id, c]) => [id, {
      case_id: id, enabled: true, flow_value: number(c!.flow), flow_unit: c!.flowUnit,
      upstream_pressure: number(c!.upstream), downstream_pressure: number(c!.downstream),
      pressure_unit: c!.pressureUnit, pressure_basis: c!.pressureBasis,
      ...(c!.pressureBasis === "gauge" ? { atmospheric_pressure_pa: number(c!.atmosphere) } : {}),
      temperature: number(c!.temperature), temperature_unit: c!.temperatureUnit,
      ...(c!.diameter.trim() ? { upstream_pipe_id_m: number(c!.diameter) / 1000 } : {}),
      fluid_config: { fluid: draft.fluid, phase_type: "Liquid", composition: "pure", rheology: "Newtonian", use_manual_properties: false },
    }])),
  };
}

export type CaseResult = {
  case_id: CaseId; required_cv: number; required_kv: number;
  normalized: { differential_pressure_pa: number; upstream_pressure_pa_abs: number; downstream_pressure_pa_abs: number; temperature_k: number; flow_m3_s: number };
  resolved_fluid_config: { density_kg_m3: number; dynamic_viscosity_pa_s: number | null; provenance: { source: string; origin: string; evaluation_pressure_pa_abs: number; evaluation_temperature_k: number } };
  pipe_reynolds_screening: { label: string; classification: string; reynolds_number: number | null; policy: string };
  assumptions: string[]; limitations: string[]; warnings: { code: string; message: string }[]; source_ids: string[]; equation_ids: string[];
};
export type ValveResult = {
  cases: CaseResult[]; governing_case: CaseId; maximum_required_cv: number; maximum_required_kv: number;
  target_rated_cv: number; target_rated_kv: number; rating_margin: number; display_basis: DisplayBasis;
  verification_status: string; final_selection_allowed: false; assessment_status: string;
  vendor_confirmation: string; standard_limitation: string; warnings: { code: string; message: string; case_id: CaseId }[];
};
export const formatEngineering = (value: number | null) => value === null ? "Unavailable" : new Intl.NumberFormat("en", { maximumSignificantDigits: 4 }).format(value);
export class ValveRequestError extends Error {
  constructor(public kind: "authentication" | "unreachable" | "validation" | "unsupported" | "server", message: string) { super(message); }
}
/** Resolve previews with the shared property API; sizing independently rechecks and freezes them. */
async function confirmLiquidStates(baseUrl: string, draft: Draft, signal: AbortSignal) {
  for (const [id, c] of Object.entries(draft.cases)) {
    if (!c) continue;
    const pressureFactor = { Pa: 1, kPa: 1000, bar: 100000, psi: 6894.757293168361 }[c.pressureUnit];
    const pressurePa = number(c.upstream) * pressureFactor + (c.pressureBasis === "gauge" ? number(c.atmosphere) : 0);
    const temperatureC = c.temperatureUnit === "K" ? number(c.temperature) - 273.15 : c.temperatureUnit === "F" ? (number(c.temperature) - 32) * 5 / 9 : number(c.temperature);
    const response = await apiFetch(`${baseUrl}/fluids/properties`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal,
      body: JSON.stringify({ fluid: draft.fluid, temperature_c: temperatureC, pressure_bar_a: pressurePa / 100000 }),
    });
    if (!response.ok) {
      const kind = [401, 403].includes(response.status) ? "authentication" : response.status < 500 ? "unsupported" : "server";
      throw new ValveRequestError(kind, await readApiError(response, `${id}: Fluid property resolution failed (${response.status}).`));
    }
    const properties = await response.json();
    if (properties.phase_type !== "Liquid" || !["liquid", "l"].includes(properties.phase_label) ||
        !(properties.density_kg_m3 > 0) || !(properties.dynamic_viscosity_pa_s > 0)) {
      throw new ValveRequestError("unsupported", `${id}: Only supported pure, single-phase Newtonian liquids can be sized. Gas, steam, mixtures and unconfirmed properties are unsupported at these upstream conditions.`);
    }
  }
}
export async function requestValve(baseUrl: string, draft: Draft, signal: AbortSignal): Promise<ValveResult> {
  let response: Response;
  try {
    const payload = buildValveRequest(draft);
    await confirmLiquidStates(baseUrl, draft, signal);
    signal.throwIfAborted();
    response = await apiFetch(`${baseUrl}/control-valves/liquid/size`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal });
  } catch (error) {
    if (signal.aborted || error instanceof ValveRequestError) throw error;
    const message = error instanceof Error ? error.message : "The service is unreachable. Please retry deliberately.";
    throw new ValveRequestError(/session|sign in/i.test(message) ? "authentication" : "unreachable", message);
  }
  if (!response.ok) {
    const message = await readApiError(response, `Calculation failed (${response.status}).`);
    const kind = [401, 403].includes(response.status) ? "authentication" : response.status === 422
      ? (/unsupported|extra inputs|literal_error|curated pure-fluid/i.test(message) ? "unsupported" : "validation") : "server";
    throw new ValveRequestError(kind, message);
  }
  return response.json();
}


/** Presentation only: raw responses/provenance remain unchanged for persistence. */
export function publicValveMessage(message: string): string {
  if (/CoolProp|\bthermo\b|_property_provider|_provider_fluid_id|PropsSI|HEOS|AbstractState/i.test(message)) {
    return "Automatic fluid properties could not be confirmed for this substance at the operating temperature and upstream pressure. Check the selected liquid and operating conditions.";
  }
  return message.replace("Existing hydraulics.classify_flow project policy:", "Pipe screening thresholds:");
}
