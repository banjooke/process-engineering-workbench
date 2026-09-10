from __future__ import annotations

import os
from difflib import get_close_matches
from typing import Literal

from pydantic import BaseModel, Field

from engineering.fluids import get_available_fluids


CalculationIntent = Literal["pressure_drop", "outlet_pressure", "pressure_profile"]
FluidMode = Literal["coolprop", "manual"]
PhaseType = Literal["Liquid", "Gas"]


class AIFluid(BaseModel):
    mode: FluidMode | None = None
    fluid: str | None = None
    temperature_c: float | None = None
    phase_type: PhaseType | None = None
    density_kg_m3: float | None = None
    dynamic_viscosity_pa_s: float | None = None
    vapor_pressure_bar_a: float | None = None
    molecular_weight_kg_kmol: float | None = None
    compressibility_factor: float | None = None
    gamma: float | None = None


class AIFlow(BaseModel):
    value: float | None = None
    unit: str | None = None


class AIPipeBasis(BaseModel):
    pipe_mode: Literal["standard", "custom"] | None = None
    nps: str | None = None
    schedule: str | None = None
    material: str | None = None
    custom_id_mm: float | None = None
    custom_roughness_mm: float | None = None


class AIPromptElement(BaseModel):
    type: Literal["Pipe", "Resistance / Fitting", "Known Equipment ΔP", "Elevation Change"]
    description: str
    pipe_mode: Literal["standard", "custom"] | None = None
    nps: str | None = None
    schedule: str | None = None
    material: str | None = None
    custom_id_mm: float | None = None
    custom_roughness_mm: float | None = None
    length_m: float | None = None
    dz_m: float | None = None
    fitting_mode: Literal["database", "manual"] | None = None
    fitting_pipe_basis: Literal["inherit", "override"] | None = None
    fitting_search: str | None = None
    quantity: int | None = None
    known_dp_bar: float | None = None


class AIHydraulicsInterpretation(BaseModel):
    prompt: str
    status: Literal["ready", "needs_input"] = "needs_input"
    calculation_intent: CalculationIntent = "pressure_drop"
    fluid: AIFluid
    flow: AIFlow
    inlet_pressure_bar_a: float | None = None
    property_reference_pressure_bar_a: float | None = None
    pipe_basis: AIPipeBasis
    elements: list[AIPromptElement] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    interpreter: str = "ai"


SYSTEM_INSTRUCTIONS = """
You are the intent-extraction layer for a professional process-engineering hydraulics application.
Only extract engineering intent and inputs. The deterministic engineering engine performs calculations.
Never invent physical properties, pressure, dimensions, fitting counts, or other engineering inputs.

CALCULATION INTENT
- Pressure drop / delta-P / ΔP only => calculation_intent="pressure_drop".
- Outlet pressure => calculation_intent="outlet_pressure".
- Pressure profile => calculation_intent="pressure_profile".
- Inlet absolute pressure is NOT required for an ordinary incompressible liquid pressure-drop-only calculation.
- Inlet absolute pressure IS required for outlet pressure, pressure profile, and gas/compressible calculations.

FLUIDS
- Both CoolProp and manual fluid properties are supported.
- Preserve arbitrary names such as Product X and company formulations.
- If density and viscosity are explicitly supplied for a liquid, set mode="manual".
- Do not reject a custom fluid because it is absent from CoolProp.
- Convert explicitly supplied viscosity: 1 cP = 0.001 Pa.s.
- Manual liquid pressure-drop calculations require density and dynamic viscosity.
- Never invent missing properties.
- A known named fluid with no manual properties may use mode="coolprop".
- If custom-fluid density/viscosity are supplied and no contrary phase is stated, use phase_type="Liquid".

PIPING
- ID100mm / ID 100 mm / 100 mm ID / internal diameter 100 mm / inside diameter 100 mm => pipe_mode="custom", custom_id_mm=100.
- Natural engineering shorthand such as "pipe diameter 20 mm", "diameter of 20 mm", or "20 mm diameter pipe" may be interpreted as custom internal diameter for a hydraulic calculation. Add an assumption telling the engineer that the unqualified diameter was treated as ID and should be verified against OD.
- NPS/schedule => pipe_mode="standard".
- Standard pipe needs NPS, schedule and material.
- Custom pipe needs internal diameter and either material or absolute roughness. Do not invent the material or roughness; if absent, keep the parsed geometry and put the missing material/roughness in missing.
- Pipe length is required.
- Preserve element order.
- Treat 90 degree bend / 90-degree bend / 90° bend as equivalent to a 90° elbow for fitting intent; likewise for 45-degree bend/elbow.
- Standard fittings may use fitting_mode="database" and normally inherit upstream pipe basis.

ELEVATION
- Recognize explicit statements such as "50 m above", "50 m elevation increase", "50 m rise", "50 m static head", or "outlet tank 50 m above the inlet" as dz_m=+50.
- Natural shorthand such as "the pipe discharges to a tank 50 m high" may mean a +50 m outlet elevation, but it is ambiguous. Parse dz_m=+50 and add an assumption that the receiving/outlet elevation was interpreted as 50 m above the line inlet and must be verified.
- Use negative dz_m for downstream elevation decreases.

FLOW
- Normalize volumetric flow to m³/h, m³/s or Nm³/h.
- Normalize mass flow to kg/h or kg/s.

PRESSURE
- Only treat pressure as bar(a) when explicitly absolute.
- Do not silently convert gauge pressure.

The engineer reviews the structured model before the deterministic solver runs.
""".strip()


def ai_available() -> bool:
    return bool(os.getenv("OPENAI_API_KEY"))


def _canonicalize_fluid(name: str | None) -> tuple[str | None, str | None]:
    if not name:
        return None, None
    try:
        available = get_available_fluids()
    except Exception:
        return name, None

    exact = {item.lower(): item for item in available}
    key = name.strip().lower()
    if key in exact:
        return exact[key], None

    close = get_close_matches(key, list(exact.keys()), n=1, cutoff=0.86)
    if close:
        canonical = exact[close[0]]
        return canonical, f'Fluid name normalized from "{name}" to CoolProp fluid "{canonical}".'

    return name, f'Fluid "{name}" was not matched to the current CoolProp fluid list; manual properties will be used when supplied.'


def _is_obsolete_missing(message: str) -> bool:
    text = message.strip().lower()
    obsolete_fragments = (
        "coolprop-compatible fluid",
        "coolprop fluid name",
        "supported fluid name",
        "current fluid-property model requires",
        "schema supports a named fluid",
        "valid coolprop fluid name or manual fluid properties",
        "inlet absolute pressure is required",
        "inlet absolute pressure, bar(a)",
    )
    return any(fragment in text for fragment in obsolete_fragments)


def _missing_category(message: str) -> str | None:
    """Return a semantic category for common missing-input messages.

    The AI may phrase a missing input naturally while deterministic validation
    adds a shorter engineering requirement. Categorising them lets us keep one
    useful message instead of showing both.
    """
    text = " ".join(message.strip().lower().split())

    if "temperature" in text and ("fluid" in text or "water" in text or "properties" in text):
        return "fluid_temperature"

    if "pressure" in text and (
        "absolute" in text or "gauge" in text or "pressure basis" in text
    ) and ("inlet" in text or "6 bar" in text or "bar(a)" in text):
        return "inlet_pressure_basis"

    if "pipe" in text and ("material" in text or "roughness" in text):
        import re
        match = re.search(r"\bpipe\s+(\d+)\b", text)
        if match:
            return f"pipe_material_{match.group(1)}"
        return "pipe_material_generic"

    return None


def _dedupe_missing_messages(messages: list[str], pipe_count: int) -> list[str]:
    """De-duplicate semantically equivalent missing-input messages.

    Natural AI wording is preserved when possible. For a single-pipe model,
    generic and "pipe 1" material/roughness warnings are treated as the same
    requirement. For multiple pipes, numbered requirements remain distinct.
    """
    cleaned = [m.strip() for m in messages if m and m.strip()]

    # If deterministic validation identified specific pipes in a multi-pipe
    # model, the generic material/roughness message adds no useful information.
    if pipe_count > 1:
        has_specific_pipe_requirement = any(
            (_missing_category(m) or "").startswith("pipe_material_")
            and _missing_category(m) != "pipe_material_generic"
            for m in cleaned
        )
        if has_specific_pipe_requirement:
            cleaned = [
                m for m in cleaned
                if _missing_category(m) != "pipe_material_generic"
            ]

    result: list[str] = []
    seen_exact: set[str] = set()
    seen_categories: set[str] = set()

    for message in cleaned:
        exact_key = " ".join(message.lower().split())
        if exact_key in seen_exact:
            continue

        category = _missing_category(message)
        if pipe_count == 1 and category in {"pipe_material_generic", "pipe_material_1"}:
            category = "pipe_material_single"

        if category and category in seen_categories:
            continue

        result.append(message)
        seen_exact.add(exact_key)
        if category:
            seen_categories.add(category)

    return result


def _post_validate(model: AIHydraulicsInterpretation) -> AIHydraulicsInterpretation:
    missing = [m for m in model.missing if m and not _is_obsolete_missing(m)]
    assumptions = list(dict.fromkeys(a for a in model.assumptions if a))

    has_density = model.fluid.density_kg_m3 is not None
    has_viscosity = model.fluid.dynamic_viscosity_pa_s is not None
    has_manual_props = has_density or has_viscosity

    canonical, note = _canonicalize_fluid(model.fluid.fluid)

    if has_manual_props:
        model.fluid.mode = "manual"
        if model.fluid.phase_type is None:
            model.fluid.phase_type = "Liquid"
        if note and "not matched" in note:
            assumptions.append(note)
    else:
        model.fluid.fluid = canonical
        if canonical and not (note and "not matched" in note):
            model.fluid.mode = "coolprop"
        elif model.fluid.fluid:
            model.fluid.mode = "manual"
            if model.fluid.phase_type is None:
                model.fluid.phase_type = "Liquid"
            if note:
                assumptions.append(note)

    if not model.fluid.fluid:
        missing.append("fluid name")

    if model.fluid.mode == "coolprop":
        if model.fluid.temperature_c is None:
            missing.append("fluid temperature")
    else:
        if model.fluid.phase_type is None:
            model.fluid.phase_type = "Liquid"
        if model.fluid.phase_type == "Liquid":
            if model.fluid.density_kg_m3 is None:
                missing.append("manual liquid density, kg/m³")
            if model.fluid.dynamic_viscosity_pa_s is None:
                missing.append("manual liquid dynamic viscosity, Pa·s")
        else:
            if model.fluid.dynamic_viscosity_pa_s is None:
                missing.append("manual gas dynamic viscosity, Pa·s")
            if model.fluid.molecular_weight_kg_kmol is None:
                missing.append("manual gas molecular weight, kg/kmol")
            if model.fluid.compressibility_factor is None:
                missing.append("manual gas compressibility factor, Z")
            if model.fluid.gamma is None:
                missing.append("manual gas heat-capacity ratio, gamma")

    if model.flow.value is None or not model.flow.unit:
        missing.append("flow rate and unit")

    needs_absolute_pressure = (
        model.calculation_intent in {"outlet_pressure", "pressure_profile"}
        or model.fluid.phase_type == "Gas"
    )
    if needs_absolute_pressure and model.inlet_pressure_bar_a is None:
        missing.append("inlet absolute pressure, bar(a)")

    if not model.elements:
        missing.append("at least one hydraulic line element")

    for i, element in enumerate(model.elements, start=1):
        if element.type != "Pipe":
            continue
        basis_mode = element.pipe_mode or model.pipe_basis.pipe_mode
        if element.length_m is None:
            missing.append(f"pipe {i} length")
        if basis_mode == "custom":
            if (element.custom_id_mm or model.pipe_basis.custom_id_mm) is None:
                missing.append(f"pipe {i} internal diameter")
            has_roughness = (
                element.custom_roughness_mm is not None
                or model.pipe_basis.custom_roughness_mm is not None
            )
            has_material = bool(element.material or model.pipe_basis.material)
            if not has_roughness and not has_material:
                missing.append(f"pipe {i} material or absolute roughness")
        else:
            if not (element.nps or model.pipe_basis.nps):
                missing.append(f"pipe {i} NPS")
            if not (element.schedule or model.pipe_basis.schedule):
                missing.append(f"pipe {i} schedule")
            if not (element.material or model.pipe_basis.material):
                missing.append(f"pipe {i} material")

    has_custom_pipe = any(
        e.type == "Pipe" and (e.pipe_mode == "custom" or model.pipe_basis.pipe_mode == "custom")
        for e in model.elements
    )
    has_database_fitting = any(
        e.type == "Resistance / Fitting" and (e.fitting_mode or "database") == "database"
        for e in model.elements
    )
    if has_custom_pipe and has_database_fitting:
        assumptions.append(
            "For custom-ID piping, the current MVP may use internal diameter as the nominal-size basis "
            "for Crane fT lookup. Verify nominal DN/NPS before final design."
        )

    pipe_count = sum(1 for e in model.elements if e.type == "Pipe")
    model.missing = _dedupe_missing_messages(missing, pipe_count)
    model.assumptions = list(dict.fromkeys(assumptions))
    model.status = "ready" if not model.missing else "needs_input"
    model.interpreter = "ai"
    return model


def interpret_hydraulics_with_ai(prompt: str) -> dict:
    if not ai_available():
        raise RuntimeError(
            "OPENAI_API_KEY is not configured. Set the environment variable before using the AI interpreter."
        )

    from openai import OpenAI

    client = OpenAI()
    model_name = os.getenv("OPENAI_MODEL", "gpt-5.6-terra")

    response = client.responses.parse(
        model=model_name,
        instructions=SYSTEM_INSTRUCTIONS,
        input=prompt,
        text_format=AIHydraulicsInterpretation,
    )

    parsed: AIHydraulicsInterpretation | None = None
    for output in response.output:
        if getattr(output, "type", None) != "message":
            continue
        for content in getattr(output, "content", []):
            if getattr(content, "type", None) == "output_text" and getattr(content, "parsed", None):
                parsed = content.parsed
                break
        if parsed is not None:
            break

    if parsed is None:
        raise RuntimeError("The AI response could not be parsed into the hydraulics engineering schema.")

    parsed.prompt = prompt
    parsed = _post_validate(parsed)
    return parsed.model_dump()
