export const INDUSTRIES = [
  { id: "general", title: "General Process Engineering", description: "A complete workspace for everyday process design and analysis.", availability: "available", mark: "01" },
  { id: "pharmaceuticals", title: "Pharmaceuticals", description: "Process development, batch operations and reliable fluid handling.", availability: "coming-soon", mark: "02" },
  { id: "food-beverage", title: "Food & Beverage", description: "Tools for liquid processing, mixing and thermal operations.", availability: "coming-soon", mark: "03" },
  { id: "water-wastewater", title: "Water & Wastewater", description: "Hydraulic systems, treatment processes and utility networks.", availability: "coming-soon", mark: "04" },
  { id: "oil-gas", title: "Oil & Gas", description: "Liquid transport, process equipment and utility systems.", availability: "coming-soon", mark: "05" },
  { id: "chemicals", title: "Chemicals", description: "Fluid systems, equipment sizing and process development.", availability: "coming-soon", mark: "06" },
  { id: "energy-utilities", title: "Energy & Utilities", description: "Liquid circulation, heat transfer and plant utilities.", availability: "coming-soon", mark: "07" },
] as const;
export type IndustryId = typeof INDUSTRIES[number]["id"];
export type ModuleAction = "pressure_drop" | "pump_sizing" | "control_valve" | "system_curve";
export const MODULE_CATEGORIES = ["Fluid Flow & Hydraulics", "Flow Control & Instrumentation", "Heat Transfer", "Equipment & Vessels", "Process Operations & Scale-Up", "Process Safety", "Industry Tools"] as const;
export type ModuleCategory = typeof MODULE_CATEGORIES[number];
type ModuleBase = { id: string; title: string; description: string; industries: readonly IndustryId[]; category: ModuleCategory };
export type ModuleDefinition = ModuleBase & (
  { availability: "available" | "prototype"; action: ModuleAction; comingSoonLabel?: never } |
  { availability: "coming-soon"; action: null; comingSoonLabel: string }
);
const allIndustries = INDUSTRIES.map(industry => industry.id);
export const MODULES: readonly ModuleDefinition[] = [
  { id: "pressure-drop", title: "Pressure Drop Analysis", description: "Calculate line losses, pressure profiles, velocities and flow-regime checks.", industries: allIndustries, category: "Fluid Flow & Hydraulics", availability: "available", action: "pressure_drop" },
  { id: "pump-sizing", title: "Pump Sizing", description: "Determine liquid pump duty, differential head and preliminary power requirements.", industries: allIndustries, category: "Fluid Flow & Hydraulics", availability: "available", action: "pump_sizing" },
  { id: "control-valve-sizing", title: "Control Valve Sizing", description: "Estimate preliminary liquid Cv and Kv from direct valve pressures. Manufacturer confirmation required.", industries: allIndustries, category: "Flow Control & Instrumentation", availability: "prototype", action: "control_valve" },
  { id: "system-curve", title: "System Curve Generator", description: "Generate system head versus flow for a liquid hydraulic system.", industries: allIndustries, category: "Fluid Flow & Hydraulics", availability: "available", action: "system_curve" },
  { id: "heat-exchanger", title: "Heat Exchanger Sizing", description: "Explore thermal duties and preliminary heat-transfer requirements.", industries: allIndustries, category: "Heat Transfer", availability: "coming-soon", action: null, comingSoonLabel: "Coming soon" },
  { id: "tank-vessel", title: "Tank and Vessel Sizing", description: "Plan process storage and preliminary vessel capacity.", industries: allIndustries, category: "Equipment & Vessels", availability: "coming-soon", action: null, comingSoonLabel: "Coming soon" },
  { id: "agitation", title: "Agitation and Mixing", description: "Support early mixing and agitation decisions.", industries: ["general", "pharmaceuticals", "food-beverage", "chemicals", "water-wastewater"], category: "Process Operations & Scale-Up", availability: "coming-soon", action: null, comingSoonLabel: "Coming soon" },
  { id: "relief", title: "Relief Device Sizing", description: "A future workspace for preliminary relief-system studies.", industries: ["general", "oil-gas", "chemicals", "energy-utilities"], category: "Process Safety", availability: "coming-soon", action: null, comingSoonLabel: "Coming soon" },
  { id: "scale-up", title: "Process Scale-Up", description: "Compare operating scales during process development.", industries: ["general", "pharmaceuticals", "food-beverage", "chemicals"], category: "Process Operations & Scale-Up", availability: "coming-soon", action: null, comingSoonLabel: "Coming soon" },
  { id: "batch", title: "Batch Process Tools", description: "Plan batch operations and process-cycle requirements.", industries: ["general", "pharmaceuticals", "food-beverage", "chemicals"], category: "Process Operations & Scale-Up", availability: "coming-soon", action: null, comingSoonLabel: "Coming soon" },
  { id: "water-treatment", title: "Water Treatment Calculations", description: "A future collection of treatment-process calculations.", industries: ["general", "water-wastewater", "energy-utilities"], category: "Industry Tools", availability: "coming-soon", action: null, comingSoonLabel: "Coming soon" },
  { id: "pharmaceutical-tools", title: "Pharmaceutical Process Tools", description: "A future collection for pharmaceutical process development.", industries: ["general", "pharmaceuticals"], category: "Industry Tools", availability: "coming-soon", action: null, comingSoonLabel: "Coming soon" },
];
export const isIndustryId = (value: unknown): value is IndustryId => INDUSTRIES.some(industry => industry.id === value);
export const isSelectableIndustry = (value: unknown): value is IndustryId => INDUSTRIES.some(industry => industry.id === value && industry.availability === "available");
export const modulesForIndustry = (industry: IndustryId) => isSelectableIndustry(industry) ? MODULES.filter(module => module.industries.includes(industry)) : [];
export function moduleAction(id: string): ModuleAction | null { return MODULES.find(module => module.id === id)?.action ?? null; }
