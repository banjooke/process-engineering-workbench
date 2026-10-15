import type { BasisInput, BasisResult, WaterInput, WaterResult, Quality, StandardKind, Standard, ComplianceResult, Statistics, Check, Summary } from "./types";
declare const engine: {
  VERSION: string;
  check(item: string, value: number | null, unit: string, range: [number | null, number | null], source: string, options?: { hard?: boolean }): Check;
  designBasis(input: BasisInput): BasisResult;
  waterDemand(input: WaterInput): WaterResult;
  stats(values: number[]): Statistics;
  compliance(predicted: Quality, kind: StandardKind, id: string): ComplianceResult;
  summarise(checks: Check[]): Summary;
  PF_METHODS: Record<string, { label: string }>;
  STANDARDS: { effluent: Record<string, Standard>; drinking: Record<string, Standard>; labels: Record<string, string> };
};
export = engine;
