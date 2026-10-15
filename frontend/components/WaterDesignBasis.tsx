"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ENGINE_VERSION, peakingMethods, standards, summarise } from "@/lib/water-treatment/adapter";
import { initialDraft, flowFields, qualityFields, loadFields, waterFields, type Draft, type Field } from "@/lib/water-treatment/input";
import { formatValue as fmt, formatLimit } from "@/lib/water-treatment/format";
import type { Check, ComplianceResult } from "@/lib/water-treatment/types";

import type { WaterSection } from "@/components/WaterWorkflowControls";
import { calculateDraft, selectedStandard, type Run } from "@/lib/water-treatment/calculation";
import { SCREENING_NOTICE, STATUS_LABELS, checkReference, standardMetadata } from "@/lib/water-treatment/presentation";

const inputClass = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus-visible:outline-2 focus-visible:outline-teal-700";
const buttonClass = "rounded-lg border border-teal-700 px-4 py-2 font-semibold text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700";
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>{children}</section>;
}
function Fields({ fields, values, onChange, prefix }: { fields: Field[]; values: Record<string, string>; onChange: (key: string, value: string) => void; prefix: string }) {
  return <div className="grid gap-4 sm:grid-cols-2">{fields.map(field => <label key={field.key} className="text-sm font-medium text-gray-700" htmlFor={`${prefix}-${field.key}`}>{field.label} {field.unit && <span className="font-normal">({field.unit})</span>}
    <input id={`${prefix}-${field.key}`} type="text" inputMode="decimal" aria-describedby="water-calculation-error" className={inputClass} value={values[field.key] ?? ""} onChange={event => onChange(field.key, event.target.value)} />
  </label>)}</div>;
}
function Table({ headings, children, caption }: { headings: string[]; children: ReactNode; caption: string }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">{caption}</caption><thead><tr>{headings.map(heading => <th scope="col" key={heading} className="border-b p-2 font-semibold">{heading}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
function Cell({ children }: { children: ReactNode }) { return <td className="border-b border-gray-100 p-2 align-top">{children}</td>; }
export function CheckTable({ checks }: { checks: Check[] }) {
  return <Table caption="Design checks" headings={["Check", "Value", "Unit", "Screening indicator", "Source", "Classification"]}>{checks.map((check, index) => <tr key={index}><Cell>{check.item}</Cell><Cell>{fmt(check.value)}</Cell><Cell>{check.unit}</Cell><Cell><strong>{STATUS_LABELS[check.status]}</strong></Cell><Cell>{checkReference(check).shortSource}</Cell><Cell>{checkReference(check).classification}</Cell></tr>)}</Table>;
}
export function CompliancePanel({ result, standardId }: { result: ComplianceResult; standardId?: string }) {
  const standard = result.standard;
  if (!standard) return null;
  const id = standardId ?? (standard.status === "user supplied" ? "custom" : [...Object.entries(standards.effluent), ...Object.entries(standards.drinking)].find(([, s]) => s.name === standard.name)?.[0] ?? "");
  const metadata = standardMetadata(id, standard);
  return <Panel title="Standard comparison (screening)"><p className="mb-3 text-sm">{standard.name}<br />Reference status: <strong>{metadata.verification}</strong> · {standard.version} · checked {standard.checked}</p>
    <p className="mb-3 text-sm">{id === "custom" ? standard.note : metadata.jurisdiction} | {metadata.classification}</p>
    {standard.url ? <a className="text-sm text-teal-800 underline" href={standard.url} target="_blank" rel="noopener noreferrer">Reference source</a> : <p className="text-sm">Source URL not supplied in reference library.</p>}
    <p className="my-3 text-sm">{standard.note}</p>
    {standard.status === "to verify" && <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold">Unverified reference values: these comparisons do not establish legal compliance. Confirm the applicable source and permit before use.</p>}
    <Table caption="Standard comparison" headings={["Parameter", "Reference limit", "Entered value", "Status"]}>{result.rows.map(row => <tr key={row.param}><Cell>{row.label}</Cell><Cell>{formatLimit(row.limit)}</Cell><Cell>{fmt(row.value)}</Cell><Cell>{STATUS_LABELS[row.status]}{standard.status === "to verify" ? " · provisional" : ""}</Cell></tr>)}</Table>
    <p className="mt-3 text-sm text-gray-600">Blank quality values are not assessed (information only). A within-range indication is a screening result; confirm current requirements and site applicability with competent reviewers.</p>
  </Panel>;
}
type Props = { registerExitGuard?: (guard: () => boolean) => void; active: boolean; initialValues?: Draft; initialResult?: Run | null; onEdit?: (draft: Draft) => void; onCalculated?: (draft: Draft, result: Run) => void; section?: WaterSection; onSectionChange?: (section: WaterSection) => void };
export default function WaterDesignBasis({ registerExitGuard, active, initialValues, initialResult, onEdit, onCalculated, section: selectedSection, onSectionChange }: Props) {
  const [draft, setDraft] = useState<Draft>(() => initialValues ?? initialDraft());
  const [result, setResult] = useState<Run | null>(initialResult ?? null);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [customParam, setCustomParam] = useState("BOD");
  const [localSection, setLocalSection] = useState<WaterSection>("inputs");
  const section = selectedSection ?? localSection;
  useEffect(() => {
    registerExitGuard?.(() => !dirty || window.confirm("Water treatment inputs are held only in this session. Leave this workspace?"));
    return () => registerExitGuard?.(() => true);
  }, [dirty, registerExitGuard]);
  useEffect(() => {
    if (!dirty || !active || onEdit) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, active, onEdit]);
  function edit(update: Partial<Draft>) { const next = { ...draft, ...update }; setDraft(next); onEdit?.(next); setDirty(true); setResult(null); setError(""); }
  function values(group: "flows" | "conc" | "loads" | "water" | "predicted") { return (key: string, value: string) => edit({ [group]: { ...draft[group], [key]: value } }); }
  function showSection(next: WaterSection, focusId: string) {
    setLocalSection(next); onSectionChange?.(next);
    window.requestAnimationFrame?.(() => {
      const heading = document.getElementById(focusId);
      heading?.focus({ preventScroll: true }); heading?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  function calculate() {
    setResult(null); setError("");
    try {
      const next = calculateDraft(draft);
      setResult(next); onCalculated?.(draft, next);
      showSection("results", "water-results-heading");
    } catch {
      showSection("inputs", "water-calculation-error");
      setError("Cannot calculate. Check that required inputs are finite, non-negative numbers, average flow or population is positive, losses are at most 90%, and operating hours are above zero and at most 24. Pasted data must contain only numbers separated by spaces, commas or semicolons.");
    }
  }
  let standard;
  try { standard = selectedStandard(draft); } catch { standard = { name: "Custom project limits", status: "user supplied" as const, version: "User-supplied project criteria", checked: "Not independently verified", limits: {} }; }
  const criteria = draft.projectCriteria ?? { name: "Custom project limits", jurisdiction: "", limits: {} };
  const metadata = standardMetadata(draft.standardIds[draft.kind], standard);
  const checks = result?.basis?.checks ?? result?.water?.checks ?? [];
  const summary = summarise(checks);
  return <section aria-labelledby="water-basis-heading" className="mx-auto max-w-6xl text-gray-900">
    <h2 id="water-basis-heading" className="sr-only">Design Basis &amp; Compliance</h2>
    <p className="mt-3 text-sm text-gray-600">{ENGINE_VERSION} · SI units · Example inputs from the reference prototype; replace with project data.</p>
    <p className="my-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">Results require competent engineering review. Save calculated scenarios in the project workflow before comparison or report downloads.</p>
    <p className="mb-4 text-sm">{SCREENING_NOTICE}</p>
    <div id="water-panel-inputs" role="tabpanel" aria-labelledby="water-tab-inputs" hidden={section !== "inputs"}>
    <form id="water-design-basis-form" aria-describedby={error ? "water-calculation-error" : undefined} onSubmit={event => { event.preventDefault(); calculate(); }}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-semibold">Inputs</h3><button type="submit" className={`${buttonClass} bg-teal-50`}>Calculate design basis</button></div>
    <Panel title="Project basis">
    <div className="mb-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">Basis type<select className={inputClass} value={draft.kind} onChange={e => edit({ kind: e.target.value as Draft["kind"] })}><option value="effluent">Wastewater</option><option value="drinking">Water supply</option></select></label>
      <label className="text-sm font-semibold">Mode<select className={inputClass} value={draft.mode} onChange={e => edit({ mode: e.target.value as Draft["mode"] })}><option value="design">Design</option><option value="proposal">Check a proposal</option><option value="existing">Existing plant</option></select></label>
    </div>
    <p className="mb-5 text-sm text-gray-600">Modes use the same Design Basis equations in the reference engine. Enter proposed or measured basis values for comparison; this tool does not rate treatment equipment.</p>
    </Panel>
    <div>
      {draft.kind === "effluent" ? <>
        <Panel title="Flow contributors"><p className="mb-4 text-sm text-gray-600">A positive average-flow override treats the entire flow as domestic and ignores industrial and infiltration components, as in the reference engine. Clear it for component peaking.</p><Fields fields={flowFields.filter(field => ["population", "perCapita", "industrialFlow", "infiltration", "avgFlowOverride"].includes(field.key))} values={draft.flows} onChange={values("flows")} prefix="flow" />
        </Panel>
        <Panel title="Peaking assumptions"><Fields fields={flowFields.filter(field => !["population", "perCapita", "industrialFlow", "infiltration", "avgFlowOverride"].includes(field.key))} values={draft.flows} onChange={values("flows")} prefix="flow" />
          <label className="mt-4 block text-sm font-semibold">Domestic peak method<select className={inputClass} value={draft.pfMethod} onChange={e => edit({ pfMethod: e.target.value as Draft["pfMethod"] })}>{Object.entries(peakingMethods).map(([key, method]) => <option key={key} value={key}>{method.label}</option>)}<option value="manual">Manual</option></select></label>
          <label className="mt-4 block text-sm font-semibold">Domestic minimum method<select className={inputClass} value={draft.minMethod} onChange={e => edit({ minMethod: e.target.value as Draft["minMethod"] })}><option value="log48">Qasim Eq. 4.8</option><option value="manual">Manual</option></select></label>
        </Panel>
        <details className="mb-5 rounded-2xl border border-gray-200 bg-white p-5"><summary className="cursor-pointer text-lg font-semibold focus-visible:outline-2 focus-visible:outline-teal-700">Pollutant concentrations and loads</summary><div className="mt-4"><Fields fields={qualityFields} values={draft.conc} onChange={values("conc")} prefix="quality" />
          <fieldset className="mt-4"><legend className="text-sm font-semibold">Measured values (unchecked = assumed)</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{qualityFields.map(f => <label key={f.key} className="flex gap-2 text-sm"><input type="checkbox" checked={draft.origin[f.key] === "measured"} onChange={e => edit({ origin: { ...draft.origin, [f.key]: e.target.checked ? "measured" : "assumed" } })} />{f.label} measured</label>)}</div></fieldset>
        <h4 className="my-4 font-semibold">Daily load factors</h4><Fields fields={loadFields} values={draft.loads} onChange={values("loads")} prefix="load" /></div></details>
      </> : <Panel title="Water demand and plant capacity"><Fields fields={waterFields} values={draft.water} onChange={values("water")} prefix="water" /></Panel>}
      <details className="mb-5 rounded-2xl border border-gray-200 bg-white p-5"><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-teal-700">Pasted-data statistics</summary><div className="mt-4"><label className="text-sm" htmlFor="water-data">Daily values, one consistent unit (spaces, commas, semicolons or newlines)<textarea id="water-data" className={inputClass} rows={4} value={draft.data} onChange={e => edit({ data: e.target.value })} /></label></div></details>
      <details className="mb-5 rounded-2xl border border-gray-200 bg-white p-5"><summary className="cursor-pointer text-lg font-semibold focus-visible:outline-2 focus-visible:outline-teal-700">Reference standard or custom project criteria</summary><div className="mt-4"><label className="text-sm font-semibold">Reference standard<select className={inputClass} value={draft.standardIds[draft.kind]} onChange={e => edit({ standardIds: { ...draft.standardIds, [draft.kind]: e.target.value }, predicted: {} })}>{Object.entries(standards[draft.kind]).map(([key, s]) => <option key={key} value={key}>{standardMetadata(key, s).jurisdiction} | {s.name} | {s.version} | {standardMetadata(key, s).verification} | checked {s.checked} | {standardMetadata(key, s).classification}</option>)}<option value="custom">Custom project limits - user-supplied criteria</option></select></label>
        <p className="my-3 text-sm">Reference status: <strong>{metadata.verification}</strong> | {metadata.jurisdiction} | {metadata.classification} · {standard.version} · checked {standard.checked}. {standard.note}</p>
        {draft.standardIds[draft.kind] === "custom" && <fieldset className="mb-4 space-y-3 rounded-lg border p-3"><legend>User-supplied project criteria</legend>
          <label className="block text-sm">Criterion name<input className={inputClass} value={criteria.name} onChange={e => edit({ projectCriteria: { ...criteria, name: e.target.value } })} /></label>
          <label className="block text-sm">Project jurisdiction<input className={inputClass} value={criteria.jurisdiction} onChange={e => edit({ projectCriteria: { ...criteria, jurisdiction: e.target.value } })} /></label>
          <label className="block text-sm">Parameter<select className={inputClass} value={customParam} onChange={e => setCustomParam(e.target.value)}>{Object.entries(standards.labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <button type="button" className={buttonClass} onClick={() => edit({ projectCriteria: { ...criteria, limits: { ...criteria.limits, [customParam]: criteria.limits[customParam] ?? { min: "", max: "" } } } })}>Add project criterion</button>
          {Object.entries(criteria.limits).map(([key, limits]) => <div key={key} className="rounded border p-2"><Fields prefix={`custom-${key}`} fields={[{ key: "min", label: `${standards.labels[key]} minimum`, unit: "reference units", initial: "", optional: true }, { key: "max", label: `${standards.labels[key]} maximum`, unit: "reference units", initial: "", optional: true }]} values={limits} onChange={(bound, value) => edit({ projectCriteria: { ...criteria, limits: { ...criteria.limits, [key]: { ...limits, [bound]: value } } } })} />
          <button type="button" className="mt-2 text-sm underline" onClick={() => edit({ projectCriteria: { ...criteria, limits: Object.fromEntries(Object.entries(criteria.limits).filter(([param]) => param !== key)) } })}>Remove {standards.labels[key]} criterion</button></div>)}
          <p className="text-sm">Custom limits are user-entered project criteria. They are not verified regulatory requirements.</p>
        </fieldset>}
        <p className="mb-4 text-sm text-gray-600">Enter measured or proposed treated quality, independently of influent. Values use the reference limit units: mg/L unless labelled otherwise; pH is dimensionless. No treatment performance is predicted by this tool.</p>
        <Fields fields={Object.keys(standard.limits).map(key => ({ key, label: standards.labels[key] ?? key, unit: "reference units", initial: "", optional: true }))} values={draft.predicted} onChange={values("predicted")} prefix="treated" />
      </div></details>
      <p id="water-calculation-error" hidden={!error} role={error ? "alert" : undefined} tabIndex={-1} className="mb-5 scroll-mt-[var(--water-toolbar-height,12rem)] rounded-lg border border-red-300 bg-red-50 p-4 text-sm focus-visible:outline-2 focus-visible:outline-red-700">{error}</p>
    </div></form></div>
    <div id="water-panel-results" role="tabpanel" aria-labelledby="water-tab-results" hidden={section !== "results"}>
      <h3 id="water-results-heading" tabIndex={-1} className="mb-4 scroll-mt-[var(--water-toolbar-height,12rem)] text-xl font-semibold focus-visible:outline-2 focus-visible:outline-teal-700">Results</h3>
      {!result ? <Panel title="Calculation required"><p className="text-sm text-gray-600">Results are unavailable or stale. Recalculate after changing inputs or criteria; previous results are not used.</p></Panel> : <>
        <Panel title="Key results"><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
          ["Average flow (m³/d)", result.basis?.flows.Qavg ?? result.water?.avgProduction],
          ["Peak flow (m³/d)", result.basis?.flows.Qpeak ?? result.water?.peakHour],
          ["Minimum flow (m³/d)", result.basis?.flows.Qmin], ["Peak factor", result.basis?.flows.pf],
          ["BOD load (kg/d)", result.basis?.loads.BOD], ["Population equivalent", result.basis?.PE],
        ].filter(([, value]) => value != null).map(([label, value]) => <div key={String(label)} className="rounded-lg bg-teal-50 p-3"><dt className="text-sm">{label}</dt><dd className="mt-1 text-xl font-bold">{fmt(value)}</dd></div>)}</dl></Panel>
        <Panel title="Result summary"><p className="mb-3 text-sm">{summary.pass} within typical range | {summary.warn} review | {summary.fail} outside selected criterion | {summary.info} information only</p>
          <dl className="grid grid-cols-2 gap-3 text-sm">{Object.entries(result.basis ? { "Average flow (m³/d)": result.basis.flows.Qavg, "Domestic flow (m³/d)": result.basis.flows.Qdom, "Industrial flow (m³/d)": result.basis.flows.Qind, "Infiltration (m³/d)": result.basis.flows.Qinf, "Minimum flow (m³/d)": result.basis.flows.Qmin, "Peak flow (m³/d)": result.basis.flows.Qpeak, "Max day (m³/d)": result.basis.flows.QmaxDay, "Max month (m³/d)": result.basis.flows.QmaxMonth, "Domestic peak factor": result.basis.flows.pf, "Overall peak factor": result.basis.flows.pfOverall, "Population equivalent (60 g BOD/d)": result.basis.PE } : result.water ? { "Domestic demand (m³/d)": result.water.domestic, "Average demand (m³/d)": result.water.demand, "Average production (m³/d)": result.water.avgProduction, "Max day (m³/d)": result.water.maxDay, "Peak hour (m³/d)": result.water.peakHour, "Plant capacity (m³/d)": result.water.plantCapacity } : {}).map(([label, value]) => <div key={label} className="rounded-lg bg-teal-50 p-3"><dt>{label}</dt><dd className="mt-1 text-lg font-bold">{fmt(value)}</dd></div>)}</dl>
        </Panel>
        {result.basis && <><Panel title="Domestic peak factors by method"><Table caption="Domestic peak factor comparison" headings={["Method", "Factor"]}>{result.basis.pfTable.map(row => <tr key={row.key}><Cell>{row.label}</Cell><Cell>{fmt(row.pf)}</Cell></tr>)}</Table></Panel>
          <Panel title="Pollutant loads"><Table caption="Pollutant loads" headings={["Parameter", "mg/L", "Average kg/d", "Peak kg/d", "Origin"]}>{Object.entries(result.basis.loads).map(([key, value]) => <tr key={key}><Cell>{key}</Cell><Cell>{result.input.conc[key]}</Cell><Cell>{fmt(value)}</Cell><Cell>{fmt(result.basis?.peakLoads[key])}</Cell><Cell>{result.input.origin[key] ?? "assumed"}</Cell></tr>)}</Table></Panel></>}
        {result.statistics.n > 0 && <Panel title={`Pasted-data statistics (${result.statistics.n} values)`}><dl className="grid grid-cols-2 gap-2 text-sm">{Object.entries(result.statistics).filter(([key]) => key !== "n").map(([key, value]) => <div key={key}><dt>{key}</dt><dd className="font-semibold">{fmt(value)}</dd></div>)}</dl></Panel>}
        <CompliancePanel result={result.compliance} standardId={result.input.standardIds[result.kind]} />
        <details className="mb-5 rounded-2xl border border-gray-200 bg-white p-5"><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-teal-700">Assumptions and calculation notes</summary><ul className="list-disc space-y-2 pl-5 text-sm"><li>{ENGINE_VERSION}; prototype equations and defaults retained. SI units throughout.</li><li>Domestic peaking applies only to domestic flow. Industrial peaking uses its own factor; infiltration is unpeaked. Positive average-flow overrides replace the component model.</li><li>Daily loads use average flow and entered concentrations; peak loads use their separate load factors. PE uses 60 g BOD5/person/day.</li><li>Pasted percentiles use linear interpolation; standard deviation is the sample statistic. Blank datasets produce no statistics.</li><li>Water capacity includes losses, process water and operating hours; no treatment removal performance is inferred.</li><li>Unmeasured influent values remain assumptions. Permit applicability and all values marked to verify require independent confirmation.</li></ul></details>
      </>}
    </div>
    <div id="water-panel-checks" role="tabpanel" aria-labelledby="water-tab-checks" hidden={section !== "checks"}>
      {!result ? <Panel title="Design checks"><p>Checks are unavailable or stale. Calculate the current inputs to review screening indicators.</p></Panel> : <>
        <details open className="mb-5 rounded-2xl border border-gray-200 bg-white p-5"><summary className="cursor-pointer text-lg font-semibold">Design checks</summary><p className="my-3 text-sm">{SCREENING_NOTICE}</p><CheckTable checks={checks} />
          <details className="mt-4"><summary className="cursor-pointer font-semibold">Method and references</summary><p className="my-3 text-sm">Mixed-country contextual notes below are comparative guidance, not one governing regulatory requirement. The selected reference or user-entered project limits are assessed separately.</p>
            <Table caption="Complete design methods and references" headings={["Indicator", "Classification", "Complete criterion", "Full source and methodology"]}>{checks.map((check, index) => <tr key={index}><Cell>{check.item}</Cell><Cell>{checkReference(check).classification}</Cell><Cell>{formatLimit({ min: check.range[0] ?? undefined, max: check.range[1] ?? undefined }) || "Not bounded"}</Cell><Cell>{check.source} {check.note}</Cell></tr>)}</Table>
          </details>
        </details>
      </>}
    </div>
  </section>;
}
