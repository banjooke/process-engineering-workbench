"use client";
import type { ReactNode } from "react";
import { INDUSTRIES, MODULE_CATEGORIES, isSelectableIndustry, modulesForIndustry, moduleAction, type IndustryId, type ModuleAction } from "@/lib/module-registry";
export default function ModuleWorkspace({ industry, onLaunch, onResume, children }: { industry: IndustryId; onLaunch: (action: ModuleAction) => void; onResume?: () => void; children?: ReactNode }) {
  if (!isSelectableIndustry(industry)) return null;
  const modules = modulesForIndustry(industry);
  return <section aria-labelledby="modules-heading" className="mx-auto max-w-6xl">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">{INDUSTRIES.find(item => item.id === industry)?.title}</p>
      <h2 id="modules-heading" className="mt-2 text-3xl font-bold text-gray-900">Engineering modules</h2>
      <p className="mt-3 max-w-2xl text-gray-600">Choose a tool to continue into your project workflow. Your projects and scenarios remain available here.</p>
    </div>{onResume && <button type="button" onClick={onResume} className="rounded-lg bg-teal-800 px-4 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">Resume current work</button>}</div>
    <p id="module-availability-note" className="mb-6 text-sm text-gray-600">Additional engineering tools will be introduced progressively.</p>
    {MODULE_CATEGORIES.filter(category => modules.some(module => module.category === category)).map(category => <section key={category} aria-labelledby={`category-${MODULE_CATEGORIES.indexOf(category)}`} className="mb-8 border-t border-gray-200 pt-6">
      <h3 id={`category-${MODULE_CATEGORIES.indexOf(category)}`} className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-600">{category}</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{modules.filter(module => module.category === category).map(module => {
        const unavailable = module.availability === "coming-soon";
        const content = <>{!unavailable && <span className="inline-flex rounded-full border border-teal-700 px-3 py-1 text-xs font-bold text-teal-800">{module.availability === "prototype" ? "Liquid prototype" : "Available"}</span>}
          <h4 id={`module-${module.id}`} className={unavailable ? "text-xl font-bold text-gray-700" : "mt-5 text-xl font-bold text-gray-900"}>{module.title}</h4><p className="mt-2 text-sm leading-6 text-gray-600">{module.description}</p></>;
        const card = "rounded-2xl border border-gray-300 bg-white p-6 text-left shadow-sm";
        return unavailable ? <div role="group" key={module.id} aria-disabled="true" aria-labelledby={`module-${module.id}`} aria-describedby="module-availability-note" className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-left">{content}</div> :
          <button key={module.id} type="button" onClick={() => { const action = moduleAction(module.id); if (action) onLaunch(action); }} className={`${card} transition hover:border-teal-700 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700`}>{content}<span className="mt-5 block text-sm font-semibold text-teal-800">Open module</span></button>;
      })}</div>
    </section>)}
    {children}
  </section>;
}
