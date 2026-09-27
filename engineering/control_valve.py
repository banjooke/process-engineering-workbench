"""Isolated liquid prototype: equation-verification record section 1A only.

No IEC/ISA correction, valve selection, HTTP, database or hydraulic integration.
Invalid enabled cases fail the request rather than disappearing from aggregation.
"""
from __future__ import annotations

import math
from importlib.metadata import PackageNotFoundError, version
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from engineering import fluids
from engineering.hydraulics import calculate_reynolds_number, calculate_velocity, classify_flow


CV_TO_KV = 0.8649776554423018
REFERENCE_DENSITY_KG_M3 = 1000.0
PA_PER_PSI = 0.45359237 * 9.80665 / 0.0254**2
VENDOR_CONFIRMATION = (
    "Prototype preliminary sizing based on publicly available manufacturer methodology. "
    "Confirm final sizing and valve selection with the valve manufacturer."
)
STANDARD_LIMITATION = (
    "Not verified against the complete IEC/ISA standard. "
    "Not for final design, procurement or safety-critical decisions."
)
POSITIVE = Field(gt=0)
Positive = Annotated[float, POSITIVE]
Text = Annotated[str, Field(min_length=1, pattern=r"\S")]
CaseId = Literal["minimum", "normal", "maximum"]
FlowUnit = Literal["m³/s", "m3/s", "m³/h", "m3/h", "L/s", "L/min", "US gpm"]
PressureUnit = Literal["Pa", "kPa", "bar", "psi"]
TemperatureUnit = Literal["K", "°C", "C", "°F", "F"]


class Model(BaseModel):
    model_config = ConfigDict(
        extra="forbid", strict=True, frozen=True, allow_inf_nan=False,
        validate_default=True, revalidate_instances="always",
    )
    schema_version: Literal["control-valve-liquid/1"] = "control-valve-liquid/1"


class ManualSource(Model):
    """Explicit manual override evidence; values have units in their field names."""
    source: Text
    reason: Text
    actor: Text
    reference_edition: Text
    evaluation_pressure_pa_abs: Positive
    evaluation_temperature_k: Positive
    source_hash: Text | None = None


class FluidConfig(Model):
    """Existing fluid vocabulary without the legacy model's water defaults.

    Manual mode is a complete, explicit property snapshot, not silent fallback or
    partial blending with automatic data. SG requires its own reference density.
    """
    fluid: Text
    phase_type: Literal["Liquid"]
    composition: Literal["pure"]
    rheology: Literal["Newtonian"]
    use_manual_properties: bool
    density_kg_m3: Positive | None = None
    specific_gravity: Positive | None = None
    sg_reference_density_kg_m3: Positive | None = None
    dynamic_viscosity_pa_s: Positive | None = None
    vapor_pressure_bar_a: Positive | None = None
    critical_pressure_bar_a: Positive | None = None
    manual_source: ManualSource | None = None

    @model_validator(mode="after")
    def validate_mode(self):
        properties = (
            self.density_kg_m3, self.specific_gravity,
            self.sg_reference_density_kg_m3, self.dynamic_viscosity_pa_s,
            self.vapor_pressure_bar_a, self.critical_pressure_bar_a,
        )
        if self.use_manual_properties:
            if self.manual_source is None:
                raise ValueError("Manual properties require source, edition, reason and actor.")
            if (self.density_kg_m3 is None) == (self.specific_gravity is None):
                raise ValueError("Supply exactly one of density or explicitly based specific gravity.")
            if (self.specific_gravity is None) != (self.sg_reference_density_kg_m3 is None):
                raise ValueError("Specific gravity requires its reference density.")
        elif any(v is not None for v in properties) or self.manual_source is not None:
            raise ValueError("Automatic properties cannot silently mix with manual overrides.")
        elif self.fluid not in {item["id"] for item in fluids.CURATED_FLUIDS}:
            raise ValueError("Automatic prototype requires a curated pure-fluid ID; mixtures are unsupported.")
        return self


class OperatingCase(Model):
    case_id: CaseId
    enabled: bool = True
    flow_value: Positive
    flow_unit: FlowUnit
    upstream_pressure: float
    downstream_pressure: float
    pressure_unit: PressureUnit
    pressure_basis: Literal["absolute", "gauge"]
    atmospheric_pressure_pa: Positive | None = None
    temperature: float
    temperature_unit: TemperatureUnit
    fluid_config: FluidConfig
    upstream_pipe_id_m: Positive | None = None
    known_choked: Literal[False] = False

    @model_validator(mode="after")
    def validate_pressure_basis(self):
        if (self.pressure_basis == "gauge") != (self.atmospheric_pressure_pa is not None):
            raise ValueError("Gauge pressure requires explicit atmospheric Pa; absolute input must omit it.")
        return self


class SizingRequest(Model):
    normal: OperatingCase
    minimum: OperatingCase | None = None
    maximum: OperatingCase | None = None
    rating_margin: Annotated[float, Field(ge=0)] = 0.10
    display_basis: Literal["Cv", "Kv", "both"] = "both"

    @model_validator(mode="after")
    def validate_cases(self):
        for name in ("minimum", "normal", "maximum"):
            case = getattr(self, name)
            if case is not None and case.case_id != name:
                raise ValueError(f"{name} case must have matching case_id.")
        if not self.normal.enabled:
            raise ValueError("Normal case must be enabled.")
        return self


class NormalizedSI(Model):
    flow_m3_s: Annotated[float, Field(gt=1e-9)]
    upstream_pressure_pa_abs: Positive
    downstream_pressure_pa_abs: Positive
    differential_pressure_pa: Annotated[float, Field(gt=1)]
    temperature_k: Positive
    atmospheric_pressure_pa: Positive | None


class Provenance(Model):
    origin: Literal["automatic", "manual"]
    source: Text
    provider_fluid_id: Text
    provider_version: Text | None
    evaluation_pressure_pa_abs: Positive
    evaluation_temperature_k: Positive
    manual_source: ManualSource | None


class ResolvedLiquidProperties(Model):
    """Immutable provider-compatible replay snapshot; origin remains in provenance."""
    fluid: Text
    phase_type: Literal["Liquid"] = "Liquid"
    use_manual_properties: Literal[True] = True
    temperature_c: float
    pressure_bar_a: Positive
    density_kg_m3: Positive
    dynamic_viscosity_pa_s: Positive | None
    vapor_pressure_bar_a: Positive | None
    critical_pressure_bar_a: Positive | None
    provenance: Provenance


class Diagnostic(Model):
    code: Text
    level: Literal["warning", "info"] = "warning"
    message: Text
    case_id: CaseId
    source: str = "control_valve_equation_verification §1A"


class PipeScreening(Model):
    label: Literal["pipe Reynolds screening"] = "pipe Reynolds screening"
    reynolds_number: Positive | None = None
    classification: Literal["indeterminate", "Laminar", "Transitional", "Turbulent"] = "indeterminate"
    policy: str = (
        "Existing hydraulics.classify_flow project policy: Re <2300 laminar; "
        "2300 <=Re <4000 transitional; Re >=4000 turbulent. "
        "Not IEC/ISA criteria or proof of valve turbulence."
    )


class CaseResult(Model):
    case_id: CaseId
    normalized: NormalizedSI
    resolved_fluid_config: ResolvedLiquidProperties
    required_kv: Positive
    required_cv: Positive
    pipe_reynolds_screening: PipeScreening
    verification_status: Literal["prototype_correlated"] = "prototype_correlated"
    final_selection_allowed: Literal[False] = False
    assessment_status: Literal["incomplete"] = "incomplete"
    assumptions: tuple[str, ...]
    warnings: tuple[Diagnostic, ...]
    limitations: tuple[str, ...]
    equation_ids: tuple[str, ...] = ("E2k", "E2v", "E2c", "E1d", "U-Q")
    source_ids: tuple[str, ...] = ("T1", "T3", "T4", "U4", "P0")
    vendor_confirmation: str = VENDOR_CONFIRMATION
    standard_limitation: str = STANDARD_LIMITATION


class SizingResult(Model):
    cases: tuple[CaseResult, ...]
    governing_case: CaseId
    maximum_required_kv: Positive
    maximum_required_cv: Positive
    rating_margin: Annotated[float, Field(ge=0)]
    target_rated_kv: Positive
    target_rated_cv: Positive
    display_basis: Literal["Cv", "Kv", "both"]
    verification_status: Literal["prototype_correlated"] = "prototype_correlated"
    final_selection_allowed: Literal[False] = False
    assessment_status: Literal["incomplete"] = "incomplete"
    warnings: tuple[Diagnostic, ...]
    vendor_confirmation: str = VENDOR_CONFIRMATION
    standard_limitation: str = STANDARD_LIMITATION
    equation_ids: tuple[str, ...] = ("E12",)


def _positive(value: float, name: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or value <= 0:
        raise ValueError(f"{name} must be finite and greater than zero.")
    return value


def cv_to_kv(cv: float) -> float:
    return _positive(_positive(cv, "Cv") * CV_TO_KV, "Kv")


def kv_to_cv(kv: float) -> float:
    return _positive(_positive(kv, "Kv") / CV_TO_KV, "Cv")


def normalize_case(case: OperatingCase) -> NormalizedSI:
    flow_factors = {
        "m³/s": 1, "m3/s": 1, "m³/h": 1 / 3600, "m3/h": 1 / 3600,
        "L/s": 0.001, "L/min": 1 / 60000, "US gpm": 0.003785411784 / 60,
    }
    pressure_factors = {"Pa": 1, "kPa": 1000, "bar": 100000, "psi": PA_PER_PSI}
    offset = case.atmospheric_pressure_pa or 0.0
    p1 = case.upstream_pressure * pressure_factors[case.pressure_unit] + offset
    p2 = case.downstream_pressure * pressure_factors[case.pressure_unit] + offset
    t = case.temperature
    if case.temperature_unit in ("°C", "C"):
        t += 273.15
    elif case.temperature_unit in ("°F", "F"):
        t = (t - 32) * 5 / 9 + 273.15
    return NormalizedSI(
        flow_m3_s=case.flow_value * flow_factors[case.flow_unit],
        upstream_pressure_pa_abs=p1, downstream_pressure_pa_abs=p2,
        differential_pressure_pa=p1 - p2, temperature_k=t,
        atmospheric_pressure_pa=case.atmospheric_pressure_pa,
    )


def resolve_liquid(case: OperatingCase, si: NormalizedSI) -> ResolvedLiquidProperties:
    config = case.fluid_config
    if config.use_manual_properties:
        source = config.manual_source
        assert source is not None  # Validated by FluidConfig.
        if not (
            math.isclose(source.evaluation_pressure_pa_abs, si.upstream_pressure_pa_abs, rel_tol=1e-12)
            and math.isclose(source.evaluation_temperature_k, si.temperature_k, rel_tol=1e-12)
        ):
            raise ValueError("Manual property applicability must match real upstream pressure and temperature.")
        density = config.density_kg_m3
        if density is None:
            density = config.specific_gravity * config.sg_reference_density_kg_m3
        values = dict(
            density_kg_m3=density, dynamic_viscosity_pa_s=config.dynamic_viscosity_pa_s,
            vapor_pressure_bar_a=config.vapor_pressure_bar_a,
            critical_pressure_bar_a=config.critical_pressure_bar_a,
        )
        provenance = Provenance(
            origin="manual", source=source.source, provider_fluid_id=config.fluid,
            provider_version=None, manual_source=source,
            evaluation_pressure_pa_abs=si.upstream_pressure_pa_abs,
            evaluation_temperature_k=si.temperature_k,
        )
    else:
        raw = fluids.get_fluid_properties(
            fluid=config.fluid, temperature_c=si.temperature_k - 273.15,
            pressure_bar_a=si.upstream_pressure_pa_abs / 100000,
        )
        if raw.get("phase_type") != "Liquid" or raw.get("phase_label", "liquid") not in ("liquid", "l"):
            raise ValueError("Property provider did not confirm a single-phase liquid inlet.")
        provider = raw.get("_property_provider")
        try:
            provider_version = version(provider) if provider else None
        except PackageNotFoundError:
            provider_version = None
        provenance = Provenance(
            origin="automatic", source=provider, provider_fluid_id=raw.get("_provider_fluid_id"),
            provider_version=provider_version, manual_source=None,
            evaluation_pressure_pa_abs=si.upstream_pressure_pa_abs,
            evaluation_temperature_k=si.temperature_k,
        )
        values = {key: raw.get(key) for key in (
            "density_kg_m3", "dynamic_viscosity_pa_s", "vapor_pressure_bar_a", "critical_pressure_bar_a",
        )}
    resolved = ResolvedLiquidProperties(
        fluid=config.fluid, temperature_c=si.temperature_k - 273.15,
        pressure_bar_a=si.upstream_pressure_pa_abs / 100000, provenance=provenance, **values,
    )
    if resolved.vapor_pressure_bar_a is not None and si.upstream_pressure_pa_abs <= resolved.vapor_pressure_bar_a * 100000:
        raise ValueError("Upstream pressure must exceed supplied vapor pressure for supported liquid service.")
    return resolved


def calculate_case(case: OperatingCase) -> CaseResult:
    # Revalidate even instances supplied via unchecked model_copy/model_construct.
    case = OperatingCase.model_validate(case)
    if not case.enabled:
        raise ValueError("Disabled cases are omitted, not sized with zero coefficients.")
    si = normalize_case(case)
    props = resolve_liquid(case, si)
    kv = _positive(
        (si.flow_m3_s * 3600) * math.sqrt(
            (props.density_kg_m3 / REFERENCE_DENSITY_KG_M3) / (si.differential_pressure_pa / 100000)
        ), "required Kv",
    )
    screening = PipeScreening()
    if case.upstream_pipe_id_m is not None and props.dynamic_viscosity_pa_s is not None:
        velocity = calculate_velocity(si.flow_m3_s * 3600, case.upstream_pipe_id_m)
        re = calculate_reynolds_number(props.density_kg_m3, velocity, case.upstream_pipe_id_m, props.dynamic_viscosity_pa_s)
        screening = PipeScreening(reynolds_number=re, classification=classify_flow(re))
    messages = [
        ("PROTOTYPE", VENDOR_CONFIRMATION), ("NOT_STANDARD_VERIFIED", STANDARD_LIMITATION),
        ("BASE_ONLY", "Uncorrected turbulent liquid base estimate; non-choked applicability is not established."),
        ("CHOKING_INCOMPLETE", "Choking assessment incomplete — verified method and applicable manufacturer factors required."),
        ("CAVITATION_INDETERMINATE", "Cavitation assessment indeterminate — manufacturer data required."),
        ("REFERENCE_CONVENTION", "Density reference is conventionally 1000 kg/m³, not actual water density at nominal 60°F."),
        ("REGIME_UNCONFIRMED", "Pipe Reynolds screening cannot establish valve turbulence; no viscosity correction applied."),
    ]
    if screening.classification in ("Laminar", "Transitional"):
        messages.append((
            "LOW_RE_LIMITATION",
            "Possible low-Reynolds/viscous service: uncorrected preliminary value only. "
            "Final valve selection blocked; valve-specific Fd and verified low-Reynolds "
            "correction required. No viscosity correction applied.",
        ))
    if props.vapor_pressure_bar_a is None:
        messages.append(("VAPOR_PRESSURE_UNKNOWN", "Vapor pressure unavailable; flashing boundary unknown."))
    elif si.downstream_pressure_pa_abs <= props.vapor_pressure_bar_a * 100000:
        messages.append(("VAPOR_BOUNDARY", "Downstream pressure is at/below vapor pressure; possible flashing, no completed prediction."))
    if props.critical_pressure_bar_a is None:
        messages.append(("CRITICAL_PRESSURE_UNKNOWN", "Critical pressure unavailable; dependent assessments incomplete."))
    if props.provenance.origin == "manual":
        messages.append(("MANUAL_PROPERTIES", "Explicit manual property snapshot used; inspect its source and applicability."))
    warnings = tuple(Diagnostic(code=code, message=message, case_id=case.case_id) for code, message in messages)
    return CaseResult(
        case_id=case.case_id, normalized=si, resolved_fluid_config=props,
        required_kv=kv, required_cv=kv_to_cv(kv), pipe_reynolds_screening=screening,
        assumptions=("Pure Newtonian liquid; base turbulent non-choked equation only.",
                     "No attached fitting, Reynolds or choking correction.",
                     "Bar-based Kv and shared conventional reference density 1000 kg/m³; nominal 60°F."),
        warnings=warnings, limitations=tuple(message for _, message in messages),
    )


def size_control_valve(request: SizingRequest | dict) -> SizingResult:
    request = SizingRequest.model_validate(request)
    cases = []
    for case in (request.minimum, request.normal, request.maximum):
        if case is not None and case.enabled:
            try:
                cases.append(calculate_case(case))
            except (ValueError, ArithmeticError, RuntimeError) as exc:
                raise ValueError(f"{case.case_id}: {exc}") from exc
    governing = max(cases, key=lambda case: case.required_kv)
    return SizingResult(
        cases=tuple(cases), governing_case=governing.case_id,
        maximum_required_kv=governing.required_kv, maximum_required_cv=governing.required_cv,
        rating_margin=request.rating_margin,
        target_rated_kv=governing.required_kv * (1 + request.rating_margin),
        target_rated_cv=governing.required_cv * (1 + request.rating_margin),
        display_basis=request.display_basis,
        warnings=tuple(warning for case in cases for warning in case.warnings),
    )
