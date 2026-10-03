/** Public beta/operator information. No user data or secrets belong here. */
export const siteConfig = {
  applicationName: "Process Engineering Workbench",
  operatorName: "BAFED Services",
  enterpriseNumber: "0760838801",
  operatorCountry: "Belgium",
  contactEmail: "consultancy@bafedservices.com",
  effectiveDate: "3 October 2026",
  betaStatus: true,
  feedbackFormUrl: "https://tally.so/r/dWBBZo",
} as const;

export const contactHref = `mailto:${siteConfig.contactEmail}`;
export const deletionHref = `${contactHref}?subject=${encodeURIComponent("Account deletion request")}`;
export const engineeringDisclaimer = "Beta software for preliminary engineering evaluation. Results must be independently verified against applicable standards, project requirements and manufacturer data. Do not use outputs as the sole basis for safety-critical or final design decisions.";
export const confidentialityWarning = "Do not enter confidential, proprietary, personal or safety-sensitive company information during the beta.";
