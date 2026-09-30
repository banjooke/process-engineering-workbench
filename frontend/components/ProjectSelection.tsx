"use client";
import type { ReactNode } from "react";
import type { ProjectSummary } from "@/lib/projects";

type Props = {
  projects: ProjectSummary[]; name: string; description: string; selectedId: string; busy: boolean;
  onName: (value: string) => void; onDescription: (value: string) => void; onSelect: (value: string) => void;
  onCreate: () => void; onOpen: () => void; openLabel?: string; children?: ReactNode;
};
const input = "mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900";
export default function ProjectSelection(p: Props) {
  return <fieldset disabled={p.busy} className="grid gap-6 lg:grid-cols-2">
    <legend className="sr-only">Create or open a project</legend>
    <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-5">
      <h3 className="font-semibold text-gray-900">Create New Project</h3>
      <label htmlFor="project-name">Project name</label><input id="project-name" className={input} value={p.name} onChange={e => p.onName(e.target.value)} />
      <label htmlFor="project-description">Description (optional)</label><input id="project-description" className={input} value={p.description} onChange={e => p.onDescription(e.target.value)} />
      <button type="button" onClick={p.onCreate} disabled={p.busy} className="mt-4 w-full rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white disabled:opacity-50">Create Project</button>
    </div>
    <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
      <h3 className="font-semibold text-gray-900">Open Existing Project</h3>
      <label htmlFor="project-selector">Project selector</label><select id="project-selector" className={input} value={p.selectedId} onChange={e => p.onSelect(e.target.value)}>
        <option value="">Select project</option>{p.projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select>
      <button type="button" onClick={p.onOpen} disabled={!p.selectedId || p.busy} className="mt-4 w-full rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-40">{p.busy ? "Loading..." : p.openLabel ?? "Open project"}</button>
      {p.children}
    </div>
  </fieldset>;
}
