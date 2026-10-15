import type { Limit } from "./types";
export function formatValue(value: number | string | null | undefined): string {
  if (value == null || value === "" || typeof value === "number" && !Number.isFinite(value)) return "—";
  return typeof value === "number" ? value.toLocaleString("en-GB", { maximumFractionDigits: 3 }) : value;
}
export function formatLimit(limit: Limit) {
  return typeof limit === "number" ? `≤ ${formatValue(limit)}` : `${limit.min == null ? "" : `≥ ${formatValue(limit.min)}`} ${limit.max == null ? "" : `≤ ${formatValue(limit.max)}`}`.trim();
}
