"use client";

import {
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";


// ============================================================
// TYPES
// ============================================================

type PageName =
  | "assistant"
  | "fluid"
  | "line"
  | "results";

type FluidMode =
  | "coolprop"
  | "manual";

type PipeMode =
  | "standard"
  | "custom";

type FittingMode =
  | "database"
  | "manual";

type FittingPipeBasis =
  | "inherit"
  | "override";

type ElementType =
  | "Pipe"
  | "Resistance / Fitting"
  | "Known Equipment ΔP"
  | "Elevation Change";


type FluidProperties = {
  fluid: string;
  display_name?: string | null;
  formula?: string | null;
  category?: string | null;
  compressibility_factor?: number | null;

  temperature_c:
    number;

  pressure_bar_a:
    number | null;

  phase_label:
    string | null;

  phase_type:
    string | null;

  density_kg_m3:
    number | null;

  dynamic_viscosity_pa_s:
    number | null;

  vapor_pressure_bar_a:
    number | null;

  speed_of_sound_m_s:
    number | null;

  cp_j_kg_k:
    number | null;

  cv_j_kg_k:
    number | null;

  gamma:
    number | null;

  molecular_weight_kg_kmol:
    number | null;
};


type FluidCatalogueItem = {
  id: string;
  name: string;
  formula: string | null;
  category: string | null;
  aliases: string[];
  cas?: string | null;
};


type PipeScheduleRecord = {
  schedule: string;
  wall_mm: number;
  id_mm: number;
};


type PipeSizeRecord = {
  nps: string;
  od_mm: number;

  schedules:
    PipeScheduleRecord[];
};


type PipeMaterialRecord = {
  material: string;
  roughness_mm: number;
};


type PipeCatalog = {
  sizes:
    PipeSizeRecord[];

  materials:
    PipeMaterialRecord[];
};


type FittingRecord = {
  id: number;
  category: string | null;
  component: string | null;
  configuration: string | null;
  size_range_mm: string | null;
  angle_geometry: string | null;
  k_basis: string | null;
  multiplier_on_ft: number | null;
  fixed_k: number | null;
  k_expression: string | null;
  notes: string | null;
  crane_page: string | number | null;
  selection_label: string;
};

type FittingCatalog = {
  source: string;
  available: boolean;
  count: number;
  categories: string[];
  records: FittingRecord[];
};

type FittingKResult = {
  selection_label: string;
  nominal_size_mm: number;
  quantity: number;
  database_k_each: number;
  k_each: number;
  k_total: number;
  method: string;
  database_method: string;
  ft: number | null;
  multiplier: number | null;
  expression: string;
};


type PromptElement = {
  type: ElementType;
  description: string;
  pipe_mode?: PipeMode;
  nps?: string | null;
  schedule?: string | null;
  material?: string | null;
  custom_id_mm?: number | null;
  custom_roughness_mm?: number | null;
  length_m?: number;
  dz_m?: number;
  fitting_mode?: FittingMode;
  fitting_pipe_basis?: FittingPipeBasis;
  fitting_search?: string;
  quantity?: number;
  known_dp_bar?: number;
};

type PromptInterpretation = {
  prompt: string;
  status: "ready" | "needs_input";
  fluid: {
    mode: "coolprop" | "manual" | null;
    fluid: string | null;
    temperature_c: number | null;
    phase_type?: "Liquid" | "Gas" | null;
    density_kg_m3?: number | null;
    dynamic_viscosity_pa_s?: number | null;
    vapor_pressure_bar_a?: number | null;
    molecular_weight_kg_kmol?: number | null;
    compressibility_factor?: number | null;
    gamma?: number | null;
  };
  flow: {
    value: number | null;
    unit: string | null;
  };
  calculation_intent?: "pressure_drop" | "outlet_pressure" | "pressure_profile";
  inlet_pressure_bar_a: number | null;
  property_reference_pressure_bar_a?: number | null;
  pipe_basis: {
    pipe_mode?: PipeMode | null;
    nps: string | null;
    schedule: string | null;
    material: string | null;
    custom_id_mm?: number | null;
    custom_roughness_mm?: number | null;
  };
  elements: PromptElement[];
  missing: string[];
  assumptions: string[];
  interpreter?: string;
};

type LineElement = {
  id: number;

  type:
    ElementType;

  description:
    string;

  pipeMode?:
    PipeMode;

  nps?:
    string;

  schedule?:
    string;

  material?:
    string;

  custom_id_mm?:
    string;

  custom_roughness_mm?:
    string;

  length_m?:
    string;

  dz_m?:
    string;

  k_total?:
    string;

  fittingMode?:
    FittingMode;

  fittingPipeBasis?:
    FittingPipeBasis;

  fittingCategory?:
    string;

  fittingSelection?:
    string;

  fittingQuantity?:
    string;

  fittingOverrideEnabled?:
    string;

  fittingOverrideKEach?:
    string;

  fittingDatabaseKEach?:
    string;

  fittingKEach?:
    string;

  fittingMethod?:
    string;

  fittingFt?:
    string;

  fittingMultiplier?:
    string;

  fittingExpression?:
    string;

  known_dp_bar?:
    string;
};


type WarningItem = {
  level:
    string;

  code:
    string;

  message:
    string;
};


type ElementResult = {
  index:
    number;

  element_type:
    string;

  description:
    string;

  pressure_in_bar_a:
    number | null;

  pressure_out_bar_a:
    number | null;

  pipe_friction_dp_bar:
    number;

  local_resistance_dp_bar:
    number;

  equipment_dp_bar:
    number;

  elevation_dp_bar:
    number;

  velocity_m_s:
    number | null;

  reynolds_number:
    number | null;

  friction_factor:
    number | null;

  friction_method:
    string | null;

  mach:
    number | null;
};


type ProfilePoint = {
  distance_m:
    number;

  pressure_bar_a:
    number | null;

  elevation_m:
    number;

  cumulative_resistance_drop_bar:
    number;

  element:
    string;

  velocity_m_s:
    number | null;

  mach:
    number | null;
};


type SolveResult = {
  inlet_pressure_bar_a:
    number | null;

  outlet_pressure_bar_a:
    number | null;

  total_dp_bar:
    number;

  resistance_dp_bar:
    number;

  static_dp_bar:
    number;

  minimum_pressure_bar_a:
    number | null;

  maximum_mach:
    number;

  mass_flow_kg_s:
    number;

  total_line_length_m:
    number;

  net_elevation_change_m:
    number;

  elements:
    ElementResult[];

  profile:
    ProfilePoint[];

  warnings:
    WarningItem[];

  calculation_intent?:
    "pressure_drop" | "outlet_pressure" | "pressure_profile";

  absolute_pressure_available?:
    boolean;

  property_reference_pressure_bar_a?:
    number | null;
};

type SystemCurvePoint = {
  flow_value: number;
  flow_unit: string;
  total_dp_bar: number;
  total_dp_pa: number;
  total_head_m: number;
  static_dp_bar: number;
  static_head_m: number;
  resistance_dp_bar: number;
  resistance_head_m: number;
  outlet_pressure_bar_a: number;
  warning_count: number;
  warnings: WarningItem[];
};

type SystemCurveResult = {
  phase_type: string;
  flow_unit: string;
  design_flow_value: number;
  max_flow_value: number;
  max_flow_factor: number;
  number_points: number;
  reference_density_kg_m3: number;
  inlet_pressure_bar_a: number;
  design_point: {
    flow_value: number;
    flow_unit: string;
    total_dp_bar: number;
    total_head_m: number;
    outlet_pressure_bar_a: number;
  };
  points: SystemCurvePoint[];
  assumptions: string[];
};


type PumpSizingResult = {
  phase_type: string;
  design_flow_value: number;
  flow_unit: string;
  source_pressure_bar_a: number;
  destination_pressure_bar_a: number;
  reference_density_kg_m3: number;
  reference_dynamic_viscosity_pa_s: number;
  mass_flow_kg_s: number;
  actual_flow_m3_s: number;
  system: {
    total_dp_bar: number;
    total_head_m: number;
    resistance_dp_bar: number;
    resistance_head_m: number;
    static_dp_bar: number;
    static_head_m: number;
  };
  boundary: {
    pressure_difference_bar: number;
    pressure_head_m: number;
  };
  npsha: {
    available_head_m: number;
    pump_after_element_index: number;
    suction_element_count: number;
    suction_pressure_bar_a: number;
    vapor_pressure_bar_a: number;
    suction_velocity_m_s: number;
    suction_velocity_head_m: number;
    pressure_npsh_m: number;
    suction_total_dp_bar: number;
    suction_total_head_m: number;
    suction_resistance_dp_bar: number;
    suction_resistance_head_m: number;
    suction_static_dp_bar: number;
    suction_static_head_m: number;
  };
  pump_duty: {
    required_differential_pressure_bar: number;
    required_differential_head_m: number;
    positive_required_head_m: number;
    hydraulic_power_kw: number;
    pump_efficiency: number;
    shaft_power_kw: number;
    motor_margin: number;
    minimum_motor_rating_kw: number;
  };
  line_result: SolveResult;
  warnings: Array<string | WarningItem>;
  assumptions: string[];
};


type ProjectSummary = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type SavedHydraulicModel = {
  id: number;
  project_id: number;
  calculation_intent: "pressure_drop" | "outlet_pressure" | "pressure_profile";
  flow_value: number;
  flow_unit: string;
  inlet_pressure_bar_a: number | null;
  property_reference_pressure_bar_a: number | null;
  fluid_config: Record<string, unknown>;
  elements: LineElement[];
  created_at: string;
  updated_at: string;
};

type SavedScenario = {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  calculation_intent: "pressure_drop" | "outlet_pressure" | "pressure_profile";
  flow_value: number;
  flow_unit: string;
  inlet_pressure_bar_a: number | null;
  property_reference_pressure_bar_a: number | null;
  fluid_config: Record<string, unknown>;
  elements: LineElement[];
  created_at: string;
  updated_at: string;
};


type ScenarioComparisonRow = {
  scenario_id: number;
  name: string;
  description: string | null;
  engineering_task: "pressure_drop" | "pump_sizing";
  flow_value: number;
  flow_unit: string;
  main_pipe_id_mm: number | null;
  maximum_velocity_m_s: number | null;
  total_dp_bar: number | null;
  outlet_pressure_bar_a: number | null;

  required_pump_head_m: number | null;
  required_pump_dp_bar: number | null;
  shaft_power_kw: number | null;
  minimum_motor_power_kw: number | null;
  system_curve_max_factor: number | null;

  warning_count: number;
  error: string | null;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000";


const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-300";


// ============================================================
// MAIN
// ============================================================

export default function Home() {

  const [
    activePage,
    setActivePage,
  ] =
    useState<PageName>(
      "assistant"
    );


  // ========================================================
  // PROJECT WORKSPACE
  // ========================================================

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectStatus, setProjectStatus] = useState("");

  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [newScenarioName, setNewScenarioName] = useState("");
  const [newScenarioDescription, setNewScenarioDescription] = useState("");
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioStatus, setScenarioStatus] = useState("");
  const [scenarioComparisonLoading, setScenarioComparisonLoading] = useState(false);
  const [scenarioComparisonRows, setScenarioComparisonRows] = useState<ScenarioComparisonRow[]>([]);
  const [scenarioComparisonStatus, setScenarioComparisonStatus] = useState("");
  const [scenarioDefinitionMode, setScenarioDefinitionMode] = useState<"new" | "edit" | null>(null);
  const [scenarioDefinitionRoute, setScenarioDefinitionRoute] = useState<"assistant" | "manual" | null>(null);
  const [workingScenarioName, setWorkingScenarioName] = useState("");
  const [workingScenarioDescription, setWorkingScenarioDescription] = useState("");

  // Guided one-page-at-a-time workflow
  const [wizardStep, setWizardStep] = useState<"tasks" | "project" | "overview" | "analysis" | "method" | "engineering">("tasks");
  const [engineeringTask, setEngineeringTask] = useState<"pressure_drop" | "system_curve" | "pump_sizing" | null>(null);
  const [analysisType, setAnalysisType] = useState<"single" | "scenario" | null>(null);

  const selectedProject = projects.find(
    (project) => String(project.id) === selectedProjectId
  );

  const selectedScenario = scenarios.find(
    (scenario) => String(scenario.id) === selectedScenarioId
  );


  // ========================================================
  // DATABASES
  // ========================================================

  const [
    availableFluids,
    setAvailableFluids,
  ] =
    useState<FluidCatalogueItem[]>([]);

  const [fluidSearch, setFluidSearch] = useState("Water");
  const [fluidSearchResults, setFluidSearchResults] =
    useState<FluidCatalogueItem[]>([]);
  const [fluidSearchFocused, setFluidSearchFocused] = useState(false);
  const [fluidSearchLoading, setFluidSearchLoading] = useState(false);

  const [
    pipeCatalog,
    setPipeCatalog,
  ] =
    useState<
      PipeCatalog | null
    >(null);

  const [
    fittingCatalog,
    setFittingCatalog,
  ] =
    useState<FittingCatalog | null>(null);

  const [
    databaseLoading,
    setDatabaseLoading,
  ] =
    useState(true);


  // ========================================================
  // FLUID
  // ========================================================

  const [
    fluidMode,
    setFluidMode,
  ] =
    useState<FluidMode>(
      "coolprop"
    );

  const [
    selectedFluid,
    setSelectedFluid,
  ] =
    useState("Water");

  const [
    manualFluidName,
    setManualFluidName,
  ] =
    useState(
      "Custom Fluid"
    );

  const [
    phaseType,
    setPhaseType,
  ] =
    useState("Liquid");

  const [
    temperatureC,
    setTemperatureC,
  ] =
    useState("25");

  const [
    inletPressure,
    setInletPressure,
  ] =
    useState("5");

  const [
    calculationIntent,
    setCalculationIntent,
  ] =
    useState<"pressure_drop" | "outlet_pressure" | "pressure_profile">(
      "outlet_pressure"
    );

  const [
    propertyReferencePressure,
    setPropertyReferencePressure,
  ] =
    useState("1.01325");

  const [
    density,
    setDensity,
  ] =
    useState("997");

  const [
    viscosity,
    setViscosity,
  ] =
    useState("0.00089");

  const [
    vaporPressure,
    setVaporPressure,
  ] =
    useState("0.0317");

  const [
    molecularWeight,
    setMolecularWeight,
  ] =
    useState("28.965");

  const [
    compressibilityFactor,
    setCompressibilityFactor,
  ] =
    useState("1");

  const [
    gamma,
    setGamma,
  ] =
    useState("1.4");

  const [
    coolPropProperties,
    setCoolPropProperties,
  ] =
    useState<
      FluidProperties | null
    >(null);

  const [
    propertyLoading,
    setPropertyLoading,
  ] =
    useState(false);


  // ========================================================
  // FLOW
  // ========================================================

  const [
    flowValue,
    setFlowValue,
  ] =
    useState("5");

  const [
    flowUnit,
    setFlowUnit,
  ] =
    useState("m³/h");


  function normalizeFlowUnit(value: string | null | undefined) {
    const raw = (value ?? "").trim();
    const compact = raw
      .replace(/\s+/g, "")
      .replace(/³/g, "3")
      .toLowerCase();

    const aliases: Record<string, string> = {
      "m3/h": "m³/h",
      "m3/hr": "m³/h",
      "m3/hour": "m³/h",
      "m3/s": "m³/s",
      "m3/sec": "m³/s",
      "m3/second": "m³/s",
      "nm3/h": "Nm³/h",
      "nm3/hr": "Nm³/h",
      "nm3/hour": "Nm³/h",
      "kg/h": "kg/h",
      "kg/hr": "kg/h",
      "kg/hour": "kg/h",
      "kg/s": "kg/s",
      "kg/sec": "kg/s",
      "kg/second": "kg/s",
    };

    return aliases[compact] ?? raw;
  }


  // ========================================================
  // LINE
  // ========================================================

  const [
    elements,
    setElements,
  ] =
    useState<
      LineElement[]
    >([
      {
        id: 1,

        type:
          "Pipe",

        description:
          "Pipe 1",

        pipeMode:
          "standard",

        nps:
          "2",

        schedule:
          "Sch 40",

        material:
          "Commercial Steel",

        custom_id_mm:
          "52.48",

        custom_roughness_mm:
          "0.045",

        length_m:
          "10",

        dz_m:
          "0",
      },
    ]);

  const [
    nextElementId,
    setNextElementId,
  ] =
    useState(2);


  // ========================================================
  // RESULTS
  // ========================================================

  const [
    result,
    setResult,
  ] =
    useState<
      SolveResult | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    reportLoading,
    setReportLoading,
  ] =
    useState<"pdf" | "docx" | null>(null);


  const [systemCurve, setSystemCurve] =
    useState<SystemCurveResult | null>(null);
  const [systemCurveLoading, setSystemCurveLoading] =
    useState(false);
  const [systemCurveMaxFactor, setSystemCurveMaxFactor] =
    useState("1.5");
  const [systemCurvePoints, setSystemCurvePoints] =
    useState("21");

  const [pumpResult, setPumpResult] =
    useState<PumpSizingResult | null>(null);
  const [pumpSizingLoading, setPumpSizingLoading] =
    useState(false);
  const [pumpSourcePressure, setPumpSourcePressure] =
    useState("1");
  const [pumpDestinationPressure, setPumpDestinationPressure] =
    useState("1");
  const [pumpEfficiency, setPumpEfficiency] =
    useState("0.70");
  const [pumpMotorMargin, setPumpMotorMargin] =
    useState("1.10");
  const [pumpAfterElementIndex, setPumpAfterElementIndex] =
    useState("0");

  // ========================================================
  // ENGINEERING ASSISTANT
  // ========================================================

  const [engineeringPrompt, setEngineeringPrompt] = useState(
    "Size the pressure drop for water at 25 °C flowing at 10 m³/h from a vessel at 5 bar(a). Use 20 m of NPS 2 Sch 40 commercial steel pipe, four standard 90° elbows, one fully open gate valve, a heat exchanger with 0.15 bar pressure drop, and a 6 m elevation increase."
  );

  const [promptLoading, setPromptLoading] = useState(false);
  const [promptInterpretation, setPromptInterpretation] =
    useState<PromptInterpretation | null>(null);
  const [promptClarification, setPromptClarification] = useState("");
  const [promptFeedback, setPromptFeedback] = useState("");
  const [pendingAssistantSolve, setPendingAssistantSolve] = useState(false);


  // ========================================================
  // PROJECT PERSISTENCE
  // ========================================================

  async function refreshProjects(selectNewest = false) {
    const response = await fetch(`${API_BASE_URL}/projects`);

    if (!response.ok) {
      throw new Error(`Unable to load projects (${response.status}).`);
    }

    const data: ProjectSummary[] = await response.json();
    setProjects(data);

    if (selectNewest && data.length > 0) {
      setSelectedProjectId(String(data[0].id));
    }

    return data;
  }

  async function createProject() {
    const name = newProjectName.trim();

    if (!name) {
      setError("Enter a project name before creating a project.");
      return;
    }

    setProjectLoading(true);
    setError("");
    setProjectStatus("Creating project…");

    try {
      const response = await fetch(`${API_BASE_URL}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: newProjectDescription.trim() || null,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Unable to create project (${response.status}).`);
      }

      const project: ProjectSummary = await response.json();
      await refreshProjects();
      setSelectedProjectId(String(project.id));
      setNewProjectName("");
      setNewProjectDescription("");

      if (engineeringTask === "pump_sizing") {
        // A new pump-sizing project must start with a clean hydraulic definition,
        // rather than inheriting whatever project/model was previously open.
        setFluidMode("coolprop");
        setSelectedFluid("Water");
        setFluidSearch("Water");
        setManualFluidName("Custom Fluid");
        setPhaseType("Liquid");
        setTemperatureC("25");
        setInletPressure("5");
        setPropertyReferencePressure("1.01325");
        setDensity("997");
        setViscosity("0.00089");
        setVaporPressure("0.0317");
        setMolecularWeight("28.965");
        setCompressibilityFactor("1");
        setGamma("1.4");
        setCoolPropProperties(null);

        setFlowValue("5");
        setFlowUnit("m³/h");

        setElements([
          {
            id: 1,
            type: "Pipe",
            description: "Pipe 1",
            pipeMode: "standard",
            nps: "2",
            schedule: "Sch 40",
            material: "Commercial Steel",
            custom_id_mm: "52.48",
            custom_roughness_mm: "0.045",
            length_m: "10",
            dz_m: "0",
          },
        ]);
        setNextElementId(2);

        setResult(null);
        setPumpResult(null);
        setSystemCurve(null);
        setPumpAfterElementIndex("0");
        setPromptInterpretation(null);
        setPromptFeedback("");
        setSelectedScenarioId("");
        setScenarios([]);
        setScenarioDefinitionMode(null);
        setScenarioDefinitionRoute(null);

        // Pump sizing now follows the same analysis hierarchy as pressure drop.
        setAnalysisType(null);
        setActivePage("fluid");
        setWizardStep("analysis");
        setProjectStatus(
          `Pump sizing project “${project.name}” created. Choose Single Calculation or Scenario Analysis.`
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setProjectStatus(`Project “${project.name}” created.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create project.";
      setError(message);
      setProjectStatus("");
    } finally {
      setProjectLoading(false);
    }
  }

  async function deleteProject() {
    if (!selectedProjectId || !selectedProject) {
      setError("Select a saved project before deleting it.");
      return;
    }

    const confirmed = window.confirm(
      `Delete project “${selectedProject.name}”? This will permanently delete the project, its saved hydraulic model and all scenarios. This cannot be undone.`
    );
    if (!confirmed) return;

    setProjectLoading(true);
    setError("");
    setProjectStatus("Deleting project…");

    try {
      const response = await fetch(
        `${API_BASE_URL}/projects/${selectedProjectId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Unable to delete project (${response.status}).`);
      }

      const deletedName = selectedProject.name;
      setSelectedProjectId("");
      setSelectedScenarioId("");
      setScenarios([]);
      setScenarioDefinitionMode(null);
      setScenarioDefinitionRoute(null);
      setWorkingScenarioName("");
      setWorkingScenarioDescription("");
      setScenarioComparisonRows([]);
      setScenarioComparisonStatus("");
      setResult(null);
      await refreshProjects();
      setProjectStatus(`Project “${deletedName}” deleted.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete project.";
      setError(message);
      setProjectStatus("");
    } finally {
      setProjectLoading(false);
    }
  }

  function buildProjectFluidConfig() {
    return {
      workspace_schema: "hydraulics-ui-v1",
      mode: fluidMode,
      selected_fluid: selectedFluid,
      manual_fluid_name: manualFluidName,
      phase_type: phaseType,
      temperature_c: temperatureC,
      density_kg_m3: density,
      dynamic_viscosity_pa_s: viscosity,
      vapor_pressure_bar_a: vaporPressure,
      molecular_weight_kg_kmol: molecularWeight,
      compressibility_factor: compressibilityFactor,
      gamma,
      coolprop_properties: coolPropProperties,

      // Workbench task metadata. Kept inside the existing JSON payload so
      // current project/scenario backend schemas remain backward compatible.
      engineering_task: engineeringTask,
      pump_sizing:
        engineeringTask === "pump_sizing"
          ? {
              source_pressure_bar_a: pumpSourcePressure,
              destination_pressure_bar_a: pumpDestinationPressure,
              pump_efficiency: pumpEfficiency,
              motor_margin: pumpMotorMargin,
              pump_after_element_index: pumpAfterElementIndex,
            }
          : null,
      system_curve: {
        max_flow_factor: systemCurveMaxFactor,
        number_points: systemCurvePoints,
      },
    };
  }

  async function saveProjectModel() {
    if (!selectedProjectId) {
      setError("Select or create a project before saving the hydraulic model.");
      return;
    }

    const numericFlow = Number(flowValue);
    if (!Number.isFinite(numericFlow) || numericFlow <= 0) {
      setError("Enter a valid positive flow rate before saving the model.");
      return;
    }

    setProjectLoading(true);
    setError("");
    setProjectStatus("Saving hydraulic model…");

    try {
      const response = await fetch(
        `${API_BASE_URL}/projects/${selectedProjectId}/hydraulics`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            calculation_intent: calculationIntent,
            flow_value: numericFlow,
            flow_unit: normalizeFlowUnit(flowUnit),
            inlet_pressure_bar_a: inletPressure.trim()
              ? Number(inletPressure)
              : null,
            property_reference_pressure_bar_a: propertyReferencePressure.trim()
              ? Number(propertyReferencePressure)
              : null,
            fluid_config: buildProjectFluidConfig(),
            elements,
          }),
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Unable to save model (${response.status}).`);
      }

      await response.json();
      await refreshProjects();
      setProjectStatus("Hydraulic model saved to project.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save hydraulic model.";
      setError(message);
      setProjectStatus("");
    } finally {
      setProjectLoading(false);
    }
  }

  async function saveCompleteProject() {
    if (!selectedProjectId || !selectedProject) {
      setError("Select or create a project before saving it.");
      return;
    }

    if (scenarioDefinitionMode) {
      setError("Complete and save the current scenario before saving the project.");
      return;
    }

    setProjectLoading(true);
    setError("");
    setProjectStatus("Saving project and verifying all scenarios…");

    try {
      // Scenarios are first-class child records of the project and are already
      // persisted individually when Save Scenario / Save Changes is used.
      // Do NOT write the currently displayed scenario into the project's single
      // hydraulic-model slot here; that would make the project appear to contain
      // only the last scenario that happened to be open.
      const savedScenarios = await refreshScenarios(selectedProjectId);
      await refreshProjects();

      const scenarioNames = savedScenarios
        .map((scenario) => scenario.name)
        .filter((name) => Boolean(name));

      if (savedScenarios.length === 0) {
        setProjectStatus(
          `Project “${selectedProject.name}” saved. No scenarios have been added yet.`
        );
        return;
      }

      const preview = scenarioNames.slice(0, 4).join(", ");
      const remainder = scenarioNames.length > 4
        ? ` + ${scenarioNames.length - 4} more`
        : "";

      setProjectStatus(
        `Project “${selectedProject.name}” saved with all ${savedScenarios.length} scenario${savedScenarios.length === 1 ? "" : "s"}: ${preview}${remainder}.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save project.";
      setError(message);
      setProjectStatus("");
    } finally {
      setProjectLoading(false);
    }
  }

  async function loadProjectModel(continueToEngineering = false) {
    if (!selectedProjectId) {
      setError("Select a project before loading a hydraulic model.");
      return;
    }

    setProjectLoading(true);
    setError("");
    setProjectStatus("Loading hydraulic model…");

    try {
      const response = await fetch(
        `${API_BASE_URL}/projects/${selectedProjectId}/hydraulics`
      );

      let saved: SavedHydraulicModel | SavedScenario;
      let loadedFromScenario: SavedScenario | null = null;

      if (response.ok) {
        saved = await response.json();
      } else {
        // Older / scenario-based pressure-drop projects may not have a separate
        // project-level HydraulicModel row. Reuse the most recently updated
        // saved scenario instead of making the user rebuild the hydraulic system.
        const scenariosResponse = await fetch(
          `${API_BASE_URL}/projects/${selectedProjectId}/scenarios`
        );

        if (!scenariosResponse.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(
            body?.detail ??
              `This project has no loadable hydraulic model (${response.status}).`
          );
        }

        const savedScenarios: SavedScenario[] = await scenariosResponse.json();

        if (savedScenarios.length === 0) {
          const body = await response.json().catch(() => ({}));
          throw new Error(
            body?.detail ??
              "This project does not yet contain a saved hydraulic model or scenario."
          );
        }

        loadedFromScenario = [...savedScenarios].sort(
          (a, b) =>
            new Date(b.updated_at ?? b.created_at).getTime() -
            new Date(a.updated_at ?? a.created_at).getTime()
        )[0];

        saved = loadedFromScenario;
        setSelectedScenarioId(String(loadedFromScenario.id));
      }

      const fluid = saved.fluid_config ?? {};

      const savedEngineeringTask =
        fluid.engineering_task === "pump_sizing"
          ? "pump_sizing"
          : fluid.engineering_task === "pressure_drop"
            ? "pressure_drop"
            : engineeringTask;

      if (savedEngineeringTask) {
        setEngineeringTask(savedEngineeringTask);
      }

      if (fluid.pump_sizing && typeof fluid.pump_sizing === "object") {
        const pump = fluid.pump_sizing as Record<string, unknown>;
        if (pump.source_pressure_bar_a != null) {
          setPumpSourcePressure(String(pump.source_pressure_bar_a));
        }
        if (pump.destination_pressure_bar_a != null) {
          setPumpDestinationPressure(String(pump.destination_pressure_bar_a));
        }
        if (pump.pump_efficiency != null) {
          setPumpEfficiency(String(pump.pump_efficiency));
        }
        if (pump.motor_margin != null) {
          setPumpMotorMargin(String(pump.motor_margin));
        }
        if (pump.pump_after_element_index != null) {
          setPumpAfterElementIndex(String(pump.pump_after_element_index));
        }
      }

      setCalculationIntent(saved.calculation_intent ?? "pressure_drop");
      setFlowValue(String(saved.flow_value));
      setFlowUnit(normalizeFlowUnit(saved.flow_unit));
      setInletPressure(
        saved.inlet_pressure_bar_a == null ? "" : String(saved.inlet_pressure_bar_a)
      );
      setPropertyReferencePressure(
        saved.property_reference_pressure_bar_a == null
          ? "1.01325"
          : String(saved.property_reference_pressure_bar_a)
      );

      if (fluid.mode === "manual" || fluid.mode === "coolprop") {
        setFluidMode(fluid.mode);
      }

      if (typeof fluid.selected_fluid === "string") {
        setSelectedFluid(fluid.selected_fluid);
        setFluidSearch(fluid.selected_fluid);
      } else if (typeof fluid.fluid === "string" && fluid.mode !== "manual") {
        setSelectedFluid(fluid.fluid);
        setFluidSearch(fluid.fluid);
      }

      if (typeof fluid.manual_fluid_name === "string") {
        setManualFluidName(fluid.manual_fluid_name);
      } else if (typeof fluid.fluid === "string" && fluid.mode === "manual") {
        setManualFluidName(fluid.fluid);
      }

      if (typeof fluid.phase_type === "string") {
        setPhaseType(fluid.phase_type);
      }
      if (fluid.temperature_c != null) setTemperatureC(String(fluid.temperature_c));
      if (fluid.density_kg_m3 != null) setDensity(String(fluid.density_kg_m3));
      if (fluid.dynamic_viscosity_pa_s != null) setViscosity(String(fluid.dynamic_viscosity_pa_s));
      if (fluid.vapor_pressure_bar_a != null) setVaporPressure(String(fluid.vapor_pressure_bar_a));
      if (fluid.molecular_weight_kg_kmol != null) setMolecularWeight(String(fluid.molecular_weight_kg_kmol));
      if (fluid.compressibility_factor != null) setCompressibilityFactor(String(fluid.compressibility_factor));
      if (fluid.gamma != null) setGamma(String(fluid.gamma));

      if (fluid.coolprop_properties && typeof fluid.coolprop_properties === "object") {
        setCoolPropProperties(fluid.coolprop_properties as FluidProperties);
      } else {
        setCoolPropProperties(null);
      }

      const loadedElements = Array.isArray(saved.elements) ? saved.elements : [];
      setElements(loadedElements);
      setNextElementId(
        loadedElements.reduce((maximum, item) => Math.max(maximum, Number(item.id) || 0), 0) + 1
      );
      setResult(null);
      setPromptInterpretation(null);
      setPromptFeedback("Hydraulic model loaded from project.");
      setProjectStatus(
        savedEngineeringTask === "pump_sizing"
          ? loadedFromScenario
            ? `Loaded pump-sizing definition from saved scenario “${loadedFromScenario.name}”.`
            : "Existing pump-sizing model loaded."
          : loadedFromScenario
            ? `Hydraulic definition loaded from saved scenario “${loadedFromScenario.name}”.`
            : "Hydraulic model loaded from project."
      );
      setActivePage("fluid");

      if (continueToEngineering) {
        setAnalysisType(null);
        setScenarioDefinitionMode(null);
        setScenarioDefinitionRoute(null);
        setPumpResult(null);
        setWizardStep(savedEngineeringTask === "pump_sizing" ? "analysis" : "engineering");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load hydraulic model.";
      setError(message);
      setProjectStatus("");
    } finally {
      setProjectLoading(false);
    }
  }

  async function refreshScenarios(projectId: string, selectNewest = false) {
    if (!projectId) {
      setScenarios([]);
      setSelectedScenarioId("");
      return [];
    }

    const response = await fetch(`${API_BASE_URL}/projects/${projectId}/scenarios`);

    if (!response.ok) {
      throw new Error(`Unable to load scenarios (${response.status}).`);
    }

    const data: SavedScenario[] = await response.json();
    setScenarios(data);

    if (selectNewest && data.length > 0) {
      setSelectedScenarioId(String(data[data.length - 1].id));
    }

    return data;
  }

  function buildScenarioPayload(name: string, description: string | null) {
    const numericFlow = Number(flowValue);

    if (!Number.isFinite(numericFlow) || numericFlow <= 0) {
      throw new Error("Enter a valid positive flow rate before saving a scenario.");
    }

    return {
      name,
      description,
      calculation_intent: calculationIntent,
      flow_value: numericFlow,
      flow_unit: normalizeFlowUnit(flowUnit),
      inlet_pressure_bar_a: inletPressure.trim()
        ? Number(inletPressure)
        : null,
      property_reference_pressure_bar_a: propertyReferencePressure.trim()
        ? Number(propertyReferencePressure)
        : null,
      fluid_config: buildProjectFluidConfig(),
      elements,
    };
  }

  function startScenarioDefinition() {
    if (!selectedProjectId) {
      setError("Select or create a project before defining a scenario.");
      return;
    }

    setScenarioDefinitionMode("new");
    setScenarioDefinitionRoute(null);
    setWorkingScenarioName("");
    setWorkingScenarioDescription("");
    setNewScenarioName("");
    setNewScenarioDescription("");
    setSelectedScenarioId("");
    setResult(null);
    setPumpResult(null);
    setSystemCurve(null);
    setError("");
    setScenarioStatus("Choose how you want to define this scenario: Engineering Assistant or Manual.");
    // When starting an additional scenario from the Saved Scenarios workspace,
    // return to the input-method choice instead of leaving the previous Results page active.
    setWizardStep("method");
    setActivePage("fluid");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function chooseScenarioDefinitionRoute(route: "assistant" | "manual") {
    setScenarioDefinitionRoute(route);
    setResult(null);
    setPumpResult(null);
    setSystemCurve(null);
    setError("");
    setScenarioStatus(
      route === "assistant"
        ? "Scenario definition started with the Engineering Assistant. Describe the case, review the interpreted inputs, then continue through the workflow and calculate."
        : "Manual scenario definition started. Complete Fluid & Flow, Build Line and calculate the case before saving it."
    );
    setActivePage(route === "assistant" ? "assistant" : "fluid");
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
  }

  function cancelScenarioDefinition() {
    setScenarioDefinitionMode(null);
    setScenarioDefinitionRoute(null);
    setWorkingScenarioName("");
    setWorkingScenarioDescription("");
    setScenarioStatus("Scenario definition cancelled. The current model remains on screen.");
  }

  async function completeScenarioDefinition() {
    if (!selectedProjectId || !scenarioDefinitionMode || !workingScenarioName.trim()) {
      setError(!workingScenarioName.trim() ? "Enter a scenario name before saving the completed scenario." : "No scenario definition is currently active.");
      return;
    }

    if (!result && !pumpResult) {
      setError(
        engineeringTask === "pump_sizing"
          ? "Calculate the pump duty before completing the scenario."
          : "Calculate the hydraulic model before completing the scenario."
      );
      return;
    }

    if (scenarioDefinitionMode === "edit" && !selectedScenarioId) {
      setError("The scenario being edited could not be identified. Reload it and try again.");
      return;
    }

    setScenarioLoading(true);
    setError("");
    setScenarioStatus("Completing scenario…");

    try {
      const payload = buildScenarioPayload(
        workingScenarioName.trim(),
        workingScenarioDescription.trim() || null
      );

      const isEdit = scenarioDefinitionMode === "edit";
      const url = isEdit
        ? `${API_BASE_URL}/projects/${selectedProjectId}/scenarios/${selectedScenarioId}`
        : `${API_BASE_URL}/projects/${selectedProjectId}/scenarios`;

      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Unable to complete scenario (${response.status}).`);
      }

      const saved: SavedScenario = await response.json();
      await refreshScenarios(selectedProjectId);
      setSelectedScenarioId(String(saved.id));
      setScenarioDefinitionMode(null);
      setScenarioDefinitionRoute(null);
      setWorkingScenarioName("");
      setWorkingScenarioDescription("");
      setNewScenarioName("");
      setNewScenarioDescription("");
      setScenarioStatus(`Scenario “${saved.name}” completed and saved.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to complete scenario.";
      setError(message);
      setScenarioStatus("");
    } finally {
      setScenarioLoading(false);
    }
  }

  async function createScenario() {
    if (!selectedProjectId) {
      setError("Select or create a project before creating a scenario.");
      return;
    }

    const name = newScenarioName.trim();
    if (!name) {
      setError("Enter a scenario name before creating a scenario.");
      return;
    }

    setScenarioLoading(true);
    setError("");
    setScenarioStatus("Creating scenario…");

    try {
      const payload = buildScenarioPayload(
        name,
        newScenarioDescription.trim() || null
      );

      const response = await fetch(
        `${API_BASE_URL}/projects/${selectedProjectId}/scenarios`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Unable to create scenario (${response.status}).`);
      }

      const created: SavedScenario = await response.json();
      await refreshScenarios(selectedProjectId);
      setSelectedScenarioId(String(created.id));
      setNewScenarioName("");
      setNewScenarioDescription("");
      setScenarioStatus(`Scenario “${created.name}” created from the current model.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create scenario.";
      setError(message);
      setScenarioStatus("");
    } finally {
      setScenarioLoading(false);
    }
  }

  async function duplicateScenario() {
    if (!selectedProjectId || !selectedScenario) {
      setError("Select a scenario before duplicating it.");
      return;
    }

    const suggestedName = `${selectedScenario.name} Copy`;
    const duplicateName = window.prompt("Name the new scenario:", suggestedName)?.trim();
    if (!duplicateName) return;

    applySavedHydraulicState(selectedScenario);
    setScenarioDefinitionMode("new");
    setScenarioDefinitionRoute("manual");
    setWorkingScenarioName(duplicateName);
    setWorkingScenarioDescription(selectedScenario.description ?? "");
    setSelectedScenarioId("");
    setScenarioStatus(`New scenario “${duplicateName}” started from “${selectedScenario.name}”. Modify it, calculate, then complete it from Results.`);
    setActivePage("fluid");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveScenario() {
    if (!selectedProjectId || !selectedScenarioId || !selectedScenario) {
      setError("Select a scenario before saving changes.");
      return;
    }

    setScenarioLoading(true);
    setError("");
    setScenarioStatus("Saving scenario…");

    try {
      const payload = buildScenarioPayload(
        selectedScenario.name,
        selectedScenario.description
      );

      const response = await fetch(
        `${API_BASE_URL}/projects/${selectedProjectId}/scenarios/${selectedScenarioId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Unable to save scenario (${response.status}).`);
      }

      await response.json();
      await refreshScenarios(selectedProjectId);
      setScenarioStatus(`Scenario “${selectedScenario.name}” updated.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save scenario.";
      setError(message);
      setScenarioStatus("");
    } finally {
      setScenarioLoading(false);
    }
  }

  function applySavedHydraulicState(saved: SavedHydraulicModel | SavedScenario) {
    const fluid = saved.fluid_config ?? {};

    setCalculationIntent(saved.calculation_intent ?? "pressure_drop");
    setFlowValue(String(saved.flow_value));
    setFlowUnit(normalizeFlowUnit(saved.flow_unit));
    setInletPressure(
      saved.inlet_pressure_bar_a == null ? "" : String(saved.inlet_pressure_bar_a)
    );
    setPropertyReferencePressure(
      saved.property_reference_pressure_bar_a == null
        ? "1.01325"
        : String(saved.property_reference_pressure_bar_a)
    );

    if (fluid.mode === "manual" || fluid.mode === "coolprop") {
      setFluidMode(fluid.mode);
    }

    if (typeof fluid.selected_fluid === "string") {
      setSelectedFluid(fluid.selected_fluid);
      setFluidSearch(fluid.selected_fluid);
    } else if (typeof fluid.fluid === "string" && fluid.mode !== "manual") {
      setSelectedFluid(fluid.fluid);
      setFluidSearch(fluid.fluid);
    }

    if (typeof fluid.manual_fluid_name === "string") {
      setManualFluidName(fluid.manual_fluid_name);
    } else if (typeof fluid.fluid === "string" && fluid.mode === "manual") {
      setManualFluidName(fluid.fluid);
    }

    if (typeof fluid.phase_type === "string") {
      setPhaseType(fluid.phase_type);
    }
    if (fluid.temperature_c != null) setTemperatureC(String(fluid.temperature_c));
    if (fluid.density_kg_m3 != null) setDensity(String(fluid.density_kg_m3));
    if (fluid.dynamic_viscosity_pa_s != null) setViscosity(String(fluid.dynamic_viscosity_pa_s));
    if (fluid.vapor_pressure_bar_a != null) setVaporPressure(String(fluid.vapor_pressure_bar_a));
    if (fluid.molecular_weight_kg_kmol != null) setMolecularWeight(String(fluid.molecular_weight_kg_kmol));
    if (fluid.compressibility_factor != null) setCompressibilityFactor(String(fluid.compressibility_factor));
    if (fluid.gamma != null) setGamma(String(fluid.gamma));

    if (fluid.coolprop_properties && typeof fluid.coolprop_properties === "object") {
      setCoolPropProperties(fluid.coolprop_properties as FluidProperties);
    } else {
      setCoolPropProperties(null);
    }

    if (fluid.engineering_task === "pump_sizing") {
      setEngineeringTask("pump_sizing");
    }

    if (fluid.pump_sizing && typeof fluid.pump_sizing === "object") {
      const pump = fluid.pump_sizing as Record<string, unknown>;
      if (pump.source_pressure_bar_a != null) {
        setPumpSourcePressure(String(pump.source_pressure_bar_a));
      }
      if (pump.destination_pressure_bar_a != null) {
        setPumpDestinationPressure(String(pump.destination_pressure_bar_a));
      }
      if (pump.pump_efficiency != null) {
        setPumpEfficiency(String(pump.pump_efficiency));
      }
      if (pump.motor_margin != null) {
        setPumpMotorMargin(String(pump.motor_margin));
      }
      if (pump.pump_after_element_index != null) {
        setPumpAfterElementIndex(String(pump.pump_after_element_index));
      } else {
        setPumpAfterElementIndex("0");
      }
    }

    if (fluid.system_curve && typeof fluid.system_curve === "object") {
      const curve = fluid.system_curve as Record<string, unknown>;
      if (curve.max_flow_factor != null) {
        setSystemCurveMaxFactor(String(curve.max_flow_factor));
      }
      if (curve.number_points != null) {
        setSystemCurvePoints(String(curve.number_points));
      }
    }

    const loadedElements = Array.isArray(saved.elements) ? saved.elements : [];
    setElements(loadedElements);
    setNextElementId(
      loadedElements.reduce((maximum, item) => Math.max(maximum, Number(item.id) || 0), 0) + 1
    );
    setResult(null);
    setPromptInterpretation(null);
    setActivePage("fluid");
  }

  async function loadScenario() {
    if (!selectedProjectId || !selectedScenarioId) {
      setError("Select a scenario before loading it.");
      return;
    }

    setScenarioLoading(true);
    setError("");
    setScenarioStatus("Loading scenario…");

    try {
      const response = await fetch(
        `${API_BASE_URL}/projects/${selectedProjectId}/scenarios/${selectedScenarioId}`
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Unable to load scenario (${response.status}).`);
      }

      const saved: SavedScenario = await response.json();
      applySavedHydraulicState(saved);
      setScenarioDefinitionMode("edit");
      setScenarioDefinitionRoute("manual");
      setWorkingScenarioName(saved.name);
      setWorkingScenarioDescription(saved.description ?? "");
      setPromptFeedback(`Scenario “${saved.name}” loaded for editing.`);
      setScenarioStatus(`Editing scenario “${saved.name}”. Use the full workflow, recalculate, then save the completed scenario from Results.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load scenario.";
      setError(message);
      setScenarioStatus("");
    } finally {
      setScenarioLoading(false);
    }
  }

  async function loadScenarioById(scenario: SavedScenario) {
    setAnalysisType("scenario");
    setWizardStep("engineering");
    if (!selectedProjectId) return;

    setScenarioLoading(true);
    setError("");
    setSelectedScenarioId(String(scenario.id));
    setScenarioStatus("Loading scenario…");

    try {
      const response = await fetch(
        `${API_BASE_URL}/projects/${selectedProjectId}/scenarios/${scenario.id}`
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Unable to load scenario (${response.status}).`);
      }

      const saved: SavedScenario = await response.json();
      applySavedHydraulicState(saved);
      setScenarioDefinitionMode("edit");
      setScenarioDefinitionRoute("manual");
      setWorkingScenarioName(saved.name);
      setWorkingScenarioDescription(saved.description ?? "");
      setPromptFeedback(`Scenario “${saved.name}” loaded for editing.`);
      setScenarioStatus(`Editing scenario “${saved.name}”. Recalculate, then save the completed scenario from Results.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load scenario.";
      setError(message);
      setScenarioStatus("");
    } finally {
      setScenarioLoading(false);
    }
  }

  function startNewFromScenario(scenario: SavedScenario) {
    const suggestedName = `${scenario.name} Copy`;
    const duplicateName = window.prompt("Name the new scenario:", suggestedName)?.trim();
    if (!duplicateName) return;

    applySavedHydraulicState(scenario);
    setScenarioDefinitionMode("new");
    setScenarioDefinitionRoute("manual");
    setWorkingScenarioName(duplicateName);
    setWorkingScenarioDescription(scenario.description ?? "");
    setSelectedScenarioId("");
    setScenarioStatus(`New scenario “${duplicateName}” started from “${scenario.name}”. Modify it, calculate, then save it from Results.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteScenario(targetScenario?: SavedScenario) {
    const scenario = targetScenario ?? selectedScenario;

    if (!selectedProjectId || !scenario) {
      setError("Select a scenario before deleting it.");
      return;
    }

    const confirmed = window.confirm(
      `Delete scenario “${scenario.name}”? This removes only this design case and cannot be undone.`
    );
    if (!confirmed) return;

    setScenarioLoading(true);
    setError("");
    setScenarioStatus("Deleting scenario…");

    try {
      const response = await fetch(
        `${API_BASE_URL}/projects/${selectedProjectId}/scenarios/${scenario.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Unable to delete scenario (${response.status}).`);
      }

      if (String(scenario.id) === selectedScenarioId) {
        setSelectedScenarioId("");
      }
      await refreshScenarios(selectedProjectId);
      setScenarioComparisonRows([]);
      setScenarioComparisonStatus("");
      setScenarioStatus(`Scenario “${scenario.name}” deleted.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete scenario.";
      setError(message);
      setScenarioStatus("");
    } finally {
      setScenarioLoading(false);
    }
  }

  // ========================================================
  // SCENARIO COMPARISON
  // ========================================================

  function findUpstreamPipeInList(
    scenarioElements: LineElement[],
    elementId: number
  ): LineElement | null {
    const elementIndex = scenarioElements.findIndex((item) => item.id === elementId);
    if (elementIndex <= 0) return null;

    for (let i = elementIndex - 1; i >= 0; i -= 1) {
      if (scenarioElements[i].type === "Pipe") return scenarioElements[i];
    }

    return null;
  }

  function buildApiElementsForScenario(scenarioElements: LineElement[]) {
    return scenarioElements.map((element) => {
      if (element.type === "Pipe") {
        let idMm: number;
        let roughnessMm: number;

        if (element.pipeMode === "custom") {
          idMm = Number(element.custom_id_mm);
          roughnessMm = Number(element.custom_roughness_mm);
        } else {
          const standard = resolveStandardPipe(element);
          idMm = Number(standard.id_mm);
          roughnessMm = Number(standard.roughness_mm);
        }

        if (!Number.isFinite(idMm) || idMm <= 0) {
          throw new Error(`Unable to resolve a valid internal diameter for pipe "${element.description}".`);
        }
        if (!Number.isFinite(roughnessMm) || roughnessMm < 0) {
          throw new Error(`Unable to resolve a valid roughness for pipe "${element.description}".`);
        }

        return {
          type: element.type,
          description: element.description,
          length_m: Number(element.length_m),
          id_mm: idMm,
          roughness_mm: roughnessMm,
          dz_m: Number(element.dz_m ?? 0),
          nps: element.pipeMode === "standard" ? element.nps : undefined,
          schedule: element.pipeMode === "standard" ? element.schedule : undefined,
          material: element.pipeMode === "standard" ? element.material : undefined,
        };
      }

      if (element.type === "Resistance / Fitting") {
        const pipeBasis =
          element.fittingPipeBasis === "override"
            ? element
            : findUpstreamPipeInList(scenarioElements, element.id);

        if (!pipeBasis) {
          throw new Error(`Fitting "${element.description}" has no upstream pipe to inherit from.`);
        }

        let idMm: number;
        let roughnessMm: number;

        if (pipeBasis.pipeMode === "custom") {
          idMm = Number(pipeBasis.custom_id_mm);
          roughnessMm = Number(pipeBasis.custom_roughness_mm);
        } else {
          const standard = resolveStandardPipe(pipeBasis);
          idMm = Number(standard.id_mm);
          roughnessMm = Number(standard.roughness_mm);
        }

        if (!Number.isFinite(idMm) || idMm <= 0 || !Number.isFinite(roughnessMm) || roughnessMm < 0) {
          throw new Error(`Unable to resolve the pipe basis for fitting "${element.description}".`);
        }

        return {
          type: element.type,
          description: element.description,
          id_mm: idMm,
          roughness_mm: roughnessMm,
          nps: pipeBasis.pipeMode === "standard" ? pipeBasis.nps : undefined,
          schedule: pipeBasis.pipeMode === "standard" ? pipeBasis.schedule : undefined,
          material: pipeBasis.pipeMode === "standard" ? pipeBasis.material : undefined,
          k_total: Number(element.k_total),
          k_each: element.fittingKEach ? Number(element.fittingKEach) : undefined,
          quantity: element.fittingQuantity ? Number(element.fittingQuantity) : undefined,
          database_selection: element.fittingSelection || undefined,
          fitting_method: element.fittingMethod || undefined,
          fitting_ft: element.fittingFt ? Number(element.fittingFt) : undefined,
          fitting_multiplier: element.fittingMultiplier ? Number(element.fittingMultiplier) : undefined,
          fitting_expression: element.fittingExpression || undefined,
        };
      }

      if (element.type === "Known Equipment ΔP") {
        return {
          type: element.type,
          description: element.description,
          known_dp_bar: Number(element.known_dp_bar),
        };
      }

      return {
        type: element.type,
        description: element.description,
        dz_m: Number(element.dz_m),
      };
    });
  }

  async function buildSolveFluidConfigForScenario(scenario: SavedScenario) {
    const fluid = scenario.fluid_config ?? {};
    const mode = fluid.mode === "manual" ? "manual" : "coolprop";
    const scenarioPhase = fluid.phase_type === "Gas" ? "Gas" : "Liquid";
    const temperature = Number(fluid.temperature_c);
    const pressureDropWithoutInlet =
      scenario.calculation_intent === "pressure_drop" && scenario.inlet_pressure_bar_a == null;

    if (mode === "coolprop") {
      const selected = String(fluid.selected_fluid ?? "").trim();
      if (!selected) throw new Error("Saved automatic-database fluid is missing.");
      if (!Number.isFinite(temperature)) throw new Error("Saved fluid temperature is invalid.");

      if (pressureDropWithoutInlet) {
        let props =
          fluid.coolprop_properties && typeof fluid.coolprop_properties === "object"
            ? (fluid.coolprop_properties as FluidProperties)
            : null;

        if (!props) {
          const propertyPressure = Number(scenario.property_reference_pressure_bar_a ?? 1.01325);
          const response = await fetch(`${API_BASE_URL}/fluids/properties`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fluid: selected,
              temperature_c: temperature,
              pressure_bar_a: propertyPressure,
            }),
          });

          if (!response.ok) {
            throw new Error(`Unable to load fluid properties (${response.status}).`);
          }
          props = (await response.json()) as FluidProperties;
        }

        return {
          phase_type: props.phase_type === "Gas" ? "Gas" : "Liquid",
          fluid: selected,
          temperature_c: temperature,
          use_manual_properties: true,
          density_kg_m3: props.density_kg_m3 ?? null,
          dynamic_viscosity_pa_s: props.dynamic_viscosity_pa_s ?? null,
          vapor_pressure_bar_a: props.vapor_pressure_bar_a ?? null,
          molecular_weight_kg_kmol: props.molecular_weight_kg_kmol ?? null,
          gamma: props.gamma ?? null,
        };
      }

      return {
        phase_type: scenarioPhase,
        fluid: selected,
        temperature_c: temperature,
        use_manual_properties: false,
      };
    }

    const manualName = String(fluid.manual_fluid_name ?? "Manual fluid");
    if (scenarioPhase === "Liquid") {
      return {
        phase_type: "Liquid",
        fluid: manualName,
        temperature_c: temperature,
        use_manual_properties: true,
        density_kg_m3: Number(fluid.density_kg_m3),
        dynamic_viscosity_pa_s: Number(fluid.dynamic_viscosity_pa_s),
        vapor_pressure_bar_a:
          String(fluid.vapor_pressure_bar_a ?? "").trim()
            ? Number(fluid.vapor_pressure_bar_a)
            : null,
      };
    }

    return {
      phase_type: "Gas",
      fluid: manualName,
      temperature_c: temperature,
      use_manual_properties: true,
      dynamic_viscosity_pa_s: Number(fluid.dynamic_viscosity_pa_s),
      molecular_weight_kg_kmol: Number(fluid.molecular_weight_kg_kmol),
      compressibility_factor: Number(fluid.compressibility_factor),
      gamma: Number(fluid.gamma),
    };
  }

  function getScenarioMainPipeIdMm(scenario: SavedScenario): number | null {
    const pipe = scenario.elements.find((element) => element.type === "Pipe");
    if (!pipe) return null;

    if (pipe.pipeMode === "custom") {
      const value = Number(pipe.custom_id_mm);
      return Number.isFinite(value) && value > 0 ? value : null;
    }

    const standard = resolveStandardPipe(pipe);
    const value = Number(standard.id_mm);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  async function openProjectOverview() {
    if (!selectedProjectId) {
      setError("Select a project to open.");
      return;
    }

    setProjectLoading(true);
    setProjectStatus("Loading project overview…");
    setError("");
    setAnalysisType("scenario");
    setScenarioDefinitionMode(null);
    setScenarioDefinitionRoute(null);
    setSelectedScenarioId("");
    setResult(null);

    try {
      const savedScenarios = await refreshScenarios(selectedProjectId);

      if (savedScenarios.length > 0) {
        const projectTasks = new Set(
          savedScenarios.map((scenario) =>
            (scenario.fluid_config ?? {}).engineering_task === "pump_sizing"
              ? "pump_sizing"
              : "pressure_drop"
          )
        );

        if (projectTasks.size === 1) {
          setEngineeringTask(
            projectTasks.has("pump_sizing") ? "pump_sizing" : "pressure_drop"
          );
        }
      }

      setWizardStep("overview");

      if (savedScenarios.length > 0) {
        await compareScenarios(savedScenarios);
        setProjectStatus("");
      } else {
        setScenarioComparisonRows([]);
        setScenarioComparisonStatus("No saved scenarios are currently associated with this project.");
        setProjectStatus("");
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load project overview.";
      setError(message);
      setProjectStatus("");
    } finally {
      setProjectLoading(false);
    }
  }

  async function compareScenarios(scenariosToCompare: SavedScenario[] = scenarios) {
    if (!selectedProjectId) {
      setError("Select a project before comparing scenarios.");
      return;
    }
    if (scenariosToCompare.length === 0) {
      setError("Create at least one scenario before running scenario comparison.");
      return;
    }

    setScenarioComparisonLoading(true);
    setScenarioComparisonRows([]);
    setScenarioComparisonStatus(
      `Calculating ${scenariosToCompare.length} scenario${scenariosToCompare.length === 1 ? "" : "s"}…`
    );
    setError("");

    const rows: ScenarioComparisonRow[] = [];

    for (const scenario of scenariosToCompare) {
      const savedFluid = (scenario.fluid_config ?? {}) as Record<string, unknown>;
      const task =
        savedFluid.engineering_task === "pump_sizing"
          ? "pump_sizing"
          : "pressure_drop";

      try {
        const fluidConfig = await buildSolveFluidConfigForScenario(scenario);
        const apiElements = buildApiElementsForScenario(scenario.elements);

        if (task === "pump_sizing") {
          const pumpMeta =
            savedFluid.pump_sizing && typeof savedFluid.pump_sizing === "object"
              ? (savedFluid.pump_sizing as Record<string, unknown>)
              : {};

          const sourcePressure = Number(pumpMeta.source_pressure_bar_a ?? 1);
          const destinationPressure = Number(pumpMeta.destination_pressure_bar_a ?? 1);
          const efficiency = Number(pumpMeta.pump_efficiency ?? 0.70);
          const motorMargin = Number(pumpMeta.motor_margin ?? 1.10);
          const pumpAfterIndex = Number(pumpMeta.pump_after_element_index ?? 0);

          const response = await fetch(`${API_BASE_URL}/hydraulics/pump-sizing`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fluid_config: fluidConfig,
              design_flow_value: scenario.flow_value,
              flow_unit: normalizeFlowUnit(scenario.flow_unit),
              source_pressure_bar_a: sourcePressure,
              destination_pressure_bar_a: destinationPressure,
              elements: apiElements,
              pump_efficiency: efficiency,
              motor_margin: motorMargin,
              pump_after_element_index: pumpAfterIndex,
            }),
          });

          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            const detail = body?.detail;
            throw new Error(
              typeof detail === "string"
                ? detail
                : detail
                  ? JSON.stringify(detail)
                  : `Pump sizing error ${response.status}`
            );
          }

          const solved: PumpSizingResult = await response.json();
          const velocities = solved.line_result.elements
            .map((element) => element.velocity_m_s)
            .filter((value): value is number => value !== null);

          const curveMeta =
            savedFluid.system_curve && typeof savedFluid.system_curve === "object"
              ? (savedFluid.system_curve as Record<string, unknown>)
              : {};

          rows.push({
            scenario_id: scenario.id,
            name: scenario.name,
            description: scenario.description,
            engineering_task: "pump_sizing",
            flow_value: scenario.flow_value,
            flow_unit: normalizeFlowUnit(scenario.flow_unit),
            main_pipe_id_mm: getScenarioMainPipeIdMm(scenario),
            maximum_velocity_m_s: velocities.length ? Math.max(...velocities) : null,
            total_dp_bar: solved.system.total_dp_bar,
            outlet_pressure_bar_a: null,
            required_pump_head_m: solved.pump_duty.required_differential_head_m,
            required_pump_dp_bar: solved.pump_duty.required_differential_pressure_bar,
            shaft_power_kw: solved.pump_duty.shaft_power_kw,
            minimum_motor_power_kw: solved.pump_duty.minimum_motor_rating_kw,
            system_curve_max_factor:
              curveMeta.max_flow_factor != null ? Number(curveMeta.max_flow_factor) : null,
            warning_count: solved.warnings?.length ?? 0,
            error: null,
          });
        } else {
          const response = await fetch(`${API_BASE_URL}/hydraulics/solve-line`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fluid_config: fluidConfig,
              flow_value: scenario.flow_value,
              flow_unit: normalizeFlowUnit(scenario.flow_unit),
              calculation_intent: scenario.calculation_intent,
              inlet_pressure_bar_a: scenario.inlet_pressure_bar_a,
              property_reference_pressure_bar_a:
                scenario.calculation_intent === "pressure_drop" && scenario.inlet_pressure_bar_a == null
                  ? scenario.property_reference_pressure_bar_a ?? 1.01325
                  : null,
              elements: apiElements,
            }),
          });

          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            const detail = body?.detail;
            throw new Error(
              typeof detail === "string"
                ? detail
                : detail
                  ? JSON.stringify(detail)
                  : `Solver error ${response.status}`
            );
          }

          const solved: SolveResult = await response.json();
          const velocities = solved.elements
            .map((element) => element.velocity_m_s)
            .filter((value): value is number => value !== null);

          rows.push({
            scenario_id: scenario.id,
            name: scenario.name,
            description: scenario.description,
            engineering_task: "pressure_drop",
            flow_value: scenario.flow_value,
            flow_unit: normalizeFlowUnit(scenario.flow_unit),
            main_pipe_id_mm: getScenarioMainPipeIdMm(scenario),
            maximum_velocity_m_s: velocities.length ? Math.max(...velocities) : null,
            total_dp_bar: solved.total_dp_bar,
            outlet_pressure_bar_a: solved.outlet_pressure_bar_a,
            required_pump_head_m: null,
            required_pump_dp_bar: null,
            shaft_power_kw: null,
            minimum_motor_power_kw: null,
            system_curve_max_factor: null,
            warning_count: solved.warnings?.length ?? 0,
            error: null,
          });
        }
      } catch (err) {
        rows.push({
          scenario_id: scenario.id,
          name: scenario.name,
          description: scenario.description,
          engineering_task: task,
          flow_value: scenario.flow_value,
          flow_unit: normalizeFlowUnit(scenario.flow_unit),
          main_pipe_id_mm: getScenarioMainPipeIdMm(scenario),
          maximum_velocity_m_s: null,
          total_dp_bar: null,
          outlet_pressure_bar_a: null,
          required_pump_head_m: null,
          required_pump_dp_bar: null,
          shaft_power_kw: null,
          minimum_motor_power_kw: null,
          system_curve_max_factor: null,
          warning_count: 0,
          error: err instanceof Error ? err.message : "Unable to calculate scenario.",
        });
      }
    }

    setScenarioComparisonRows(rows);
    const failed = rows.filter((row) => row.error).length;
    setScenarioComparisonStatus(
      failed
        ? `Comparison complete: ${rows.length - failed} calculated, ${failed} require review.`
        : `Comparison complete for ${rows.length} scenario${rows.length === 1 ? "" : "s"}.`
    );
    setScenarioComparisonLoading(false);
  }

  useEffect(() => {
    void refreshProjects().catch((err) => {
      console.error("Project loading error:", err);
    });
  }, []);

  useEffect(() => {
    setSelectedScenarioId("");
    setScenarioStatus("");
    setScenarioComparisonRows([]);
    setScenarioComparisonStatus("");

    if (!selectedProjectId) {
      setScenarios([]);
      return;
    }

    void refreshScenarios(selectedProjectId).catch((err) => {
      console.error("Scenario loading error:", err);
      setScenarios([]);
    });
  }, [selectedProjectId]);


  // ========================================================
  // ASSISTANT -> SOLVER HANDOFF
  // ========================================================

  useEffect(() => {
    if (!pendingAssistantSolve) return;

    // This effect runs after React has committed the interpreted fluid,
    // flow and line-element state. That prevents the solver from reading
    // stale pre-interpretation values.
    setPendingAssistantSolve(false);

    if (engineeringTask === "pump_sizing") {
      void calculatePumpSizing();
    } else {
      void solveHydraulics();
    }
  }, [pendingAssistantSolve, engineeringTask]);

  // ========================================================
  // LOAD DATABASES
  // ========================================================

  useEffect(() => {

    async function loadDatabases() {

      setDatabaseLoading(
        true
      );

      try {

        const [
          fluidsResponse,
          pipingResponse,
          fittingsResponse,
        ] =
          await Promise.all([
            fetch(
              `${API_BASE_URL}/fluids`
            ),

            fetch(
              `${API_BASE_URL}/piping/catalog`
            ),

            fetch(
              `${API_BASE_URL}/fittings`
            ),
          ]);


        if (
          fluidsResponse.ok
        ) {
          const data =
            await fluidsResponse.json();

          const catalogue: FluidCatalogueItem[] =
            Array.isArray(data.catalogue)
              ? data.catalogue
              : Array.isArray(data.fluids)
                ? data.fluids.map((fluid: string) => ({
                    id: fluid,
                    name: fluid,
                    formula: null,
                    category: null,
                    aliases: [],
                  }))
                : [];

          setAvailableFluids(catalogue);
          setFluidSearchResults(catalogue.slice(0, 20));
        }


        if (
          pipingResponse.ok
        ) {
          const data =
            await pipingResponse.json();

          setPipeCatalog(
            data
          );
        }

        if (
          fittingsResponse.ok
        ) {
          const data =
            await fittingsResponse.json();

          setFittingCatalog(
            data
          );
        }

      }

      catch (err) {
        console.error(
          "Database loading error:",
          err
        );
      }

      finally {
        setDatabaseLoading(
          false
        );
      }
    }


    loadDatabases();

  }, []);


  useEffect(() => {
    if (!fluidSearchFocused || fluidMode !== "coolprop") {
      return;
    }

    const query = fluidSearch.trim();

    const timer = window.setTimeout(async () => {
      if (!query) {
        setFluidSearchResults(availableFluids.slice(0, 20));
        return;
      }

      setFluidSearchLoading(true);

      try {
        const response = await fetch(
          `${API_BASE_URL}/fluids/search?q=${encodeURIComponent(query)}&limit=30`
        );

        if (!response.ok) {
          throw new Error(`Fluid search failed (${response.status}).`);
        }

        const data = await response.json();
        setFluidSearchResults(
          Array.isArray(data.fluids) ? data.fluids : []
        );
      } catch (err) {
        console.error("Fluid search error:", err);

        const q = query.toLowerCase();
        setFluidSearchResults(
          availableFluids
            .filter((item) => {
              const terms = [
                item.id,
                item.name,
                item.formula ?? "",
                item.cas ?? "",
                ...(item.aliases ?? []),
              ];
              return terms.some((term) =>
                String(term).toLowerCase().includes(q)
              );
            })
            .slice(0, 30)
        );
      } finally {
        setFluidSearchLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [fluidSearch, fluidSearchFocused, fluidMode, availableFluids]);


  // ========================================================
  // AUTOMATIC FLUID PROPERTIES
  // ========================================================

  async function loadFluidProperties() {

    if (!selectedFluid.trim()) {
      setError("Select a substance before loading fluid properties.");
      return;
    }

    setPropertyLoading(
      true
    );

    setError("");

    try {

      const response =
        await fetch(
          `${API_BASE_URL}/fluids/properties`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                fluid:
                  selectedFluid,

                temperature_c:
                  Number(
                    temperatureC
                  ),

                pressure_bar_a:
                  Number(
                    calculationIntent === "pressure_drop" && !inletPressure.trim()
                      ? propertyReferencePressure
                      : inletPressure
                  ),
              }),
          }
        );


      if (
        !response.ok
      ) {
        const body =
          await response.json();

        throw new Error(
          body.detail ??
          "Unable to calculate fluid properties."
        );
      }


      const properties:
        FluidProperties =
        await response.json();


      setCoolPropProperties(
        properties
      );


      if (
        properties.phase_type ===
        "Liquid"
        ||
        properties.phase_type ===
        "Gas"
      ) {
        setPhaseType(
          properties.phase_type
        );
      }

    }

    catch (err) {

      if (
        err instanceof
        Error
      ) {
        setError(
          err.message
        );
      }

    }

    finally {
      setPropertyLoading(
        false
      );
    }
  }


  // ========================================================
  // ELEMENT FUNCTIONS
  // ========================================================

  function addElement(
    type:
      ElementType
  ) {

    let element:
      LineElement;


    if (
      type ===
      "Pipe"
    ) {

      element = {
        id:
          nextElementId,

        type,

        description:
          `Pipe ${nextElementId}`,

        pipeMode:
          "standard",

        nps:
          "2",

        schedule:
          "Sch 40",

        material:
          "Commercial Steel",

        custom_id_mm:
          "52.48",

        custom_roughness_mm:
          "0.045",

        length_m:
          "10",

        dz_m:
          "0",
      };

    }

    else if (
      type ===
      "Resistance / Fitting"
    ) {

      element = {
        id:
          nextElementId,

        type,

        description:
          "Fitting",

        pipeMode:
          "standard",

        nps:
          "2",

        schedule:
          "Sch 40",

        material:
          "Commercial Steel",

        custom_id_mm:
          "52.48",

        custom_roughness_mm:
          "0.045",

        k_total:
          "1",

        fittingMode:
          "database",

        fittingPipeBasis:
          "inherit",

        fittingCategory:
          "",

        fittingSelection:
          "",

        fittingQuantity:
          "1",

        fittingOverrideEnabled:
          "false",

        fittingOverrideKEach:
          "",
      };

    }

    else if (
      type ===
      "Known Equipment ΔP"
    ) {

      element = {
        id:
          nextElementId,

        type,

        description:
          "Equipment",

        known_dp_bar:
          "0.1",
      };

    }

    else {

      element = {
        id:
          nextElementId,

        type,

        description:
          "Elevation change",

        dz_m:
          "1",
      };

    }


    setElements(
      [
        ...elements,
        element,
      ]
    );

    setNextElementId(
      nextElementId + 1
    );
  }


  function updateElement(
    id:
      number,

    field:
      keyof LineElement,

    value:
      string
  ) {

    setElements(
      (current) =>
        current.map(
          (element) =>
            element.id === id
              ? {
                  ...element,

                  [field]:
                    value,
                }
              : element
        )
    );
  }


  function removeElement(
    id:
      number
  ) {

    setElements(
      elements.filter(
        (element) =>
          element.id !== id
      )
    );
  }


  function moveElement(
    index:
      number,

    direction:
      number
  ) {

    const target =
      index
      + direction;


    if (
      target < 0
      ||
      target >=
      elements.length
    ) {
      return;
    }


    const updated = [
      ...elements,
    ];


    [
      updated[index],
      updated[target],
    ] = [
      updated[target],
      updated[index],
    ];


    setElements(
      updated
    );
  }


  // ========================================================
  // STANDARD PIPE LOOKUPS
  // ========================================================

  function normalizePipeToken(value: string | null | undefined) {
    return (value ?? "")
      .toLowerCase()
      .replace(/["']/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeNps(value: string | null | undefined) {
    return normalizePipeToken(value)
      .replace(/^nps\s*/i, "")
      .replace(/\s*in(ch(es)?)?$/i, "")
      .replace(/\s+/g, "");
  }

  function normalizeSchedule(value: string | null | undefined) {
    return normalizePipeToken(value)
      .replace(/^schedule\s*/i, "")
      .replace(/^sch\.?\s*/i, "")
      .replace(/\s+/g, "");
  }

  function resolveStandardPipe(
    element: LineElement
  ) {
    const requestedNps = normalizeNps(element.nps);
    const requestedSchedule = normalizeSchedule(element.schedule);
    const requestedMaterial = normalizePipeToken(element.material);

    const size =
      pipeCatalog?.sizes.find(
        (item) => normalizeNps(item.nps) === requestedNps
      );

    const schedule =
      size?.schedules.find(
        (item) => normalizeSchedule(item.schedule) === requestedSchedule
      );

    const material =
      pipeCatalog?.materials.find(
        (item) => {
          const candidate = normalizePipeToken(item.material);
          return (
            candidate === requestedMaterial ||
            candidate.includes(requestedMaterial) ||
            requestedMaterial.includes(candidate)
          );
        }
      );

    return {
      od_mm: size?.od_mm ?? null,
      id_mm: schedule?.id_mm ?? null,
      wall_mm: schedule?.wall_mm ?? null,
      roughness_mm: material?.roughness_mm ?? null,
    };
  }

  // ========================================================
  // PIPE CONTEXT / INHERITANCE
  // ========================================================

  function findUpstreamPipe(
    elementId: number
  ): LineElement | null {
    const elementIndex =
      elements.findIndex(
        (item) =>
          item.id === elementId
      );

    if (elementIndex <= 0) {
      return null;
    }

    for (
      let i = elementIndex - 1;
      i >= 0;
      i -= 1
    ) {
      if (
        elements[i].type ===
        "Pipe"
      ) {
        return elements[i];
      }
    }

    return null;
  }


  function getFittingPipeBasis(
    element: LineElement
  ): LineElement {
    if (
      element.type ===
        "Resistance / Fitting"
      &&
      element.fittingPipeBasis !==
        "override"
    ) {
      const upstreamPipe =
        findUpstreamPipe(
          element.id
        );

      if (upstreamPipe) {
        return upstreamPipe;
      }
    }

    return element;
  }


  // ========================================================
  // FITTING K CALCULATION
  // ========================================================

  async function calculateFittingK(
    element: LineElement
  ) {
    if (!element.fittingSelection) {
      setError("Select a Crane fitting before calculating K.");
      return;
    }

    if (
      element.fittingPipeBasis !== "override"
      &&
      !findUpstreamPipe(element.id)
    ) {
      setError(
        "This fitting is set to inherit its pipe basis, but no upstream pipe exists. Add a pipe before the fitting or choose Override Pipe Basis."
      );
      return;
    }

    const pipeBasis =
      getFittingPipeBasis(
        element
      );

    const nominalSizeMm =
      pipeBasis.pipeMode === "standard"
        ? npsToNominalMm(
            pipeBasis.nps ?? ""
          )
        : Number(
            pipeBasis.custom_id_mm
          );

    if (!Number.isFinite(nominalSizeMm) || nominalSizeMm <= 0) {
      setError("A valid nominal pipe size is required for the Crane K calculation.");
      return;
    }

    try {
      setError("");

      const overrideEnabled =
        element.fittingOverrideEnabled === "true";

      const response = await fetch(
        `${API_BASE_URL}/fittings/calculate-k`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            selection_label: element.fittingSelection,
            nominal_size_mm: nominalSizeMm,
            quantity: Math.max(1, Number(element.fittingQuantity ?? "1")),
            override_k_each: overrideEnabled
              ? Number(element.fittingOverrideKEach)
              : null,
          }),
        }
      );

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.detail ?? "Unable to calculate fitting K.");
      }

      const data: FittingKResult = await response.json();

      setElements((current) =>
        current.map((item) =>
          item.id === element.id
            ? {
                ...item,
                k_total: String(data.k_total),
                fittingDatabaseKEach: String(data.database_k_each),
                fittingKEach: String(data.k_each),
                fittingMethod: data.method,
                fittingFt: data.ft === null ? "" : String(data.ft),
                fittingMultiplier: data.multiplier === null ? "" : String(data.multiplier),
                fittingExpression: data.expression,
              }
            : item
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to calculate fitting K."
      );
    }
  }


  // ========================================================
  // API ELEMENTS
  // ========================================================

  function buildApiElements() {

    return elements.map(
      (element) => {

        if (
          element.type ===
          "Pipe"
        ) {

          let idMm:
            number;

          let roughnessMm:
            number;


          if (
            element.pipeMode ===
            "custom"
          ) {

            idMm =
              Number(
                element.custom_id_mm
              );

            roughnessMm =
              Number(
                element.custom_roughness_mm
              );

          }

          else {

            const standard =
              resolveStandardPipe(
                element
              );


            idMm =
              Number(
                standard.id_mm
              );

            roughnessMm =
              Number(
                standard.roughness_mm
              );

          }


          if (!Number.isFinite(idMm) || idMm <= 0) {
            const basis =
              element.pipeMode === "custom"
                ? `custom ID "${element.custom_id_mm ?? ""} mm"`
                : `NPS "${element.nps ?? ""}", schedule "${element.schedule ?? ""}"`;

            throw new Error(
              `Unable to resolve a valid internal diameter for pipe "${element.description}" (${basis}). ` +
              `Check the interpreted pipe size/schedule or select the pipe basis manually.`
            );
          }

          if (!Number.isFinite(roughnessMm) || roughnessMm < 0) {
            throw new Error(
              `Unable to resolve a valid roughness for pipe "${element.description}" using material "${element.material ?? ""}".`
            );
          }

          return {
            type:
              element.type,

            description:
              element.description,

            length_m:
              Number(
                element.length_m
              ),

            id_mm:
              idMm,

            roughness_mm:
              roughnessMm,

            dz_m:
              Number(
                element.dz_m ??
                0
              ),

            nps:
              element.pipeMode ===
              "standard"
                ? element.nps
                : undefined,

            schedule:
              element.pipeMode ===
              "standard"
                ? element.schedule
                : undefined,

            material:
              element.pipeMode ===
              "standard"
                ? element.material
                : undefined,
          };
        }


        if (
          element.type ===
          "Resistance / Fitting"
        ) {

          if (
            element.fittingPipeBasis !== "override"
            &&
            !findUpstreamPipe(element.id)
          ) {
            throw new Error(
              `Fitting "${element.description}" has no upstream pipe to inherit from.`
            );
          }

          const pipeBasis =
            getFittingPipeBasis(
              element
            );

          let idMm:
            number;

          let roughnessMm:
            number;


          if (
            pipeBasis.pipeMode ===
            "custom"
          ) {

            idMm =
              Number(
                pipeBasis.custom_id_mm
              );

            roughnessMm =
              Number(
                pipeBasis.custom_roughness_mm
              );

          }

          else {

            const standard =
              resolveStandardPipe(
                pipeBasis
              );


            idMm =
              Number(
                standard.id_mm
              );

            roughnessMm =
              Number(
                standard.roughness_mm
              );

          }


          return {
            type:
              element.type,

            description:
              element.description,

            id_mm:
              idMm,

            roughness_mm:
              roughnessMm,

            nps:
              pipeBasis.pipeMode === "standard"
                ? pipeBasis.nps
                : undefined,

            schedule:
              pipeBasis.pipeMode === "standard"
                ? pipeBasis.schedule
                : undefined,

            material:
              pipeBasis.pipeMode === "standard"
                ? pipeBasis.material
                : undefined,

            k_total:
              Number(
                element.k_total
              ),

            k_each:
              element.fittingKEach
                ? Number(element.fittingKEach)
                : undefined,

            quantity:
              element.fittingQuantity
                ? Number(element.fittingQuantity)
                : undefined,

            database_selection:
              element.fittingSelection || undefined,

            fitting_method:
              element.fittingMethod || undefined,

            fitting_ft:
              element.fittingFt
                ? Number(element.fittingFt)
                : undefined,

            fitting_multiplier:
              element.fittingMultiplier
                ? Number(element.fittingMultiplier)
                : undefined,

            fitting_expression:
              element.fittingExpression || undefined,
          };
        }


        if (
          element.type ===
          "Known Equipment ΔP"
        ) {

          return {
            type:
              element.type,

            description:
              element.description,

            known_dp_bar:
              Number(
                element.known_dp_bar
              ),
          };
        }


        return {
          type:
            element.type,

          description:
            element.description,

          dz_m:
            Number(
              element.dz_m
            ),
        };

      }
    );
  }


  // ========================================================
  // SOLVE
  // ========================================================

  async function solveHydraulics() {
    setSystemCurve(null);
    setPumpResult(null);

    setLoading(true);
    setError("");

    try {
      const pressureDropWithoutInlet =
        calculationIntent === "pressure_drop" &&
        !inletPressure.trim();

      if (
        calculationIntent !== "pressure_drop" &&
        !inletPressure.trim()
      ) {
        throw new Error(
          "Inlet absolute pressure is required for outlet-pressure or pressure-profile calculations."
        );
      }

      if (
        phaseType === "Gas" &&
        !inletPressure.trim()
      ) {
        throw new Error(
          "Inlet absolute pressure is required for gas/compressible-flow calculations."
        );
      }

      // The Assistant can now calculate directly.
      //
      // Automatic properties with an actual inlet pressure:
      //   let the backend evaluate the properties itself.
      //
      // Automatic-property pressure-drop-only with no inlet pressure:
      //   obtain one frozen property state at the chosen reference pressure,
      //   because the backend intentionally requires frozen/manual properties
      //   when no physical absolute pressure is available.
      let propertiesForSolve = coolPropProperties;

      if (
        fluidMode === "coolprop" &&
        pressureDropWithoutInlet &&
        !propertiesForSolve
      ) {
        const propertyPressure = Number(propertyReferencePressure);

        if (!Number.isFinite(propertyPressure) || propertyPressure <= 0) {
          throw new Error(
            "Enter a positive property reference pressure for the automatic fluid-property calculation."
          );
        }

        const propertiesResponse = await fetch(
          `${API_BASE_URL}/fluids/properties`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fluid: selectedFluid,
              temperature_c: Number(temperatureC),
              pressure_bar_a: propertyPressure,
            }),
          }
        );

        if (!propertiesResponse.ok) {
          const body = await propertiesResponse.json();
          const detail = body?.detail;
          throw new Error(
            typeof detail === "string"
              ? detail
              : detail
                ? JSON.stringify(detail)
                : `Unable to load fluid properties (${propertiesResponse.status}).`
          );
        }

        propertiesForSolve =
          (await propertiesResponse.json()) as FluidProperties;

        setCoolPropProperties(propertiesForSolve);

        if (
          propertiesForSolve.phase_type === "Liquid" ||
          propertiesForSolve.phase_type === "Gas"
        ) {
          setPhaseType(propertiesForSolve.phase_type);
        }
      }

      const fluidConfig =
        fluidMode === "coolprop"
          ? pressureDropWithoutInlet
            ? {
                phase_type:
                  propertiesForSolve?.phase_type === "Gas"
                    ? "Gas"
                    : propertiesForSolve?.phase_type === "Liquid"
                      ? "Liquid"
                      : phaseType,
                fluid: selectedFluid,
                temperature_c: Number(temperatureC),
                use_manual_properties: true,
                density_kg_m3:
                  propertiesForSolve?.density_kg_m3 ?? null,
                dynamic_viscosity_pa_s:
                  propertiesForSolve?.dynamic_viscosity_pa_s ?? null,
                vapor_pressure_bar_a:
                  propertiesForSolve?.vapor_pressure_bar_a ?? null,
                molecular_weight_kg_kmol:
                  propertiesForSolve?.molecular_weight_kg_kmol ?? null,
                gamma:
                  propertiesForSolve?.gamma ?? null,
              }
            : {
                phase_type: phaseType,
                fluid: selectedFluid,
                temperature_c: Number(temperatureC),
                use_manual_properties: false,
              }
          : phaseType === "Liquid"
            ? {
                phase_type: "Liquid",
                fluid: manualFluidName,
                temperature_c: Number(temperatureC),
                use_manual_properties: true,
                density_kg_m3: Number(density),
                dynamic_viscosity_pa_s: Number(viscosity),
                vapor_pressure_bar_a:
                  vaporPressure.trim()
                    ? Number(vaporPressure)
                    : null,
              }
            : {
                phase_type: "Gas",
                fluid: manualFluidName,
                temperature_c: Number(temperatureC),
                use_manual_properties: true,
                dynamic_viscosity_pa_s: Number(viscosity),
                molecular_weight_kg_kmol: Number(molecularWeight),
                compressibility_factor: Number(compressibilityFactor),
                gamma: Number(gamma),
              };

      const response = await fetch(
        `${API_BASE_URL}/hydraulics/solve-line`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fluid_config: fluidConfig,
            flow_value: Number(flowValue),
            flow_unit: normalizeFlowUnit(flowUnit),
            calculation_intent: calculationIntent,
            inlet_pressure_bar_a:
              inletPressure.trim()
                ? Number(inletPressure)
                : null,
            property_reference_pressure_bar_a:
              pressureDropWithoutInlet
                ? Number(propertyReferencePressure)
                : null,
            elements: buildApiElements(),
          }),
        }
      );

      if (!response.ok) {
        const body = await response.json();

        const detail = body?.detail;
        const message =
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail
                  .map((item) => {
                    if (typeof item === "string") return item;
                    const location = Array.isArray(item?.loc)
                      ? item.loc.join(" → ")
                      : "request";
                    return `${location}: ${item?.msg ?? JSON.stringify(item)}`;
                  })
                  .join("; ")
              : detail
                ? JSON.stringify(detail)
                : `Backend error ${response.status}`;

        throw new Error(message);
      }

      const data: SolveResult = await response.json();

      setResult(data);
      setPromptFeedback("Calculation complete.");
      setActivePage("results");

    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to solve the hydraulic line.";

      setError(message);
      setPromptFeedback(`Calculation failed: ${message}`);
      setActivePage("results");

    } finally {
      setLoading(false);
    }
  }


  // ========================================================
  // PUMP SIZING
  // ========================================================

  async function calculatePumpSizing() {
    setPumpSizingLoading(true);
    setError("");
    setPumpResult(null);
    setSystemCurve(null);

    try {
      if (phaseType !== "Liquid") {
        throw new Error("Pump sizing version 1 is available for liquid systems only.");
      }

      const sourcePressure = Number(pumpSourcePressure);
      const destinationPressure = Number(pumpDestinationPressure);
      const efficiency = Number(pumpEfficiency);
      const motorMargin = Number(pumpMotorMargin);
      const pumpAfterIndex = Number(pumpAfterElementIndex);
      const designFlow = Number(flowValue);

      if (!Number.isFinite(designFlow) || designFlow <= 0) {
        throw new Error("Enter a valid positive design flow.");
      }
      if (!Number.isFinite(sourcePressure) || sourcePressure <= 0) {
        throw new Error("Source pressure must be a positive absolute pressure.");
      }
      if (!Number.isFinite(destinationPressure) || destinationPressure <= 0) {
        throw new Error("Destination pressure must be a positive absolute pressure.");
      }
      if (!Number.isFinite(efficiency) || efficiency <= 0 || efficiency > 1) {
        throw new Error("Pump efficiency must be greater than 0 and at most 1.0.");
      }
      if (!Number.isFinite(motorMargin) || motorMargin < 1) {
        throw new Error("Motor margin must be at least 1.0.");
      }
      if (
        !Number.isInteger(pumpAfterIndex) ||
        pumpAfterIndex < 0 ||
        pumpAfterIndex > elements.length
      ) {
        throw new Error("Select a valid pump location in the hydraulic line.");
      }

      const response = await fetch(`${API_BASE_URL}/hydraulics/pump-sizing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fluid_config: buildReportFluidConfig(),
          design_flow_value: designFlow,
          flow_unit: normalizeFlowUnit(flowUnit),
          source_pressure_bar_a: sourcePressure,
          destination_pressure_bar_a: destinationPressure,
          elements: buildApiElements(),
          pump_efficiency: efficiency,
          motor_margin: motorMargin,
          pump_after_element_index: pumpAfterIndex,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const detail = body?.detail;
        throw new Error(
          typeof detail === "string"
            ? detail
            : detail
              ? JSON.stringify(detail)
              : `Pump-sizing error ${response.status}`
        );
      }

      const data: PumpSizingResult = await response.json();
      setPumpResult(data);
      setResult(null);
      setPromptFeedback("Pump duty calculation complete.");
      setActivePage("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to calculate pump duty.";
      setError(message);
      setPromptFeedback(`Pump sizing failed: ${message}`);
      setActivePage("results");
    } finally {
      setPumpSizingLoading(false);
    }
  }


  // ========================================================
  // SYSTEM CURVE
  // ========================================================

  async function generateSystemCurve() {
    setSystemCurveLoading(true);
    setError("");

    try {
      if (phaseType !== "Liquid") {
        throw new Error("System-curve generation is currently available for liquid systems only.");
      }
      if (!result && !pumpResult) {
        throw new Error("Calculate the hydraulic system or pump duty before generating the system curve.");
      }
      if (!pumpResult && !inletPressure.trim()) {
        throw new Error("Enter an inlet absolute pressure before generating the system curve.");
      }

      const maxFactor = Number(systemCurveMaxFactor);
      const pointCount = Number(systemCurvePoints);

      if (!Number.isFinite(maxFactor) || maxFactor <= 0) {
        throw new Error("Maximum flow factor must be greater than zero.");
      }
      if (!Number.isInteger(pointCount) || pointCount < 2 || pointCount > 101) {
        throw new Error("Number of system-curve points must be an integer from 2 to 101.");
      }

      const response = await fetch(`${API_BASE_URL}/hydraulics/system-curve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fluid_config: buildReportFluidConfig(),
          design_flow_value: Number(flowValue),
          flow_unit: normalizeFlowUnit(flowUnit),
          // For pump-sizing system curves, absolute pressure is only a numerical
          // coordinate for the underlying liquid line solver. Use a safe datum so
          // a legitimate 10 m static lift from a 1 bar(a) vessel is not rejected
          // before the pump head is applied. The plotted curve uses head/losses,
          // not this artificial absolute-pressure coordinate.
          inlet_pressure_bar_a: pumpResult ? 1000 : Number(inletPressure),
          elements: buildApiElements(),
          max_flow_factor: maxFactor,
          number_points: pointCount,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const detail = body?.detail;
        throw new Error(
          typeof detail === "string"
            ? detail
            : detail
              ? JSON.stringify(detail)
              : `System-curve error ${response.status}`
        );
      }

      const data: SystemCurveResult = await response.json();
      setSystemCurve(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate the system curve.");
      setSystemCurve(null);
    } finally {
      setSystemCurveLoading(false);
    }
  }


  // ========================================================
  // ENGINEERING REPORTS
  // ========================================================

  function buildReportFluidConfig() {
    if (fluidMode === "coolprop") {
      return {
        phase_type: phaseType,
        fluid: selectedFluid,
        temperature_c: Number(temperatureC),
        use_manual_properties: false,
        density_kg_m3: coolPropProperties?.density_kg_m3 ?? null,
        dynamic_viscosity_pa_s: coolPropProperties?.dynamic_viscosity_pa_s ?? null,
        vapor_pressure_bar_a: coolPropProperties?.vapor_pressure_bar_a ?? null,
        molecular_weight_kg_kmol: coolPropProperties?.molecular_weight_kg_kmol ?? null,
        gamma: coolPropProperties?.gamma ?? null,
      };
    }

    if (phaseType === "Liquid") {
      return {
        phase_type: "Liquid",
        fluid: manualFluidName,
        temperature_c: Number(temperatureC),
        use_manual_properties: true,
        density_kg_m3: Number(density),
        dynamic_viscosity_pa_s: Number(viscosity),
        vapor_pressure_bar_a: Number(vaporPressure),
      };
    }

    return {
      phase_type: "Gas",
      fluid: manualFluidName,
      temperature_c: Number(temperatureC),
      use_manual_properties: true,
      dynamic_viscosity_pa_s: Number(viscosity),
      molecular_weight_kg_kmol: Number(molecularWeight),
      compressibility_factor: Number(compressibilityFactor),
      gamma: Number(gamma),
    };
  }

  function sanitizeReportFilename(value: string) {
    return value
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_") || "Hydraulic_Line_Analysis";
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    // Do not revoke immediately. Some browsers start the file transfer
    // asynchronously and can lose an object URL that is revoked too early.
    window.setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 1500);
  }

  async function downloadEngineeringReport(
    format: "pdf" | "docx",
    scope: "auto" | "current" | "project" = "auto"
  ) {
    const reportFormat = format;

    // Resolve the report type from the saved project itself when exporting
    // from Project Overview. This is important for reopened/legacy projects:
    // React's current engineeringTask state may not yet reflect the saved study,
    // but the scenario metadata is authoritative for project-report routing.
    const projectLooksLikePumpSizing =
      scope === "project" &&
      scenarios.length > 0 &&
      scenarios.some((scenario) => {
        const savedFluid = scenario.fluid_config ?? {};
        return (
          savedFluid.engineering_task === "pump_sizing" ||
          (savedFluid.pump_sizing != null &&
            typeof savedFluid.pump_sizing === "object")
        );
      });

    // Pump sizing has two report scopes:
    // - current: the calculation currently on screen
    // - project: every saved pump-sizing scenario in the selected project
    //
    // Both "Download All Scenarios" and Project Overview -> Project
    // Engineering Report now converge on this same pump-project pathway.
    if (engineeringTask === "pump_sizing" || projectLooksLikePumpSizing) {
      const wantsProjectReport =
        scope === "project" ||
        (scope === "auto" && analysisType === "scenario" && wizardStep === "overview");

      setReportLoading(reportFormat);
      setError("");

      try {
        if (wantsProjectReport) {
          if (!selectedProjectId || !selectedProject) {
            throw new Error("Select a pump-sizing project before generating the all-scenarios report.");
          }

          if (scenarioDefinitionMode) {
            throw new Error(
              "Save or cancel the scenario currently being defined before generating the project report."
            );
          }

          const scenariosResponse = await fetch(
            `${API_BASE_URL}/projects/${selectedProjectId}/scenarios`
          );

          if (!scenariosResponse.ok) {
            throw new Error(
              `Unable to load saved scenarios for the pump report (${scenariosResponse.status}).`
            );
          }

          const savedScenarios: SavedScenario[] = await scenariosResponse.json();

          if (savedScenarios.length === 0) {
            throw new Error("Save at least one pump-sizing scenario before generating a project report.");
          }

          const reportScenarios = [];

          for (const scenario of savedScenarios) {
            const savedFluid = scenario.fluid_config ?? {};
            const pump =
              savedFluid.pump_sizing && typeof savedFluid.pump_sizing === "object"
                ? (savedFluid.pump_sizing as Record<string, unknown>)
                : null;

            if (!pump) {
              throw new Error(
                `Scenario “${scenario.name}” does not contain saved pump-sizing boundary conditions.`
              );
            }

            const sourcePressure = Number(pump.source_pressure_bar_a);
            const destinationPressure = Number(pump.destination_pressure_bar_a);
            const efficiency = Number(pump.pump_efficiency ?? 0.70);
            const motorMargin = Number(pump.motor_margin ?? 1.10);
            const pumpAfterIndex = Number(pump.pump_after_element_index ?? 0);

            if (
              !Number.isFinite(sourcePressure) ||
              sourcePressure <= 0 ||
              !Number.isFinite(destinationPressure) ||
              destinationPressure <= 0
            ) {
              throw new Error(
                `Scenario “${scenario.name}” has invalid source or destination pressure.`
              );
            }

            const fluidConfig = await buildSolveFluidConfigForScenario(scenario);
            const apiElements = buildApiElementsForScenario(scenario.elements);

            const pumpResponse = await fetch(`${API_BASE_URL}/hydraulics/pump-sizing`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fluid_config: fluidConfig,
                design_flow_value: scenario.flow_value,
                flow_unit: normalizeFlowUnit(scenario.flow_unit),
                source_pressure_bar_a: sourcePressure,
                destination_pressure_bar_a: destinationPressure,
                elements: apiElements,
                pump_efficiency: efficiency,
                motor_margin: motorMargin,
                pump_after_element_index: pumpAfterIndex,
              }),
            });

            if (!pumpResponse.ok) {
              let detail = `Unable to calculate pump scenario “${scenario.name}” (${pumpResponse.status}).`;
              try {
                const body = await pumpResponse.json();
                detail = body?.detail ?? detail;
              } catch {
                // Keep fallback.
              }
              throw new Error(detail);
            }

            const scenarioPumpResult: PumpSizingResult = await pumpResponse.json();

            // Do not regenerate a full system curve for every saved scenario during
            // report export. A system-curve call solves the line repeatedly and can make
            // an all-scenario report appear to hang at "Creating PDF/Word report".
            // The project report still contains the complete pump-duty and NPSHa results
            // for every saved scenario. System-curve generation remains available as its
            // own engineering task / on-screen calculation.
            const scenarioSystemCurve: SystemCurveResult | null = null;

            reportScenarios.push({
              name: scenario.name,
              description: scenario.description,
              engineering_task: "pump_sizing",
              fluid_config: fluidConfig,
              flow_value: scenario.flow_value,
              flow_unit: normalizeFlowUnit(scenario.flow_unit),
              source_pressure_bar_a: sourcePressure,
              destination_pressure_bar_a: destinationPressure,
              pump_efficiency: efficiency,
              motor_margin: motorMargin,
              pump_after_element_index: pumpAfterIndex,
              elements: apiElements,
              result: scenarioPumpResult,
              system_curve: scenarioSystemCurve,
            });
          }

          const response = await fetch(
            `${API_BASE_URL}/reports/pump-sizing/project/${reportFormat}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                project_title: selectedProject.name,
                project_description: selectedProject.description,
                scenarios: reportScenarios,
              }),
            }
          );

          if (!response.ok) {
            let detail = `Pump project report generation failed (${response.status}).`;
            try {
              const body = await response.json();
              detail = body?.detail ?? detail;
            } catch {
              // Keep fallback.
            }
            throw new Error(detail);
          }

          const blob = await response.blob();
          const safeProjectName = sanitizeReportFilename(selectedProject.name);
          const filename =
            reportFormat === "pdf"
              ? `${safeProjectName}_All_Scenarios_Pump_Sizing_Report.pdf`
              : `${safeProjectName}_All_Scenarios_Pump_Sizing_Report.docx`;
          downloadBlob(blob, filename);
          setProjectStatus(
            `${reportFormat.toUpperCase()} all-scenarios pump-sizing report downloaded.`
          );
          return;
        }

        if (!pumpResult) {
          throw new Error("Calculate the pump duty before downloading a pump-sizing report.");
        }

        const response = await fetch(
          `${API_BASE_URL}/reports/pump-sizing/${reportFormat}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              project_title:
                selectedProject?.name ??
                (selectedScenario?.name
                  ? `Pump Sizing - ${selectedScenario.name}`
                  : "Pump Sizing Analysis"),
              fluid_config: buildReportFluidConfig(),
              flow_value: Number(flowValue),
              flow_unit: normalizeFlowUnit(flowUnit),
              source_pressure_bar_a: Number(pumpSourcePressure),
              destination_pressure_bar_a: Number(pumpDestinationPressure),
              pump_efficiency: Number(pumpEfficiency),
              motor_margin: Number(pumpMotorMargin),
              pump_after_element_index: Number(pumpAfterElementIndex),
              elements: buildApiElements(),
              result: pumpResult,
              system_curve: systemCurve,
            }),
          }
        );

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const detail = body?.detail;
          throw new Error(
            typeof detail === "string"
              ? detail
              : detail
                ? JSON.stringify(detail)
                : `Unable to generate pump-sizing report (${response.status}).`
          );
        }

        const blob = await response.blob();
        const disposition = response.headers.get("content-disposition") ?? "";
        const filenameMatch =
          disposition.match(/filename\*=UTF-8''([^;]+)/i) ??
          disposition.match(/filename="?([^"]+)"?/i);
        const fallback =
          reportFormat === "pdf"
            ? "pump_sizing_report.pdf"
            : "pump_sizing_report.docx";
        const filename = filenameMatch?.[1]
          ? decodeURIComponent(filenameMatch[1].replace(/"/g, ""))
          : fallback;

        downloadBlob(blob, filename);

        setProjectStatus(
          `${reportFormat.toUpperCase()} pump-sizing report downloaded.`
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to download pump-sizing report."
        );
      } finally {
        setReportLoading(null);
      }

      return;
    }

    // Pressure-drop reporting also supports explicit current/project scope.
    const wantsHydraulicProjectReport =
      scope === "project" ||
      (scope === "auto" &&
        analysisType === "scenario" &&
        wizardStep === "overview");

    setReportLoading(format);
    setError("");

    try {
      // Project report contains every saved pressure-drop scenario.
      if (wantsHydraulicProjectReport) {
        if (!selectedProjectId || !selectedProject) {
          throw new Error("Select a project before generating the all-scenarios report.");
        }

        if (scenarioDefinitionMode) {
          throw new Error(
            "Save or cancel the scenario currently being defined before generating the project report."
          );
        }

        // Always reload from the backend so the report cannot accidentally use
        // a stale React scenario list.
        const scenariosResponse = await fetch(
          `${API_BASE_URL}/projects/${selectedProjectId}/scenarios`
        );

        if (!scenariosResponse.ok) {
          throw new Error(
            `Unable to load saved scenarios for the report (${scenariosResponse.status}).`
          );
        }

        const savedScenarios: SavedScenario[] = await scenariosResponse.json();

        if (savedScenarios.length === 0) {
          throw new Error("Save at least one scenario before generating a project report.");
        }

        const reportScenarios = [];

        // Recalculate every saved scenario from its own saved inputs.
        // This prevents the current/last-open scenario from being repeated.
        for (const scenario of savedScenarios) {
          const fluidConfig = await buildSolveFluidConfigForScenario(scenario);
          const apiElements = buildApiElementsForScenario(scenario.elements);

          const solveResponse = await fetch(`${API_BASE_URL}/hydraulics/solve-line`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fluid_config: fluidConfig,
              flow_value: scenario.flow_value,
              flow_unit: normalizeFlowUnit(scenario.flow_unit),
              calculation_intent: scenario.calculation_intent,
              inlet_pressure_bar_a: scenario.inlet_pressure_bar_a,
              property_reference_pressure_bar_a:
                scenario.calculation_intent === "pressure_drop" &&
                scenario.inlet_pressure_bar_a == null
                  ? scenario.property_reference_pressure_bar_a ?? 1.01325
                  : scenario.property_reference_pressure_bar_a,
              elements: apiElements,
            }),
          });

          if (!solveResponse.ok) {
            let detail = `Unable to calculate scenario “${scenario.name}” (${solveResponse.status}).`;
            try {
              const body = await solveResponse.json();
              detail = body?.detail ?? detail;
            } catch {
              // Keep fallback.
            }
            throw new Error(detail);
          }

          const scenarioResult: SolveResult = await solveResponse.json();

          reportScenarios.push({
            name: scenario.name,
            description: scenario.description,
            fluid_config: fluidConfig,
            flow_value: scenario.flow_value,
            flow_unit: normalizeFlowUnit(scenario.flow_unit),
            inlet_pressure_bar_a: scenario.inlet_pressure_bar_a,
            calculation_intent: scenario.calculation_intent,
            elements: apiElements,
            result: scenarioResult,
          });
        }

        const response = await fetch(
          `${API_BASE_URL}/reports/hydraulics/project/${format}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              project_title: selectedProject.name,
              project_description: selectedProject.description,
              scenarios: reportScenarios,
            }),
          }
        );

        if (!response.ok) {
          let detail = `Project report generation failed (${response.status}).`;
          try {
            const body = await response.json();
            detail = body?.detail ?? detail;
          } catch {
            // Keep fallback.
          }
          throw new Error(detail);
        }

        const blob = await response.blob();
        const safeProjectName = sanitizeReportFilename(selectedProject.name);
        const filename =
          format === "pdf"
            ? `${safeProjectName}_All_Scenarios_Hydraulic_Report.pdf`
            : `${safeProjectName}_All_Scenarios_Hydraulic_Report.docx`;
        downloadBlob(blob, filename);
        return;
      }

      // Pump sizing is handled above before the scenario/project-report branch.
      // Reaching this point means the active task uses the existing hydraulic
      // pressure-drop reporting workflow.

      if (!result) {
        throw new Error("Solve the hydraulic line before generating a report.");
      }

      const response = await fetch(
        `${API_BASE_URL}/reports/hydraulics/${format}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            project_title: selectedProject?.name ?? "Hydraulic Line Analysis",
            fluid_config: buildReportFluidConfig(),
            flow_value: Number(flowValue),
            flow_unit: normalizeFlowUnit(flowUnit),
            inlet_pressure_bar_a: inletPressure.trim() ? Number(inletPressure) : null,
            calculation_intent: calculationIntent,
            elements: buildApiElements(),
            result,
          }),
        }
      );

      if (!response.ok) {
        let detail = `Report generation failed (${response.status}).`;
        try {
          const body = await response.json();
          detail = body.detail ?? detail;
        } catch {
          // Keep fallback.
        }
        throw new Error(detail);
      }

      const blob = await response.blob();
      const safeProjectName = sanitizeReportFilename(
        selectedProject?.name ?? "Hydraulic_Line_Analysis"
      );
      const filename =
        format === "pdf"
          ? `${safeProjectName}_Hydraulic_Report.pdf`
          : `${safeProjectName}_Hydraulic_Report.docx`;
      downloadBlob(blob, filename);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate engineering report."
      );
    } finally {
      setReportLoading(null);
    }
  
  }


  // ========================================================
  // ENGINEERING ASSISTANT
  // ========================================================

  async function interpretEngineeringPrompt(promptOverride?: string) {
    const promptToInterpret = (promptOverride ?? engineeringPrompt).trim();

    if (promptToInterpret.length < 10) {
      setPromptFeedback("Enter a hydraulic problem before interpreting.");
      return;
    }

    setPromptLoading(true);
    setError("");
    setPromptFeedback("Interpreting engineering problem…");

    try {
      const response = await fetch(
        `${API_BASE_URL}/assistant/interpret-hydraulics`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: promptToInterpret, use_ai: true }),
        }
      );

      if (!response.ok) {
        let detail = "Unable to interpret engineering prompt.";
        try {
          const body = await response.json();
          detail = body.detail ?? detail;
        } catch {
          detail = `Prompt interpreter returned HTTP ${response.status}.`;
        }
        throw new Error(detail);
      }

      const data: PromptInterpretation = await response.json();
      setPromptInterpretation(data);
      setPromptFeedback(
        data.missing.length === 0
          ? "Interpretation complete — review the engineering model."
          : `Interpretation complete — ${data.missing.length} input${data.missing.length === 1 ? " is" : "s are"} still required.`
      );

      window.setTimeout(() => {
        document
          .getElementById("engineering-model-preview")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to interpret engineering prompt.";
      setError(message);
      setPromptFeedback(`Interpretation failed: ${message}`);
    } finally {
      setPromptLoading(false);
    }
  }

  async function addPromptClarification() {
    const clarification = promptClarification.trim();
    if (!clarification) return;

    const combinedPrompt = `${engineeringPrompt.trim()}\nAdditional engineering clarification: ${clarification}`;
    setEngineeringPrompt(combinedPrompt);
    setPromptClarification("");
    await interpretEngineeringPrompt(combinedPrompt);
  }

  function resetEngineeringAssistant() {
    setEngineeringPrompt("");
    setPromptInterpretation(null);
    setPromptClarification("");
    setPromptFeedback("New prompt started. Enter the hydraulic problem above.");
    setError("");
  }

  function loadExamplePrompt() {
    setEngineeringPrompt(
      "Size the pressure drop for water at 25 °C flowing at 10 m³/h from a vessel at 5 bar(a). Use 20 m of NPS 2 Sch 40 commercial steel pipe, four standard 90° elbows, one fully open gate valve, a heat exchanger with 0.15 bar pressure drop, and a 6 m elevation increase."
    );
    setPromptInterpretation(null);
    setPromptClarification("");
    setPromptFeedback("Example loaded. Click Interpret Engineering Problem.");
    setError("");
  }

  function findFittingMatch(searchText: string) {
    const query = searchText.toLowerCase();
    const records = fittingCatalog?.records ?? [];

    return records.find((record) => {
      const haystack = `${record.component ?? ""} ${record.configuration ?? ""} ${record.selection_label}`.toLowerCase();
      if (query.includes("90")) return haystack.includes("90") && haystack.includes("elbow");
      if (query.includes("45")) return haystack.includes("45") && haystack.includes("elbow");
      if (query.includes("gate valve")) return haystack.includes("gate") && haystack.includes("valve");
      if (query.includes("globe valve")) return haystack.includes("globe") && haystack.includes("valve");
      if (query.includes("ball valve")) return haystack.includes("ball") && haystack.includes("valve");
      if (query.includes("check valve")) return haystack.includes("check") && haystack.includes("valve");
      return haystack.includes(query);
    });
  }

  async function applyPromptInterpretation(calculateAfterApply = false) {
    if (!promptInterpretation) return;

    if (promptInterpretation.missing.length > 0) {
      setError(
        `Complete the missing engineering inputs before applying the model: ${promptInterpretation.missing.join(", ")}.`
      );
      return;
    }

    if (promptInterpretation.calculation_intent) {
      setCalculationIntent(promptInterpretation.calculation_intent);
    }

    if (promptInterpretation.fluid.fluid) {
      if (promptInterpretation.fluid.mode === "manual") {
        setFluidMode("manual");
        setManualFluidName(promptInterpretation.fluid.fluid);
        if (promptInterpretation.fluid.phase_type) {
          setPhaseType(promptInterpretation.fluid.phase_type);
        }
        if (promptInterpretation.fluid.density_kg_m3 != null) {
          setDensity(String(promptInterpretation.fluid.density_kg_m3));
        }
        if (promptInterpretation.fluid.dynamic_viscosity_pa_s != null) {
          setViscosity(String(promptInterpretation.fluid.dynamic_viscosity_pa_s));
        }
        if (promptInterpretation.fluid.vapor_pressure_bar_a != null) {
          setVaporPressure(String(promptInterpretation.fluid.vapor_pressure_bar_a));
        }
        if (promptInterpretation.fluid.molecular_weight_kg_kmol != null) {
          setMolecularWeight(String(promptInterpretation.fluid.molecular_weight_kg_kmol));
        }
        if (promptInterpretation.fluid.compressibility_factor != null) {
          setCompressibilityFactor(String(promptInterpretation.fluid.compressibility_factor));
        }
        if (promptInterpretation.fluid.gamma != null) {
          setGamma(String(promptInterpretation.fluid.gamma));
        }
      } else {
        setFluidMode("coolprop");
        setSelectedFluid(promptInterpretation.fluid.fluid);
        setFluidSearch(promptInterpretation.fluid.fluid);
        setCoolPropProperties(null);
      }
    }

    if (promptInterpretation.fluid.temperature_c !== null) {
      setTemperatureC(String(promptInterpretation.fluid.temperature_c));
    }

    if (promptInterpretation.flow.value !== null) {
      setFlowValue(String(promptInterpretation.flow.value));
    }

    if (promptInterpretation.flow.unit) {
      setFlowUnit(normalizeFlowUnit(promptInterpretation.flow.unit));
    }

    if (promptInterpretation.inlet_pressure_bar_a !== null) {
      setInletPressure(String(promptInterpretation.inlet_pressure_bar_a));

      if (engineeringTask === "pump_sizing") {
        setPumpSourcePressure(String(promptInterpretation.inlet_pressure_bar_a));
      }
    } else if (
      promptInterpretation.calculation_intent === "pressure_drop" &&
      engineeringTask !== "pump_sizing"
    ) {
      setInletPressure("");
    }

    if (promptInterpretation.property_reference_pressure_bar_a != null) {
      setPropertyReferencePressure(String(promptInterpretation.property_reference_pressure_bar_a));
    }

    let id = 1;
    const modelElements: LineElement[] = promptInterpretation.elements.map((item) => {
      const currentId = id++;

      if (item.type === "Pipe") {
        const interpretedPipeMode =
          item.pipe_mode ?? promptInterpretation.pipe_basis.pipe_mode ?? "standard";

        return {
          id: currentId,
          type: "Pipe",
          description: item.description,
          pipeMode: interpretedPipeMode,
          nps:
            interpretedPipeMode === "standard"
              ? normalizeNps(item.nps ?? promptInterpretation.pipe_basis.nps ?? "2")
              : item.nps ?? promptInterpretation.pipe_basis.nps ?? "2",
          schedule:
            interpretedPipeMode === "standard"
              ? `Sch ${normalizeSchedule(item.schedule ?? promptInterpretation.pipe_basis.schedule ?? "40")}`
              : item.schedule ?? promptInterpretation.pipe_basis.schedule ?? "Sch 40",
          material: item.material ?? promptInterpretation.pipe_basis.material ?? "Commercial Steel",
          custom_id_mm: String(
            item.custom_id_mm ?? promptInterpretation.pipe_basis.custom_id_mm ?? 52.48
          ),
          custom_roughness_mm: String(
            item.custom_roughness_mm ??
              promptInterpretation.pipe_basis.custom_roughness_mm ??
              pipeCatalog?.materials.find(
                (material) => material.material === (item.material ?? promptInterpretation.pipe_basis.material)
              )?.roughness_mm ??
              0.045
          ),
          length_m: String(item.length_m ?? 0),
          dz_m: String(item.dz_m ?? 0),
        };
      }

      if (item.type === "Resistance / Fitting") {
        const match = findFittingMatch(item.fitting_search ?? item.description);
        return {
          id: currentId,
          type: "Resistance / Fitting",
          description: item.description,
          pipeMode: promptInterpretation.pipe_basis.pipe_mode ?? "standard",
          nps: promptInterpretation.pipe_basis.nps ?? "2",
          schedule: promptInterpretation.pipe_basis.schedule ?? "Sch 40",
          material: promptInterpretation.pipe_basis.material ?? "Commercial Steel",
          custom_id_mm: String(promptInterpretation.pipe_basis.custom_id_mm ?? 52.48),
          custom_roughness_mm: String(
            promptInterpretation.pipe_basis.custom_roughness_mm ??
              pipeCatalog?.materials.find(
                (material) => material.material === promptInterpretation.pipe_basis.material
              )?.roughness_mm ??
              0.045
          ),
          k_total: "1",
          fittingMode: "database",
          fittingPipeBasis: "inherit",
          fittingCategory: match?.category ?? "",
          fittingSelection: match?.selection_label ?? "",
          fittingQuantity: String(item.quantity ?? 1),
          fittingOverrideEnabled: "false",
          fittingOverrideKEach: "",
        };
      }

      if (item.type === "Known Equipment ΔP") {
        return {
          id: currentId,
          type: "Known Equipment ΔP",
          description: item.description,
          known_dp_bar: String(item.known_dp_bar ?? 0),
        };
      }

      return {
        id: currentId,
        type: "Elevation Change",
        description: item.description,
        dz_m: String(item.dz_m ?? 0),
      };
    });

    let resolvedElements = modelElements;

    if (calculateAfterApply) {
      // Resolve every interpreted Crane fitting before solving so the Assistant
      // never sends placeholder K values to the deterministic hydraulics engine.
      const working = [...modelElements];

      for (let index = 0; index < working.length; index += 1) {
        const fitting = working[index];
        if (fitting.type !== "Resistance / Fitting" || fitting.fittingMode !== "database") {
          continue;
        }

        if (!fitting.fittingSelection) {
          throw new Error(
            `Unable to match Crane database selection for "${fitting.description}". Review the fitting before calculating.`
          );
        }

        let pipeBasis: LineElement | null = null;
        for (let upstream = index - 1; upstream >= 0; upstream -= 1) {
          if (working[upstream].type === "Pipe") {
            pipeBasis = working[upstream];
            break;
          }
        }

        if (!pipeBasis) {
          throw new Error(
            `Fitting "${fitting.description}" has no upstream pipe to inherit from.`
          );
        }

        const nominalSizeMm =
          pipeBasis.pipeMode === "standard"
            ? npsToNominalMm(pipeBasis.nps ?? "")
            : Number(pipeBasis.custom_id_mm);

        if (!Number.isFinite(nominalSizeMm) || nominalSizeMm <= 0) {
          throw new Error(
            `A valid pipe size is required for the Crane K calculation for "${fitting.description}".`
          );
        }

        const kResponse = await fetch(`${API_BASE_URL}/fittings/calculate-k`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selection_label: fitting.fittingSelection,
            nominal_size_mm: nominalSizeMm,
            quantity: Math.max(1, Number(fitting.fittingQuantity ?? "1")),
            override_k_each: null,
          }),
        });

        if (!kResponse.ok) {
          const body = await kResponse.json();
          const detail = body?.detail;
          throw new Error(
            typeof detail === "string"
              ? detail
              : detail
                ? JSON.stringify(detail)
                : `Unable to calculate Crane K for "${fitting.description}".`
          );
        }

        const kData: FittingKResult = await kResponse.json();
        working[index] = {
          ...fitting,
          k_total: String(kData.k_total),
          fittingDatabaseKEach: String(kData.database_k_each),
          fittingKEach: String(kData.k_each),
          fittingMethod: kData.method,
          fittingFt: kData.ft === null ? "" : String(kData.ft),
          fittingMultiplier: kData.multiplier === null ? "" : String(kData.multiplier),
          fittingExpression: kData.expression,
        };
      }

      resolvedElements = working;
    }

    setElements(resolvedElements);
    setNextElementId(id);
    setResult(null);
    setError("");

    if (calculateAfterApply) {
      setPromptFeedback(
        engineeringTask === "pump_sizing"
          ? "Engineering model applied — calculating required pump duty…"
          : "Engineering model applied — running deterministic hydraulic calculation…"
      );
      // Move to Results immediately so the engineer can see calculation progress
      // and any solver validation error without manually changing tabs.
      setActivePage("results");
      setPendingAssistantSolve(true);
    } else {
      setActivePage("fluid");
    }
  }

  // ========================================================
  // PAGE
  // ========================================================

  return (

    <main className="min-h-screen bg-gray-100">

      <header className="border-b bg-white">

        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-6">

          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Process Engineering Workbench
            </h1>

            <p className="mt-1 text-gray-500">
              Fluid Flow & Hydraulics
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setActivePage("assistant");
              setWizardStep("tasks");
              setEngineeringTask(null);
              setAnalysisType(null);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50"
            title="Return to the Workbench home"
          >
            Home
          </button>

        </div>

      </header>


      <div className="mx-auto max-w-7xl px-6 py-8">

        {wizardStep !== "overview" && wizardStep !== "tasks" && (
        <div className="mb-7 flex flex-wrap items-center justify-center gap-2 text-sm">
          {[
            ["project", "1", "Project"],
            ["analysis", "2", "Analysis"],
            ["method", "3", "Method"],
            ["engineering", "4", "Define & Calculate"],
          ].map(([key, number, label]) => {
            const order = ["project", "analysis", "method", "engineering"];
            const current = order.indexOf(wizardStep);
            const item = order.indexOf(key);
            const active = key === wizardStep;
            const complete = item < current;
            return (
              <div key={key} className={`flex items-center gap-2 rounded-full border px-4 py-2 ${active ? "border-teal-700 bg-teal-700 text-white" : complete ? "border-teal-200 bg-teal-50 text-teal-800" : "border-gray-200 bg-white text-gray-400"}`}>
                <span className="font-bold">{complete ? "✓" : number}</span>
                <span className="font-medium">{label}</span>
              </div>
            );
          })}
        </div>
        )}

        {wizardStep === "tasks" && (
          <section className="mx-auto max-w-6xl">
            <div className="mb-7 text-center">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">
                Hydraulics Workbench
              </div>
              <h2 className="mt-2 text-3xl font-bold text-gray-900">
                What engineering task do you want to perform?
              </h2>
              <p className="mx-auto mt-3 max-w-3xl text-gray-600">
                Start a new hydraulic analysis or reopen an existing project.
                Engineering tasks share the same validated fluid, piping, fitting and calculation infrastructure.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  setEngineeringTask("pressure_drop");
                  setWizardStep("project");
                  setAnalysisType(null);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="group rounded-2xl border border-black bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-full border border-black bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-black">
                    Available
                  </div>
                  <span className="text-xl text-black transition group-hover:translate-x-1">→</span>
                </div>
                <h3 className="mt-5 text-xl font-bold text-gray-900">Pressure Drop / Line Analysis</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Calculate line losses, pressure profile, velocities, Reynolds number and engineering checks.
                </p>
                <div className="mt-5 text-sm font-semibold text-black">Open task →</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEngineeringTask("system_curve");
                  setWizardStep("project");
                  setAnalysisType(null);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="group rounded-2xl border border-black bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-full border border-black bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-black">
                    Available
                  </div>
                  <span className="text-xl text-black transition group-hover:translate-x-1">→</span>
                </div>
                <h3 className="mt-5 text-xl font-bold text-gray-900">System Curve Generator</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Define or load a liquid hydraulic system and generate system head versus flow.
                </p>
                <div className="mt-5 text-sm font-semibold text-black">Open task →</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEngineeringTask("pump_sizing");
                  setWizardStep("project");
                  setAnalysisType(null);
                  setPumpResult(null);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="group rounded-2xl border border-black bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-full border border-black bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-black">
                    Available
                  </div>
                  <span className="text-xl text-black transition group-hover:translate-x-1">→</span>
                </div>
                <h3 className="mt-5 text-xl font-bold text-gray-900">Pump Sizing</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  Determine the required liquid pump duty, differential head and preliminary power requirement from the hydraulic system.
                </p>
                <div className="mt-5 text-sm font-semibold text-black">Open task →</div>
              </button>
            </div>

            <div className="mt-7 rounded-2xl border border-black bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Continue Work</div>
                  <h3 className="mt-1 text-xl font-semibold text-gray-900">Recent Hydraulic Projects</h3>
                  <p className="mt-1 text-sm text-gray-500">Open an existing project directly into its Project Overview.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEngineeringTask("pressure_drop");
                    setWizardStep("project");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="text-sm font-semibold text-teal-800 hover:underline"
                >
                  View all projects →
                </button>
              </div>

              {projects.length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed border-black bg-gray-50 p-5 text-sm text-gray-500">
                  No saved hydraulic projects yet.
                </div>
              ) : (
                <div className="mt-5 divide-y divide-gray-100 rounded-xl border border-black">
                  {[...projects]
                    .sort(
                      (a, b) =>
                        new Date(b.updated_at ?? b.created_at ?? 0).getTime() -
                        new Date(a.updated_at ?? a.created_at ?? 0).getTime()
                    )
                    .slice(0, 3)
                    .map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => {
                          setSelectedProjectId(String(project.id));
                          setEngineeringTask("pressure_drop");
                          setWizardStep("overview");
                          setAnalysisType("scenario");
                          setSelectedScenarioId("");
                          setScenarioDefinitionMode(null);
                          setResult(null);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                          window.setTimeout(() => void refreshScenarios(String(project.id)), 0);
                        }}
                        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-gray-50"
                      >
                        <div>
                          <div className="font-semibold text-gray-900">{project.name}</div>
                          <div className="mt-1 text-sm text-gray-500">
                            {project.description || "Hydraulic engineering project"}
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-teal-800">Open →</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </section>
        )}

        {wizardStep === "project" && (
          <section className="mx-auto max-w-4xl rounded-2xl border border-teal-100 bg-white p-7 shadow-sm">
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Step 1</div>
                {engineeringTask && (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                    {engineeringTask === "system_curve" ? "System Curve Generator" : engineeringTask === "pump_sizing" ? "Pump Sizing" : "Pressure Drop / Line Analysis"}
                  </span>
                )}
              </div>
              <h2 className="mt-2 text-2xl font-bold text-gray-900">Create or open a project</h2>
              <p className="mt-2 text-gray-500">A project is the engineering study that will contain your hydraulic model and, when required, its design scenarios.</p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-5">
                <h3 className="font-semibold text-gray-900">Create New Project</h3>
                <input className={`${inputClass} mt-4`} value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="Project name" />
                <input className={`${inputClass} mt-3`} value={newProjectDescription} onChange={(e) => setNewProjectDescription(e.target.value)} placeholder="Description (optional)" />
                <button type="button" onClick={() => void createProject()} disabled={projectLoading} className="mt-4 w-full rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white disabled:opacity-50">Create Project</button>
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
                <h3 className="font-semibold text-gray-900">Open Existing Project</h3>
                <select className={`${inputClass} mt-4`} value={selectedProjectId} onChange={(e) => { setSelectedProjectId(e.target.value); setProjectStatus(""); }}>
                  <option value="">Select project…</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
                {selectedProject && <div className="mt-3 rounded-lg bg-white p-3 text-sm text-gray-600"><span className="font-semibold text-gray-900">Selected:</span> {selectedProject.name}</div>}
                <button
                  type="button"
                  onClick={() => void openProjectOverview()}
                  disabled={!selectedProjectId || projectLoading}
                  className="mt-4 w-full rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-40"
                >
                  {projectLoading
                    ? "Loading…"
                    : "Open Project Overview →"}
                </button>
                {engineeringTask === "pump_sizing" && (
                  <p className="mt-3 text-xs leading-5 text-blue-800">
                    The saved fluid, flow, pipes, fittings, equipment and elevations will be reused.
                    You only need to add the pump boundary conditions and calculate the required duty.
                  </p>
                )}
              </div>
            </div>
            {selectedProjectId && <div className="mt-5 flex justify-end"><button type="button" onClick={() => void deleteProject()} disabled={projectLoading} className="text-sm font-medium text-red-700 hover:underline">Delete selected project</button></div>}
            {projectStatus && <p className="mt-4 text-sm text-gray-600">{projectStatus}</p>}
          </section>
        )}

        {wizardStep === "overview" && (
          <section className="mx-auto max-w-6xl">
            <div className="rounded-2xl border border-black bg-white p-7 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Project Overview</div>
                  <h2 className="mt-2 text-2xl font-bold text-gray-900">{selectedProject?.name ?? "Selected Project"}</h2>
                  {selectedProject?.description && (
                    <p className="mt-2 max-w-3xl text-gray-600">{selectedProject.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-500">
                    <span><span className="font-semibold text-gray-800">{scenarios.length}</span> saved scenario{scenarios.length === 1 ? "" : "s"}</span>
                    {selectedProject?.updated_at && (
                      <span>Last updated: {new Date(selectedProject.updated_at).toLocaleString()}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => { setAnalysisType(null); setWizardStep("analysis"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    + New Analysis
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEngineeringTask("pump_sizing");
                      setPumpResult(null);
                      void loadProjectModel(true);
                    }}
                    disabled={projectLoading}
                    className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Size Pump for This Project
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAnalysisType("scenario"); setWizardStep("method"); }}
                    className="rounded-lg border border-black bg-white px-4 py-2.5 text-sm font-semibold text-gray-800"
                  >
                    + Add Scenario
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep("project")}
                    className="rounded-lg border border-black bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-700"
                  >
                    ← Projects
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Scenarios</div>
                <div className="mt-2 text-3xl font-bold text-gray-900">{scenarios.length}</div>
              </div>
              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Calculated</div>
                <div className="mt-2 text-3xl font-bold text-gray-900">{scenarioComparisonRows.filter((row) => !row.error).length}</div>
              </div>
              <div className="rounded-xl border border-black bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {scenarioComparisonRows.some((row) => row.engineering_task === "pump_sizing")
                    ? "Lowest Pump Head"
                    : "Lowest ΔP"}
                </div>
                <div className="mt-2 text-2xl font-bold text-gray-900">
                  {scenarioComparisonRows.some((row) => row.engineering_task === "pump_sizing")
                    ? scenarioComparisonRows.some((row) => row.required_pump_head_m != null)
                      ? `${Math.min(...scenarioComparisonRows.filter((row) => row.required_pump_head_m != null).map((row) => row.required_pump_head_m as number)).toFixed(2)} m`
                      : "—"
                    : scenarioComparisonRows.some((row) => row.total_dp_bar != null)
                      ? `${Math.min(...scenarioComparisonRows.filter((row) => row.total_dp_bar != null).map((row) => row.total_dp_bar as number)).toFixed(4)} bar`
                      : "—"}
                </div>
              </div>
              <div className="rounded-xl border border-black bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {scenarioComparisonRows.some((row) => row.engineering_task === "pump_sizing")
                    ? "Highest Motor Power"
                    : "Highest ΔP"}
                </div>
                <div className="mt-2 text-2xl font-bold text-gray-900">
                  {scenarioComparisonRows.some((row) => row.engineering_task === "pump_sizing")
                    ? scenarioComparisonRows.some((row) => row.minimum_motor_power_kw != null)
                      ? `${Math.max(...scenarioComparisonRows.filter((row) => row.minimum_motor_power_kw != null).map((row) => row.minimum_motor_power_kw as number)).toFixed(3)} kW`
                      : "—"
                    : scenarioComparisonRows.some((row) => row.total_dp_bar != null)
                      ? `${Math.max(...scenarioComparisonRows.filter((row) => row.total_dp_bar != null).map((row) => row.total_dp_bar as number)).toFixed(4)} bar`
                      : "—"}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Scenario Results</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Saved design cases are recalculated when this overview opens so the summary reflects the current hydraulic solver.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void compareScenarios()}
                  disabled={scenarioComparisonLoading || scenarios.length === 0}
                  className="rounded-lg border border-black bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 disabled:opacity-40"
                >
                  {scenarioComparisonLoading ? "Refreshing…" : "Refresh Results"}
                </button>
              </div>

              {scenarioComparisonStatus && (
                <p className="mt-3 text-sm text-gray-500">{scenarioComparisonStatus}</p>
              )}

              {scenarios.length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed border-black bg-gray-50 p-8 text-center">
                  <div className="font-semibold text-gray-900">No scenarios saved yet</div>
                  <p className="mt-1 text-sm text-gray-500">Add a scenario to start building the project design-case history.</p>
                </div>
              ) : (
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                        <th className="px-3 py-3">Scenario</th>
                        <th className="px-3 py-3">Task</th>
                        <th className="px-3 py-3">Flow</th>
                        <th className="px-3 py-3">Pipe ID</th>
                        <th className="px-3 py-3">Max velocity</th>
                        <th className="px-3 py-3">Pump Head</th>
                        <th className="px-3 py-3">Pump ΔP</th>
                        <th className="px-3 py-3">Shaft Power</th>
                        <th className="px-3 py-3">Motor Power</th>
                        <th className="px-3 py-3">Curve End</th>
                        <th className="px-3 py-3">Line ΔP</th>
                        <th className="px-3 py-3">Outlet P</th>
                        <th className="px-3 py-3">Warnings</th>
                        <th className="px-3 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenarios.map((scenario) => {
                        const row = scenarioComparisonRows.find((item) => item.scenario_id === scenario.id);
                        return (
                          <tr key={scenario.id} className="border-b last:border-0">
                            <td className="px-3 py-4">
                              <div className="font-semibold text-gray-900">{scenario.name}</div>
                              {scenario.description && <div className="mt-1 max-w-xs text-xs text-gray-500">{scenario.description}</div>}
                              {row?.error && <div className="mt-1 text-xs text-red-600">{row.error}</div>}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4">
                              {row?.engineering_task === "pump_sizing" ? "Pump Sizing" : "Pressure Drop"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4">{scenario.flow_value} {normalizeFlowUnit(scenario.flow_unit)}</td>
                            <td className="whitespace-nowrap px-3 py-4">{row?.main_pipe_id_mm != null ? `${row.main_pipe_id_mm.toFixed(1)} mm` : "—"}</td>
                            <td className="whitespace-nowrap px-3 py-4">{row?.maximum_velocity_m_s != null ? `${row.maximum_velocity_m_s.toFixed(3)} m/s` : "—"}</td>
                            <td className="whitespace-nowrap px-3 py-4 font-semibold">{row?.required_pump_head_m != null ? `${row.required_pump_head_m.toFixed(2)} m` : "—"}</td>
                            <td className="whitespace-nowrap px-3 py-4">{row?.required_pump_dp_bar != null ? `${row.required_pump_dp_bar.toFixed(4)} bar` : "—"}</td>
                            <td className="whitespace-nowrap px-3 py-4">{row?.shaft_power_kw != null ? `${row.shaft_power_kw.toFixed(3)} kW` : "—"}</td>
                            <td className="whitespace-nowrap px-3 py-4">{row?.minimum_motor_power_kw != null ? `${row.minimum_motor_power_kw.toFixed(3)} kW` : "—"}</td>
                            <td className="whitespace-nowrap px-3 py-4">{row?.system_curve_max_factor != null ? `${row.system_curve_max_factor.toFixed(2)} × Q` : "—"}</td>
                            <td className="whitespace-nowrap px-3 py-4">{row?.total_dp_bar != null ? `${row.total_dp_bar.toFixed(4)} bar` : "—"}</td>
                            <td className="whitespace-nowrap px-3 py-4">{row?.outlet_pressure_bar_a != null ? `${row.outlet_pressure_bar_a.toFixed(4)} bar(a)` : "—"}</td>
                            <td className="px-3 py-4">
                              {row ? (
                                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.error ? "bg-red-100 text-red-700" : row.warning_count > 0 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                                  {row.error ? "Review" : row.warning_count > 0 ? row.warning_count : "None"}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4">
                              <button
                                type="button"
                                onClick={() => void loadScenarioById(scenario)}
                                disabled={scenarioLoading}
                                className="rounded-lg border border-black bg-white px-3 py-2 text-xs font-semibold text-gray-800 disabled:opacity-50"
                              >
                                Open / Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {scenarios.length > 0 && (
              <div className="mt-6 rounded-2xl border border-black bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900">Project Engineering Report</h3>
                    <p className="mt-1 text-sm text-gray-500">Export the complete saved-scenario study using the existing project report workflow.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void downloadEngineeringReport("pdf", "project")} disabled={reportLoading !== null} className="rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                      {reportLoading === "pdf" ? "Creating PDF…" : "Download PDF"}
                    </button>
                    <button type="button" onClick={() => void downloadEngineeringReport("docx", "project")} disabled={reportLoading !== null} className="rounded-lg border border-black bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 disabled:opacity-50">
                      {reportLoading === "docx" ? "Creating Word…" : "Download Word"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {wizardStep === "analysis" && (
          <section className="mx-auto max-w-4xl rounded-2xl border bg-white p-7 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Step 2 · {selectedProject?.name}</div>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">What do you want to do?</h2>
            <p className="mt-2 text-gray-500">Choose the type of engineering analysis for this project.</p>
            <div className="mt-7 grid gap-5 md:grid-cols-2">
              <button type="button" onClick={() => { setAnalysisType("single"); setScenarioDefinitionMode(null); setScenarioDefinitionRoute(null); setWizardStep("method"); }} className="rounded-2xl border-2 border-blue-100 bg-blue-50/40 p-6 text-left transition hover:border-blue-600 hover:bg-blue-50">
                <div className="text-lg font-bold text-gray-900">Single Calculation</div>
                <p className="mt-2 text-sm leading-6 text-gray-600">Define one hydraulic model, calculate it and save the current design to the project.</p>
                <div className="mt-5 font-semibold text-blue-700">Start calculation →</div>
              </button>
              <button type="button" onClick={() => { setAnalysisType("scenario"); setWizardStep("method"); }} className="rounded-2xl border-2 border-teal-100 bg-teal-50/50 p-6 text-left transition hover:border-teal-600 hover:bg-teal-50">
                <div className="text-lg font-bold text-gray-900">Scenario Analysis</div>
                <p className="mt-2 text-sm leading-6 text-gray-600">Create multiple calculated design cases, save them individually and compare their engineering performance.</p>
                <div className="mt-5 font-semibold text-teal-700">Start scenario analysis →</div>
              </button>
            </div>
            <button type="button" onClick={() => setWizardStep("project")} className="mt-6 text-sm font-semibold text-gray-600">← Back to Project</button>
          </section>
        )}

        {wizardStep === "method" && (
          <section className="mx-auto max-w-4xl rounded-2xl border bg-white p-7 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">Step 3 · {analysisType === "scenario" ? "Scenario Analysis" : "Single Calculation"}</div>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">How would you like to define the inputs?</h2>
            <p className="mt-2 text-gray-500">Both routes use the same deterministic hydraulic solver.</p>
            <div className="mt-7 grid gap-5 md:grid-cols-2">
              <button type="button" onClick={() => { if (analysisType === "scenario") { startScenarioDefinition(); chooseScenarioDefinitionRoute("assistant"); } else { setScenarioDefinitionRoute("assistant"); setActivePage("assistant"); } setWizardStep("engineering"); }} className="rounded-2xl border-2 border-violet-100 bg-violet-50/50 p-6 text-left transition hover:border-violet-600">
                <div className="text-lg font-bold text-gray-900">Engineering Assistant</div>
                <p className="mt-2 text-sm leading-6 text-gray-600">Describe the problem naturally, review the interpreted engineering inputs, then calculate.</p>
                <div className="mt-5 font-semibold text-violet-700">Use Assistant →</div>
              </button>
              <button type="button" onClick={() => { if (analysisType === "scenario") { startScenarioDefinition(); chooseScenarioDefinitionRoute("manual"); } else { setScenarioDefinitionRoute("manual"); setActivePage("fluid"); } setWizardStep("engineering"); }} className="rounded-2xl border-2 border-amber-100 bg-amber-50/50 p-6 text-left transition hover:border-amber-500">
                <div className="text-lg font-bold text-gray-900">Manual Definition</div>
                <p className="mt-2 text-sm leading-6 text-gray-600">Enter Fluid & Flow, build the line, calculate and review the results yourself.</p>
                <div className="mt-5 font-semibold text-amber-700">Define manually →</div>
              </button>
            </div>
            <button type="button" onClick={() => setWizardStep("analysis")} className="mt-6 text-sm font-semibold text-gray-600">← Back to Analysis Type</button>
          </section>
        )}

        {wizardStep === "engineering" && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-100 bg-teal-50 px-5 py-3">
            <div className="text-sm text-teal-900">
              <span className="font-bold">{selectedProject?.name}</span>
              {" · "}
              {engineeringTask === "pump_sizing"
                ? "Pump Sizing"
                : engineeringTask === "system_curve"
                  ? "System Curve"
                  : "Pressure Drop"}
              {" · "}
              {analysisType === "scenario" ? "Scenario Analysis" : "Single Calculation"}
              {" · "}
              {scenarioDefinitionRoute === "assistant" ? "AI-assisted" : "Manual"}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setWizardStep("method")} className="text-sm font-semibold text-teal-800">← Change method</button>
              {analysisType === "single" && (result || pumpResult) && <button type="button" onClick={() => void saveProjectModel()} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Save to Project</button>}
            </div>
          </div>
        )}

        {wizardStep === "engineering" && (
        <div className={scenarioDefinitionMode && scenarioDefinitionRoute ? "mb-8 rounded-2xl border-2 border-gray-900 bg-white p-4 shadow-sm sm:p-6" : ""}>
          {scenarioDefinitionMode && scenarioDefinitionRoute && (
            <div className="mb-5 border-b border-gray-200 pb-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Complete Scenario Definition</div>
                  <h2 className="mt-1 text-xl font-semibold text-gray-900">{workingScenarioName}</h2>
                  <p className="mt-1 max-w-3xl text-sm text-gray-600">
                    Everything below belongs to this scenario. Complete the selected definition route, calculate the hydraulic case, review Results, then save the completed scenario.
                  </p>
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${result ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                  {result ? "CALCULATED" : "DEFINITION IN PROGRESS"}
                </span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                {[
                  ["1", "Engineering Assistant", "Optional input route"],
                  ["2", "Fluid & Flow", "Define operating basis"],
                  ["3", "Build Line", "Define hydraulic system"],
                  ["4", "Results", result ? "Calculation available" : "Calculate when ready"],
                ].map(([step, title, note]) => (
                  <div key={step} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Step {step}</div>
                    <div className="mt-0.5 text-sm font-semibold text-gray-900">{title}</div>
                    <div className="mt-0.5 text-xs text-gray-500">{note}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {(!scenarioDefinitionMode || scenarioDefinitionRoute) && (
          <div className={`mb-8 grid overflow-hidden rounded-xl border bg-white ${scenarioDefinitionMode && scenarioDefinitionRoute === "manual" ? "grid-cols-3" : "grid-cols-4"}`}>

          {(!scenarioDefinitionMode || scenarioDefinitionRoute === "assistant") && (
            <NavButton
              label="Engineering Assistant"
              active={activePage === "assistant"}
              onClick={() => setActivePage("assistant")}
            />
          )}

          <NavButton
            label="Fluid & Flow"
            active={activePage === "fluid"}
            onClick={() => setActivePage("fluid")}
          />

          <NavButton
            label="Build Line"
            active={activePage === "line"}
            onClick={() => setActivePage("line")}
          />

          <NavButton
            label={engineeringTask === "pump_sizing" ? "Pump Results" : "Results"}
            active={activePage === "results"}
            onClick={() => setActivePage("results")}
          />

          </div>
        )}


        {error && (

          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>

        )}


        {activePage === "assistant" && (
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <SectionCard
              title="Engineering Assistant"
              subtitle="Describe the hydraulic problem in engineering language. The assistant interprets it into a structured model; it does not perform the hydraulic calculation itself."
            >
              <FieldLabel>Engineering problem</FieldLabel>
              <textarea
                className={`${inputClass} min-h-[250px] resize-y`}
                value={engineeringPrompt}
                onChange={(e) => setEngineeringPrompt(e.target.value)}
                placeholder="Example: Water at 25 °C, 10 m³/h, 5 bar(a), 20 m NPS 2 Sch 40 commercial steel, four 90° elbows..."
              />

              <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                <strong>Engineering interpretation layer:</strong> understands natural engineering language,
                compact units such as ID100mm and 100m3/h, arbitrary fluid names, automatic or manual
                property workflows, standard or custom piping, multiple pipe segments, valves/fittings, equipment ΔP and elevation.
                The interpretation layer builds the engineering model; the deterministic solver performs all calculations.
              </div>

              <button
                type="button"
                onClick={() => interpretEngineeringPrompt()}
                disabled={promptLoading || engineeringPrompt.trim().length < 10}
                className="mt-5 w-full rounded-lg bg-black px-5 py-3 font-medium text-white disabled:opacity-50"
              >
                {promptLoading ? "Interpreting..." : "Interpret Engineering Problem"}
              </button>

              {promptFeedback && (
                <div
                  className={`mt-3 rounded-lg border px-4 py-3 text-sm ${
                    promptFeedback.startsWith("Interpretation failed")
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-blue-200 bg-blue-50 text-blue-800"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {promptFeedback}
                </div>
              )}

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={resetEngineeringAssistant}
                  className="w-full rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Start New Prompt
                </button>

                <button
                  type="button"
                  onClick={loadExamplePrompt}
                  className="w-full rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
                >
                  Load Example
                </button>
              </div>
            </SectionCard>

            <div id="engineering-model-preview" className="scroll-mt-6">
            <SectionCard
              title="Engineering Model Preview"
              subtitle="Review the interpretation before it changes the calculation model."
            >
              {!promptInterpretation ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-gray-500">
                  No interpretation yet.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className={`rounded-xl border p-4 ${
                    promptInterpretation.missing.length === 0
                      ? "border-green-200 bg-green-50"
                      : "border-yellow-200 bg-yellow-50"
                  }`}>
                    <p className="font-semibold">
                      {promptInterpretation.missing.length === 0
                        ? "Ready for engineer review"
                        : "Additional input required"}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Status: {promptInterpretation.status === "ready" ? "Ready" : "Additional input required"}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <PropertyCard
                      label="Calculation intent"
                      value={
                        engineeringTask === "pump_sizing"
                          ? "Pump sizing"
                          : promptInterpretation.calculation_intent === "pressure_drop"
                            ? "Pressure drop only"
                            : promptInterpretation.calculation_intent === "pressure_profile"
                              ? "Pressure profile"
                              : "Outlet pressure"
                      }
                    />
                    <PropertyCard
                      label="Fluid"
                      value={promptInterpretation.fluid.fluid ?? "Missing"}
                    />
                    <PropertyCard
                      label="Temperature"
                      value={promptInterpretation.fluid.temperature_c === null ? "Missing" : `${promptInterpretation.fluid.temperature_c} °C`}
                    />
                    <PropertyCard
                      label="Flow"
                      value={promptInterpretation.flow.value === null ? "Missing" : `${promptInterpretation.flow.value} ${promptInterpretation.flow.unit ?? ""}`}
                    />
                    <PropertyCard
                      label="Inlet pressure"
                      value={promptInterpretation.inlet_pressure_bar_a === null ? (promptInterpretation.calculation_intent === "pressure_drop" ? "Not required for liquid ΔP-only" : "Missing") : `${promptInterpretation.inlet_pressure_bar_a} bar(a)`}
                    />
                  </div>

                  <div>
                    <p className="font-semibold">Interpreted line</p>
                    <div className="mt-2 space-y-2">
                      {promptInterpretation.elements.length === 0 ? (
                        <p className="text-sm text-gray-500">No line elements identified.</p>
                      ) : promptInterpretation.elements.map((item, index) => (
                        <div key={index} className="rounded-lg border bg-white p-3 text-sm">
                          <strong>{index + 1}. {item.description}</strong>
                          <div className="mt-1 text-gray-500">
                            {item.type === "Pipe" && (
                              item.pipe_mode === "custom"
                                ? `${item.length_m ?? "?"} m · Custom ID ${item.custom_id_mm ?? "?"} mm · ${item.material ?? "roughness/material pending"}`
                                : `${item.length_m ?? "?"} m · NPS ${item.nps ?? "?"} · ${item.schedule ?? "?"} · ${item.material ?? "?"}`
                            )}
                            {item.type === "Resistance / Fitting" && `Quantity ${item.quantity ?? 1} · Crane database · inherit upstream pipe`}
                            {item.type === "Known Equipment ΔP" && `Known ΔP ${item.known_dp_bar ?? "?"} bar`}
                            {item.type === "Elevation Change" && `Δz ${item.dz_m ?? 0} m`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {promptInterpretation.missing.length > 0 && (
                    <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                      <p className="font-semibold text-yellow-800">Missing engineering inputs</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-yellow-800">
                        {promptInterpretation.missing.map((item) => <li key={item}>{item}</li>)}
                      </ul>

                      <FieldLabel>Add engineering clarification</FieldLabel>
                      <textarea
                        className={`${inputClass} min-h-[110px] resize-y`}
                        value={promptClarification}
                        onChange={(e) => setPromptClarification(e.target.value)}
                        placeholder="Example: Use Sch 40 commercial steel, inlet pressure is 5 bar(a), and there are four 90° elbows."
                      />

                      <button
                        type="button"
                        onClick={addPromptClarification}
                        disabled={promptLoading || promptClarification.trim().length === 0}
                        className="mt-3 w-full rounded-lg bg-yellow-900 px-4 py-2.5 font-medium text-white disabled:opacity-40"
                      >
                        {promptLoading ? "Re-interpreting..." : "Add Clarification & Re-interpret"}
                      </button>
                    </div>
                  )}

                  <div>
                    <p className="font-semibold">Interpretation safeguards</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
                      {promptInterpretation.assumptions.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void applyPromptInterpretation(true).catch((err) => {
                        const message =
                          err instanceof Error
                            ? err.message
                            : "Unable to apply the interpreted engineering model.";
                        setError(message);
                        setPromptFeedback(`Model application failed: ${message}`);
                      });
                    }}
                    disabled={
                      promptInterpretation.missing.length > 0 ||
                      pendingAssistantSolve ||
                      loading
                    }
                    className="w-full rounded-lg bg-black px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {pendingAssistantSolve || loading
                      ? "Calculating…"
                      : "Apply & Calculate →"}
                  </button>
                </div>
              )}
            </SectionCard>
            </div>
          </div>
        )}


        {activePage ===
          "fluid" && (

          <div className="grid gap-6 lg:grid-cols-2">

            <SectionCard
              title="Fluid Definition"
            >

              <FieldLabel>Calculation objective</FieldLabel>
              <select
                className={inputClass}
                value={calculationIntent}
                onChange={(e) => {
                  setCalculationIntent(e.target.value as "pressure_drop" | "outlet_pressure" | "pressure_profile");
                  setResult(null);
                }}
              >
                <option value="pressure_drop">Pressure drop only (ΔP)</option>
                <option value="outlet_pressure">Outlet pressure</option>
                <option value="pressure_profile">Pressure profile</option>
              </select>

              <ModeSelector
                leftLabel="Automatic Database"
                rightLabel="Manual Properties"

                leftActive={
                  fluidMode ===
                  "coolprop"
                }

                onLeft={() => {
                  setFluidMode(
                    "coolprop"
                  );

                  setCoolPropProperties(
                    null
                  );
                  setFluidSearchFocused(false);
                }}

                onRight={() =>
                  setFluidMode(
                    "manual"
                  )
                }
              />


              {fluidMode ===
                "coolprop" ? (

                <>

                  <FieldLabel>
                    Substance
                  </FieldLabel>

                  <div className="relative">
                    <input
                      className={inputClass}
                      value={fluidSearch}
                      disabled={databaseLoading}
                      placeholder="Search by name, formula, refrigerant code or CAS number…"
                      onFocus={() => {
                        setFluidSearchFocused(true);
                        if (!fluidSearch.trim()) {
                          setFluidSearchResults(availableFluids.slice(0, 20));
                        }
                      }}
                      onChange={(e) => {
                        setFluidSearch(e.target.value);
                        setSelectedFluid("");
                        setFluidSearchFocused(true);
                        setCoolPropProperties(null);
                      }}
                    />

                    {fluidSearchFocused && (
                      <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-sm">
                        {fluidSearchLoading && (
                          <div className="px-3 py-3 text-sm text-gray-500">
                            Searching substances…
                          </div>
                        )}

                        {!fluidSearchLoading &&
                          fluidSearchResults.length === 0 && (
                            <div className="px-3 py-3 text-sm text-gray-500">
                              No matching automatic property substance found. You can use Manual Properties for formulations or custom fluids.
                            </div>
                          )}

                        {!fluidSearchLoading &&
                          fluidSearchResults.map((item) => (
                            <button
                              type="button"
                              key={`${item.id}-${item.name}`}
                              className="block w-full border-b border-gray-100 px-3 py-3 text-left last:border-b-0 hover:bg-gray-50"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setSelectedFluid(item.id);
                                setFluidSearch(
                                  item.formula
                                    ? `${item.name} (${item.formula})`
                                    : item.name
                                );
                                setFluidSearchFocused(false);
                                setCoolPropProperties(null);
                              }}
                            >
                              <div className="text-sm font-medium text-gray-900">
                                {item.name}
                              </div>
                              <div className="mt-0.5 text-xs text-gray-500">
                                {[item.formula, item.category, item.cas ? `CAS ${item.cas}` : null]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-gray-500">
                    Search by common name, chemical formula, refrigerant code or CAS number. The Workbench selects the property model automatically.
                  </p>


                  <FieldLabel>
                    Temperature (°C)
                  </FieldLabel>

                  <NumberInput
                    value={
                      temperatureC
                    }

                    onChange={(
                      value
                    ) => {
                      setTemperatureC(
                        value
                      );

                      setCoolPropProperties(
                        null
                      );
                    }}
                  />


                  {calculationIntent === "pressure_drop" ? (
                    <>
                      <FieldLabel>
                        Inlet pressure — bar(a) (optional for liquid ΔP-only)
                      </FieldLabel>
                      <NumberInput
                        value={inletPressure}
                        onChange={(value) => {
                          setInletPressure(value);
                          setCoolPropProperties(null);
                        }}
                      />

                      {!inletPressure.trim() && (
                        <>
                          <FieldLabel>Property reference pressure — bar(a)</FieldLabel>
                          <NumberInput
                            value={propertyReferencePressure}
                            onChange={(value) => {
                              setPropertyReferencePressure(value);
                              setCoolPropProperties(null);
                            }}
                          />
                          <p className="mt-2 text-xs text-gray-500">
                            Used only to evaluate fluid properties. It is not treated as the process inlet pressure.
                          </p>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <FieldLabel>Inlet pressure — bar(a)</FieldLabel>
                      <NumberInput
                        value={inletPressure}
                        onChange={(value) => {
                          setInletPressure(value);
                          setCoolPropProperties(null);
                        }}
                      />
                    </>
                  )}


                  <button
                    type="button"

                    onClick={
                      loadFluidProperties
                    }

                    disabled={
                      propertyLoading
                    }

                    className="mt-5 w-full rounded-lg bg-black px-5 py-3 font-medium text-white disabled:opacity-50"
                  >
                    {propertyLoading
                      ? "Loading Properties..."
                      : "Load Fluid Properties"}
                  </button>


                  {coolPropProperties && (

                    <>
                      <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                        <div className="text-sm font-semibold text-gray-900">
                          {coolPropProperties.display_name ?? coolPropProperties.fluid}
                        </div>
                        {(coolPropProperties.formula || coolPropProperties.category) && (
                          <div className="mt-1 text-xs text-gray-500">
                            {[coolPropProperties.formula, coolPropProperties.category]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        )}
                      </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">

                      <PropertyCard
                        label="Phase"
                        value={
                          coolPropProperties.phase_label ??
                          "—"
                        }
                      />

                      <PropertyCard
                        label="Density"
                        value={
                          formatProperty(
                            coolPropProperties.density_kg_m3,
                            "kg/m³"
                          )
                        }
                      />

                      <PropertyCard
                        label="Viscosity"
                        value={
                          formatProperty(
                            coolPropProperties.dynamic_viscosity_pa_s,
                            "Pa·s",
                            7
                          )
                        }
                      />

                      <PropertyCard
                        label="Vapor pressure"
                        value={
                          formatProperty(
                            coolPropProperties.vapor_pressure_bar_a,
                            "bar(a)",
                            4
                          )
                        }
                      />

                      <PropertyCard
                        label="Speed of sound"
                        value={
                          formatProperty(
                            coolPropProperties.speed_of_sound_m_s,
                            "m/s",
                            2
                          )
                        }
                      />

                      <PropertyCard
                        label="Cp/Cv"
                        value={
                          coolPropProperties.gamma !==
                          null
                            ? coolPropProperties.gamma.toFixed(
                                4
                              )
                            : "—"
                        }
                      />

                    </div>
                    </>

                  )}

                </>

              ) : (

                <>

                  <FieldLabel>
                    Fluid name
                  </FieldLabel>

                  <input
                    className={
                      inputClass
                    }

                    value={
                      manualFluidName
                    }

                    onChange={(e) =>
                      setManualFluidName(
                        e.target.value
                      )
                    }
                  />


                  <FieldLabel>
                    Phase
                  </FieldLabel>

                  <select
                    className={
                      inputClass
                    }

                    value={
                      phaseType
                    }

                    onChange={(e) =>
                      setPhaseType(
                        e.target.value
                      )
                    }
                  >

                    <option>
                      Liquid
                    </option>

                    <option>
                      Gas
                    </option>

                  </select>


                  <FieldLabel>
                    Temperature (°C)
                  </FieldLabel>

                  <NumberInput
                    value={
                      temperatureC
                    }

                    onChange={
                      setTemperatureC
                    }
                  />


                  <FieldLabel>
                    Inlet pressure — bar(a) {calculationIntent === "pressure_drop" && phaseType === "Liquid" ? "(optional)" : ""}
                  </FieldLabel>

                  <NumberInput
                    value={inletPressure}
                    onChange={setInletPressure}
                  />


                  {phaseType ===
                    "Liquid" ? (

                    <>

                      <FieldLabel>
                        Density (kg/m³)
                      </FieldLabel>

                      <NumberInput
                        value={
                          density
                        }

                        onChange={
                          setDensity
                        }
                      />


                      <FieldLabel>
                        Dynamic viscosity (Pa·s)
                      </FieldLabel>

                      <NumberInput
                        value={
                          viscosity
                        }

                        onChange={
                          setViscosity
                        }
                      />


                      <FieldLabel>
                        Vapor pressure — bar(a)
                      </FieldLabel>

                      <NumberInput
                        value={
                          vaporPressure
                        }

                        onChange={
                          setVaporPressure
                        }
                      />

                    </>

                  ) : (

                    <>

                      <FieldLabel>
                        Dynamic viscosity (Pa·s)
                      </FieldLabel>

                      <NumberInput
                        value={
                          viscosity
                        }

                        onChange={
                          setViscosity
                        }
                      />


                      <FieldLabel>
                        Molecular weight (kg/kmol)
                      </FieldLabel>

                      <NumberInput
                        value={
                          molecularWeight
                        }

                        onChange={
                          setMolecularWeight
                        }
                      />


                      <FieldLabel>
                        Compressibility factor Z
                      </FieldLabel>

                      <NumberInput
                        value={
                          compressibilityFactor
                        }

                        onChange={
                          setCompressibilityFactor
                        }
                      />


                      <FieldLabel>
                        Cp/Cv
                      </FieldLabel>

                      <NumberInput
                        value={
                          gamma
                        }

                        onChange={
                          setGamma
                        }
                      />

                    </>

                  )}

                </>

              )}

            </SectionCard>


            <SectionCard
              title="Flow Conditions"
            >

              <FieldLabel>
                Flow rate
              </FieldLabel>


              <div className="flex gap-2">

                <NumberInput
                  value={
                    flowValue
                  }

                  onChange={
                    setFlowValue
                  }
                />


                <select
                  className="rounded-lg border border-gray-300 bg-white px-3"

                  value={
                    flowUnit
                  }

                  onChange={(e) =>
                    setFlowUnit(
                      e.target.value
                    )
                  }
                >

                  <option>
                    m³/h
                  </option>

                  <option>
                    m³/s
                  </option>

                  <option>
                    kg/h
                  </option>

                  <option>
                    kg/s
                  </option>

                  <option>
                    Nm³/h
                  </option>

                </select>

              </div>


              <div className="mt-8 rounded-xl bg-gray-50 p-5">

                <p className="font-semibold">
                  Design basis
                </p>

                <p className="mt-3 text-sm text-gray-600">
                  Fluid properties:{" "}
                  <strong>
                    {fluidMode === "coolprop"
                      ? "Automatic"
                      : "Manual"}
                  </strong>
                </p>

                <p className="mt-2 text-sm text-gray-600">
                  Flow:{" "}
                  <strong>
                    {flowValue}{" "}
                    {flowUnit}
                  </strong>
                </p>

                <p className="mt-2 text-sm text-gray-600">
                  Inlet pressure:{" "}
                  <strong>
                    {inletPressure.trim() ? `${inletPressure} bar(a)` : "Not specified — ΔP-only basis"}
                  </strong>
                </p>

              </div>


              <button
                type="button"

                onClick={() =>
                  setActivePage(
                    "line"
                  )
                }

                className="mt-8 w-full rounded-lg bg-black px-5 py-3 font-medium text-white"
              >
                Continue to Build Line →
              </button>

            </SectionCard>

          </div>

        )}


        {activePage ===
          "line" && (

          <SectionCard
            title="Build Process Line"
            subtitle="Use standard piping from the database or specify your own dimensions and roughness."
          >

            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

              <AddButton
                label="+ Pipe"
                onClick={() =>
                  addElement(
                    "Pipe"
                  )
                }
              />

              <AddButton
                label="+ Fitting"
                onClick={() =>
                  addElement(
                    "Resistance / Fitting"
                  )
                }
              />

              <AddButton
                label="+ Equipment ΔP"
                onClick={() =>
                  addElement(
                    "Known Equipment ΔP"
                  )
                }
              />

              <AddButton
                label="+ Elevation"
                onClick={() =>
                  addElement(
                    "Elevation Change"
                  )
                }
              />

            </div>


            <div className="space-y-5">

              {elements.map(
                (
                  element,
                  index
                ) => (

                <ElementEditor
                  key={
                    element.id
                  }

                  element={
                    element
                  }

                  index={
                    index
                  }

                  total={
                    elements.length
                  }

                  pipeCatalog={
                    pipeCatalog
                  }

                  fittingCatalog={
                    fittingCatalog
                  }

                  upstreamPipe={
                    findUpstreamPipe(
                      element.id
                    )
                  }

                  calculateFittingK={
                    calculateFittingK
                  }

                  resolveStandardPipe={
                    resolveStandardPipe
                  }

                  updateElement={
                    updateElement
                  }

                  removeElement={
                    removeElement
                  }

                  moveUp={() =>
                    moveElement(
                      index,
                      -1
                    )
                  }

                  moveDown={() =>
                    moveElement(
                      index,
                      1
                    )
                  }
                />

              ))}

            </div>


            {engineeringTask === "pump_sizing" && (
              <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                      Pump Design Basis
                    </div>
                    <h3 className="mt-1 text-lg font-semibold text-gray-900">
                      Define the pump boundary conditions
                    </h3>
                    <p className="mt-1 max-w-3xl text-sm text-gray-600">
                      Source and destination pressures are absolute boundary pressures.
                      Elevation, pipe friction, fittings and equipment losses are taken from the hydraulic line above.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                    Liquid systems · v1
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="block md:col-span-2">
                    <span className="text-sm font-semibold text-gray-800">Pump location</span>
                    <select
                      value={pumpAfterElementIndex}
                      onChange={(event) => {
                        setPumpAfterElementIndex(event.target.value);
                        setPumpResult(null);
                        setSystemCurve(null);
                      }}
                      className={inputClass}
                    >
                      <option value="0">At source boundary — before Element 1</option>
                      {elements.map((element, index) => (
                        <option key={element.id} value={String(index + 1)}>
                          After Element {index + 1} — {element.description || element.type}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-xs text-gray-500">
                      Elements before the pump are treated as the suction side for NPSHa.
                      Elements after the pump are downstream of the pump.
                    </span>
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">Source pressure, bar(a)</span>
                    <input
                      type="number"
                      min="0.0001"
                      step="0.1"
                      value={pumpSourcePressure}
                      onChange={(event) => { setPumpSourcePressure(event.target.value); setPumpResult(null); }}
                      className={inputClass}
                    />
                    <span className="mt-1 block text-xs text-gray-500">
                      Absolute pressure at the upstream source boundary.
                    </span>
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">Destination pressure, bar(a)</span>
                    <input
                      type="number"
                      min="0.0001"
                      step="0.1"
                      value={pumpDestinationPressure}
                      onChange={(event) => { setPumpDestinationPressure(event.target.value); setPumpResult(null); }}
                      className={inputClass}
                    />
                    <span className="mt-1 block text-xs text-gray-500">
                      Absolute pressure required at the downstream destination boundary.
                    </span>
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">Pump efficiency</span>
                    <input
                      type="number"
                      min="0.01"
                      max="1"
                      step="0.01"
                      value={pumpEfficiency}
                      onChange={(event) => { setPumpEfficiency(event.target.value); setPumpResult(null); }}
                      className={inputClass}
                    />
                    <span className="mt-1 block text-xs text-gray-500">
                      Enter as a fraction, e.g. 0.70 = 70%.
                    </span>
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">Motor margin</span>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={pumpMotorMargin}
                      onChange={(event) => { setPumpMotorMargin(event.target.value); setPumpResult(null); }}
                      className={inputClass}
                    />
                    <span className="mt-1 block text-xs text-gray-500">
                      Multiplier on calculated shaft power, e.g. 1.10 = 10% margin.
                    </span>
                  </label>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={engineeringTask === "pump_sizing" ? calculatePumpSizing : solveHydraulics}
              disabled={engineeringTask === "pump_sizing" ? pumpSizingLoading : loading}
              className="mt-8 w-full rounded-lg bg-black px-5 py-3 font-medium text-white disabled:opacity-50"
            >
              {engineeringTask === "pump_sizing"
                ? (pumpSizingLoading ? "Calculating Pump Duty..." : "Calculate Pump Duty")
                : (loading ? "Solving..." : "Solve Line Hydraulics")}
            </button>

          </SectionCard>

        )}


        {activePage ===
          "results" && (

          pumpResult ? (
            <section className="mb-6 rounded-2xl border border-black bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.16em] text-black">
                    Pump Sizing
                  </div>
                  <h2 className="mt-1 text-2xl font-bold text-gray-900">Required Pump Duty</h2>
                  <p className="mt-2 text-sm text-gray-600">
                    Preliminary hydraulic duty and suction-side NPSHa at the specified design flow. Pump curve, BEP, NPSHr and vendor selection are not yet included.
                  </p>
                </div>
                <div className="rounded-xl border border-black bg-white px-5 py-3 text-right">
                  <div className="text-xs font-semibold uppercase tracking-wide text-black">Duty Point</div>
                  <div className="mt-1 text-lg font-bold text-gray-900">
                    {pumpResult.design_flow_value.toLocaleString()} {pumpResult.flow_unit}
                    {" @ "}
                    {pumpResult.pump_duty.required_differential_head_m.toFixed(2)} m
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Required Head</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">
                    {pumpResult.pump_duty.required_differential_head_m.toFixed(2)} m
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Required ΔP</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">
                    {pumpResult.pump_duty.required_differential_pressure_bar.toFixed(3)} bar
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Shaft Power</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">
                    {pumpResult.pump_duty.shaft_power_kw.toFixed(3)} kW
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Minimum Calculated Motor Power</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">
                    {pumpResult.pump_duty.minimum_motor_rating_kw.toFixed(3)} kW
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-black bg-white p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-black">
                      Suction Performance
                    </div>
                    <h3 className="mt-1 text-xl font-semibold text-gray-900">
                      Net Positive Suction Head Available
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Calculated from the source boundary, the defined suction-side elements,
                      liquid vapour pressure and velocity at the pump suction.
                    </p>
                  </div>
                  <div className="rounded-xl border border-black bg-gray-50 px-5 py-3 text-right">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">NPSHa</div>
                    <div className="mt-1 text-2xl font-bold text-gray-900">
                      {pumpResult.npsha.available_head_m.toFixed(2)} m
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pump suction pressure</div>
                    <div className="mt-1 text-lg font-bold text-gray-900">{pumpResult.npsha.suction_pressure_bar_a.toFixed(3)} bar(a)</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Vapour pressure</div>
                    <div className="mt-1 text-lg font-bold text-gray-900">{pumpResult.npsha.vapor_pressure_bar_a.toFixed(4)} bar(a)</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Suction losses</div>
                    <div className="mt-1 text-lg font-bold text-gray-900">{pumpResult.npsha.suction_resistance_head_m.toFixed(3)} m</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Suction velocity</div>
                    <div className="mt-1 text-lg font-bold text-gray-900">{pumpResult.npsha.suction_velocity_m_s.toFixed(3)} m/s</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="flex justify-between gap-4 rounded-lg border border-gray-200 px-4 py-3 text-sm">
                    <span className="text-gray-600">Pressure head above vapour pressure</span>
                    <span className="font-semibold">{pumpResult.npsha.pressure_npsh_m.toFixed(3)} m</span>
                  </div>
                  <div className="flex justify-between gap-4 rounded-lg border border-gray-200 px-4 py-3 text-sm">
                    <span className="text-gray-600">Suction velocity head</span>
                    <span className="font-semibold">{pumpResult.npsha.suction_velocity_head_m.toFixed(3)} m</span>
                  </div>
                  <div className="flex justify-between gap-4 rounded-lg border border-gray-200 px-4 py-3 text-sm">
                    <span className="text-gray-600">Suction static contribution</span>
                    <span className="font-semibold">{pumpResult.npsha.suction_static_head_m.toFixed(3)} m</span>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  NPSHa is the available suction head only. Pump adequacy cannot be confirmed
                  until NPSHr from the selected pump/vendor curve is available and the required
                  project margin is applied.
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900">Head Breakdown</h3>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-4"><span className="text-gray-600">Static head</span><span className="font-semibold">{pumpResult.system.static_head_m.toFixed(3)} m</span></div>
                    <div className="flex justify-between gap-4"><span className="text-gray-600">Resistance / equipment head</span><span className="font-semibold">{pumpResult.system.resistance_head_m.toFixed(3)} m</span></div>
                    <div className="flex justify-between gap-4"><span className="text-gray-600">Boundary pressure head</span><span className="font-semibold">{pumpResult.boundary.pressure_head_m.toFixed(3)} m</span></div>
                    <div className="flex justify-between gap-4 border-t pt-3"><span className="font-semibold text-gray-900">Total required head</span><span className="font-bold">{pumpResult.pump_duty.required_differential_head_m.toFixed(3)} m</span></div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900">Power & Boundary Conditions</h3>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-4"><span className="text-gray-600">Source pressure</span><span className="font-semibold">{pumpResult.source_pressure_bar_a.toFixed(3)} bar(a)</span></div>
                    <div className="flex justify-between gap-4"><span className="text-gray-600">Destination pressure</span><span className="font-semibold">{pumpResult.destination_pressure_bar_a.toFixed(3)} bar(a)</span></div>
                    <div className="flex justify-between gap-4"><span className="text-gray-600">Hydraulic power</span><span className="font-semibold">{pumpResult.pump_duty.hydraulic_power_kw.toFixed(3)} kW</span></div>
                    <div className="flex justify-between gap-4"><span className="text-gray-600">Pump efficiency</span><span className="font-semibold">{(pumpResult.pump_duty.pump_efficiency * 100).toFixed(1)}%</span></div>
                    <div className="flex justify-between gap-4"><span className="text-gray-600">Motor margin</span><span className="font-semibold">{((pumpResult.pump_duty.motor_margin - 1) * 100).toFixed(1)}%</span></div>
                  </div>
                </div>
              </div>

              {pumpResult.warnings.length > 0 && (
                <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="font-semibold text-amber-900">Engineering warnings</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                    {pumpResult.warnings.map((warning, index) => (
                      <li key={index}>
                        {typeof warning === "string" ? warning : warning.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {scenarioDefinitionMode ? (
                <div className="mt-6 rounded-xl border border-black bg-white p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Pump sizing scenario
                  </div>
                  <h3 className="mt-1 text-lg font-semibold text-gray-900">
                    {scenarioDefinitionMode === "new" ? "Complete & Save Scenario" : "Save Scenario Changes"}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    The fluid, design flow, hydraulic line, pump boundary conditions, efficiency,
                    motor margin and system-curve settings are stored with this scenario.
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-semibold text-gray-800">Scenario name</span>
                      <input
                        value={workingScenarioName}
                        onChange={(event) => setWorkingScenarioName(event.target.value)}
                        className={inputClass}
                        placeholder="e.g. Base Case"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-gray-800">Description</span>
                      <input
                        value={workingScenarioDescription}
                        onChange={(event) => setWorkingScenarioDescription(event.target.value)}
                        className={inputClass}
                        placeholder="Optional"
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void completeScenarioDefinition()}
                      disabled={scenarioLoading || !workingScenarioName.trim()}
                      className="rounded-lg bg-black px-5 py-3 font-semibold text-white disabled:opacity-40"
                    >
                      {scenarioLoading
                        ? "Saving Scenario…"
                        : scenarioDefinitionMode === "new"
                          ? "Complete & Save Scenario"
                          : "Save Scenario Changes"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelScenarioDefinition}
                      disabled={scenarioLoading}
                      className="rounded-lg border border-black bg-white px-5 py-3 font-semibold text-black disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-black bg-white p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Project workspace
                  </div>
                  <h3 className="mt-1 text-lg font-semibold text-gray-900">
                    Save or develop design scenarios
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Save this pump-sizing model to the current project, or create additional pump-sizing
                    scenarios using the same project workspace.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void saveProjectModel()}
                      disabled={projectLoading || !selectedProjectId}
                      className="rounded-lg bg-black px-5 py-3 font-semibold text-white disabled:opacity-40"
                    >
                      {projectLoading ? "Saving…" : "Save Pump Sizing Project"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAnalysisType("scenario");
                        startScenarioDefinition();
                      }}
                      disabled={!selectedProjectId}
                      className="rounded-lg border border-black bg-white px-5 py-3 font-semibold text-black disabled:opacity-40"
                    >
                      + Add Pump Sizing Scenario
                    </button>
                    <button
                      type="button"
                      onClick={() => void openProjectOverview()}
                      disabled={!selectedProjectId || projectLoading}
                      className="rounded-lg border border-black bg-white px-5 py-3 font-semibold text-black disabled:opacity-40"
                    >
                      Project Overview
                    </button>
                  </div>
                  {projectStatus && (
                    <div className="mt-3 text-sm font-medium text-gray-700">{projectStatus}</div>
                  )}
                </div>
              )}

              <div className="mt-6 rounded-xl border border-black bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  System curve settings
                </div>
                <h3 className="mt-1 text-lg font-semibold text-gray-900">
                  Choose the curve endpoint
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  The curve starts at zero flow and extends to the selected multiple of the design flow.
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <span className="text-sm font-semibold text-gray-800">Design flow</span>
                    <div className="mt-1 rounded-lg border border-black bg-white px-3 py-2.5 text-gray-900">
                      {Number(flowValue).toLocaleString()} {normalizeFlowUnit(flowUnit)}
                    </div>
                  </div>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">Curve endpoint</span>
                    <select
                      value={systemCurveMaxFactor}
                      onChange={(event) => {
                        setSystemCurveMaxFactor(event.target.value);
                        setSystemCurve(null);
                      }}
                      className="mt-1 w-full rounded-lg border border-black bg-white px-3 py-2.5 text-gray-900"
                    >
                      <option value="1">1.00 × Qdesign</option>
                      <option value="1.1">1.10 × Qdesign</option>
                      <option value="1.25">1.25 × Qdesign</option>
                      <option value="1.5">1.50 × Qdesign</option>
                      <option value="1.75">1.75 × Qdesign</option>
                      <option value="2">2.00 × Qdesign</option>
                      <option value="2.5">2.50 × Qdesign</option>
                      <option value="3">3.00 × Qdesign</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-gray-800">Curve points</span>
                    <input
                      type="number"
                      min={2}
                      max={101}
                      step={1}
                      value={systemCurvePoints}
                      onChange={(event) => {
                        setSystemCurvePoints(event.target.value);
                        setSystemCurve(null);
                      }}
                      className="mt-1 w-full rounded-lg border border-black bg-white px-3 py-2.5 text-gray-900"
                    />
                  </label>
                </div>

                <div className="mt-3 text-sm text-gray-600">
                  Current endpoint:{" "}
                  <span className="font-semibold text-gray-900">
                    {(Number(flowValue) * Number(systemCurveMaxFactor)).toLocaleString()} {normalizeFlowUnit(flowUnit)}
                    {" "}({systemCurveMaxFactor} × Qdesign)
                  </span>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setActivePage("line")}
                  className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-800"
                >
                  Modify Inputs
                </button>
                <button
                  type="button"
                  onClick={() => void generateSystemCurve()}
                  disabled={systemCurveLoading}
                  className="rounded-lg border border-black bg-white px-5 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {systemCurveLoading ? "Generating System Curve…" : "Generate System Curve"}
                </button>
              </div>

              {systemCurve && (
                <section className="mt-6 rounded-2xl border border-black bg-white p-6">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.16em] text-black">
                        Pump Design
                      </div>
                      <h3 className="mt-1 text-xl font-semibold text-gray-900">System Curve</h3>
                      <p className="mt-1 max-w-3xl text-sm text-gray-600">
                        System head versus flow for the same hydraulic model used to size this pump.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ["Design flow", `${systemCurve.design_point.flow_value.toFixed(2)} ${systemCurve.flow_unit}`],
                      ["Design head", `${systemCurve.design_point.total_head_m.toFixed(2)} m`],
                      ["Design ΔP", `${systemCurve.design_point.total_dp_bar.toFixed(3)} bar`],
                      ["Reference density", `${systemCurve.reference_density_kg_m3.toFixed(1)} kg/m³`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-black bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
                        <div className="mt-1 text-lg font-bold text-gray-900">{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 h-[380px] rounded-xl border border-black bg-white p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={systemCurve.points} margin={{ top: 15, right: 25, left: 10, bottom: 15 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="flow_value"
                          type="number"
                          domain={[0, "dataMax"]}
                          label={{ value: `Flow (${systemCurve.flow_unit})`, position: "insideBottom", offset: -8 }}
                        />
                        <YAxis
                          yAxisId="head"
                          label={{ value: "System head (m)", angle: -90, position: "insideLeft" }}
                        />
                        <Tooltip
                          formatter={(value, name) => [
                            typeof value === "number" ? value.toFixed(3) : value,
                            name,
                          ]}
                        />
                        <Legend />
                        <Line
                          yAxisId="head"
                          type="monotone"
                          dataKey="total_head_m"
                          name="Total system head"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          yAxisId="head"
                          type="monotone"
                          dataKey="static_head_m"
                          name="Static head"
                          strokeDasharray="8 5"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}

              <div className="mt-6 rounded-xl border border-black bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Engineering report</div>
                <h3 className="mt-1 text-lg font-semibold text-gray-900">Pump Sizing Report</h3>
                <p className="mt-1 text-sm text-gray-600">Download the pump design basis, hydraulic line, head breakdown, pump duty, NPSHa / suction performance, power requirement and generated system curve. Scenario Analysis exports all saved scenarios.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" onClick={() => void downloadEngineeringReport("pdf", analysisType === "scenario" ? "project" : "current")} disabled={reportLoading !== null} className="rounded-lg bg-black px-5 py-3 font-semibold text-white disabled:opacity-40">
                    {reportLoading === "pdf" ? "Creating PDF…" : analysisType === "scenario" ? "Download All-Scenario PDF Report" : "Download PDF Report"}
                  </button>
                  <button type="button" onClick={() => void downloadEngineeringReport("docx", analysisType === "scenario" ? "project" : "current")} disabled={reportLoading !== null} className="rounded-lg border border-black bg-white px-5 py-3 font-semibold text-black disabled:opacity-40">
                    {reportLoading === "docx" ? "Creating Word…" : analysisType === "scenario" ? "Download All-Scenario Word Report" : "Download Word Report"}
                  </button>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                <span className="font-semibold text-gray-800">Current scope:</span>{" "}
                This is the required hydraulic duty and preliminary power requirement.
                Standard motor-size selection, pump performance curves, operating-point intersection,
                BEP, NPSHr comparison and NPSH margin checks will be added in the next pump-design stages.
              </div>
            </section>

          ) : result ? (

            <>
              <ResultsView
              result={
                result
              }

              projectName={selectedProject?.name ?? null}

              scenarioDefinitionMode={null}

              scenarioName={null}

              scenarioSaving={scenarioLoading}

              onCompleteScenario={() => void completeScenarioDefinition()}

              onCancelScenario={cancelScenarioDefinition}

              phaseType={
                phaseType
              }

              vaporPressureBarA={
                phaseType === "Liquid"
                  ? (fluidMode === "coolprop"
                      ? coolPropProperties?.vapor_pressure_bar_a ?? null
                      : Number(vaporPressure))
                  : null
              }

              onModify={() =>
                setActivePage(
                  "line"
                )
              }

              onDownloadPdf={() =>
                downloadEngineeringReport("pdf")
              }

              onDownloadDocx={() =>
                downloadEngineeringReport("docx")
              }

              reportLoading={
                reportLoading
              }
            />

              <section className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Hydraulic Design</div>
                    <h2 className="mt-1 text-xl font-semibold text-gray-900">System Curve</h2>
                    <p className="mt-1 max-w-3xl text-sm text-gray-600">
                      Generate the system resistance curve from the current liquid line model.
                      Pipe, fitting, equipment and elevation calculations are recalculated across the flow range.
                    </p>
                  </div>
                  {phaseType !== "Liquid" && (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                      Liquid systems only in v1
                    </span>
                  )}
                </div>

                {phaseType === "Liquid" && (
                  <>
                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                      <div>
                        <span className="text-sm font-semibold text-gray-800">Design flow</span>
                        <div className="mt-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
                          {Number(flowValue).toLocaleString()} {normalizeFlowUnit(flowUnit)}
                        </div>
                      </div>

                      <label className="block">
                        <span className="text-sm font-semibold text-gray-800">Maximum flow</span>
                        <select
                          value={systemCurveMaxFactor}
                          onChange={(event) => { setSystemCurveMaxFactor(event.target.value); setSystemCurve(null); }}
                          className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900"
                        >
                          <option value="1.25">1.25 × design flow</option>
                          <option value="1.5">1.50 × design flow</option>
                          <option value="1.75">1.75 × design flow</option>
                          <option value="2">2.00 × design flow</option>
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-sm font-semibold text-gray-800">Curve points</span>
                        <input
                          type="number"
                          min={2}
                          max={101}
                          step={1}
                          value={systemCurvePoints}
                          onChange={(event) => { setSystemCurvePoints(event.target.value); setSystemCurve(null); }}
                          className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900"
                        />
                      </label>
                    </div>

                    {!inletPressure.trim() && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        Enter an inlet absolute pressure before generating the system curve.
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => void generateSystemCurve()}
                      disabled={systemCurveLoading || !inletPressure.trim()}
                      className="mt-5 rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {systemCurveLoading ? "Generating System Curve…" : "Generate System Curve"}
                    </button>

                    {systemCurve && (
                      <div className="mt-6">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {[
                            ["Design flow", `${systemCurve.design_point.flow_value.toFixed(2)} ${systemCurve.flow_unit}`],
                            ["Required head", `${systemCurve.design_point.total_head_m.toFixed(2)} m`],
                            ["Required ΔP", `${systemCurve.design_point.total_dp_bar.toFixed(3)} bar`],
                            ["Reference density", `${systemCurve.reference_density_kg_m3.toFixed(1)} kg/m³`],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-xl border bg-gray-50 p-4">
                              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
                              <div className="mt-1 text-lg font-bold text-gray-900">{value}</div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-5 h-[380px] rounded-xl border border-gray-200 bg-white p-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={systemCurve.points} margin={{ top: 15, right: 25, left: 10, bottom: 15 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey="flow_value"
                                type="number"
                                domain={[0, "dataMax"]}
                                label={{ value: `Flow (${systemCurve.flow_unit})`, position: "insideBottom", offset: -8 }}
                              />
                              <YAxis
                                yAxisId="head"
                                label={{ value: "System head (m)", angle: -90, position: "insideLeft" }}
                              />
                              <Tooltip
                                formatter={(value, name) => [
                                  typeof value === "number"
                                    ? value.toFixed(3)
                                    : String(value ?? ""),
                                  String(name ?? ""),
                                ]}
                                labelFormatter={(value) =>
                                  `Flow: ${Number(value).toFixed(2)} ${systemCurve.flow_unit}`
                                }
                              />
                              <Legend verticalAlign="top" height={30} />
                              <Line yAxisId="head" type="monotone" dataKey="total_head_m" name="Total system head" strokeWidth={3} dot={false} isAnimationActive={false} />
                              <Line yAxisId="head" type="monotone" dataKey="static_head_m" name="Static head" strokeDasharray="6 4" strokeWidth={2} dot={false} isAnimationActive={false} />
                              <Line yAxisId="head" type="monotone" dataKey="resistance_head_m" name="Resistance / equipment head" strokeDasharray="2 4" strokeWidth={2} dot={false} isAnimationActive={false} />
                              <ReferenceDot
                                yAxisId="head"
                                x={systemCurve.design_point.flow_value}
                                y={systemCurve.design_point.total_head_m}
                                r={6}
                                label={{ value: "Design point", position: "top" }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
                          <div className="text-sm font-semibold text-blue-900">Current system-curve assumptions</div>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-900">
                            {systemCurve.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}
                          </ul>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>

              {analysisType === "scenario" && scenarioDefinitionMode && (
                <section className="mb-6 rounded-2xl border-2 border-teal-700 bg-teal-50/60 p-5 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Step 6 · Save Scenario</div>
                      <h2 className="mt-1 text-xl font-semibold text-gray-900">{scenarioDefinitionMode === "new" ? "Save this calculated scenario" : "Update this scenario"}</h2>
                      <p className="mt-1 text-sm text-gray-600">Review the calculation below, give the case a clear name, then save it to the current project.</p>
                    </div>
                    {scenarioDefinitionMode === "edit" && selectedScenario && (
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-teal-800 ring-1 ring-teal-200">Editing: {selectedScenario.name}</span>
                    )}
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-semibold text-gray-800">Scenario name</span>
                      <input
                        value={workingScenarioName}
                        onChange={(event) => setWorkingScenarioName(event.target.value)}
                        placeholder="e.g. Base Case"
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-gray-800">Description <span className="font-normal text-gray-500">(optional)</span></span>
                      <input
                        value={workingScenarioDescription}
                        onChange={(event) => setWorkingScenarioDescription(event.target.value)}
                        placeholder="What is different about this case?"
                        className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                      />
                    </label>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3 border-t border-teal-100 pt-4">
                    <button
                      type="button"
                      onClick={() => void completeScenarioDefinition()}
                      disabled={scenarioLoading || !workingScenarioName.trim()}
                      className="rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {scenarioLoading ? "Saving…" : scenarioDefinitionMode === "new" ? "Save Scenario" : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivePage("line")}
                      disabled={scenarioLoading}
                      className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-800 disabled:opacity-50"
                    >
                      Modify Inputs
                    </button>
                    {scenarioDefinitionMode === "edit" && selectedScenario && (
                      <button
                        type="button"
                        onClick={() => void deleteScenario(selectedScenario)}
                        disabled={scenarioLoading}
                        className="rounded-lg border border-red-300 bg-white px-5 py-3 font-semibold text-red-700 disabled:opacity-50"
                      >
                        Delete Scenario
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={cancelScenarioDefinition}
                      disabled={scenarioLoading}
                      className="rounded-lg border border-gray-300 bg-gray-50 px-5 py-3 font-medium text-gray-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </section>
              )}

              <section className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Engineering Reports & Downloads</div>
                    <h2 className="mt-1 text-xl font-semibold text-gray-900">Export the engineering calculation</h2>
                    <p className="mt-1 text-sm text-gray-600">
                      Download a traceable report containing the design basis, line definition, hydraulic results, engineering checks and pressure/elevation profile.
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700">
                    <span className="font-medium text-gray-900">Project:</span> {selectedProject?.name ?? "Hydraulic Line Analysis"}
                    {analysisType === "scenario" && (workingScenarioName.trim() || selectedScenario?.name) && (
                      <><span className="mx-2 text-gray-400">·</span><span className="font-medium text-gray-900">Scenario:</span> {workingScenarioName.trim() || selectedScenario?.name}</>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => downloadEngineeringReport("pdf")}
                    disabled={reportLoading !== null}
                    className="rounded-lg bg-black px-5 py-3 font-medium text-white disabled:opacity-50"
                  >
                    {reportLoading === "pdf" ? "Creating PDF..." : "Download PDF Report"}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadEngineeringReport("docx")}
                    disabled={reportLoading !== null}
                    className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-900 disabled:opacity-50"
                  >
                    {reportLoading === "docx" ? "Creating Word Report..." : "Download Word Report"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePage("line")}
                    disabled={reportLoading !== null}
                    className="rounded-lg border border-gray-300 bg-gray-50 px-5 py-3 font-medium text-gray-900 disabled:opacity-50"
                  >
                    Modify Line
                  </button>
                </div>
              </section>
            </>

          ) : (

            <SectionCard
              title="Results"
            >
              No results yet.
            </SectionCard>

          )

        )}

        </div>
        )}

        {wizardStep === "engineering" && analysisType === "scenario" && selectedProjectId && !scenarioDefinitionMode && (
          <section className="mt-8 rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Project Design Cases</div>
                <h2 className="mt-1 text-xl font-semibold text-gray-900">Saved Scenarios</h2>
                <p className="mt-1 max-w-3xl text-sm text-gray-500">
                  Completed engineering cases for {selectedProject?.name ?? "this project"}. Open a case to modify it, create a new case from it, delete it, or compare completed cases.
                </p>
              </div>
              {!scenarioDefinitionMode && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void saveCompleteProject()}
                    disabled={projectLoading}
                    className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    title="Save the project with all scenarios already stored under it. This does not overwrite the project with only the currently open scenario."
                  >
                    {projectLoading ? "Saving Project…" : "Save Project"}
                  </button>
                  <button
                    type="button"
                    onClick={startScenarioDefinition}
                    className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    + Add New Scenario
                  </button>
                </div>
              )}
            </div>

            <div className="mt-5">
              {scenarios.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                  No saved scenarios yet. Start a scenario definition above, choose Assistant or Manual, calculate the case and save it from Results.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {scenarios.map((scenario) => {
                    const isSelected = String(scenario.id) === selectedScenarioId;
                    const pipeId = getScenarioMainPipeIdMm(scenario);
                    return (
                      <div
                        key={scenario.id}
                        className={`rounded-xl border p-4 transition ${isSelected ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900" : "border-gray-200 bg-white"}`}
                      >
                        <button
                          type="button"
                          onClick={() => { setSelectedScenarioId(String(scenario.id)); setScenarioStatus(""); }}
                          className="w-full text-left"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-gray-900">{scenario.name}</div>
                              {scenario.description && <div className="mt-1 line-clamp-2 text-xs text-gray-500">{scenario.description}</div>}
                            </div>
                            {isSelected && <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[11px] font-medium text-white">Selected</span>}
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                            <div className="rounded-lg bg-gray-50 p-2.5">
                              <span className="text-gray-500">Flow</span>
                              <div className="mt-0.5 font-medium text-gray-800">{scenario.flow_value} {normalizeFlowUnit(scenario.flow_unit)}</div>
                            </div>
                            <div className="rounded-lg bg-gray-50 p-2.5">
                              <span className="text-gray-500">Main pipe ID</span>
                              <div className="mt-0.5 font-medium text-gray-800">{pipeId == null ? "—" : `${pipeId.toFixed(1)} mm`}</div>
                            </div>
                          </div>
                        </button>

                        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                          <button
                            type="button"
                            onClick={() => { setSelectedScenarioId(String(scenario.id)); setTimeout(() => void loadScenarioById(scenario), 0); }}
                            disabled={scenarioLoading}
                            className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            Open / Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void startNewFromScenario(scenario)}
                            disabled={scenarioLoading}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 disabled:opacity-50"
                          >
                            Create New from This
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteScenario(scenario)}
                            disabled={scenarioLoading}
                            className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {scenarioStatus && <p className="mt-3 text-sm text-gray-600">{scenarioStatus}</p>}
            </div>

            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Compare completed scenarios</div>
                  <p className="mt-1 text-xs text-gray-600">Recalculate saved cases with the appropriate deterministic engineering solver and compare key design results side-by-side.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void compareScenarios()}
                  disabled={scenarioComparisonLoading || scenarios.length < 2}
                  className="rounded-lg bg-gray-900 px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {scenarioComparisonLoading ? "Comparing…" : "Compare Scenarios"}
                </button>
              </div>
              {scenarios.length === 1 && <p className="mt-2 text-xs text-gray-500">Complete at least one more scenario to compare cases.</p>}
              {scenarioComparisonStatus && <p className="mt-3 text-sm text-gray-600">{scenarioComparisonStatus}</p>}

              {scenarioComparisonRows.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100 text-left text-gray-700">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Scenario</th>
                        <th className="px-3 py-2 font-semibold">Task</th>
                        <th className="px-3 py-2 font-semibold">Flow</th>
                        <th className="px-3 py-2 font-semibold">Main Pipe ID</th>
                        <th className="px-3 py-2 font-semibold">Max Velocity</th>
                        <th className="px-3 py-2 font-semibold">Pump Head</th>
                        <th className="px-3 py-2 font-semibold">Pump ΔP</th>
                        <th className="px-3 py-2 font-semibold">Shaft Power</th>
                        <th className="px-3 py-2 font-semibold">Motor Power</th>
                        <th className="px-3 py-2 font-semibold">Curve End</th>
                        <th className="px-3 py-2 font-semibold">Line ΔP</th>
                        <th className="px-3 py-2 font-semibold">Outlet Pressure</th>
                        <th className="px-3 py-2 font-semibold">Warnings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenarioComparisonRows.map((row) => (
                        <tr key={row.scenario_id} className="border-t border-gray-100 align-top">
                          <td className="px-3 py-2"><div className="font-medium text-gray-900">{row.name}</div>{row.description && <div className="mt-0.5 text-xs text-gray-500">{row.description}</div>}{row.error && <div className="mt-1 max-w-xs text-xs text-red-600">{row.error}</div>}</td>
                          <td className="whitespace-nowrap px-3 py-2">{row.engineering_task === "pump_sizing" ? "Pump Sizing" : "Pressure Drop"}</td>
                          <td className="whitespace-nowrap px-3 py-2">{row.flow_value.toLocaleString()} {row.flow_unit}</td>
                          <td className="whitespace-nowrap px-3 py-2">{row.main_pipe_id_mm === null ? "—" : `${row.main_pipe_id_mm.toFixed(1)} mm`}</td>
                          <td className="whitespace-nowrap px-3 py-2">{row.maximum_velocity_m_s === null ? "—" : `${row.maximum_velocity_m_s.toFixed(2)} m/s`}</td>
                          <td className="whitespace-nowrap px-3 py-2 font-medium">{row.required_pump_head_m === null ? "—" : `${row.required_pump_head_m.toFixed(2)} m`}</td>
                          <td className="whitespace-nowrap px-3 py-2">{row.required_pump_dp_bar === null ? "—" : `${row.required_pump_dp_bar.toFixed(4)} bar`}</td>
                          <td className="whitespace-nowrap px-3 py-2">{row.shaft_power_kw === null ? "—" : `${row.shaft_power_kw.toFixed(3)} kW`}</td>
                          <td className="whitespace-nowrap px-3 py-2">{row.minimum_motor_power_kw === null ? "—" : `${row.minimum_motor_power_kw.toFixed(3)} kW`}</td>
                          <td className="whitespace-nowrap px-3 py-2">{row.system_curve_max_factor === null ? "—" : `${row.system_curve_max_factor.toFixed(2)} × Q`}</td>
                          <td className="whitespace-nowrap px-3 py-2">{row.total_dp_bar === null ? "—" : `${row.total_dp_bar.toFixed(4)} bar`}</td>
                          <td className="whitespace-nowrap px-3 py-2">{row.outlet_pressure_bar_a === null ? "—" : `${row.outlet_pressure_bar_a.toFixed(3)} bar(a)`}</td>
                          <td className="whitespace-nowrap px-3 py-2">{row.error ? "Review" : row.warning_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

      </div>

    </main>
  );
}


// ============================================================
// ELEMENT EDITOR
// ============================================================

function ElementEditor({
  element,
  index,
  total,
  pipeCatalog,
  fittingCatalog,
  upstreamPipe,
  calculateFittingK,
  resolveStandardPipe,
  updateElement,
  removeElement,
  moveUp,
  moveDown,
}: {
  element:
    LineElement;

  index:
    number;

  total:
    number;

  pipeCatalog:
    PipeCatalog | null;

  fittingCatalog:
    FittingCatalog | null;

  upstreamPipe:
    LineElement | null;

  calculateFittingK:
    (element: LineElement) => Promise<void>;

  resolveStandardPipe:
    (
      element:
        LineElement
    ) => {
      od_mm:
        number | null;

      id_mm:
        number | null;

      wall_mm:
        number | null;

      roughness_mm:
        number | null;
    };

  updateElement:
    (
      id:
        number,

      field:
        keyof LineElement,

      value:
        string
    ) => void;

  removeElement:
    (
      id:
        number
    ) => void;

  moveUp:
    () => void;

  moveDown:
    () => void;
}) {

  const standard =
    useMemo(
      () =>
        resolveStandardPipe(
          element
        ),

      [
        element,
        resolveStandardPipe,
      ]
    );


  const selectedSize =
    pipeCatalog
      ?.sizes
      .find(
        (size) =>
          size.nps ===
          element.nps
      );


  const inheritedStandard =
    useMemo(
      () =>
        upstreamPipe
          ? resolveStandardPipe(
              upstreamPipe
            )
          : {
              od_mm: null,
              id_mm: null,
              wall_mm: null,
              roughness_mm: null,
            },
      [
        upstreamPipe,
        resolveStandardPipe,
      ]
    );


  return (

    <div className="rounded-xl border border-gray-200 p-5">

      <div className="mb-5 flex justify-between">

        <div>

          <p className="text-xs uppercase text-gray-400">
            Element{" "}
            {index + 1}
          </p>

          <h3 className="font-semibold">
            {element.type}
          </h3>

        </div>


        <div className="flex gap-2">

          <button
            disabled={
              index === 0
            }
            onClick={
              moveUp
            }
            className="rounded border px-3 disabled:opacity-30"
          >
            ↑
          </button>

          <button
            disabled={
              index ===
              total - 1
            }
            onClick={
              moveDown
            }
            className="rounded border px-3 disabled:opacity-30"
          >
            ↓
          </button>

          <button
            onClick={() =>
              removeElement(
                element.id
              )
            }
            className="rounded border border-red-200 px-3 text-red-600"
          >
            Remove
          </button>

        </div>

      </div>


      <FieldLabel>
        Description
      </FieldLabel>

      <input
        className={
          inputClass
        }

        value={
          element.description
        }

        onChange={(e) =>
          updateElement(
            element.id,
            "description",
            e.target.value
          )
        }
      />


      {element.type ===
        "Resistance / Fitting" && (

        <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/40 p-5">
          <p className="font-semibold text-gray-900">
            Pipe basis for fitting
          </p>

          <p className="mt-1 text-sm text-gray-600">
            By default, the fitting uses the most recent upstream pipe.
            Override only when the fitting is connected to a different line size or material.
          </p>

          <div className="mt-4">
            <ModeSelector
              leftLabel="Inherit Upstream Pipe"
              rightLabel="Override Pipe Basis"
              leftActive={
                element.fittingPipeBasis !==
                "override"
              }
              onLeft={() =>
                updateElement(
                  element.id,
                  "fittingPipeBasis",
                  "inherit"
                )
              }
              onRight={() =>
                updateElement(
                  element.id,
                  "fittingPipeBasis",
                  "override"
                )
              }
            />
          </div>

          {element.fittingPipeBasis !== "override" && (
            upstreamPipe ? (
              <div className="mt-4">
                <div className="rounded-lg border bg-white p-4 text-sm text-gray-700">
                  <p>
                    <strong>Inherited from:</strong>{" "}
                    {upstreamPipe.description || "Upstream pipe"}
                  </p>

                  <p className="mt-1">
                    <strong>Pipe basis:</strong>{" "}
                    {upstreamPipe.pipeMode === "custom"
                      ? "Custom pipe"
                      : `NPS ${upstreamPipe.nps ?? "—"} / ${upstreamPipe.schedule ?? "—"} / ${upstreamPipe.material ?? "—"}`}
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <PropertyCard
                    label="Internal diameter"
                    value={
                      upstreamPipe.pipeMode === "custom"
                        ? formatProperty(
                            Number(upstreamPipe.custom_id_mm),
                            "mm"
                          )
                        : formatProperty(
                            inheritedStandard.id_mm,
                            "mm"
                          )
                    }
                  />

                  <PropertyCard
                    label="Roughness"
                    value={
                      upstreamPipe.pipeMode === "custom"
                        ? formatProperty(
                            Number(upstreamPipe.custom_roughness_mm),
                            "mm",
                            4
                          )
                        : formatProperty(
                            inheritedStandard.roughness_mm,
                            "mm",
                            4
                          )
                    }
                  />

                  <PropertyCard
                    label="Crane nominal basis"
                    value={
                      upstreamPipe.pipeMode === "custom"
                        ? `${upstreamPipe.custom_id_mm ?? "—"} mm`
                        : `DN ${npsToNominalMm(upstreamPipe.nps ?? "") || "—"} mm`
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                No upstream pipe has been defined before this fitting.
                Add a pipe before the fitting or choose Override Pipe Basis.
              </div>
            )
          )}
        </div>

      )}


      {(element.type ===
        "Pipe"
        ||
        (
          element.type ===
          "Resistance / Fitting"
          &&
          element.fittingPipeBasis ===
          "override"
        )) && (

        <>

          <div className="mt-5">

            <ModeSelector
              leftLabel="Standard Pipe"
              rightLabel="Custom Pipe"

              leftActive={
                element.pipeMode !==
                "custom"
              }

              onLeft={() =>
                updateElement(
                  element.id,
                  "pipeMode",
                  "standard"
                )
              }

              onRight={() =>
                updateElement(
                  element.id,
                  "pipeMode",
                  "custom"
                )
              }
            />

          </div>


          {element.pipeMode !==
            "custom" ? (

            <>

              <div className="mt-5 grid gap-4 md:grid-cols-3">

                <Selector
                  label="NPS"
                  value={
                    element.nps ??
                    ""
                  }

                  onChange={(
                    value
                  ) => {

                    updateElement(
                      element.id,
                      "nps",
                      value
                    );


                    const newSize =
                      pipeCatalog
                        ?.sizes
                        .find(
                          (item) =>
                            item.nps ===
                            value
                        );


                    if (
                      newSize
                      &&
                      !newSize.schedules.some(
                        (schedule) =>
                          schedule.schedule ===
                          element.schedule
                      )
                    ) {

                      updateElement(
                        element.id,
                        "schedule",
                        newSize.schedules[0]
                          ?.schedule ??
                        ""
                      );

                    }

                  }}
                >

                  {pipeCatalog
                    ?.sizes
                    .map(
                      (size) => (

                      <option
                        key={
                          size.nps
                        }

                        value={
                          size.nps
                        }
                      >
                        NPS{" "}
                        {size.nps}
                      </option>

                    ))}

                </Selector>


                <Selector
                  label="Schedule"

                  value={
                    element.schedule ??
                    ""
                  }

                  onChange={(
                    value
                  ) =>
                    updateElement(
                      element.id,
                      "schedule",
                      value
                    )
                  }
                >

                  {selectedSize
                    ?.schedules
                    .map(
                      (item) => (

                      <option
                        key={
                          item.schedule
                        }

                        value={
                          item.schedule
                        }
                      >
                        {
                          item.schedule
                        }
                      </option>

                    ))}

                </Selector>


                <Selector
                  label="Material"

                  value={
                    element.material ??
                    ""
                  }

                  onChange={(
                    value
                  ) =>
                    updateElement(
                      element.id,
                      "material",
                      value
                    )
                  }
                >

                  {pipeCatalog
                    ?.materials
                    .map(
                      (item) => (

                      <option
                        key={
                          item.material
                        }

                        value={
                          item.material
                        }
                      >
                        {
                          item.material
                        }
                      </option>

                    ))}

                </Selector>

              </div>


              <div className="mt-5 grid gap-3 sm:grid-cols-3">

                <PropertyCard
                  label="Outside diameter"
                  value={
                    formatProperty(
                      standard.od_mm,
                      "mm"
                    )
                  }
                />

                <PropertyCard
                  label="Internal diameter"
                  value={
                    formatProperty(
                      standard.id_mm,
                      "mm"
                    )
                  }
                />

                <PropertyCard
                  label="Roughness"
                  value={
                    formatProperty(
                      standard.roughness_mm,
                      "mm",
                      4
                    )
                  }
                />

              </div>

            </>

          ) : (

            <div className="mt-5 grid gap-4 md:grid-cols-2">

              <SmallInput
                label="Internal diameter"
                unit="mm"

                value={
                  element.custom_id_mm ??
                  ""
                }

                onChange={(
                  value
                ) =>
                  updateElement(
                    element.id,
                    "custom_id_mm",
                    value
                  )
                }
              />


              <SmallInput
                label="Absolute roughness"
                unit="mm"

                value={
                  element.custom_roughness_mm ??
                  ""
                }

                onChange={(
                  value
                ) =>
                  updateElement(
                    element.id,
                    "custom_roughness_mm",
                    value
                  )
                }
              />

            </div>

          )}

        </>

      )}


      {element.type ===
        "Pipe" && (

        <div className="mt-5 grid gap-4 md:grid-cols-2">

          <SmallInput
            label="Pipe length"
            unit="m"

            value={
              element.length_m ??
              ""
            }

            onChange={(
              value
            ) =>
              updateElement(
                element.id,
                "length_m",
                value
              )
            }
          />


          <SmallInput
            label="Elevation change"
            unit="m"

            value={
              element.dz_m ??
              ""
            }

            onChange={(
              value
            ) =>
              updateElement(
                element.id,
                "dz_m",
                value
              )
            }
          />

        </div>

      )}


      {element.type ===
        "Resistance / Fitting" && (

        <div className="mt-6 rounded-xl border bg-gray-50 p-5">

          <ModeSelector
            leftLabel="Crane Database"
            rightLabel="Manual K"
            leftActive={
              element.fittingMode !== "manual"
            }
            onLeft={() =>
              updateElement(
                element.id,
                "fittingMode",
                "database"
              )
            }
            onRight={() =>
              updateElement(
                element.id,
                "fittingMode",
                "manual"
              )
            }
          />

          {element.fittingMode !== "manual" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Selector
                  label="Fitting category"
                  value={element.fittingCategory ?? ""}
                  onChange={(value) => {
                    updateElement(element.id, "fittingCategory", value);
                    updateElement(element.id, "fittingSelection", "");
                    updateElement(element.id, "k_total", "");
                  }}
                >
                  <option value="">Select category</option>
                  {fittingCatalog?.categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Selector>

                <Selector
                  label="Crane fitting"
                  value={element.fittingSelection ?? ""}
                  onChange={(value) => {
                    updateElement(element.id, "fittingSelection", value);
                    updateElement(element.id, "k_total", "");
                  }}
                >
                  <option value="">Select fitting</option>
                  {fittingCatalog?.records
                    .filter((record) =>
                      !element.fittingCategory ||
                      record.category === element.fittingCategory
                    )
                    .map((record) => (
                      <option
                        key={`${record.id}-${record.selection_label}`}
                        value={record.selection_label}
                      >
                        {record.selection_label}
                      </option>
                    ))}
                </Selector>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <SmallInput
                  label="Quantity"
                  value={element.fittingQuantity ?? "1"}
                  onChange={(value) => {
                    updateElement(element.id, "fittingQuantity", value);
                    updateElement(element.id, "k_total", "");
                  }}
                />

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Database K override
                  </label>
                  <select
                    className={inputClass}
                    value={element.fittingOverrideEnabled ?? "false"}
                    onChange={(e) =>
                      updateElement(
                        element.id,
                        "fittingOverrideEnabled",
                        e.target.value
                      )
                    }
                  >
                    <option value="false">Use Crane value</option>
                    <option value="true">Override K each</option>
                  </select>
                </div>
              </div>

              {element.fittingOverrideEnabled === "true" && (
                <div className="mt-4 max-w-sm">
                  <SmallInput
                    label="Override K each"
                    unit="K"
                    value={element.fittingOverrideKEach ?? ""}
                    onChange={(value) =>
                      updateElement(
                        element.id,
                        "fittingOverrideKEach",
                        value
                      )
                    }
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => calculateFittingK(element)}
                className="mt-5 rounded-lg bg-black px-5 py-3 font-medium text-white"
              >
                Calculate Fitting K
              </button>

              {element.k_total && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <PropertyCard
                    label="Database K each"
                    value={element.fittingDatabaseKEach || "—"}
                  />
                  <PropertyCard
                    label="Applied K each"
                    value={element.fittingKEach || "—"}
                  />
                  <PropertyCard
                    label="Quantity"
                    value={element.fittingQuantity || "1"}
                  />
                  <PropertyCard
                    label="Total K"
                    value={element.k_total}
                  />
                </div>
              )}

              {element.fittingExpression && (
                <div className="mt-4 rounded-lg border bg-white p-4 text-sm text-gray-700">
                  <p>
                    <strong>Method:</strong> {element.fittingMethod || "—"}
                  </p>
                  <p className="mt-1">
                    <strong>Calculation:</strong> {element.fittingExpression}
                  </p>
                  {element.fittingFt && (
                    <p className="mt-1">
                      <strong>Crane fT:</strong> {element.fittingFt}
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="max-w-sm">
              <SmallInput
                label="Total K"
                unit="K"
                value={element.k_total ?? ""}
                onChange={(value) =>
                  updateElement(
                    element.id,
                    "k_total",
                    value
                  )
                }
              />

              <p className="mt-2 text-xs text-gray-500">
                Use Manual K for proprietary, vendor-specific, or non-standard fittings.
              </p>
            </div>
          )}

        </div>

      )}


      {element.type ===
        "Known Equipment ΔP" && (

        <div className="mt-5 max-w-sm">

          <SmallInput
            label="Known pressure drop"
            unit="bar"

            value={
              element.known_dp_bar ??
              ""
            }

            onChange={(
              value
            ) =>
              updateElement(
                element.id,
                "known_dp_bar",
                value
              )
            }
          />

        </div>

      )}


      {element.type ===
        "Elevation Change" && (

        <div className="mt-5 max-w-sm">

          <SmallInput
            label="Elevation change"
            unit="m"

            value={
              element.dz_m ??
              ""
            }

            onChange={(
              value
            ) =>
              updateElement(
                element.id,
                "dz_m",
                value
              )
            }
          />

        </div>

      )}

    </div>
  );
}


// ============================================================
// RESULTS
// ============================================================

function ResultsView({
  result,
  projectName,
  scenarioDefinitionMode,
  scenarioName,
  scenarioSaving,
  onCompleteScenario,
  onCancelScenario,
  phaseType,
  vaporPressureBarA,
  onModify,
  onDownloadPdf,
  onDownloadDocx,
  reportLoading,
}: {
  result: SolveResult;
  projectName: string | null;
  scenarioDefinitionMode: "new" | "edit" | null;
  scenarioName: string | null;
  scenarioSaving: boolean;
  onCompleteScenario: () => void;
  onCancelScenario: () => void;
  phaseType: string;
  vaporPressureBarA: number | null;
  onModify: () => void;
  onDownloadPdf: () => void;
  onDownloadDocx: () => void;
  reportLoading: "pdf" | "docx" | null;
}) {
  type CheckStatus = "PASS" | "CAUTION" | "WARNING";
  type EngineeringCheck = {
    status: CheckStatus;
    title: string;
    value: string;
    message: string;
  };

  const hydraulicElements = result.elements.filter(
    (row) => row.velocity_m_s !== null
  );
  const velocities = hydraulicElements
    .map((row) => row.velocity_m_s)
    .filter((value): value is number => value !== null);
  const reynolds = hydraulicElements
    .map((row) => row.reynolds_number)
    .filter((value): value is number => value !== null);
  const maxVelocity = velocities.length ? Math.max(...velocities) : null;
  const minVelocity = velocities.length ? Math.min(...velocities) : null;
  const minRe = reynolds.length ? Math.min(...reynolds) : null;
  const maxRe = reynolds.length ? Math.max(...reynolds) : null;
  const pressureDropPercent =
    result.inlet_pressure_bar_a !== null && result.inlet_pressure_bar_a > 0
      ? (result.total_dp_bar / result.inlet_pressure_bar_a) * 100
      : null;
  const vaporMargin =
    phaseType === "Liquid" && vaporPressureBarA !== null && result.minimum_pressure_bar_a !== null
      ? result.minimum_pressure_bar_a - vaporPressureBarA
      : null;

  const checks: EngineeringCheck[] = [];

  if (result.minimum_pressure_bar_a !== null) {
    if (result.minimum_pressure_bar_a <= 0) {
      checks.push({
        status: "WARNING",
        title: "Absolute pressure",
        value: `${result.minimum_pressure_bar_a.toFixed(3)} bar(a)`,
        message: "Calculated pressure reaches zero or below. Review the design basis and line model before using these results.",
      });
    } else {
      checks.push({
        status: "PASS",
        title: "Absolute pressure",
        value: `${result.minimum_pressure_bar_a.toFixed(3)} bar(a) minimum`,
        message: "Calculated pressure remains positive throughout the modeled line.",
      });
    }
  } else {
    checks.push({
      status: "PASS",
      title: "Calculation basis",
      value: "ΔP-only",
      message: "No inlet absolute pressure was specified. Absolute-pressure and vapor-margin checks are intentionally omitted.",
    });
  }

  if (phaseType === "Liquid" && vaporMargin !== null) {
    checks.push({
      status: vaporMargin <= 0 ? "WARNING" : vaporMargin < 0.2 ? "CAUTION" : "PASS",
      title: "Vapor-pressure margin",
      value: `${vaporMargin.toFixed(3)} bar`,
      message:
        vaporMargin <= 0
          ? "Minimum line pressure is at or below the fluid vapor pressure; flashing/cavitation risk requires review."
          : vaporMargin < 0.2
            ? "The pressure margin above vapor pressure is small. Review local losses, temperature and suction conditions."
            : "Minimum line pressure remains above the fluid vapor pressure with more than 0.2 bar screening margin.",
    });
  }

  if (pressureDropPercent !== null) {
    checks.push({
      status: pressureDropPercent > 30 ? "WARNING" : pressureDropPercent > 10 ? "CAUTION" : "PASS",
      title: "Line pressure-drop ratio",
      value: `${pressureDropPercent.toFixed(1)}% of inlet pressure`,
      message:
        pressureDropPercent > 30
          ? "Pressure loss is a large fraction of inlet pressure. Confirm pipe sizing, fittings and available driving pressure."
          : pressureDropPercent > 10
            ? "Pressure loss is material relative to inlet pressure; review against the process pressure budget."
            : "Pressure loss is below 10% of inlet pressure in this screening check.",
    });
  }

  if (maxVelocity !== null && minVelocity !== null) {
    if (phaseType === "Liquid") {
      const status: CheckStatus =
        maxVelocity > 5 ? "WARNING" : maxVelocity > 3 || minVelocity < 0.5 ? "CAUTION" : "PASS";
      checks.push({
        status,
        title: "Liquid velocity screening",
        value: `${minVelocity.toFixed(2)}–${maxVelocity.toFixed(2)} m/s`,
        message:
          status === "PASS"
            ? "Velocity lies within the default 0.5–3 m/s screening band. Final limits should be set from service-specific design criteria."
            : maxVelocity > 5
              ? "Velocity exceeds 5 m/s. Check erosion, noise, water hammer and service-specific limits."
              : "Velocity falls outside the default 0.5–3 m/s screening band. Confirm the acceptable range for this service.",
      });
    } else {
      checks.push({
        status: result.maximum_mach >= 0.7 ? "WARNING" : result.maximum_mach >= 0.3 ? "CAUTION" : "PASS",
        title: "Gas compressibility / Mach screening",
        value: `Mach ${result.maximum_mach.toFixed(3)} maximum`,
        message:
          result.maximum_mach >= 0.7
            ? "High Mach number: compressibility and choking effects require careful review."
            : result.maximum_mach >= 0.3
              ? "Compressibility effects are becoming significant; verify the gas-flow method and pressure profile."
              : "Maximum Mach number is below 0.3 in this screening check.",
      });
    }
  }

  if (minRe !== null && maxRe !== null) {
    const transitionPresent = reynolds.some((value) => value >= 2300 && value <= 4000);
    const laminarPresent = reynolds.some((value) => value < 2300);
    checks.push({
      status: transitionPresent ? "CAUTION" : "PASS",
      title: "Flow regime",
      value: `Re ${Math.round(minRe).toLocaleString()}–${Math.round(maxRe).toLocaleString()}`,
      message: transitionPresent
        ? "At least one modeled section is in the transitional Reynolds-number range; friction-factor uncertainty is higher."
        : laminarPresent
          ? "Laminar flow is present and is handled by the solver. Confirm that this regime is appropriate for the process service."
          : "All hydraulic sections are outside the transitional Reynolds-number range.",
    });
  }

  const statusClass = (status: CheckStatus) => {
    if (status === "WARNING") return "border-red-200 bg-red-50 text-red-900";
    if (status === "CAUTION") return "border-yellow-200 bg-yellow-50 text-yellow-900";
    return "border-green-200 bg-green-50 text-green-900";
  };

  return (
    <div className="space-y-6">
      {scenarioDefinitionMode && scenarioName && (
        <SectionCard
          title={scenarioDefinitionMode === "new" ? "Complete Scenario" : "Complete Scenario Update"}
          subtitle="The scenario inputs are defined and the engineering calculation is complete. Review the results, then save this calculated case."
        >
          <div className="rounded-xl border-2 border-gray-900 bg-gray-50 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Scenario definition calculated</div>
                <div className="mt-1 text-lg font-semibold text-gray-900">{scenarioName}</div>
                <p className="mt-1 text-sm text-gray-600">This will save the fluid, flow, full line definition and the design basis that produced the results currently shown.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onCompleteScenario}
                  disabled={scenarioSaving}
                  className="rounded-lg bg-gray-900 px-5 py-3 font-semibold text-white disabled:opacity-50"
                >
                  {scenarioSaving ? "Saving Scenario…" : scenarioDefinitionMode === "new" ? "Complete & Save Scenario" : "Save Completed Scenario"}
                </button>
                <button
                  type="button"
                  onClick={onModify}
                  disabled={scenarioSaving}
                  className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-900 disabled:opacity-50"
                >
                  Modify Before Saving
                </button>
                <button
                  type="button"
                  onClick={onCancelScenario}
                  disabled={scenarioSaving}
                  className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-700 disabled:opacity-50"
                >
                  Cancel Definition
                </button>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Hydraulic Summary">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Outlet Pressure" value={result.outlet_pressure_bar_a === null ? "—" : result.outlet_pressure_bar_a.toFixed(3)} unit={result.outlet_pressure_bar_a === null ? "" : "bar(a)"} />
          <MetricCard label="Total ΔP" value={result.total_dp_bar.toFixed(4)} unit="bar" />
          <MetricCard label="Resistance ΔP" value={result.resistance_dp_bar.toFixed(4)} unit="bar" />
          <MetricCard label="Static ΔP" value={result.static_dp_bar.toFixed(4)} unit="bar" />
          <MetricCard label="Minimum Pressure" value={result.minimum_pressure_bar_a === null ? "—" : result.minimum_pressure_bar_a.toFixed(3)} unit={result.minimum_pressure_bar_a === null ? "" : "bar(a)"} />
          <MetricCard label="Mass Flow" value={result.mass_flow_kg_s.toFixed(3)} unit="kg/s" />
          <MetricCard label="Line Length" value={result.total_line_length_m.toFixed(2)} unit="m" />
          <MetricCard label="Elevation Change" value={result.net_elevation_change_m.toFixed(2)} unit="m" />
        </div>
      </SectionCard>

      <SectionCard
        title="Engineering Design Checks"
        subtitle="Screening checks support engineering review; service-specific project criteria remain authoritative."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {checks.map((check, index) => (
            <div key={`${check.title}-${index}`} className={`rounded-xl border p-4 ${statusClass(check.status)}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{check.title}</p>
                  <p className="mt-1 text-sm font-medium">{check.value}</p>
                </div>
                <span className="rounded-full border border-current px-2.5 py-1 text-xs font-bold tracking-wide">
                  {check.status}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6">{check.message}</p>
            </div>
          ))}
        </div>

        {result.warnings.length > 0 && (
          <div className="mt-6 border-t pt-5">
            <p className="font-semibold text-gray-900">Solver warnings</p>
            <div className="mt-3 space-y-3">
              {result.warnings.map((warning, index) => (
                <div key={index} className={
                  warning.level?.toLowerCase() === "error"
                    ? "rounded-lg border border-red-200 bg-red-50 p-4 text-red-900"
                    : "rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-900"
                }>
                  <strong>{warning.code}</strong>
                  <p className="mt-1 text-sm">{warning.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title={result.absolute_pressure_available === false ? "Elevation Profile (absolute pressure not specified)" : "Pressure & Elevation Profile"}>
        <div className="h-[430px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={result.profile}
              margin={{ top: 20, right: 40, left: 20, bottom: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="distance_m" type="number" domain={["dataMin", "dataMax"]} />
              <YAxis yAxisId="pressure" orientation="left" domain={["auto", "auto"]} />
              <YAxis yAxisId="elevation" orientation="right" domain={["auto", "auto"]} />
              <Tooltip />
              <Legend />
              <Line yAxisId="pressure" dataKey="pressure_bar_a" name="Pressure bar(a)" dot={false} strokeWidth={2.5} />
              <Line yAxisId="elevation" dataKey="elevation_m" name="Elevation m" dot={false} strokeWidth={2} strokeDasharray="6 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard title="Element-by-Element Pressure Balance">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-3 py-3">#</th>
                <th className="px-3 py-3">Element</th>
                <th className="px-3 py-3">Description</th>
                <th className="px-3 py-3">P in [bar(a)]</th>
                <th className="px-3 py-3">P out [bar(a)]</th>
                <th className="px-3 py-3">ΔP [bar]</th>
                <th className="px-3 py-3">Velocity [m/s]</th>
                <th className="px-3 py-3">Re [-]</th>
                <th className="px-3 py-3">f [-]</th>
              </tr>
            </thead>
            <tbody>
              {result.elements.map((row) => (
                <tr key={row.index} className="border-b">
                  <td className="px-3 py-3">{row.index}</td>
                  <td className="px-3 py-3">{row.element_type}</td>
                  <td className="px-3 py-3">{row.description}</td>
                  <td className="px-3 py-3">{row.pressure_in_bar_a === null ? "—" : row.pressure_in_bar_a.toFixed(3)}</td>
                  <td className="px-3 py-3">{row.pressure_out_bar_a === null ? "—" : row.pressure_out_bar_a.toFixed(3)}</td>
                  <td className="px-3 py-3">
                    {(
                      row.pipe_friction_dp_bar +
                      row.local_resistance_dp_bar +
                      row.equipment_dp_bar +
                      row.elevation_dp_bar
                    ).toFixed(4)}
                  </td>
                  <td className="px-3 py-3">{row.velocity_m_s === null ? "—" : row.velocity_m_s.toFixed(3)}</td>
                  <td className="px-3 py-3">{row.reynolds_number === null ? "—" : Math.round(row.reynolds_number).toLocaleString()}</td>
                  <td className="px-3 py-3">{row.friction_factor === null ? "—" : row.friction_factor.toFixed(5)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <button
        type="button"
        onClick={onModify}
        className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-900"
      >
        ← Modify Line
      </button>
    </div>
  );
}


function SectionCard({
  title,
  subtitle,
  children,
}: {
  title:
    string;

  subtitle?:
    string;

  children:
    ReactNode;
}) {

  return (

    <section className="rounded-xl bg-white p-6 shadow-sm">

      <h2 className="text-xl font-semibold">
        {title}
      </h2>

      {subtitle && (
        <p className="mt-1 text-sm text-gray-500">
          {subtitle}
        </p>
      )}

      <div className="mt-6">
        {children}
      </div>

    </section>
  );
}


function NavButton({
  label,
  active,
  onClick,
}: {
  label:
    string;

  active:
    boolean;

  onClick:
    () => void;
}) {

  return (

    <button
      onClick={
        onClick
      }

      className={
        active
          ? "border-b-4 border-black px-4 py-5 font-semibold"
          : "border-b-4 border-transparent px-4 py-5 text-gray-500"
      }
    >
      {label}
    </button>
  );
}


function ModeSelector({
  leftLabel,
  rightLabel,
  leftActive,
  onLeft,
  onRight,
}: {
  leftLabel:
    string;

  rightLabel:
    string;

  leftActive:
    boolean;

  onLeft:
    () => void;

  onRight:
    () => void;
}) {

  return (

    <div className="mb-5 grid grid-cols-2 rounded-lg bg-gray-100 p-1">

      <button
        type="button"

        onClick={
          onLeft
        }

        className={
          leftActive
            ? "rounded-md bg-white px-3 py-2 font-medium shadow-sm"
            : "px-3 py-2 text-gray-500"
        }
      >
        {leftLabel}
      </button>


      <button
        type="button"

        onClick={
          onRight
        }

        className={
          !leftActive
            ? "rounded-md bg-white px-3 py-2 font-medium shadow-sm"
            : "px-3 py-2 text-gray-500"
        }
      >
        {rightLabel}
      </button>

    </div>
  );
}


function FieldLabel({
  children,
}: {
  children:
    ReactNode;
}) {

  return (
    <label className="mb-2 mt-5 block text-sm font-medium text-gray-700">
      {children}
    </label>
  );
}


function NumberInput({
  value,
  onChange,
}: {
  value:
    string;

  onChange:
    (
      value:
        string
    ) => void;
}) {

  return (

    <input
      type="number"
      step="any"

      value={
        value
      }

      onChange={(e) =>
        onChange(
          e.target.value
        )
      }

      className={
        inputClass
      }
    />
  );
}


function SmallInput({
  label,
  unit,
  value,
  onChange,
}: {
  label:
    string;

  unit?:
    string;

  value:
    string;

  onChange:
    (
      value:
        string
    ) => void;
}) {

  return (

    <div>

      <label className="mb-2 block text-sm font-medium">
        {label}{" "}
        {unit &&
          `(${unit})`}
      </label>

      <NumberInput
        value={
          value
        }

        onChange={
          onChange
        }
      />

    </div>
  );
}


function Selector({
  label,
  value,
  onChange,
  children,
}: {
  label:
    string;

  value:
    string;

  onChange:
    (
      value:
        string
    ) => void;

  children:
    ReactNode;
}) {

  return (

    <div>

      <label className="mb-2 block text-sm font-medium">
        {label}
      </label>

      <select
        className={
          inputClass
        }

        value={
          value
        }

        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
      >
        {children}
      </select>

    </div>
  );
}


function AddButton({
  label,
  onClick,
}: {
  label:
    string;

  onClick:
    () => void;
}) {

  return (

    <button
      onClick={
        onClick
      }

      className="rounded-lg border bg-white px-4 py-3 font-medium hover:bg-gray-50"
    >
      {label}
    </button>
  );
}


function PropertyCard({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {

  return (

    <div className="rounded-lg border bg-gray-50 p-4">

      <p className="text-xs uppercase text-gray-500">
        {label}
      </p>

      <p className="mt-1 font-semibold">
        {value}
      </p>

    </div>
  );
}


function MetricCard({
  label,
  value,
  unit,
}: {
  label:
    string;

  value:
    string;

  unit:
    string;
}) {

  return (

    <div className="rounded-xl border bg-gray-50 p-5">

      <p className="text-sm text-gray-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold">
        {value}
      </p>

      <p className="text-sm text-gray-500">
        {unit}
      </p>

    </div>
  );
}


function npsToNominalMm(
  nps: string
): number {
  const map: Record<string, number> = {
    "1/2": 15,
    "3/4": 20,
    "1": 25,
    "1 1/4": 32,
    "1 1/2": 40,
    "2": 50,
    "2 1/2": 65,
    "3": 80,
    "4": 100,
    "5": 125,
    "6": 150,
    "8": 200,
    "10": 250,
    "12": 300,
  };

  return map[nps] ?? Number.NaN;
}


function formatProperty(
  value:
    number | null,

  unit:
    string,

  decimals:
    number = 3
) {

  if (
    value === null
    ||
    !Number.isFinite(
      value
    )
  ) {
    return "—";
  }

  return `${value.toFixed(
    decimals
  )} ${unit}`;
}