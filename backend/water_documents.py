"""Validate saved engine output without reimplementing or recalculating its equations."""
from copy import deepcopy
from datetime import datetime
import hashlib
import json
import math
import re
from pathlib import Path

SCHEMA = "water-treatment-scenario/1"
ENGINE = "ww-engine/0.2.0"
TASK = "water_treatment"
REFERENCE = json.loads((Path(__file__).resolve().parents[1] / "engineering/water_reference.json").read_text(encoding="utf-8"))
STATUSES = {"pass", "warn", "fail", "info"}


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def _finite(value):
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("Water-treatment values must be finite.")
    if isinstance(value, dict):
        for child in value.values():
            _finite(child)
    elif isinstance(value, list):
        for child in value:
            _finite(child)


def _number(value, nullable=False):
    try:
        return nullable and value is None or type(value) in (int, float) and math.isfinite(value)
    except OverflowError:
        return False


def validate_calculated_inputs(draft):
    """Input contract only. No flow, peaking, load or capacity equations."""
    required = {
        "flows": ("population", "perCapita", "industrialFlow", "industrialPF", "industrialMinFactor", "infiltration", "pfManual", "maxDayFactor", "maxMonthFactor", "minFactorManual"),
        "water": ("population", "perCapita", "nonDomesticPct", "lossesPct", "maxDayFactor", "peakHourFactor", "processWaterPct", "operatingHours"),
    }
    group = "flows" if draft["kind"] == "effluent" else "water"
    for key in required[group]:
        if not draft[group].get(key, "").strip():
            raise ValueError("Calculated scenarios require complete numerical inputs.")
    for current_group in (("flows", "conc", "loads") if group == "flows" else ("water",)):
        for text in draft[current_group].values():
            if not text.strip():
                continue
            if not re.fullmatch(r"[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?", text.strip(), re.I) or not _number(float(text)) or float(text) < 0:
                raise ValueError("Calculated scenarios require finite non-negative numerical inputs.")
    if group == "water":
        water = {key: float(value) for key, value in draft["water"].items()}
        if water["population"] <= 0 or water["perCapita"] <= 0 or not 0 < water["operatingHours"] <= 24 or water["lossesPct"] > 90:
            raise ValueError("Calculated water demand inputs are outside their supported bounds.")


def validate_draft(draft):
    if not isinstance(draft, dict) or draft.get("kind") not in ("effluent", "drinking") or draft.get("mode") not in ("design", "proposal", "existing"):
        raise ValueError("Water-treatment scenarios require a supported Design Basis input document.")
    for key in ("flows", "conc", "loads", "water", "predicted", "standardIds"):
        if not isinstance(draft.get(key), dict) or not all(isinstance(v, str) for v in draft[key].values()):
            raise ValueError("Water-treatment draft inputs must be text-valued input groups.")
    if not isinstance(draft.get("origin"), dict) or any(v not in ("measured", "assumed") for v in draft["origin"].values()):
        raise ValueError("Input provenance must be measured or assumed.")
    if draft.get("pfMethod") not in ("harmon", "qasim45", "babbitt", "log47", "manual") or draft.get("minMethod") not in ("log48", "manual") or not isinstance(draft.get("data"), str):
        raise ValueError("Unsupported Design Basis methods.")
    custom = draft.get("projectCriteria")
    if custom is not None:
        if not isinstance(custom, dict) or not all(isinstance(custom.get(k), str) for k in ("name", "jurisdiction")) or not isinstance(custom.get("limits"), dict):
            raise ValueError("Custom project criteria require a name, jurisdiction and limits.")
        for key, item in custom["limits"].items():
            if key not in REFERENCE["labels"] or not isinstance(item, dict) or not all(isinstance(item.get(k), str) for k in ("min", "max")):
                raise ValueError("Unsupported custom criterion input.")


def selected_standard(draft):
    kind = draft["kind"]
    selected = draft["standardIds"].get(kind)
    if selected != "custom":
        if selected not in REFERENCE[kind]:
            raise ValueError("Select a supported reference standard.")
        return REFERENCE[kind][selected]
    custom = draft.get("projectCriteria") or {}
    limits = {}
    for key, item in custom.get("limits", {}).items():
        bounds = {k: float(v.strip()) for k, v in item.items() if k in ("min", "max") and v.strip()}
        if any(not _number(v) or v < 0 for v in bounds.values()) or bounds.get("min", 0) > bounds.get("max", math.inf):
            raise ValueError("Custom project limits must be finite and minimum must not exceed maximum.")
        if bounds:
            limits[key] = bounds
    if not limits:
        raise ValueError("Enter at least one custom project limit before calculating.")
    return {"name": custom.get("name", "").strip() or "Custom project limits", "version": "User-supplied project criteria", "checked": "Not independently verified", "status": "user supplied", "limits": limits,
            "note": f"Jurisdiction: {custom.get('jurisdiction') or 'Not specified'}. User-entered criteria, not regulatory approval."}


def _checks(checks):
    if not isinstance(checks, list):
        raise ValueError("Saved design checks are incomplete.")
    for row in checks:
        if not isinstance(row, dict) or row.get("status") not in STATUSES or not all(isinstance(row.get(k), str) for k in ("item", "unit", "source", "note")) or not isinstance(row.get("range"), list) or len(row["range"]) != 2 or not all(_number(v, True) for v in row["range"]):
            raise ValueError("Saved design check is incomplete.")
        if not (_number(row.get("value"), True) or isinstance(row.get("value"), str)):
            raise ValueError("Saved design check value is invalid.")


def validate_document(document, require_current=False):
    if not isinstance(document, dict):
        raise ValueError("Water-treatment scenarios require a versioned document.")
    _finite(document)
    if len(canonical(document)) > 512_000:
        raise ValueError("Water-treatment scenario exceeds the supported size.")
    draft = document.get("draft")
    validate_draft(draft)
    compatible = document.get("schema_version") == SCHEMA and document.get("engine_version") == ENGINE and document.get("tool") == "design_basis"
    result = document.get("result")
    if result is None:
        if require_current or document.get("result_status") != "draft" or document.get("stale") is not True or document.get("calculated_at") is not None or document.get("calculated_inputs") is not None or document.get("checks") != []:
            raise ValueError("Calculate and save this scenario before comparing or reporting.")
        if not compatible:
            raise ValueError("Save drafts using the supported water-treatment schema and engine versions.")
        return False
    if not compatible or document.get("stale") is not False or document.get("result_status") != "calculated" or document.get("calculated_inputs") != canonical(draft):
        raise ValueError("Saved result is stale or incompatible. Recalculate and save.")
    validate_calculated_inputs(draft)
    try:
        datetime.fromisoformat(document["calculated_at"].replace("Z", "+00:00"))
    except (KeyError, ValueError, TypeError, AttributeError):
        raise ValueError("Saved calculation timestamp is invalid.") from None
    if not isinstance(result, dict) or result.get("kind") != draft["kind"] or result.get("input") != draft or not isinstance(document.get("calculation_note"), str) or not document["calculation_note"].strip():
        raise ValueError("Saved result provenance is incomplete.")
    if draft["kind"] == "effluent":
        basis = result.get("basis")
        if not isinstance(basis, dict) or "water" in result or not isinstance(basis.get("flows"), dict):
            raise ValueError("Saved flow result is incomplete.")
        flows = basis["flows"]
        if not all(_number(flows.get(k)) for k in ("Qavg", "Qdom", "Qind", "Qinf", "Qpeak", "Qmin", "QmaxDay", "QmaxMonth", "pf", "mmin", "pfOverall")) or flows["Qavg"] <= 0:
            raise ValueError("Saved flow result requires finite calculated values.")
        for group in ("loads", "peakLoads"):
            if not isinstance(basis.get(group), dict) or not all(_number(v) for v in basis[group].values()):
                raise ValueError("Saved pollutant loads are incomplete.")
        expected_loads = {key for key, value in draft["conc"].items() if value.strip()}
        expected_peak_loads = {key for key, value in draft["loads"].items() if value.strip() and key in expected_loads}
        if set(basis["loads"]) != expected_loads or set(basis["peakLoads"]) != expected_peak_loads or "PE" not in basis or not _number(basis.get("PE"), True) or ("BOD" in expected_loads and basis["PE"] is None) or not _number(basis.get("mmin")):
            raise ValueError("Saved pollutant load provenance is incomplete.")
        if not isinstance(basis.get("pfTable"), list) or len(basis["pfTable"]) != 4 or any(not isinstance(r, dict) or not isinstance(r.get("label"), str) or not _number(r.get("pf"), True) for r in basis["pfTable"]):
            raise ValueError("Saved peaking method comparison is incomplete.")
        if {r.get("key") for r in basis["pfTable"]} != {"harmon", "qasim45", "babbitt", "log47"}:
            raise ValueError("Saved peaking methods are incomplete.")
        checks = basis.get("checks")
    else:
        water = result.get("water")
        if not isinstance(water, dict) or "basis" in result or not all(_number(water.get(k)) for k in ("domestic", "demand", "avgProduction", "maxDay", "peakHour", "plantCapacity")) or water["avgProduction"] <= 0:
            raise ValueError("Saved water-demand result is incomplete.")
        checks = water.get("checks")
    _checks(checks)
    if document.get("checks") != checks:
        raise ValueError("Saved checks do not match the calculation result.")
    stats = result.get("statistics")
    if not isinstance(stats, dict) or type(stats.get("n")) is not int or stats["n"] < 0 or stats["n"] and not all(_number(stats.get(k), k == "cov") for k in ("min", "max", "mean", "sd", "cov", "p50", "p90", "p95", "p99")):
        raise ValueError("Saved statistics are incomplete.")
    compliance = result.get("compliance")
    standard = selected_standard(draft)
    if not isinstance(compliance, dict) or compliance.get("standard") != standard or not isinstance(compliance.get("rows"), list):
        raise ValueError("Saved criteria do not match the selected reference or custom project limits.")
    if [r.get("param") for r in compliance["rows"] if isinstance(r, dict)] != list(standard["limits"]):
        raise ValueError("Saved reference comparison is incomplete.")
    for row in compliance["rows"]:
        if row.get("status") not in STATUSES or not _number(row.get("value"), True) or row.get("limit") != standard["limits"][row["param"]] or row.get("label") != REFERENCE["labels"].get(row["param"], row["param"]):
            raise ValueError("Saved comparison values or criteria are invalid.")
        text = draft["predicted"].get(row["param"], "").strip()
        if row["value"] != (float(text) if text else None):
            raise ValueError("Saved treated quality differs from the entered values.")
    return True


def integrity(document):
    content = {k: v for k, v in document.items() if k != "integrity"}
    return hashlib.sha256(canonical(content).encode("utf-8")).hexdigest()


def prepare_document(document):
    validate_document(document)
    saved = deepcopy(document)
    saved["integrity"] = integrity(saved)
    return saved


def require_saved_document(config):
    if config.get("engineering_task") != TASK:
        raise ValueError("Select a Design Basis water-treatment scenario.")
    document = config.get("water_treatment")
    validate_document(document, require_current=True)
    if document.get("integrity") != integrity(document):
        raise ValueError("Saved result integrity failed. Recalculate and save.")
    return document
