"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export type WaterSection = "inputs" | "results" | "checks" | "comparison";
export const WATER_SECTIONS: { id: WaterSection; label: string }[] = [
  { id: "inputs", label: "Inputs" }, { id: "results", label: "Results" },
  { id: "checks", label: "Design checks" }, { id: "comparison", label: "Comparison" },
];
export function WaterSectionNavigation({ section, onChange, hasScenario, hasProject, checkSummary }: { section: WaterSection; onChange: (section: WaterSection) => void; hasScenario: boolean; hasProject: boolean; checkSummary: string }) {
  const available = (id: WaterSection) => id === "inputs" || (id === "comparison" ? hasProject : hasScenario);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const buttons = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []);
    let next = index;
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    else if (["ArrowLeft", "ArrowRight"].includes(event.key)) next = (index + direction + buttons.length) % buttons.length;
    else return;
    event.preventDefault();
    while (buttons[next]?.disabled) next = (next + direction + buttons.length) % buttons.length;
    onChange(WATER_SECTIONS[next].id); buttons[next]?.focus();
  }
  return <nav aria-label="Design Basis sections" className="border-t border-gray-200 pt-2">
    <label className="flex items-center gap-3 text-sm font-semibold sm:hidden">View<select className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-teal-700" value={section} onChange={e => onChange(e.target.value as WaterSection)}>{WATER_SECTIONS.map(item => <option key={item.id} value={item.id} disabled={!available(item.id)}>{item.label}</option>)}</select></label>
    <div role="tablist" aria-label="Design Basis sections" className="hidden flex-wrap gap-2 sm:flex">{WATER_SECTIONS.map((item, index) => <button key={item.id} id={`water-tab-${item.id}`} type="button" role="tab" aria-selected={section === item.id} aria-controls={`water-panel-${item.id}`} tabIndex={section === item.id ? 0 : -1} disabled={!available(item.id)} onClick={() => onChange(item.id)} onKeyDown={e => navigate(e, index)} className={`rounded-lg border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:text-gray-500 ${section === item.id ? "border-teal-800 bg-teal-800 text-white" : "border-transparent text-gray-700 hover:bg-gray-100"}`}>{item.label}</button>)}</div>
    {checkSummary && <p className="mt-2 text-xs text-gray-700">Design checks: {checkSummary}</p>}
  </nav>;
}
export type DownloadOption = { id: string; label: string; disabled: boolean; reason: string; onSelect: () => void };
export function WaterDownloadMenu({ options, busy }: { options: DownloadOption[]; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const focusLast = useRef(false);
  useEffect(() => {
    if (!open) return;
    const items = menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    if (items?.length) items[focusLast.current ? items.length - 1 : 0].focus();
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function close() { setOpen(false); trigger.current?.focus(); }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key === "Tab") { close(); return; }
    const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const current = items.indexOf(event.target as HTMLButtonElement);
    let next = current;
    if (event.key === "ArrowDown") next = (current + 1) % items.length;
    else if (event.key === "ArrowUp") next = (current - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault(); items[next]?.focus();
  }
  return <div ref={container} className="relative" onKeyDown={keyboard} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <button ref={trigger} id="water-download-trigger" type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? "water-download-menu" : undefined} disabled={busy} onClick={() => { focusLast.current = false; setOpen(value => !value); }} onKeyDown={event => { if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); event.stopPropagation(); focusLast.current = event.key === "ArrowUp"; setOpen(true); } }} className="rounded-lg border border-teal-700 bg-white px-4 py-2 text-sm font-semibold text-teal-900 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">Download<span aria-hidden="true"> ▾</span></button>
    {open && <div ref={menu} id="water-download-menu" role="menu" aria-labelledby="water-download-trigger" className="absolute right-0 top-full z-30 mt-2 max-h-[60dvh] w-72 max-w-[calc(100vw-3rem)] overflow-y-auto rounded-xl border border-gray-300 bg-white p-2 shadow-lg">{options.map(option => <button key={option.id} type="button" role="menuitem" tabIndex={-1} aria-disabled={option.disabled} aria-describedby={option.disabled ? `${option.id}-reason` : undefined} onClick={() => { if (!option.disabled) { close(); option.onSelect(); } }} className="block w-full rounded-lg p-3 text-left text-sm text-gray-900 hover:bg-gray-50 aria-disabled:text-gray-500 focus-visible:outline-2 focus-visible:outline-teal-700"><span className="font-semibold">{option.label}</span>{option.disabled && <span id={`${option.id}-reason`} className="mt-1 block text-xs">{option.reason}</span>}</button>)}</div>}
  </div>;
}
