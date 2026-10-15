import type { Check, Standard, Status } from "./types";
export const SCREENING_NOTICE = "These checks are engineering screening indicators and do not constitute regulatory approval.";
export const STATUS_LABELS: Record<Status, string> = { pass: "Within typical range", warn: "Review", fail: "Outside selected criterion", info: "Information only" };
export function standardMetadata(id: string, standard: Standard) {
  const jurisdiction = id === "custom" ? "User-supplied project jurisdiction" : id.startsWith("WHO") ? "International" : ({ ZA: "South Africa", KE: "Kenya", NG: "Nigeria", GH: "Ghana", EU: "European Union" }[id.split("_")[0]] ?? "See reference source");
  const classification = id === "custom" ? "User-entered project criteria" : /WHO|guideline|GS175/.test(id) ? "Published guidance / draft reference" : "Regulatory reference — confirm applicability";
  return { jurisdiction, classification, verification: standard.status === "to verify" ? "Provisional — source verification required" : standard.status === "user supplied" ? "User-supplied criteria" : "Verified in prototype reference" };
}
export function checkReference(check: Check) {
  const source = check.source;
  const comparative = /Nigeria.*Kenya|Kenya.*Mwache/.test(source);
  const classification = comparative ? "Comparative published guidance" : /Typical|typical|Municipal/.test(source) ? "Typical engineering range" : /Data consistency|Input validation|Measured vs assumed/.test(source) ? "Input quality indicator" : "Published design guidance";
  const shortSource = comparative ? "Comparative guidance" : /M&E/.test(source) ? "Metcalf & Eddy" : /Qasim|Q Ex\.|Q Ch\./.test(source) ? "Qasim & Zhu" : /Ten States/.test(source) ? "Ten States guidance" : "Engineering screening";
  return { classification, shortSource };
}
