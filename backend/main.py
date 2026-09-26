from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator

from engineering.hydraulics import (
    calculate_velocity,
    calculate_reynolds_number,
    classify_flow,
    friction_factor as engineering_friction_factor,
    calculate_pressure_drop,
    solve_line,
    build_system_curve,
    size_pump_duty,
)
from engineering.fluids import (
    automatic_properties_available,
    get_available_fluids,
    get_fluid_catalogue,
    search_fluids,
    get_fluid_properties,
)
from engineering.piping import get_piping_catalog
from engineering.fittings import (
    fitting_database_available,
    get_database_info,
    get_fitting_catalog,
    calculate_fitting_k,
)
from engineering.prompt_interpreter import interpret_hydraulics_prompt
from agents.hydraulics_copilot import ai_available, interpret_hydraulics_with_ai
from reports.engineering_report import (
    create_pdf_report,
    create_docx_report,
    create_pump_pdf_report,
    create_pump_docx_report,
)
from reports.project_engineering_report import (
    create_project_pdf_report,
    create_project_docx_report,
    create_pump_project_pdf_report,
    create_pump_project_docx_report,
)

from database.db import create_db_and_tables

from backend.projects import router as projects_router
from backend.scenarios import router as scenarios_router
from backend.project_delete import router as project_delete_router

from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="Process Engineering Workbench",
    version="0.8.0",
    description=(
        "Engineering API for fluid properties, piping, fittings, line hydraulics, "
        "engineering reports and AI-assisted engineering intent interpretation."
    ),
)

app.include_router(projects_router)
app.include_router(scenarios_router)
app.include_router(project_delete_router)


@app.get("/health", tags=["Operations"])
def health_check():
    return {"status": "ok"}


@app.on_event("startup")
def on_startup():
    create_db_and_tables()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.0.253:3000",
        "https://process-engineering-workbench.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def normalize_flow_unit(value: str) -> str:
    """Normalize common engineering flow-unit spellings to canonical symbols."""
    raw = (value or "").strip()
    compact = (
        raw.replace(" ", "")
           .replace("³", "3")
           .lower()
    )

    aliases = {
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
    }

    return aliases.get(compact, raw)


class VelocityInput(BaseModel):
    flow_rate_m3_h: float = Field(gt=0)
    pipe_diameter_m: float = Field(gt=0)


class PressureDropInput(BaseModel):
    flow_rate_m3_h: float = Field(gt=0)
    pipe_diameter_m: float = Field(gt=0)
    pipe_length_m: float = Field(gt=0)
    density_kg_m3: float = Field(gt=0)
    dynamic_viscosity_pa_s: float = Field(gt=0)
    roughness_m: float = Field(ge=0)


class FluidPropertyRequest(BaseModel):
    fluid: str
    temperature_c: float
    pressure_bar_a: float = Field(gt=0)


class FluidConfig(BaseModel):
    phase_type: str = "Liquid"
    fluid: str = "Water"
    temperature_c: float = 25.0
    use_manual_properties: bool = True
    density_kg_m3: float | None = 997.0
    dynamic_viscosity_pa_s: float | None = 0.00089
    vapor_pressure_bar_a: float | None = 0.0317
    molecular_weight_kg_kmol: float | None = 28.965
    compressibility_factor: float | None = 1.0
    gamma: float | None = 1.40


class FittingKRequest(BaseModel):
    selection_label: str
    nominal_size_mm: float = Field(gt=0)
    quantity: int = Field(default=1, ge=1)
    override_k_each: float | None = Field(default=None, ge=0)


class LineElement(BaseModel):
    type: str
    description: str = ""
    length_m: float | None = None
    id_mm: float | None = None
    roughness_mm: float | None = None
    dz_m: float | None = 0.0
    k_total: float | None = None
    k_each: float | None = None
    quantity: int | None = None
    database_selection: str | None = None
    fitting_method: str | None = None
    fitting_ft: float | None = None
    fitting_multiplier: float | None = None
    fitting_expression: str | None = None
    known_dp_bar: float | None = None
    nps: str | None = None
    dn_mm: float | None = None
    schedule: str | None = None
    material: str | None = None
    roughness_label: str | None = None


class LineSolveInput(BaseModel):
    fluid_config: FluidConfig
    flow_value: float = Field(gt=0)
    flow_unit: str = "m³/h"
    calculation_intent: Literal["pressure_drop", "outlet_pressure", "pressure_profile"] = "outlet_pressure"
    inlet_pressure_bar_a: float | None = Field(default=None, gt=0)
    property_reference_pressure_bar_a: float | None = Field(default=None, gt=0)
    elements: list[LineElement]

    @field_validator("flow_unit", mode="before")
    @classmethod
    def normalize_requested_flow_unit(cls, value):
        return normalize_flow_unit(str(value))

    @field_validator("inlet_pressure_bar_a", "property_reference_pressure_bar_a", mode="before")
    @classmethod
    def normalize_optional_pressure(cls, value):
        if value is None:
            return None

        if isinstance(value, str):
            cleaned = value.strip()
            if cleaned == "" or cleaned.lower() in {"null", "none", "undefined", "nan"}:
                return None
            return cleaned

        return value


class SystemCurveInput(BaseModel):
    fluid_config: FluidConfig
    design_flow_value: float = Field(gt=0)
    flow_unit: str = "m³/h"
    inlet_pressure_bar_a: float = Field(gt=0)
    elements: list[LineElement]
    max_flow_factor: float = Field(default=1.5, gt=0)
    number_points: int = Field(default=21, ge=2, le=101)

    @field_validator("flow_unit", mode="before")
    @classmethod
    def normalize_system_curve_flow_unit(cls, value):
        return normalize_flow_unit(str(value))


class PumpSizingInput(BaseModel):
    fluid_config: FluidConfig
    design_flow_value: float = Field(gt=0)
    flow_unit: str = "m³/h"
    source_pressure_bar_a: float = Field(gt=0)
    destination_pressure_bar_a: float = Field(gt=0)
    elements: list[LineElement]
    pump_efficiency: float = Field(default=0.70, gt=0, le=1)
    motor_margin: float = Field(default=1.10, ge=1)
    pump_after_element_index: int = Field(default=0, ge=0)

    @field_validator("flow_unit", mode="before")
    @classmethod
    def normalize_pump_sizing_flow_unit(cls, value):
        return normalize_flow_unit(str(value))


class HydraulicPromptRequest(BaseModel):
    prompt: str = Field(min_length=10)
    use_ai: bool = True


class EngineeringReportRequest(BaseModel):
    project_title: str = "Hydraulic Line Analysis"
    fluid_config: dict[str, Any]
    flow_value: float
    flow_unit: str

    @field_validator("flow_unit", mode="before")
    @classmethod
    def normalize_report_flow_unit(cls, value):
        return normalize_flow_unit(str(value))
    inlet_pressure_bar_a: float | None = None
    calculation_intent: str = "outlet_pressure"
    elements: list[dict[str, Any]]
    result: dict[str, Any]


class PumpEngineeringReportRequest(BaseModel):
    project_title: str = "Pump Sizing Analysis"
    fluid_config: dict[str, Any]
    flow_value: float
    flow_unit: str
    source_pressure_bar_a: float = Field(gt=0)
    destination_pressure_bar_a: float = Field(gt=0)
    pump_efficiency: float = Field(gt=0, le=1)
    motor_margin: float = Field(ge=1)
    pump_after_element_index: int = Field(default=0, ge=0)
    elements: list[dict[str, Any]]
    result: dict[str, Any]
    system_curve: dict[str, Any] | None = None

    @field_validator("flow_unit", mode="before")
    @classmethod
    def normalize_pump_report_flow_unit(cls, value):
        return normalize_flow_unit(str(value))


class ProjectScenarioReportItem(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None
    fluid_config: dict[str, Any]
    flow_value: float
    flow_unit: str
    inlet_pressure_bar_a: float | None = None
    calculation_intent: str = "pressure_drop"
    elements: list[dict[str, Any]]
    result: dict[str, Any]

    @field_validator("flow_unit", mode="before")
    @classmethod
    def normalize_project_scenario_flow_unit(cls, value):
        return normalize_flow_unit(str(value))


class ProjectScenarioReportRequest(BaseModel):
    project_title: str = "Hydraulic Project"
    project_description: str | None = None
    scenarios: list[ProjectScenarioReportItem] = Field(min_length=1)


class PumpProjectScenarioReportItem(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None
    engineering_task: Literal["pump_sizing"] = "pump_sizing"
    fluid_config: dict[str, Any]
    flow_value: float
    flow_unit: str
    source_pressure_bar_a: float = Field(gt=0)
    destination_pressure_bar_a: float = Field(gt=0)
    pump_efficiency: float = Field(gt=0, le=1)
    motor_margin: float = Field(ge=1)
    pump_after_element_index: int = Field(default=0, ge=0)
    elements: list[dict[str, Any]]
    result: dict[str, Any]
    system_curve: dict[str, Any] | None = None

    @field_validator("flow_unit", mode="before")
    @classmethod
    def normalize_pump_project_scenario_flow_unit(cls, value):
        return normalize_flow_unit(str(value))


class PumpProjectScenarioReportRequest(BaseModel):
    project_title: str = "Pump Sizing Project"
    project_description: str | None = None
    scenarios: list[PumpProjectScenarioReportItem] = Field(min_length=1)


@app.get("/")
def root():
    return {
        "message": "Process Engineering Workbench API",
        "version": "0.8.0",
        "automatic_fluid_properties_available": automatic_properties_available(),
        "fitting_database_available": fitting_database_available(),
        "ai_interpreter_available": ai_available(),
        "report_formats": ["pdf", "docx"],
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": "0.8.0",
        "automatic_fluid_properties_available": automatic_properties_available(),
        "fitting_database_available": fitting_database_available(),
        "ai_interpreter_available": ai_available(),
    }


@app.get("/fluids")
def list_fluids():
    if not automatic_properties_available():
        raise HTTPException(
            status_code=503,
            detail="No automatic fluid-property engine is available on the backend.",
        )

    catalogue = get_fluid_catalogue()
    fluids = [item["id"] for item in catalogue]

    return {
        "count": len(catalogue),
        "fluids": fluids,
        "catalogue": catalogue,
    }


@app.get("/fluids/search")
def fluid_search(q: str = "", limit: int = 30):
    if not automatic_properties_available():
        raise HTTPException(
            status_code=503,
            detail="No automatic fluid-property engine is available on the backend.",
        )

    safe_limit = max(1, min(int(limit), 100))
    matches = search_fluids(q, limit=safe_limit)

    return {
        "query": q,
        "count": len(matches),
        "fluids": matches,
    }


@app.post("/fluids/properties")
def fluid_properties(request: FluidPropertyRequest):
    if not automatic_properties_available():
        raise HTTPException(
            status_code=503,
            detail="No automatic fluid-property engine is available on the backend.",
        )

    try:
        result = get_fluid_properties(
            fluid=request.fluid,
            temperature_c=request.temperature_c,
            pressure_bar_a=request.pressure_bar_a,
        )
        result = {
            key: value
            for key, value in result.items()
            if not str(key).startswith("_")
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if result.get("phase_type") == "Two-phase":
        raise HTTPException(
            status_code=400,
            detail="Two-phase conditions are not supported by the current single-phase hydraulic solver.",
        )
    return result


@app.post("/assistant/interpret-hydraulics")
def interpret_hydraulics(request: HydraulicPromptRequest):
    try:
        if request.use_ai:
            if not ai_available():
                result = interpret_hydraulics_prompt(request.prompt)
                result["interpreter"] = "rules-fallback"
                result.setdefault("assumptions", []).append(
                    "AI interpreter was requested but OPENAI_API_KEY was not configured; rule-based fallback was used."
                )
                return result
            return interpret_hydraulics_with_ai(request.prompt)

        result = interpret_hydraulics_prompt(request.prompt)
        result["interpreter"] = "rules"
        return result
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Prompt interpretation failed: {exc}") from exc


@app.get("/assistant/status")
def assistant_status():
    return {
        "ai_available": ai_available(),
        "default_interpreter": "ai" if ai_available() else "rules-fallback",
    }


@app.get("/piping/catalog")
def piping_catalog():
    try:
        return get_piping_catalog()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load piping catalog: {exc}") from exc


@app.get("/fittings/info")
def fittings_info():
    try:
        return get_database_info()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to read fitting database information: {exc}") from exc


@app.get("/fittings")
def fittings_catalog():
    try:
        return get_fitting_catalog()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to load fitting catalog: {exc}") from exc


@app.post("/fittings/calculate-k")
def fitting_k(request: FittingKRequest):
    try:
        return calculate_fitting_k(
            selection_label=request.selection_label,
            nominal_size_mm=request.nominal_size_mm,
            quantity=request.quantity,
            override_k_each=request.override_k_each,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/calculate/velocity")
def velocity(request: VelocityInput):
    try:
        return {"velocity_m_s": calculate_velocity(request.flow_rate_m3_h, request.pipe_diameter_m)}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/calculate/pressure-drop")
def pressure_drop(request: PressureDropInput):
    try:
        velocity_m_s = calculate_velocity(request.flow_rate_m3_h, request.pipe_diameter_m)
        reynolds_number = calculate_reynolds_number(
            density_kg_m3=request.density_kg_m3,
            velocity_m_s=velocity_m_s,
            pipe_diameter_m=request.pipe_diameter_m,
            dynamic_viscosity_pa_s=request.dynamic_viscosity_pa_s,
        )
        flow_regime = classify_flow(reynolds_number)
        friction_factor, friction_method = engineering_friction_factor(
            reynolds_number=reynolds_number,
            relative_roughness=request.roughness_m / request.pipe_diameter_m,
        )
        pressure_drop_pa = calculate_pressure_drop(
            friction_factor=friction_factor,
            pipe_length_m=request.pipe_length_m,
            pipe_diameter_m=request.pipe_diameter_m,
            density_kg_m3=request.density_kg_m3,
            velocity_m_s=velocity_m_s,
        )
        return {
            "velocity_m_s": velocity_m_s,
            "reynolds_number": reynolds_number,
            "flow_regime": flow_regime,
            "friction_factor": friction_factor,
            "friction_method": friction_method,
            "pressure_drop_pa": pressure_drop_pa,
            "pressure_drop_bar": pressure_drop_pa / 100000.0,
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/hydraulics/solve-line")
def solve_hydraulic_line(request: LineSolveInput):
    try:
        intent = request.calculation_intent or "outlet_pressure"
        fluid_config = request.fluid_config.model_dump()
        phase = str(fluid_config.get("phase_type", "Liquid"))

        if fluid_config.get("use_manual_properties", False) and phase.lower() == "liquid":
            density = fluid_config.get("density_kg_m3")
            viscosity = fluid_config.get("dynamic_viscosity_pa_s")
            if density is None or float(density) <= 0:
                raise ValueError("Manual liquid calculations require a positive density, kg/m³.")
            if viscosity is None or float(viscosity) <= 0:
                raise ValueError("Manual liquid calculations require a positive dynamic viscosity, Pa·s.")

        if intent in {"outlet_pressure", "pressure_profile"} and request.inlet_pressure_bar_a is None:
            raise ValueError("Inlet absolute pressure is required for outlet-pressure or pressure-profile calculations.")

        if phase.lower() == "gas" and request.inlet_pressure_bar_a is None:
            raise ValueError("Inlet absolute pressure is required for gas/compressible-flow calculations.")

        absolute_pressure_available = request.inlet_pressure_bar_a is not None

        if request.inlet_pressure_bar_a is not None:
            solver_pressure = request.inlet_pressure_bar_a
        else:
            # Pressure-drop-only liquid calculation. The deterministic solver still needs
            # a positive numerical pressure coordinate internally. Manual/frozen properties
            # make ΔP independent of this coordinate, so use a safe computational datum and
            # remove absolute-pressure outputs before returning the result.
            if not fluid_config.get("use_manual_properties", False):
                raise ValueError(
                    "Pressure-drop-only liquid calculations without inlet pressure require frozen/manual properties. "
                    "Load CoolProp properties at a reference pressure first, or provide manual density and viscosity."
                )
            solver_pressure = 1000.0

        result = solve_line(
            fluid_config=fluid_config,
            flow_value=request.flow_value,
            flow_unit=request.flow_unit,
            inlet_pressure_bar_a=solver_pressure,
            elements=[element.model_dump(exclude_none=True) for element in request.elements],
        )

        result["calculation_intent"] = intent
        result["absolute_pressure_available"] = absolute_pressure_available
        result["property_reference_pressure_bar_a"] = request.property_reference_pressure_bar_a

        if not absolute_pressure_available:
            result["inlet_pressure_bar_a"] = None
            result["outlet_pressure_bar_a"] = None
            result["minimum_pressure_bar_a"] = None
            for row in result.get("elements", []):
                row["pressure_in_bar_a"] = None
                row["pressure_out_bar_a"] = None
            for point in result.get("profile", []):
                point["pressure_bar_a"] = None

        return result
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Hydraulic calculation failed: {exc}") from exc


@app.post("/hydraulics/system-curve")
def hydraulics_system_curve(request: SystemCurveInput):
    try:
        fluid_config = request.fluid_config.model_dump()

        if str(fluid_config.get("phase_type", "Liquid")).lower() != "liquid":
            raise ValueError(
                "System-curve generation is currently limited to liquid systems."
            )

        return build_system_curve(
            fluid_config=fluid_config,
            design_flow_value=request.design_flow_value,
            flow_unit=request.flow_unit,
            inlet_pressure_bar_a=request.inlet_pressure_bar_a,
            elements=[
                element.model_dump(exclude_none=True)
                for element in request.elements
            ],
            max_flow_factor=request.max_flow_factor,
            number_points=request.number_points,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"System-curve calculation failed: {exc}",
        ) from exc


@app.post("/hydraulics/pump-sizing")
def hydraulics_pump_sizing(request: PumpSizingInput):
    try:
        fluid_config = request.fluid_config.model_dump()

        if str(fluid_config.get("phase_type", "Liquid")).lower() != "liquid":
            raise ValueError(
                "Pump-duty sizing version 1 is currently limited to liquid systems."
            )

        return size_pump_duty(
            fluid_config=fluid_config,
            design_flow_value=request.design_flow_value,
            flow_unit=request.flow_unit,
            source_pressure_bar_a=request.source_pressure_bar_a,
            destination_pressure_bar_a=request.destination_pressure_bar_a,
            elements=[
                element.model_dump(exclude_none=True)
                for element in request.elements
            ],
            pump_efficiency=request.pump_efficiency,
            motor_margin=request.motor_margin,
            pump_after_element_index=request.pump_after_element_index,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Pump-sizing calculation failed: {exc}",
        ) from exc


@app.post("/reports/pump-sizing/pdf")
def pump_sizing_pdf_report(request: PumpEngineeringReportRequest):
    try:
        report_path = create_pump_pdf_report(request.model_dump())
        return FileResponse(path=str(report_path), media_type="application/pdf", filename="pump_sizing_engineering_report.pdf")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Pump PDF report generation failed: {exc}") from exc


@app.post("/reports/pump-sizing/docx")
def pump_sizing_docx_report(request: PumpEngineeringReportRequest):
    try:
        report_path = create_pump_docx_report(request.model_dump())
        return FileResponse(path=str(report_path), media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", filename="pump_sizing_engineering_report.docx")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Pump Word report generation failed: {exc}") from exc


@app.post("/reports/hydraulics/pdf")
def hydraulic_pdf_report(request: EngineeringReportRequest):
    try:
        report_path = create_pdf_report(request.model_dump())
        return FileResponse(
            path=str(report_path),
            media_type="application/pdf",
            filename="hydraulic_line_engineering_report.pdf",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF report generation failed: {exc}") from exc


@app.post("/reports/hydraulics/docx")
def hydraulic_docx_report(request: EngineeringReportRequest):
    try:
        report_path = create_docx_report(request.model_dump())
        return FileResponse(
            path=str(report_path),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename="hydraulic_line_engineering_report.docx",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Word report generation failed: {exc}") from exc




def _prepare_pump_project_report_payload(
    request: PumpProjectScenarioReportRequest,
) -> dict[str, Any]:
    payload = request.model_dump()

    for scenario in payload.get("scenarios", []):
        if scenario.get("system_curve"):
            continue

        fluid_config = scenario.get("fluid_config", {}) or {}
        curve_settings = fluid_config.get("system_curve", {}) or {}

        try:
            max_flow_factor = float(curve_settings.get("max_flow_factor", 1.5))
        except (TypeError, ValueError):
            max_flow_factor = 1.5

        try:
            number_points = int(curve_settings.get("number_points", 21))
        except (TypeError, ValueError):
            number_points = 21

        # Keep project-report generation bounded while retaining a smooth,
        # solver-generated engineering curve.
        number_points = max(5, min(number_points, 21))

        try:
            scenario["system_curve"] = build_system_curve(
                fluid_config=fluid_config,
                design_flow_value=float(scenario["flow_value"]),
                flow_unit=str(scenario["flow_unit"]),
                # Computational pressure datum only. System-curve reporting uses
                # hydraulic head, not this artificial absolute pressure.
                inlet_pressure_bar_a=1000.0,
                elements=scenario.get("elements", []) or [],
                max_flow_factor=max_flow_factor,
                number_points=number_points,
            )
        except Exception as curve_exc:
            # Do not fail the entire engineering report because one chart could
            # not be generated. Keep the deterministic pump/NPSHa results and
            # make the omission auditable in the scenario warnings.
            scenario["system_curve"] = None
            result = scenario.get("result", {}) or {}
            warnings = list(result.get("warnings", []) or [])
            warnings.append(
                {
                    "code": "SYSTEM_CURVE_REPORT",
                    "message": f"System curve could not be generated for this report: {curve_exc}",
                }
            )
            result["warnings"] = warnings
            scenario["result"] = result

    return payload


@app.post("/reports/pump-sizing/project/pdf")
def pump_sizing_project_pdf_report(request: PumpProjectScenarioReportRequest):
    try:
        payload = _prepare_pump_project_report_payload(request)
        report_path = create_pump_project_pdf_report(payload)
        return FileResponse(
            path=str(report_path),
            media_type="application/pdf",
            filename="pump_sizing_project_all_scenarios_report.pdf",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Pump project PDF report generation failed: {exc}",
        ) from exc


@app.post("/reports/pump-sizing/project/docx")
def pump_sizing_project_docx_report(request: PumpProjectScenarioReportRequest):
    try:
        payload = _prepare_pump_project_report_payload(request)
        report_path = create_pump_project_docx_report(payload)
        return FileResponse(
            path=str(report_path),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename="pump_sizing_project_all_scenarios_report.docx",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Pump project Word report generation failed: {exc}",
        ) from exc


@app.post("/reports/hydraulics/project/pdf")
def hydraulic_project_pdf_report(request: ProjectScenarioReportRequest):
    try:
        report_path = create_project_pdf_report(request.model_dump())
        return FileResponse(
            path=str(report_path),
            media_type="application/pdf",
            filename="hydraulic_project_all_scenarios_report.pdf",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Project PDF report generation failed: {exc}",
        ) from exc


@app.post("/reports/hydraulics/project/docx")
def hydraulic_project_docx_report(request: ProjectScenarioReportRequest):
    try:
        report_path = create_project_docx_report(request.model_dump())
        return FileResponse(
            path=str(report_path),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename="hydraulic_project_all_scenarios_report.docx",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Project Word report generation failed: {exc}",
        ) from exc

