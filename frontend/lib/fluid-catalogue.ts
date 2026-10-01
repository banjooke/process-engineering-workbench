import { apiFetch } from "@/lib/api";
import { readApiError } from "@/lib/api-error";

export type FluidCatalogueItem = {
  id: string; name: string; formula: string | null; category: string | null;
  aliases: string[]; cas?: string | null;
  liquid_capability?: { eligible: boolean; reason: string };
};

/** Shared browse/search transport retains authentication and GET cold-start retries. */
export async function loadFluidCatalogue(baseUrl: string, signal: AbortSignal, query?: string): Promise<FluidCatalogueItem[]> {
  const path = query === undefined ? "/fluids" : `/fluids/search?q=${encodeURIComponent(query)}&limit=30`;
  const response = await apiFetch(`${baseUrl}${path}`, { signal });
  if (!response.ok) throw new Error(await readApiError(response, `Fluid catalogue loading failed (${response.status}).`));
  const data = await response.json();
  const rows = query === undefined ? data.catalogue ?? data.fluids : data.fluids;
  if (!Array.isArray(rows)) throw new Error("Fluid catalogue response is invalid. Please retry loading fluids.");
  return rows.map(row => typeof row === "string" ? { id: row, name: row, formula: null, category: null, aliases: [] } : row);
}

export function liquidEligibilityError(fluid?: FluidCatalogueItem): string | null {
  if (!fluid) return "Select a fluid from the loaded workbench catalogue.";
  if (!fluid.liquid_capability) return "Liquid capability metadata is unavailable. Reload the catalogue before calculating.";
  return fluid.liquid_capability.eligible ? null : fluid.liquid_capability.reason;
}
