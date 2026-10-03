"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { industryPreference } from "@/lib/industry-preference";
import { isSelectableIndustry, type IndustryId } from "@/lib/module-registry";
export function useIndustryWorkspace() {
  const industry = useSyncExternalStore(industryPreference.subscribe, industryPreference.getSnapshot, industryPreference.getServerSnapshot);
  // Callback/proxy arrivals establish Home before consuming the fresh-auth signal.
  // Only this exact internal value is accepted; it is never a redirect destination.
  const [view, setView] = useState<"industries" | "modules" | "module" | null>(() =>
    typeof window !== "undefined" && new URL(window.location.href).searchParams.get("workspace") === "home"
      ? "industries"
      : null
  );
  useEffect(() => {
    if (view !== "industries") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("workspace") !== "home") return;
    industryPreference.clear();
    url.searchParams.delete("workspace");
    // Preserve Next.js history state and unrelated query/hash values.
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [view]);
  return {
    industry, view: industry ? (view ?? "modules") : "industries",
    chooseIndustry(value: IndustryId) { if (!isSelectableIndustry(value)) return; industryPreference.select(value); setView("modules"); },
    goHome(beforeLeave: () => boolean = () => true) { if (beforeLeave()) setView("industries"); },
    showModules() { setView(industry ? "modules" : "industries"); },
    enterModule() { setView("module"); },
  };
}
