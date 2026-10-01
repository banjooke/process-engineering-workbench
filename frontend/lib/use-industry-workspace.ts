"use client";
import { useState, useSyncExternalStore } from "react";
import { industryPreference } from "@/lib/industry-preference";
import { isSelectableIndustry, type IndustryId } from "@/lib/module-registry";
export function useIndustryWorkspace() {
  const industry = useSyncExternalStore(industryPreference.subscribe, industryPreference.getSnapshot, industryPreference.getServerSnapshot);
  const [view, setView] = useState<"industries" | "modules" | "module" | null>(null);
  return {
    industry, view: view ?? (industry ? "modules" : "industries"),
    chooseIndustry(value: IndustryId) { if (!isSelectableIndustry(value)) return; industryPreference.select(value); setView("modules"); },
    goHome(beforeLeave: () => boolean = () => true) { if (beforeLeave()) setView("industries"); },
    showModules() { setView(industry ? "modules" : "industries"); },
    enterModule() { setView("module"); },
  };
}
