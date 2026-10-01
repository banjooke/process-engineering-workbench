"use client";
import { useEffect, useRef, useState } from "react";
import ProjectSelection from "@/components/ProjectSelection";
import ControlValveSizing from "@/components/ControlValveSizing";
import { publicValveMessage } from "@/lib/control-valve";
import type { FluidCatalogueItem } from "@/lib/fluid-catalogue";
import { listProjects, createProjectRecord, openProjectRecord, listScenarioRecords, openScenarioRecord, saveScenarioRecord, deleteScenarioRecord, confirmScenarioDeletion, isValveScenario, ProjectApiError, type ProjectSummary, type ScenarioRecord } from "@/lib/projects";
import { newValveSession, restoreValveSession, editValveSession, calculatedValveSession, valveScenarioPayload, type ValveSession } from "@/lib/control-valve-persistence";

type Props = { apiBaseUrl: string; fluids: FluidCatalogueItem[]; catalogueError?: string | null; catalogueLoading?: boolean; onRetryFluids: () => void; onExit?: () => void; registerExitGuard?: (guard: () => boolean) => void };
const button = "rounded-lg border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-900 disabled:opacity-50";
const input = "mt-2 w-full rounded-lg border border-gray-300 px-3 py-2";
export default function ControlValveProjectWorkflow(props: Props) {
  const { apiBaseUrl, registerExitGuard } = props;
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
  const [session, setSession] = useState<ValveSession>(newValveSession);
  const [step, setStep] = useState<"inputs" | "results">("inputs");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const gate = useRef(false);
  const [calculating, setCalculating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  function fail(failure: unknown, title: string) {
    const message = failure instanceof Error ? failure.message : "Unexpected server response. Your inputs are retained.";
    setError({ title: failure instanceof ProjectApiError && [401, 403].includes(failure.status) ? "Sign-in required" : /session|sign in/i.test(message) ? "Sign-in required" : /unreachable|waking|could not confirm/i.test(message) ? "Engineering service unavailable" : title, message: publicValveMessage(message) });
  }
  useEffect(() => {
    const controller = new AbortController();
    void listProjects(apiBaseUrl, controller.signal).then(rows => { if (!controller.signal.aborted) { setProjects(rows); setError(null); } }).catch(failure => {
      if (!controller.signal.aborted) fail(failure, "Project loading failed");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [apiBaseUrl, loadAttempt]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    registerExitGuard?.(() => !busy && !calculating && (!dirty || window.confirm("Discard unsaved changes to this scenario?")));
    return () => registerExitGuard?.(() => true);
  }, [registerExitGuard, busy, calculating, dirty]);
  async function run(title: string, action: () => Promise<void>) {
    if (gate.current || calculating) return;
    gate.current = true; setBusy(true); setError(null); setStatus("");
    try { await action(); } catch (failure) { fail(failure, title); }
    finally { gate.current = false; setBusy(false); }
  }
  async function refresh(projectKey?: number) {
    const [rows, saved] = await Promise.all([listProjects(apiBaseUrl), projectKey === undefined ? Promise.resolve([]) : listScenarioRecords(apiBaseUrl, projectKey)]);
    setProjects(rows);
    if (projectKey !== undefined) { setScenarios(saved.filter(isValveScenario)); setProject(rows.find(row => row.id === projectKey) ?? project); }
  }
  function leave(action: () => void) {
    if (busy || calculating || (dirty && !window.confirm("Discard unsaved changes to this scenario?"))) return;
    setDirty(false); setError(null); setStatus(""); action();
  }
  function clearScenario() { setScenario(null); setScenarioId(""); setName(""); setDescription(""); setSession(newValveSession()); setStep("inputs"); }
  async function createProject() {
    if (!projectName.trim()) { setError({ title: "Project creation failed", message: "Enter a project name." }); return; }
    await run("Project creation failed", async () => {
      const created = await createProjectRecord(apiBaseUrl, projectName.trim(), projectDescription.trim() || null);
      setProject(created); setProjectId(String(created.id)); setProjectName(""); setProjectDescription(""); clearScenario(); setScenarios([]);
      setStatus(`Project "${created.name}" created.`);
      await refresh(created.id);
    });
  }
  async function openProject() {
    if (!projectId) return;
    await run("Opening project failed", async () => {
      const selected = await openProjectRecord(apiBaseUrl, Number(projectId));
      const rows = await listScenarioRecords(apiBaseUrl, selected.id);
      setProject(selected); setScenarios(rows.filter(isValveScenario)); clearScenario();
    });
  }
  async function createScenario() {
    if (!project) return;
    await run("Scenario creation failed", async () => {
      const fresh = newValveSession();
      const saved = await saveScenarioRecord(apiBaseUrl, project.id, valveScenarioPayload(name, description, fresh));
      setScenario(saved); setScenarioId(String(saved.id)); setSession(fresh); setStep("inputs"); setDirty(false);
      setStatus("Scenario created. Define sizing inputs, calculate, then save.");
      await refresh(project.id);
    });
  }
  async function openScenario() {
    if (!project || !scenarioId) return;
    await run("Opening scenario failed", async () => {
      const saved = await openScenarioRecord(apiBaseUrl, project.id, Number(scenarioId));
      if (saved.project_id !== project.id) throw new Error("Scenario does not belong to this project.");
      const restored = restoreValveSession(saved);
      setScenario(saved); setName(saved.name); setDescription(saved.description ?? ""); setSession(restored); setDirty(false);
      setStep(restored.result ? "results" : "inputs"); setStatus("Saved scenario opened.");
    });
  }
  async function save() {
    if (!project || !scenario) return;
    await run("Scenario save failed", async () => {
      const saved = await saveScenarioRecord(apiBaseUrl, project.id, valveScenarioPayload(name, description, session), scenario.id);
      setScenario(saved); setDirty(false); setStatus(session.result ? "Inputs and preliminary results saved." : "Inputs saved. Recalculate to save current results.");
      await refresh(project.id);
    });
  }
  async function remove() {
    if (!project || !scenario || busy || calculating || !confirmScenarioDeletion(scenario.name)) return;
    await run("Scenario deletion failed", async () => {
      await deleteScenarioRecord(apiBaseUrl, project.id, scenario.id);
      clearScenario(); setDirty(false); setStatus("Scenario deleted."); await refresh(project.id);
    });
  }
  const locked = busy || calculating;
  const currentStep = !project ? 0 : !scenario ? 1 : step === "inputs" ? 2 : 3;
  return <section aria-label="Control Valve project workflow" className="mx-auto max-w-5xl space-y-5 text-gray-900">
    <h2 className="text-3xl font-bold">Control Valve Sizing</h2>
    <ol aria-label="Sizing steps" className="flex flex-wrap gap-3 text-sm">{["Project", "Scenario", "Sizing inputs", "Results"].map((label, i) => <li key={label} aria-current={i === currentStep ? "step" : undefined} className={i === currentStep ? "font-bold text-teal-800" : "text-gray-500"}>Step {i + 1}: {label}</li>)}</ol>
    <div className="flex flex-wrap gap-3 text-sm">
      {props.onExit && <button type="button" className={button} disabled={locked} onClick={() => props.onExit?.()}>Back to modules</button>}
      {project && <><span>Project: <strong>{project.name}</strong></span><button type="button" className={button} disabled={locked} onClick={() => leave(() => { setProject(null); clearScenario(); })}>Change project</button></>}
      {scenario && <><span>Scenario: <strong>{name}</strong></span><button type="button" className={button} disabled={locked} onClick={() => leave(clearScenario)}>Change scenario</button><span role="status">{dirty ? "Unsaved changes" : "Saved"}</span></>}
    </div>
    {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3"><strong>{error.title}</strong><p>{error.message}</p>{error.title === "Sign-in required" && <a href="/login">Sign in again</a>}</div>}
    {status && <p role="status">{status}</p>}
    {busy && <p role="status">Saving or loading. A sleeping service may take up to one minute. Mutations are not automatically retried.</p>}
    {!project && <>
      <ProjectSelection projects={projects} name={projectName} description={projectDescription} selectedId={projectId} busy={busy}
        onName={setProjectName} onDescription={setProjectDescription} onSelect={setProjectId} onCreate={() => void createProject()} onOpen={() => void openProject()} />
      {loading && <p role="status">Loading projects. A sleeping service may take up to one minute.</p>}
      <button type="button" className={button} disabled={busy} onClick={() => { setLoading(true); setLoadAttempt(value => value + 1); }}>Refresh projects</button>
    </>}
    {project && !scenario && <div className="grid gap-6 rounded-2xl border border-gray-300 p-5 sm:grid-cols-2">
      <fieldset disabled={busy}><legend className="font-bold">Create New Scenario</legend>
        <label htmlFor="valve-scenario-name">Scenario name</label><input id="valve-scenario-name" className={input} value={name} onChange={e => setName(e.target.value)} />
        <label htmlFor="valve-scenario-description">Description (optional)</label><input id="valve-scenario-description" className={input} value={description} onChange={e => setDescription(e.target.value)} />
        <button type="button" className={button} onClick={() => void createScenario()}>Create scenario</button>
      </fieldset>
      <fieldset disabled={busy}><legend className="font-bold">Open Existing Scenario</legend>
        <label htmlFor="valve-scenario-selector">Control-valve scenarios</label><select id="valve-scenario-selector" className={input} value={scenarioId} onChange={e => setScenarioId(e.target.value)}><option value="">Select scenario</option>{scenarios.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
        {!scenarios.length && <p>No saved control-valve scenarios in this project.</p>}
        <button type="button" className={button} disabled={!scenarioId} onClick={() => void openScenario()}>Open scenario</button>
        <button type="button" className={button} onClick={() => void run("Scenario loading failed", () => refresh(project.id))}>Refresh scenarios</button>
      </fieldset>
    </div>}
    {project && scenario && <>
      <fieldset disabled={locked} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
        <legend>Scenario details</legend><label>Scenario name<input className={input} value={name} onChange={e => { setName(e.target.value); setDirty(true); }} /></label>
        <label>Description (optional)<input className={input} value={description} onChange={e => { setDescription(e.target.value); setDirty(true); }} /></label>
        <button type="button" className={button} onClick={() => setStep("inputs")}>Sizing inputs</button><button type="button" className={button} onClick={() => setStep("results")}>Review results</button>
        <button type="button" className={button} onClick={() => void save()}>Save scenario / Update scenario</button><button type="button" className={button} onClick={() => void remove()}>Delete scenario</button>
      </fieldset>
      {session.staleReason && <p role="status" className="rounded-lg bg-amber-50 p-3">{session.staleReason}</p>}
      <fieldset disabled={busy} className="min-w-0"><legend className="sr-only">Scenario sizing</legend>
        <ControlValveSizing key={scenario.id} {...props} initialValues={session.draft} initialResult={session.result} view={step}
          onPendingChange={pending => {
            setCalculating(pending);
            if (pending) { setSession(current => ({ ...current, result: null, calculatedInputs: null, calculatedAt: null, staleReason: "Recalculate to obtain current preliminary results." })); setDirty(true); }
          }} onEdit={draft => { setSession(editValveSession(session, draft)); setDirty(true); }}
          onCalculated={(draft, result) => { setSession(calculatedValveSession(draft, result)); setDirty(true); setStep("results"); }} />
      </fieldset>
      <p className="text-sm text-gray-600">Reports and system-aware piping integration may be added later. Saved preliminary results do not permit final valve selection.</p>
    </>}
  </section>;
}
