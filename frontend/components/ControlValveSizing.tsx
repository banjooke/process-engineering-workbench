"use client";

import { loadFluidCatalogue, liquidEligibilityError, type FluidCatalogueItem } from "@/lib/fluid-catalogue";
import { useEffect, useRef, useState } from "react";
import {
  CaseDraft, CaseId, DisplayBasis, Draft, FieldErrors, ValveResult, ValveRequestError,
  STANDARD_WARNING, VENDOR_WARNING, emptyCase, formatEngineering as fmt, initialDraft,
  requestValve, validateDraft, publicValveMessage,
} from "@/lib/control-valve";

const inputClass = "mt-1 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-700";
const buttonClass = "rounded-lg border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50";
const order: CaseId[] = ["minimum", "normal", "maximum"];
const name = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

type Props = { apiBaseUrl: string; fluids: FluidCatalogueItem[]; catalogueError?: string | null; catalogueLoading?: boolean; onRetryFluids: () => void;
  initialValues?: Draft; initialResult?: ValveResult | null; view?: "inputs" | "results";
  onEdit?: (draft: Draft) => void; onCalculated?: (draft: Draft, result: ValveResult) => void; onPendingChange?: (pending: boolean) => void;
};

export function ValveResults({ result }: { result: ValveResult }) {
  const showCv = result.display_basis !== "Kv", showKv = result.display_basis !== "Cv";
  return <section aria-label="Sizing results" className="space-y-5 rounded-2xl border border-gray-300 bg-white p-4 sm:p-6">
    <h3 className="text-xl font-bold">Preliminary sizing results</h3>
    <p>Governing case: <strong>{name(result.governing_case)}</strong></p>
    <dl className="grid gap-4 sm:grid-cols-2">
      {showCv && <><div><dt>Required Cv</dt><dd className="text-2xl font-bold text-teal-900">{fmt(result.maximum_required_cv)}</dd></div><div><dt>Preliminary target rated Cv</dt><dd className="text-2xl font-bold">{fmt(result.target_rated_cv)}</dd></div></>}
      {showKv && <><div><dt>Required Kv</dt><dd className="text-2xl font-bold text-teal-900">{fmt(result.maximum_required_kv)}</dd></div><div><dt>Preliminary target rated Kv</dt><dd className="text-2xl font-bold">{fmt(result.target_rated_kv)}</dd></div></>}
    </dl>
    <p>Target rating includes {fmt(result.rating_margin * 100)}% margin. Selected valve coefficient: not supported.</p>
    <p className="font-semibold">Final valve selection: blocked — manufacturer confirmation required.</p>
    <p className="text-sm">Verification: {result.verification_status}. Assessments: {result.assessment_status}. Choking, cavitation and flashing have not been fully assessed.</p>
    <table className="w-full table-fixed border-collapse text-left text-xs sm:text-sm">
      <caption className="mb-2 text-left font-semibold">Operating-case comparison</caption>
      <thead><tr>{["Case", "Valve ΔP (Pa)", ...(showCv ? ["Required Cv"] : []), ...(showKv ? ["Required Kv"] : []), "Pipe screening"].map(label => <th key={label} className="break-words border-b p-1 sm:p-2">{label}</th>)}</tr></thead>
      <tbody>{result.cases.map(c => <tr key={c.case_id}>
        <th scope="row" className="break-words border-b p-1 sm:p-2">{name(c.case_id)}</th>
        <td className="break-all border-b p-1 sm:p-2">{fmt(c.normalized.differential_pressure_pa)}</td>
        {showCv && <td className="break-all border-b p-1 sm:p-2">{fmt(c.required_cv)}</td>}
        {showKv && <td className="break-all border-b p-1 sm:p-2">{fmt(c.required_kv)}</td>}
        <td className="break-words border-b p-1 sm:p-2">{c.pipe_reynolds_screening.classification}</td>
      </tr>)}</tbody>
    </table>
    {result.cases.map(c => <div key={c.case_id} className="space-y-2 rounded-xl bg-gray-50 p-4 text-sm">
      <h4 className="font-bold">{name(c.case_id)} — fluid properties and screening</h4>
      <p>Properties calculated automatically. Evaluated at the operating temperature and upstream pressure: {fmt(c.resolved_fluid_config.provenance.evaluation_pressure_pa_abs)} Pa absolute and {fmt(c.resolved_fluid_config.provenance.evaluation_temperature_k)} K.</p>
      <p>Density: {fmt(c.resolved_fluid_config.density_kg_m3)} kg/m³. Dynamic viscosity: {fmt(c.resolved_fluid_config.dynamic_viscosity_pa_s)} Pa·s.</p>
      <p>{c.pipe_reynolds_screening.label}: {fmt(c.pipe_reynolds_screening.reynolds_number)} — {c.pipe_reynolds_screening.classification}. {publicValveMessage(c.pipe_reynolds_screening.policy)}</p>
      {["Laminar", "Transitional"].includes(c.pipe_reynolds_screening.classification) && <p role="alert" className="rounded border border-amber-500 bg-amber-50 p-3 font-bold">Warning: possible viscous service. No viscosity correction has been applied. Do not use this preliminary value for final valve selection.</p>}
      <details><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-teal-700">Assumptions and limitations — {name(c.case_id)}</summary>
        <ul className="ml-5 list-disc">{[...new Set([...c.assumptions, ...c.limitations])].map(text => <li key={text}>{publicValveMessage(text)}</li>)}</ul>
        <p>References: {c.source_ids.join(", ")}. Equations: {c.equation_ids.join(", ")}.</p>
      </details>
    </div>)}
    <aside className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm text-amber-950" aria-label="Calculation warnings">
      <h4 className="font-bold">Warnings — review before using these preliminary results</h4>
      <p>{publicValveMessage(result.vendor_confirmation)}</p><p>{publicValveMessage(result.standard_limitation)}</p>
      <ul className="ml-5 mt-2 list-disc">{result.warnings.map((warning, i) => <li key={`${warning.case_id}-${warning.code}-${i}`}>{name(warning.case_id)}: {publicValveMessage(warning.message)}</li>)}</ul>
    </aside>
  </section>;
}

function CaseFields({ id, value, errors, onChange, onRemove }: { id: CaseId; value: CaseDraft; errors: FieldErrors; onChange: (key: keyof CaseDraft, value: string) => void; onRemove?: () => void }) {
  function field(key: keyof CaseDraft, label: string, options?: string[]) {
    const fieldId = `valve-${id}-${key}`, error = errors[`${id}.${key}`];
    const common = { id: fieldId, value: value[key], className: inputClass, "aria-invalid": !!error, "aria-describedby": error ? `${fieldId}-error` : undefined, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange(key, event.target.value) };
    return <div key={key}><label htmlFor={fieldId} className="text-sm font-medium">{label}</label>
      {options ? <select {...common}>{options.map(option => <option key={option} value={option}>{option}</option>)}</select> : <input {...common} type="number" step="any" />}
      {error && <p id={`${fieldId}-error`} className="mt-1 text-sm text-red-800">{error}</p>}
    </div>;
  }
  return <fieldset className="rounded-xl border border-gray-300 p-4">
    <legend className="px-2 font-bold">{name(id)} operating case</legend>
    {onRemove && <button type="button" onClick={onRemove} className={`${buttonClass} mb-4`}>Remove {id} case</button>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {field("flow", "Volumetric flow")}{field("flowUnit", "Flow unit", ["m³/h", "m³/s", "L/s", "L/min", "US gpm"])}
      {field("temperature", "Temperature")}{field("temperatureUnit", "Temperature unit", ["C", "F", "K"])}
      {field("upstream", "Upstream pressure")}{field("downstream", "Downstream pressure")}
      {field("pressureUnit", "Pressure unit (both pressures)", ["bar", "kPa", "Pa", "psi"])}
      {field("pressureBasis", "Pressure basis", ["absolute", "gauge"])}
      {value.pressureBasis === "gauge" && field("atmosphere", "Atmospheric pressure (Pa absolute)")}
      {field("diameter", "Upstream pipe internal diameter (mm, optional)")}
    </div>
  </fieldset>;
}

export default function ControlValveSizing({ apiBaseUrl, fluids, catalogueError, catalogueLoading, onRetryFluids, initialValues, initialResult, view, onEdit, onCalculated, onPendingChange }: Props) {
  const [draft, setDraft] = useState<Draft>(() => initialValues ?? initialDraft());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<ValveResult | null>(initialResult ?? null);
  const [error, setError] = useState<ValveRequestError | null>(null);
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState(() => initialValues && !fluids.some(fluid => fluid.id === initialValues.fluid) ? initialValues.fluid : "");
  const [searchResults, setSearchResults] = useState<FluidCatalogueItem[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const options = query.trim() ? searchResults : fluids;
  const eligibilityError = liquidEligibilityError(options.find(fluid => fluid.id === draft.fluid));
  const groups = [...new Set(options.map(fluid => fluid.category ?? "Other Chemicals"))];
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!query.trim()) return;
    const request = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const rows = await loadFluidCatalogue(apiBaseUrl, request.signal, query.trim());
        if (!request.signal.aborted) { setSearchResults(rows); setSearchError(null); }
      } catch (failure) {
        if (!request.signal.aborted) setSearchError(failure instanceof Error ? failure.message : "Fluid search failed. Please retry.");
      } finally {
        if (!request.signal.aborted) setSearchLoading(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); request.abort(); };
  }, [apiBaseUrl, query]);
  function edit(next: Draft) { onEdit?.(next); setDraft(next); setResult(null); setError(null); setErrors({}); }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    const invalid = validateDraft(draft);
    if (eligibilityError) invalid.fluid = eligibilityError;
    setErrors(invalid); setError(null); setResult(null);
    if (Object.keys(invalid).length) return;
    busy.current = true; setPending(true); onPendingChange?.(true);
    const request = new AbortController(); controller.current = request;
    try { const response = await requestValve(apiBaseUrl, draft, request.signal); if (!request.signal.aborted) { onCalculated?.(draft, response); setResult(response); } }
    catch (failure) { if (!request.signal.aborted) setError(failure instanceof ValveRequestError ? failure : new ValveRequestError("server", "Unexpected response. Please retry the calculation deliberately.")); }
    finally { busy.current = false; if (!request.signal.aborted) { setPending(false); onPendingChange?.(false); } }
  }
  const titles = { authentication: "Sign-in required", unreachable: "Engineering service unavailable", validation: "Check the calculation inputs", unsupported: "Unsupported prototype capability", server: "Engineering service error" };
  return <section aria-label="Control Valve Sizing" className="mx-auto max-w-5xl space-y-6 text-gray-900">
    <div><p className="text-xs font-bold uppercase tracking-widest text-teal-700">Liquid prototype</p><h2 className="mt-2 text-3xl font-bold">Control Valve Sizing</h2><p className="mt-2 text-gray-600">Estimate a preliminary capacity coefficient from flow and the pressures directly across your valve.</p></div>
    <aside className="space-y-2 rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">{VENDOR_WARNING}</p><p>{STANDARD_WARNING}</p></aside>
    <form hidden={view === "results"} onSubmit={submit} noValidate className="space-y-5">
      <fieldset disabled={pending} className="min-w-0 space-y-5 disabled:opacity-70">
        <legend className="sr-only">Valve sizing inputs</legend>
        <div className="rounded-2xl border border-gray-300 bg-white p-5"><h3 className="font-bold">Liquid service</h3><p>Single-phase, pure Newtonian fluid. Enter the upstream and downstream pressures directly across the valve.</p></div>
        <div className="rounded-2xl border border-gray-300 bg-white p-5">
          <label htmlFor="valve-fluid-search" className="font-bold">Search workbench substances</label>
          <input id="valve-fluid-search" className={inputClass} value={query} placeholder="Search by name, formula, refrigerant code or CAS number" onChange={e => {
            setQuery(e.target.value); setSearchResults([]); setSearchError(null); setSearchLoading(!!e.target.value.trim()); edit({ ...draft, fluid: "" });
          }} />
          <label htmlFor="valve-fluid" className="font-bold">Automatic fluid properties</label>
          <select id="valve-fluid" className={inputClass} value={draft.fluid} aria-invalid={!!errors.fluid} aria-describedby={errors.fluid ? "valve-fluid-error" : "valve-fluid-help"} onChange={e => edit({ ...draft, fluid: e.target.value })}>
            <option value="">Select a fluid</option>{groups.map(group => <optgroup key={group} label={group}>{options.filter(fluid => (fluid.category ?? "Other Chemicals") === group).map(fluid => <option key={fluid.id} value={fluid.id} disabled={!!liquidEligibilityError(fluid)}>{fluid.name}{fluid.formula ? ` (${fluid.formula})` : ""}{liquidEligibilityError(fluid) ? ` - Unsupported: ${publicValveMessage(liquidEligibilityError(fluid) ?? "")}` : ""}</option>)}</optgroup>)}
          </select>
          {errors.fluid && <p id="valve-fluid-error" className="text-sm text-red-800">{errors.fluid}</p>}
          {(catalogueLoading || searchLoading) && <p role="status">Loading workbench fluids. A sleeping service may take up to one minute.</p>}
          {(catalogueError || searchError) && <p role="alert" className="text-sm text-red-800">{publicValveMessage(searchError ?? catalogueError ?? "")}</p>}
          {query.trim() && !searchLoading && !searchError && !options.length && <p>No matching automatic substance found. Mixtures, slurries and custom formulations are unsupported; manual entry is deferred.</p>}
          {eligibilityError && draft.fluid && <p className="text-sm text-amber-900">{publicValveMessage(eligibilityError)}</p>}
          {(!fluids.length || catalogueError) && <p className="mt-2 text-sm">Fluid catalogue is not loaded. <button type="button" onClick={onRetryFluids} className={buttonClass}>Retry loading fluids</button></p>}
          <p id="valve-fluid-help" className="mt-2 text-sm text-gray-600">Automatic properties are evaluated at each case’s actual upstream pressure and temperature. Pure-fluid Newtonian models only. Gas, steam, two-phase and supercritical states, mixtures and slurries are unsupported. Liquid phase and usable density/viscosity are checked before sizing. Manual entry is deferred. Enter temperature in each operating case.</p>
        </div>
        {order.map(id => draft.cases[id] && <CaseFields key={id} id={id} value={draft.cases[id]!} errors={errors}
          onChange={(key, value) => edit({ ...draft, cases: { ...draft.cases, [id]: { ...draft.cases[id], [key]: value } } })}
          onRemove={id === "normal" ? undefined : () => { const cases = { ...draft.cases }; delete cases[id]; edit({ ...draft, cases }); }} />)}
        <div className="flex flex-wrap gap-3">{(["minimum", "maximum"] as const).filter(id => !draft.cases[id]).map(id => <button key={id} type="button" className={buttonClass} onClick={() => edit({ ...draft, cases: { ...draft.cases, [id]: emptyCase() } })}>Add {id} case</button>)}</div>
        <div className="grid gap-4 rounded-xl border border-gray-300 bg-white p-5 sm:grid-cols-2">
          <div><label htmlFor="valve-display">Coefficient display</label><select id="valve-display" className={inputClass} value={draft.display} onChange={e => edit({ ...draft, display: e.target.value as DisplayBasis })}>{["Cv", "Kv", "both"].map(basis => <option key={basis}>{basis}</option>)}</select></div>
          <div><label htmlFor="valve-margin">Preliminary rating margin (%)</label><input id="valve-margin" type="number" step="any" className={inputClass} value={draft.margin} aria-invalid={!!errors.margin} aria-describedby="valve-margin-help" onChange={e => edit({ ...draft, margin: e.target.value })} />{errors.margin && <p className="text-sm text-red-800">{errors.margin}</p>}</div>
          <p id="valve-margin-help" className="text-sm text-gray-600 sm:col-span-2">Margin affects only the target rated coefficient, not the required coefficient, flow or pressure drop.</p>
        </div>
        <button type="submit" disabled={pending || searchLoading || !!eligibilityError} className="rounded-lg bg-teal-800 px-5 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-50">{pending ? "Calculating…" : "Calculate preliminary valve size"}</button>
      </fieldset>
    </form>
    <div aria-live="polite" aria-atomic="true">{pending && <p role="status">Calculating preliminary size. A sleeping service may take up to one minute. This request will not be automatically retried.</p>}{Object.keys(errors).length > 0 && <p role="alert" className="font-semibold text-red-800">Correct the highlighted fields before calculating.</p>}{error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4"><h3 className="font-bold">{titles[error.kind]}</h3><p>{publicValveMessage(error.message)}</p>{error.kind === "authentication" ? <a href="/login" className="underline">Sign in again</a> : <p className="mt-2 text-sm">Your inputs are retained. Review them, then select Calculate to retry deliberately.</p>}</div>}{result && <p>Preliminary calculation complete. Final valve selection remains blocked.</p>}</div>
    {result && view !== "inputs" && <ValveResults result={result} />}
  </section>;
}
