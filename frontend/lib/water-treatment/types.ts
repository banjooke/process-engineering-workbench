export type Status = "pass" | "warn" | "fail" | "info";
export type Check = { item: string; value: number | string | null; unit: string; range: [number | null, number | null]; source: string; status: Status; note: string };
export type Quality = Record<string, number | "">;
export type BasisInput = {
  population?: number; perCapita?: number; industrialFlow?: number; infiltration?: number; avgFlowOverride?: number;
  industrialPF?: number; industrialMinFactor?: number; pfMethod?: "harmon" | "qasim45" | "babbitt" | "log47" | "manual";
  pfManual?: number; maxDayFactor?: number; maxMonthFactor?: number; minMethod?: "log48" | "manual"; minFactorManual?: number;
  conc?: Quality; loadPF?: Record<string, number>; origin?: Record<string, "measured" | "assumed">;
};
export type BasisResult = {
  flows: { Qavg: number; Qdom: number; Qind: number; Qinf: number; Qpeak: number; Qmin: number; QmaxDay: number; QmaxMonth: number; pf: number; mmin: number; pfOverall: number | null };
  pfTable: { key: string; label: string; pf: number | null }[]; mmin: number; loads: Record<string, number>; peakLoads: Record<string, number>; PE: number | null; checks: Check[];
};
export type WaterInput = { population?: number; perCapita?: number; nonDomesticPct?: number; lossesPct?: number; maxDayFactor?: number; peakHourFactor?: number; processWaterPct?: number; operatingHours?: number };
export type WaterResult = { domestic: number; demand: number; avgProduction: number; maxDay: number; peakHour: number; plantCapacity: number; checks: Check[] };
export type StandardKind = "effluent" | "drinking";
export type Limit = number | { min?: number; max?: number };
export type Standard = { name: string; version: string; checked: string; status: "verified" | "to verify" | "user supplied"; url?: string; note?: string; limits: Record<string, Limit> };
export type ComplianceResult = { standard: Standard | null; rows: { param: string; label: string; limit: Limit; value: number | null; status: Status }[] };
export type Statistics = { n: number; min?: number; max?: number; mean?: number; sd?: number; cov?: number | null; p50?: number; p90?: number; p95?: number; p99?: number };
export type Summary = Record<Status, number> & { overall: Status };
