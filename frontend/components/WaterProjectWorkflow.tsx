"use client";
import { useEffect, useRef, useState } from "react";
import ProjectSelection from "@/components/ProjectSelection";
import WaterDesignBasis from "@/components/WaterDesignBasis";
import { listProjects, createProjectRecord, openProjectRecord, listScenarioRecords, openScenarioRecord, saveScenarioRecord, deleteScenarioRecord, confirmScenarioDeletion, type ProjectSummary, type ScenarioRecord } from "@/lib/projects";
import { newWaterSession, restoreWaterSession, editWaterSession, waterScenarioPayload, isWaterScenario, type WaterSession } from "@/lib/water-treatment/persistence";
import { compareWaterScenarios, duplicateWaterScenario, downloadWaterReport, type Comparison } from "@/lib/water-treatment/api";
import { formatValue } from "@/lib/water-treatment/format";
import { WaterDownloadMenu, WaterSectionNavigation, type WaterSection } from "@/components/WaterWorkflowControls";
import { summarise } from "@/lib/water-treatment/adapter";
import { STATUS_LABELS } from "@/lib/water-treatment/presentation";

const button = "rounded-lg border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-900 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700";
const input = "mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900";
type Props = { apiBaseUrl: string; active: boolean; registerExitGuard?: (guard: () => boolean) => void };
export default function WaterProjectWorkflow({ apiBaseUrl, active, registerExitGuard }: Props) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([]);
  const [scenario, setScenario] = useState<ScenarioRecord | null>(null);
  const [scenarioId, setScenarioId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [session, setSession] = useState<WaterSession>(newWaterSession);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [section, setSection] = useState<WaterSection>("inputs");
  const workflow = useRef<HTMLElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof ResizeObserver === "undefined" || !toolbar.current) return;
    const observer = new ResizeObserver(([entry]) => workflow.current?.style.setProperty("--water-toolbar-height", `${entry.target.getBoundingClientRect().height + 16}px`));
    observer.observe(toolbar.current); return () => observer.disconnect();
  }, []);
  const gate = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void listProjects(apiBaseUrl, controller.signal).then(rows => { if (!controller.signal.aborted) { setProjects(rows); setError(""); } }).catch(() => {
      if (!controller.signal.aborted) setError("Projects could not be loaded. Check your connection and sign-in, then refresh projects.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [apiBaseUrl, attempt]);
  useEffect(() => {
    registerExitGuard?.(() => !gate.current && (!dirty || window.confirm("Leave with unsaved Design Basis changes?")));
    return () => registerExitGuard?.(() => true);
  }, [dirty, registerExitGuard]);
  useEffect(() => {
    if (!dirty || !active) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, active]);
  async function run(action: () => Promise<void>) {
    if (gate.current) return;
    gate.current = true; setBusy(true); setError(""); setStatus("");
    try { await action(); } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Action could not be completed. Inputs are retained.";
      setError(/traceback|stack|sqlalchemy|internal server|\/site-packages\/|<html/i.test(message) ? "The service could not complete this action. Inputs are retained; refresh saved data before retrying." : message);
    } finally { gate.current = false; setBusy(false); }
  }
  function canLeave() { return !gate.current && (!dirty || window.confirm("Discard unsaved changes before changing the selected scenario or project?")); }
  function clearScenario() { setScenario(null); setScenarioId(""); setName(""); setDescription(""); setSession(newWaterSession()); setDirty(false); setComparison(null); setSection("inputs"); }
  async function refresh(id: number) {
    const rows = await listScenarioRecords(apiBaseUrl, id);
    setScenarios(rows.filter(isWaterScenario)); setComparison(null); setSelected([]);
    setProjects(await listProjects(apiBaseUrl));
  }
  function apply(saved: ScenarioRecord) {
    const restored = restoreWaterSession(saved);
    setScenario(saved); setScenarioId(String(saved.id)); setName(saved.name); setDescription(saved.description ?? ""); setSession(restored); setDirty(false); setSection(restored.result ? "results" : "inputs");
  }
  async function openProject() {
    if (!projectId || !canLeave()) return;
    await run(async () => {
      const opened = await openProjectRecord(apiBaseUrl, Number(projectId));
      const rows = await listScenarioRecords(apiBaseUrl, opened.id);
      clearScenario(); setProject(opened); setScenarios(rows.filter(isWaterScenario)); setSelected([]);
    });
  }
  async function createProject() {
    if (!projectName.trim()) { setError("Enter a project name."); return; }
    await run(async () => {
      const created = await createProjectRecord(apiBaseUrl, projectName.trim(), projectDescription.trim() || null);
      clearScenario(); setProject(created); setProjectId(String(created.id)); setScenarios([]); setSelected([]); setStatus("Project created. Create a Design Basis scenario.");
      setProjects(await listProjects(apiBaseUrl));
    });
  }
  async function createScenario() {
    if (!project) return;
    await run(async () => { const saved = await saveScenarioRecord(apiBaseUrl, project.id, waterScenarioPayload(name, description, newWaterSession())); apply(saved); await refresh(project.id); setStatus("Draft scenario created. Configure inputs, calculate and save."); });
  }
  async function openScenario() {
    if (!project || !scenarioId || !canLeave()) return;
    await run(async () => {
      const saved = await openScenarioRecord(apiBaseUrl, project.id, Number(scenarioId));
      if (saved.project_id !== project.id) throw new Error("Scenario does not belong to this project.");
      apply(saved); setStatus("Saved scenario reopened.");
    });
  }
  async function save() {
    if (!project || !scenario) return;
    await run(async () => {
      const saved = await saveScenarioRecord(apiBaseUrl, project.id, waterScenarioPayload(name, description, session), scenario.id);
      const restored = restoreWaterSession(saved);
      setScenario(saved); setSession(restored); setDirty(false); setStatus(restored.result ? "Calculated Design Basis saved." : "Draft saved. Calculate and save before reporting."); await refresh(project.id);
    });
  }
  async function duplicate() {
    if (!project || !scenario || !canLeave()) return;
    await run(async () => { const copy = await duplicateWaterScenario(apiBaseUrl, project.id, scenario.id); apply(copy); await refresh(project.id); setStatus("A separate copy was created. Edit its name and recalculate. The original is unchanged."); });
  }
  async function remove() {
    if (!project || !scenario || busy || !confirmScenarioDeletion(scenario.name)) return;
    await run(async () => { await deleteScenarioRecord(apiBaseUrl, project.id, scenario.id); clearScenario(); await refresh(project.id); setStatus("Scenario deleted."); });
  }
  const scenarioOptions = scenarios.map(row => {
    try {
      if (row.project_id !== project?.id || !isWaterScenario(row)) return { row, ready: false, label: "Unavailable", reason: "Not a Design Basis scenario in this project." };
      const restored = restoreWaterSession(row);
      return { row, ready: !!restored.result, label: restored.result ? "Calculated" : row.fluid_config.water_treatment && typeof row.fluid_config.water_treatment === "object" && (row.fluid_config.water_treatment as { result?: unknown }).result ? "Calculation required" : "Draft", reason: restored.result ? "" : restored.staleReason ?? "Calculate and save this scenario first." };
    } catch { return { row, ready: false, label: "Unavailable", reason: "Incompatible or incomplete saved inputs. Open a supported scenario." }; }
  });
  const compatible = scenarioOptions.filter(option => option.ready).map(option => option.row);
  const reportReady = !!scenario && !!session.result && !session.staleReason && !dirty;
  const comparisonReady = selected.length >= 2 && selected.length <= 5 && selected.every(id => compatible.some(row => row.id === id));
  const validComparison = !!comparison && comparisonReady && selected.every(id => comparison.scenario_ids.includes(id)) && comparison.scenario_ids.length === selected.length;
  const comparisonReportReady = reportReady && validComparison && !!scenario && selected.includes(scenario.id);
  const downloadReason = !scenario ? "Create or open a Design Basis scenario first." : session.staleReason && dirty ? "Recalculate because inputs have changed, then save the scenario." : !session.result || session.staleReason ? "Calculate and save the scenario first." : dirty ? "Save the calculated scenario first." : "";
  const stateLabel = !scenario ? "Draft" : session.result && !session.staleReason ? "Calculated" : dirty ? "Calculation required" : "Draft";
  const checks = session.result?.basis?.checks ?? session.result?.water?.checks ?? [];
  const counts = summarise(checks);
  const checkSummary = session.result ? `${counts.pass} within typical range | ${counts.warn} review | ${counts.fail} outside selected criterion | ${counts.info} information only` : "Calculation required";
  async function report(format: "pdf" | "docx", withComparison = false) {
    if (!project || !scenario || !reportReady) { setError("Calculate and save the scenario before downloading a report."); return; }
    if (withComparison && !comparisonReportReady) { setError("Compare two to five compatible saved scenarios including the current scenario first."); return; }
    await run(async () => { await downloadWaterReport(apiBaseUrl, project.id, scenario.id, format, withComparison ? selected : []); setStatus(`${format.toUpperCase()} report downloaded.`); });
  }
  return <section ref={workflow} aria-label="Water treatment project workflow" className="mx-auto max-w-6xl space-y-5 pb-8 text-gray-900">
    <div ref={toolbar} aria-label="Design Basis project and actions" className="sticky top-0 z-20 space-y-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 basis-full lg:basis-0 lg:flex-1">
        <h2 className="text-base font-bold text-teal-900">Water Treatment / Design Basis</h2>
        <p className="truncate text-sm" title={project?.name ?? "No project selected"}>Project: <strong>{project?.name ?? "Select a project"}</strong></p>
        <p className="truncate text-sm" title={name || "No scenario selected"}>Scenario: <strong>{scenario ? name : "Create or open a scenario"}</strong></p>
        <p role="status" className="mt-1 text-xs font-semibold text-gray-700">{stateLabel} | {scenario ? dirty ? "Unsaved changes" : "Saved" : "Not saved"}</p>
      </div><div className="flex w-full max-w-full flex-wrap gap-2 lg:w-auto">
        <button type="button" className={button} disabled={busy || !scenario} aria-describedby={!scenario ? "water-action-reason" : undefined} aria-label="Save scenario" onClick={() => void save()}>Save</button>
        <button type="button" className={button} disabled={busy || !scenario} aria-describedby={!scenario ? "water-action-reason" : undefined} aria-label="Duplicate saved scenario" onClick={() => void duplicate()}>Duplicate</button>
        <button type="button" className={button} disabled={busy || !project || compatible.length < 2} aria-describedby="water-compare-reason" onClick={() => setSection("comparison")}>Compare</button>
        <WaterDownloadMenu busy={busy} options={[
          { id: "water-pdf", label: "Download PDF", disabled: busy || !reportReady, reason: busy ? "Wait for the current action to finish." : downloadReason, onSelect: () => void report("pdf") },
          { id: "water-word", label: "Download Word", disabled: busy || !reportReady, reason: busy ? "Wait for the current action to finish." : downloadReason, onSelect: () => void report("docx") },
          { id: "water-comparison-pdf", label: "Download comparison PDF", disabled: busy || !comparisonReportReady, reason: busy ? "Wait for the current action to finish." : downloadReason || "Compare two to five compatible scenarios including the current scenario first.", onSelect: () => void report("pdf", true) },
          { id: "water-comparison-word", label: "Download comparison Word", disabled: busy || !comparisonReportReady, reason: busy ? "Wait for the current action to finish." : downloadReason || "Compare two to five compatible scenarios including the current scenario first.", onSelect: () => void report("docx", true) },
        ]} />
      </div></div>
      {!scenario && <p id="water-action-reason" className="text-xs text-gray-600">Create or open a scenario to save or duplicate it.</p>}
      {!reportReady && <p className="text-xs text-gray-700">{downloadReason}</p>}
      <p id="water-compare-reason" className={compatible.length < 2 ? "text-xs text-gray-600" : "sr-only"}>{compatible.length < 2 ? "Select at least two compatible calculated scenarios. Calculate and save at least two in this project first." : "Open Comparison to select two to five compatible scenarios."}</p>
      {(project || scenario) && <WaterSectionNavigation section={section} onChange={setSection} hasScenario={!!scenario} hasProject={!!project} checkSummary={scenario ? checkSummary : ""} />}
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3">{error}</p>}
    {status && <p role="status">{status}</p>}
    {busy && <p role="status">Saving or loading. A sleeping service may take up to one minute. This action is not automatically retried.</p>}
    <div className="flex flex-wrap items-center gap-3 text-sm">{project && <><strong>Project: {project.name}</strong><button type="button" className={button} disabled={busy} onClick={() => { if (canLeave()) { setProject(null); clearScenario(); setScenarios([]); setSelected([]); } }}>Change project</button></>}
      {scenario && <><strong>Scenario: {name}</strong><button type="button" className={button} disabled={busy} onClick={() => { if (canLeave()) clearScenario(); }}>Change scenario</button><span>{dirty ? "Unsaved changes" : "Saved"}</span></>}
    </div>
    {!scenario && <div id="water-panel-inputs" role={project ? "tabpanel" : undefined} aria-labelledby={project ? "water-tab-inputs" : undefined} hidden={section !== "inputs"}>
    {!project && <><ProjectSelection projects={projects} name={projectName} description={projectDescription} selectedId={projectId} busy={busy} onName={setProjectName} onDescription={setProjectDescription} onSelect={setProjectId} onCreate={() => void createProject()} onOpen={() => void openProject()} />
      {loading && <p role="status">Loading projects…</p>}<button type="button" className={button} disabled={busy} onClick={() => { setLoading(true); setAttempt(value => value + 1); }}>Refresh projects</button></>}
    {project && !scenario && <fieldset disabled={busy} className="grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-2"><legend className="font-semibold">Create or open a Design Basis scenario</legend>
      <div><label htmlFor="water-scenario-name">Scenario name</label><input id="water-scenario-name" className={input} value={name} onChange={e => setName(e.target.value)} /><label htmlFor="water-scenario-description">Description</label><input id="water-scenario-description" className={input} value={description} onChange={e => setDescription(e.target.value)} /><button type="button" className={`${button} mt-3`} onClick={() => void createScenario()}>Create scenario</button></div>

    </fieldset>}
    </div>}
    {project && <fieldset disabled={busy} className="rounded-xl border border-gray-200 bg-white p-3"><legend className="sr-only">Scenario navigation</legend>      <div><label htmlFor="water-scenario-selector">Saved Design Basis scenarios</label><select id="water-scenario-selector" className={input} value={scenarioId} onChange={e => setScenarioId(e.target.value)}><option value="">Select scenario</option>{scenarios.map(row => <option key={row.id} value={row.id}>{row.name} | {scenarioOptions.find(option => option.row.id === row.id)?.label}{row.id === scenario?.id ? " (open)" : ""}</option>)}</select><button type="button" className={`${button} mt-3`} disabled={!scenarioId} onClick={() => void openScenario()}>Open scenario</button><button type="button" className={`${button} mt-3`} onClick={() => void run(() => refresh(project.id))}>Refresh scenarios</button>{!scenarios.length && <p className="mt-3 text-sm">No Design Basis scenarios in this project yet.</p>}</div></fieldset>}
    {project && scenario && <>
      <div hidden={section !== "inputs"}><fieldset disabled={busy} className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2"><legend>Scenario details and actions</legend>
        <label>Scenario name<input className={input} value={name} onChange={e => { setName(e.target.value); setDirty(true); }} /></label><label>Description<input className={input} value={description} onChange={e => { setDescription(e.target.value); setDirty(true); }} /></label>
        <div className="col-span-full flex flex-wrap gap-3"><button type="button" className={button} onClick={() => void remove()}>Delete scenario</button></div>
      </fieldset></div>
      {session.staleReason && <p role="status" className="rounded-lg bg-amber-50 p-3">{session.staleReason}</p>}
      <fieldset disabled={busy} className="min-w-0"><legend className="sr-only">Design Basis inputs and results</legend><WaterDesignBasis key={scenario.id} active={false} initialValues={session.draft} initialResult={session.result} section={section} onSectionChange={setSection}
        onEdit={draft => { setSession(editWaterSession(session, draft)); setDirty(true); }} onCalculated={(draft, result) => { setSession({ draft, result, calculatedAt: new Date().toISOString(), staleReason: null }); setDirty(true); }} /></fieldset>
      {section === "inputs" && <div aria-label="Input actions" className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-300 bg-white p-3 shadow-sm">
        <p className="text-sm">{dirty ? "Unsaved changes" : "Saved draft"} | {session.staleReason ? "Calculation required" : "Current calculation available"}</p>
        <button type="submit" form="water-design-basis-form" disabled={busy} className={`${button} bg-teal-50`}>Calculate design basis</button>
      </div>}

    </>}
    {project && <section id="water-panel-comparison" role="tabpanel" aria-labelledby="water-tab-comparison" hidden={section !== "comparison"} aria-label="Scenario comparison" className="rounded-xl border bg-white p-5"><h3 className="text-lg font-semibold">Compare saved Design Basis scenarios</h3>
      {compatible.length < 2 ? <p className="mt-3 text-sm">Calculate and save at least two compatible Design Basis scenarios in this project to compare them.</p> : <><p className="my-3 text-sm">Select two to five saved scenarios. Different reference criteria remain separate. Highest and lowest values describe the range and do not identify a best design.</p>
      </>}
      <fieldset disabled={busy} className="my-3 grid gap-3 sm:grid-cols-2"><legend className="sr-only">Scenarios to compare</legend>{scenarioOptions.map(({ row, ready, reason }) => <label className="rounded-lg border border-gray-200 p-3 text-sm" key={row.id}><span className="flex gap-2"><input type="checkbox" checked={selected.includes(row.id)} disabled={!ready || !selected.includes(row.id) && selected.length >= 5} aria-describedby={!ready ? `water-unavailable-${row.id}` : undefined} onChange={e => { setSelected(previous => e.target.checked ? [...previous, row.id] : previous.filter(id => id !== row.id)); setComparison(null); }} />{row.name}</span>{!ready && <span id={`water-unavailable-${row.id}`} className="mt-1 block text-xs text-gray-600">{reason}</span>}</label>)}</fieldset>

        <button type="button" className={button} disabled={busy || !comparisonReady} onClick={() => void run(async () => { setComparison(await compareWaterScenarios(apiBaseUrl, project.id, selected)); })}>Compare scenarios</button>
      {comparison && <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Saved Design Basis scenario comparison</caption><thead><tr><th scope="col" className="p-2">Metric</th>{comparison.names.map((label, i) => <th scope="col" className="p-2" key={comparison.scenario_ids[i]}>{label}</th>)}</tr></thead><tbody>{comparison.metrics.map(metric => <tr key={metric.label}><th scope="row" className="border-t p-2 font-medium">{metric.label}</th>{metric.values.map((value, i) => <td key={comparison.scenario_ids[i]} className="border-t p-2 align-top">{typeof value === "string" ? value.replace(/\b(pass|warn|fail|info)\b/g, raw => STATUS_LABELS[raw as keyof typeof STATUS_LABELS]) : formatValue(value)}{typeof value === "number" && metric.lowest !== metric.highest && <span className="block text-xs text-teal-800">{value === metric.lowest ? "Lowest" : value === metric.highest ? "Highest" : ""}</span>}</td>)}</tr>)}</tbody></table></div>}
    </section>}
  </section>;
}
