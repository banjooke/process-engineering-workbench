"use client";
import { INDUSTRIES, type IndustryId } from "@/lib/module-registry";
export default function IndustrySelector({ selected, onSelect }: { selected: IndustryId | null; onSelect: (id: IndustryId) => void }) {
  return <section aria-labelledby="industry-heading" className="mx-auto max-w-6xl">
    <div className="mb-8 max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Your engineering workspace</p>
      <h2 id="industry-heading" className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">Choose your workspace</h2>
    </div>
      <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">{INDUSTRIES.map(industry => industry.availability === "available" ?
        <button type="button" key={industry.id} aria-pressed={selected === industry.id} onClick={() => onSelect(industry.id)}
          className="rounded-2xl border border-teal-700 bg-teal-50 p-6 text-left transition hover:bg-teal-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 sm:p-7">
          <div className="flex h-full flex-col justify-between gap-5">
            <div><h3 className="text-xl font-bold text-gray-900">{industry.title}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-700">{industry.description}</p></div>
            <span className="shrink-0 text-sm font-semibold text-teal-800">Explore tools <span aria-hidden="true">&rarr;</span></span>
          </div>
        </button> :
        <div role="group" key={industry.id} aria-disabled="true" aria-labelledby={`${industry.id}-title`} aria-describedby="industry-availability-note" className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-left">
          <h3 id={`${industry.id}-title`} className="text-lg font-semibold text-gray-700">{industry.title}</h3><p className="mt-2 text-sm leading-6 text-gray-600">{industry.description}</p>
        </div>)}</div>
    <p id="industry-availability-note" className="mt-4 text-sm leading-6 text-gray-600">Additional industry workspaces will be introduced progressively.</p>
  </section>;
}
