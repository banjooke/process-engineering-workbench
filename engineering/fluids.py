from __future__ import annotations

from typing import Any

try:
    import CoolProp.CoolProp as CP

    COOLPROP_AVAILABLE = True
except ImportError:
    CP = None
    COOLPROP_AVAILABLE = False

try:
    from thermo import Chemical

    THERMO_AVAILABLE = True
except ImportError:
    Chemical = None
    THERMO_AVAILABLE = False

try:
    from chemicals.identifiers import search_chemical

    CHEMICAL_SEARCH_AVAILABLE = True
except ImportError:
    search_chemical = None
    CHEMICAL_SEARCH_AVAILABLE = False


# ---------------------------------------------------------------------------
# Curated engineering-friendly catalogue
# ---------------------------------------------------------------------------
#
# The frontend never needs to know whether CoolProp or thermo supplies a
# substance. Provider identifiers are internal implementation details.
#
# This curated list gives common substances polished display names and aliases.
# The backend also augments it dynamically with the installed CoolProp database,
# and direct thermo/chemicals lookup can resolve many additional substances.
#
CURATED_FLUIDS: list[dict[str, Any]] = [
    {
        "id": "Water",
        "name": "Water",
        "formula": "H2O",
        "category": "Common Process Fluids",
        "aliases": ["water", "h2o"],
        "coolprop": "Water",
        "thermo": "water",
    },
    {
        "id": "Ethanol",
        "name": "Ethanol",
        "formula": "C2H6O",
        "category": "Common Process Fluids",
        "aliases": ["ethanol", "ethyl alcohol", "c2h6o"],
        "coolprop": "Ethanol",
        "thermo": "ethanol",
    },
    {
        "id": "Methanol",
        "name": "Methanol",
        "formula": "CH4O",
        "category": "Common Process Fluids",
        "aliases": ["methanol", "methyl alcohol", "ch4o"],
        "coolprop": "Methanol",
        "thermo": "methanol",
    },
    {
        "id": "Ammonia",
        "name": "Ammonia",
        "formula": "NH3",
        "category": "Common Process Fluids",
        "aliases": ["ammonia", "nh3"],
        "coolprop": "Ammonia",
        "thermo": "ammonia",
    },
    {
        "id": "CarbonDioxide",
        "name": "Carbon dioxide",
        "formula": "CO2",
        "category": "Industrial Gases",
        "aliases": ["carbon dioxide", "co2"],
        "coolprop": "CarbonDioxide",
        "thermo": "carbon dioxide",
    },
    {
        "id": "Hydrogen",
        "name": "Hydrogen",
        "formula": "H2",
        "category": "Industrial Gases",
        "aliases": ["hydrogen", "h2"],
        "coolprop": "Hydrogen",
        "thermo": "hydrogen",
    },
    {
        "id": "Nitrogen",
        "name": "Nitrogen",
        "formula": "N2",
        "category": "Industrial Gases",
        "aliases": ["nitrogen", "n2"],
        "coolprop": "Nitrogen",
        "thermo": "nitrogen",
    },
    {
        "id": "Oxygen",
        "name": "Oxygen",
        "formula": "O2",
        "category": "Industrial Gases",
        "aliases": ["oxygen", "o2"],
        "coolprop": "Oxygen",
        "thermo": "oxygen",
    },
    {
        "id": "Argon",
        "name": "Argon",
        "formula": "Ar",
        "category": "Industrial Gases",
        "aliases": ["argon", "ar"],
        "coolprop": "Argon",
        "thermo": "argon",
    },
    {
        "id": "CarbonMonoxide",
        "name": "Carbon monoxide",
        "formula": "CO",
        "category": "Industrial Gases",
        "aliases": ["carbon monoxide", "co"],
        "coolprop": "CarbonMonoxide",
        "thermo": "carbon monoxide",
    },
    {
        "id": "Methane",
        "name": "Methane",
        "formula": "CH4",
        "category": "Hydrocarbons",
        "aliases": ["methane", "ch4"],
        "coolprop": "Methane",
        "thermo": "methane",
    },
    {
        "id": "Ethane",
        "name": "Ethane",
        "formula": "C2H6",
        "category": "Hydrocarbons",
        "aliases": ["ethane", "c2h6"],
        "coolprop": "Ethane",
        "thermo": "ethane",
    },
    {
        "id": "Propane",
        "name": "Propane",
        "formula": "C3H8",
        "category": "Hydrocarbons",
        "aliases": ["propane", "c3h8"],
        "coolprop": "Propane",
        "thermo": "propane",
    },
    {
        "id": "n-Butane",
        "name": "n-Butane",
        "formula": "C4H10",
        "category": "Hydrocarbons",
        "aliases": ["n-butane", "butane", "c4h10"],
        "coolprop": "n-Butane",
        "thermo": "n-butane",
    },
    {
        "id": "IsoButane",
        "name": "Isobutane",
        "formula": "C4H10",
        "category": "Hydrocarbons",
        "aliases": ["isobutane", "i-butane", "2-methylpropane", "c4h10"],
        "coolprop": "IsoButane",
        "thermo": "isobutane",
    },
    {
        "id": "n-Pentane",
        "name": "n-Pentane",
        "formula": "C5H12",
        "category": "Hydrocarbons",
        "aliases": ["n-pentane", "pentane", "c5h12"],
        "coolprop": "n-Pentane",
        "thermo": "n-pentane",
    },
    {
        "id": "n-Hexane",
        "name": "n-Hexane",
        "formula": "C6H14",
        "category": "Hydrocarbons",
        "aliases": ["n-hexane", "hexane", "c6h14"],
        "coolprop": "n-Hexane",
        "thermo": "n-hexane",
    },
    {
        "id": "n-Heptane",
        "name": "n-Heptane",
        "formula": "C7H16",
        "category": "Hydrocarbons",
        "aliases": ["n-heptane", "heptane", "c7h16"],
        "coolprop": "n-Heptane",
        "thermo": "n-heptane",
    },
    {
        "id": "n-Octane",
        "name": "n-Octane",
        "formula": "C8H18",
        "category": "Hydrocarbons",
        "aliases": ["n-octane", "octane", "c8h18"],
        "coolprop": "n-Octane",
        "thermo": "n-octane",
    },
    {
        "id": "Acetone",
        "name": "Acetone",
        "formula": "C3H6O",
        "category": "Organic Solvents",
        "aliases": ["acetone", "propanone", "c3h6o"],
        "coolprop": None,
        "thermo": "acetone",
    },
    {
        "id": "Benzene",
        "name": "Benzene",
        "formula": "C6H6",
        "category": "Organic Solvents",
        "aliases": ["benzene", "c6h6"],
        "coolprop": "Benzene",
        "thermo": "benzene",
    },
    {
        "id": "Toluene",
        "name": "Toluene",
        "formula": "C7H8",
        "category": "Organic Solvents",
        "aliases": ["toluene", "methylbenzene", "c7h8"],
        "coolprop": "Toluene",
        "thermo": "toluene",
    },
    {
        "id": "Cyclohexane",
        "name": "Cyclohexane",
        "formula": "C6H12",
        "category": "Organic Solvents",
        "aliases": ["cyclohexane", "c6h12"],
        "coolprop": "CycloHexane",
        "thermo": "cyclohexane",
    },
    {
        "id": "R32",
        "name": "R32 — Difluoromethane",
        "formula": "CH2F2",
        "category": "Refrigerants",
        "aliases": ["r32", "difluoromethane", "ch2f2"],
        "coolprop": "R32",
        "thermo": "difluoromethane",
    },
    {
        "id": "R125",
        "name": "R125 — Pentafluoroethane",
        "formula": "C2HF5",
        "category": "Refrigerants",
        "aliases": ["r125", "pentafluoroethane", "c2hf5"],
        "coolprop": "R125",
        "thermo": "pentafluoroethane",
    },
    {
        "id": "R134a",
        "name": "R134a — 1,1,1,2-Tetrafluoroethane",
        "formula": "C2H2F4",
        "category": "Refrigerants",
        "aliases": ["r134a", "1,1,1,2-tetrafluoroethane", "tetrafluoroethane", "c2h2f4"],
        "coolprop": "R134a",
        "thermo": "1,1,1,2-tetrafluoroethane",
    },
    {
        "id": "R1234yf",
        "name": "R1234yf — 2,3,3,3-Tetrafluoropropene",
        "formula": "C3H2F4",
        "category": "Refrigerants",
        "aliases": ["r1234yf", "2,3,3,3-tetrafluoropropene", "c3h2f4"],
        "coolprop": "R1234yf",
        "thermo": "2,3,3,3-tetrafluoropropene",
    },
]


def coolprop_available() -> bool:
    return COOLPROP_AVAILABLE


def thermo_available() -> bool:
    return THERMO_AVAILABLE


def automatic_properties_available() -> bool:
    return COOLPROP_AVAILABLE or THERMO_AVAILABLE


def property_engines_available() -> dict[str, bool]:
    """
    Diagnostic metadata. This is intended for backend health/audit information,
    not as a user-facing fluid-selection choice.
    """
    return {
        "coolprop": COOLPROP_AVAILABLE,
        "thermo": THERMO_AVAILABLE,
    }


def _normalise_search_text(value: str) -> str:
    return (
        value.lower()
        .replace("₂", "2")
        .replace("₃", "3")
        .replace("₄", "4")
        .replace("₅", "5")
        .replace("₆", "6")
        .replace("₇", "7")
        .replace("₈", "8")
        .replace("₉", "9")
        .replace("₀", "0")
        .strip()
    )


def _public_item(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": item["id"],
        "name": item["name"],
        "formula": item.get("formula"),
        "category": item.get("category"),
        "aliases": item.get("aliases", []),
        "cas": item.get("cas"),
    }


def _try_chemical_identity(identifier: str) -> dict[str, Any] | None:
    if not CHEMICAL_SEARCH_AVAILABLE:
        return None

    try:
        metadata = search_chemical(identifier)
    except Exception:
        return None

    try:
        common_name = str(metadata.common_name).strip() if metadata.common_name else None
    except Exception:
        common_name = None

    try:
        formula = str(metadata.formula).strip() if metadata.formula else None
    except Exception:
        formula = None

    try:
        cas = str(metadata.CASs).strip() if metadata.CASs else None
    except Exception:
        cas = None

    aliases: list[str] = []
    try:
        synonyms = list(metadata.synonyms or [])
        aliases = [str(value) for value in synonyms[:12] if value]
    except Exception:
        pass

    return {
        "name": common_name,
        "formula": formula,
        "cas": cas,
        "aliases": aliases,
    }


def _coolprop_metadata(fluid: str) -> dict[str, Any]:
    result: dict[str, Any] = {}

    if not COOLPROP_AVAILABLE:
        return result

    for key, target in (
        ("formula", "formula"),
        ("CAS", "cas"),
        ("aliases", "aliases_raw"),
    ):
        try:
            value = CP.get_fluid_param_string(fluid, key)
            if value:
                result[target] = str(value)
        except Exception:
            pass

    aliases: list[str] = []
    aliases_raw = result.pop("aliases_raw", None)
    if aliases_raw:
        aliases = [
            value.strip()
            for value in str(aliases_raw).replace(";", ",").split(",")
            if value.strip()
        ]
    result["aliases"] = aliases

    return result


def _infer_category(fluid_id: str, display_name: str | None = None) -> str:
    fluid_upper = fluid_id.upper()

    if fluid_upper.startswith("R") and any(ch.isdigit() for ch in fluid_upper):
        return "Refrigerants"

    text = f"{fluid_id} {display_name or ''}".lower()

    if any(name in text for name in ("methane", "ethane", "propane", "butane", "pentane", "hexane", "heptane", "octane")):
        return "Hydrocarbons"

    return "Other Database Fluids"


def _build_catalogue() -> list[dict[str, Any]]:
    """
    Build a readable catalogue from:
      1. curated engineering substances;
      2. the full installed CoolProp fluid list.

    Unknown CoolProp identifiers are enriched using chemicals/thermo metadata
    where possible, so a refrigerant code can be displayed with a chemical name
    rather than as an unexplained code.
    """
    catalogue: list[dict[str, Any]] = [dict(item) for item in CURATED_FLUIDS]

    existing_ids = {
        _normalise_search_text(str(item["id"]))
        for item in catalogue
    }

    if COOLPROP_AVAILABLE:
        try:
            raw_fluids = [
                fluid.strip()
                for fluid in CP.get_global_param_string("fluids_list").split(",")
                if fluid.strip()
            ]
        except Exception:
            raw_fluids = []

        for fluid in raw_fluids:
            key = _normalise_search_text(fluid)
            if key in existing_ids:
                continue

            cp_meta = _coolprop_metadata(fluid)
            chemical_meta = _try_chemical_identity(fluid) or {}

            chemical_name = chemical_meta.get("name")
            formula = chemical_meta.get("formula") or cp_meta.get("formula")
            cas = chemical_meta.get("cas") or cp_meta.get("cas")

            aliases = list(dict.fromkeys([
                fluid,
                *(cp_meta.get("aliases") or []),
                *(chemical_meta.get("aliases") or []),
            ]))

            category = _infer_category(fluid, chemical_name)

            if chemical_name and _normalise_search_text(chemical_name) != key:
                name = f"{fluid} — {chemical_name}" if category == "Refrigerants" else chemical_name
            elif category == "Refrigerants":
                name = f"{fluid} — Refrigerant"
            else:
                name = fluid

            catalogue.append({
                "id": fluid,
                "name": name,
                "formula": formula,
                "category": category,
                "aliases": aliases,
                "cas": cas,
                "coolprop": fluid,
                "thermo": chemical_name or fluid,
            })
            existing_ids.add(key)

    return catalogue


def get_fluid_catalogue() -> list[dict[str, Any]]:
    """
    Return the readable browse catalogue shown to engineers.

    Important:
    - Raw provider/database identifiers are NOT exposed here.
    - The browse list contains only curated, recognisable substance names.
    - Additional chemicals remain available through search.
    """
    rows = [_public_item(dict(item)) for item in CURATED_FLUIDS]

    category_order = {
        "Common Process Fluids": 0,
        "Industrial Gases": 1,
        "Hydrocarbons": 2,
        "Organic Solvents": 3,
        "Refrigerants": 4,
        "Other Chemicals": 5,
    }

    return sorted(
        rows,
        key=lambda row: (
            category_order.get(str(row.get("category", "")), 99),
            str(row.get("name", "")).lower(),
        ),
    )


def _catalogue_index() -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}

    for item in CURATED_FLUIDS:
        terms = [
            item.get("id"),
            item.get("name"),
            item.get("formula"),
            item.get("cas"),
            *(item.get("aliases") or []),
        ]
        for term in terms:
            if term:
                index[_normalise_search_text(str(term))] = item

    return index


def search_fluids(query: str, limit: int = 30) -> list[dict[str, Any]]:
    """
    Search by common name, formula, refrigerant code, alias or CAS number.

    Only readable chemical identities are returned. Raw property-library
    identifiers are never exposed to the user.
    """
    q = _normalise_search_text(query)

    if not q:
        return get_fluid_catalogue()[:limit]

    matches: list[tuple[int, dict[str, Any]]] = []
    seen: set[str] = set()

    for item in CURATED_FLUIDS:
        terms = [
            str(item.get("id", "")),
            str(item.get("name", "")),
            str(item.get("formula", "")),
            str(item.get("cas", "")),
            *[str(a) for a in item.get("aliases", [])],
        ]
        normalised_terms = [
            _normalise_search_text(term)
            for term in terms
            if term
        ]

        if not any(q in term for term in normalised_terms):
            continue

        if any(q == term for term in normalised_terms):
            score = 0
        elif any(term.startswith(q) for term in normalised_terms):
            score = 1
        else:
            score = 2

        public = _public_item(item)
        identity = _normalise_search_text(str(public["id"]))
        if identity not in seen:
            seen.add(identity)
            matches.append((score, public))

    # Resolve additional substances by human-readable chemical identity.
    # This is search-only: it does not dump an underlying provider's raw list.
    chemical_meta = _try_chemical_identity(query)
    if chemical_meta and chemical_meta.get("name"):
        chemical_name = str(chemical_meta["name"]).strip()
        formula = chemical_meta.get("formula")
        cas = chemical_meta.get("cas")
        aliases = chemical_meta.get("aliases", [])

        # Preserve a refrigerant code in the display when that is what the
        # engineer searched, but always pair it with the chemical identity.
        if q.startswith("r") and any(ch.isdigit() for ch in q):
            display_name = f"{query.strip().upper()} — {chemical_name}"
            public_id = chemical_name
            category = "Refrigerants"
        else:
            display_name = chemical_name
            public_id = chemical_name
            category = "Other Chemicals"

        identity = _normalise_search_text(public_id)
        if identity not in seen:
            matches.append((
                0,
                {
                    "id": public_id,
                    "name": display_name,
                    "formula": formula,
                    "category": category,
                    "aliases": aliases,
                    "cas": cas,
                },
            ))

    matches.sort(
        key=lambda row: (
            row[0],
            str(row[1].get("category", "")).lower(),
            str(row[1].get("name", "")).lower(),
        )
    )

    return [row for _, row in matches[:limit]]


def get_available_fluids() -> list[str]:
    """
    Backward-compatible fluid-ID list.
    """
    return [item["id"] for item in get_fluid_catalogue()]


# ---------------------------------------------------------------------------
# CoolProp provider
# ---------------------------------------------------------------------------

def _safe_props(
    output: str,
    input_1: str,
    value_1: float,
    input_2: str,
    value_2: float,
    fluid: str,
) -> float | None:
    if not COOLPROP_AVAILABLE:
        return None

    try:
        value = CP.PropsSI(
            output,
            input_1,
            value_1,
            input_2,
            value_2,
            fluid,
        )
        return float(value)
    except Exception:
        return None


def _safe_phase(
    temperature_k: float,
    pressure_pa: float,
    fluid: str,
) -> str | None:
    if not COOLPROP_AVAILABLE:
        return None

    try:
        return str(
            CP.PhaseSI(
                "T",
                temperature_k,
                "P",
                pressure_pa,
                fluid,
            )
        )
    except Exception:
        return None


def classify_phase(phase_label: str | None) -> str | None:
    """
    Convert provider phase labels to the simplified Liquid/Gas classification
    used by the hydraulics solver.
    """
    if phase_label is None:
        return None

    phase_lower = phase_label.lower().strip()

    if "two" in phase_lower and "phase" in phase_lower:
        return "Two-phase"

    if phase_lower in {
        "g",
        "gas",
        "vapor",
        "vapour",
        "supercritical_gas",
    }:
        return "Gas"

    if phase_lower in {
        "l",
        "liquid",
        "supercritical_liquid",
    }:
        return "Liquid"

    if phase_lower in {"supercritical", "sc"}:
        return "Supercritical"

    if phase_lower in {"s", "solid"}:
        return "Solid"

    return phase_label


def _get_properties_coolprop(
    fluid: str,
    temperature_c: float,
    pressure_bar_a: float,
) -> dict[str, Any]:
    if not COOLPROP_AVAILABLE:
        raise RuntimeError("CoolProp is not installed.")

    temperature_k = temperature_c + 273.15
    pressure_pa = pressure_bar_a * 100000.0

    phase_label = _safe_phase(
        temperature_k,
        pressure_pa,
        fluid,
    )
    phase_type = classify_phase(phase_label)

    density = _safe_props("D", "T", temperature_k, "P", pressure_pa, fluid)
    viscosity = _safe_props("V", "T", temperature_k, "P", pressure_pa, fluid)
    speed_of_sound = _safe_props("A", "T", temperature_k, "P", pressure_pa, fluid)
    cp = _safe_props("Cpmass", "T", temperature_k, "P", pressure_pa, fluid)
    cv = _safe_props("Cvmass", "T", temperature_k, "P", pressure_pa, fluid)
    z = _safe_props("Z", "T", temperature_k, "P", pressure_pa, fluid)
    molar_mass_kg_mol = _safe_props("M", "T", temperature_k, "P", pressure_pa, fluid)
    critical_temperature_k = _safe_props("Tcrit", "T", temperature_k, "P", pressure_pa, fluid)
    critical_pressure_pa = _safe_props("Pcrit", "T", temperature_k, "P", pressure_pa, fluid)

    gamma = None
    if cp is not None and cv is not None and cv > 0:
        gamma = cp / cv

    molecular_weight_kg_kmol = None
    if molar_mass_kg_mol is not None:
        molecular_weight_kg_kmol = molar_mass_kg_mol * 1000.0

    vapor_pressure_bar_a = None
    if (
        critical_temperature_k is not None
        and temperature_k < critical_temperature_k
    ):
        saturation_pressure_pa = _safe_props(
            "P",
            "T",
            temperature_k,
            "Q",
            0.0,
            fluid,
        )
        if saturation_pressure_pa is not None:
            vapor_pressure_bar_a = saturation_pressure_pa / 100000.0

    return {
        "phase_label": phase_label,
        "phase_type": phase_type,
        "density_kg_m3": density,
        "dynamic_viscosity_pa_s": viscosity,
        "vapor_pressure_bar_a": vapor_pressure_bar_a,
        "speed_of_sound_m_s": speed_of_sound,
        "cp_j_kg_k": cp,
        "cv_j_kg_k": cv,
        "gamma": gamma,
        "compressibility_factor": z,
        "molecular_weight_kg_kmol": molecular_weight_kg_kmol,
        "critical_temperature_c": (
            critical_temperature_k - 273.15
            if critical_temperature_k is not None
            else None
        ),
        "critical_pressure_bar_a": (
            critical_pressure_pa / 100000.0
            if critical_pressure_pa is not None
            else None
        ),
    }


# ---------------------------------------------------------------------------
# thermo provider
# ---------------------------------------------------------------------------

def _safe_thermo_value(obj: Any, *names: str) -> float | None:
    for name in names:
        try:
            value = getattr(obj, name)
            if callable(value):
                value = value()
            if value is not None:
                return float(value)
        except Exception:
            continue
    return None


def _get_properties_thermo(
    fluid: str,
    temperature_c: float,
    pressure_bar_a: float,
) -> dict[str, Any]:
    if not THERMO_AVAILABLE:
        raise RuntimeError("thermo is not installed.")

    temperature_k = temperature_c + 273.15
    pressure_pa = pressure_bar_a * 100000.0

    chemical = Chemical(
        fluid,
        T=temperature_k,
        P=pressure_pa,
    )

    phase_label = getattr(chemical, "phase", None)
    phase_type = classify_phase(
        str(phase_label) if phase_label is not None else None
    )

    density = _safe_thermo_value(chemical, "rho", "rhol", "rhog")
    viscosity = _safe_thermo_value(chemical, "mu", "mul", "mug")
    vapor_pressure_pa = _safe_thermo_value(chemical, "Psat")
    cp = _safe_thermo_value(chemical, "Cp")
    cv = _safe_thermo_value(chemical, "Cv")
    z = _safe_thermo_value(chemical, "Z", "Zg", "Zl")
    molecular_weight_kg_kmol = _safe_thermo_value(chemical, "MW")
    critical_temperature_k = _safe_thermo_value(chemical, "Tc")
    critical_pressure_pa = _safe_thermo_value(chemical, "Pc")
    speed_of_sound = _safe_thermo_value(chemical, "speed_of_sound")

    gamma = None
    if cp is not None and cv is not None and cv > 0:
        gamma = cp / cv

    return {
        "phase_label": str(phase_label) if phase_label is not None else None,
        "phase_type": phase_type,
        "density_kg_m3": density,
        "dynamic_viscosity_pa_s": viscosity,
        "vapor_pressure_bar_a": (
            vapor_pressure_pa / 100000.0
            if vapor_pressure_pa is not None
            else None
        ),
        "speed_of_sound_m_s": speed_of_sound,
        "cp_j_kg_k": cp,
        "cv_j_kg_k": cv,
        "gamma": gamma,
        "compressibility_factor": z,
        # thermo's MW is numerically g/mol, equivalent to kg/kmol.
        "molecular_weight_kg_kmol": molecular_weight_kg_kmol,
        "critical_temperature_c": (
            critical_temperature_k - 273.15
            if critical_temperature_k is not None
            else None
        ),
        "critical_pressure_bar_a": (
            critical_pressure_pa / 100000.0
            if critical_pressure_pa is not None
            else None
        ),
    }


# ---------------------------------------------------------------------------
# Automatic provider selection
# ---------------------------------------------------------------------------

def _resolve_catalogue_item(fluid: str) -> dict[str, Any] | None:
    q = _normalise_search_text(fluid)
    return _catalogue_index().get(q)


def _properties_are_usable(properties: dict[str, Any]) -> bool:
    density = properties.get("density_kg_m3")
    viscosity = properties.get("dynamic_viscosity_pa_s")

    return (
        density is not None
        and density > 0
        and viscosity is not None
        and viscosity > 0
    )


def get_fluid_properties(
    fluid: str,
    temperature_c: float,
    pressure_bar_a: float,
) -> dict[str, Any]:
    """
    Calculate thermophysical properties with automatic provider selection.

    Users select only the substance. Internally the Workbench:
      1. uses CoolProp when it has a valid model for the selected substance;
      2. falls back to thermo when CoolProp is unavailable or does not support it.

    The returned schema is provider-independent. Provider metadata is retained
    only for traceability and does not need to be shown in the normal UI.
    """
    if pressure_bar_a <= 0:
        raise ValueError("Absolute pressure must be greater than zero.")

    if not automatic_properties_available():
        raise RuntimeError(
            "No automatic fluid-property engine is installed. "
            "Install CoolProp and/or thermo, or use manual properties."
        )

    catalogue_item = _resolve_catalogue_item(fluid)

    requested_name = (
        str(catalogue_item["id"])
        if catalogue_item is not None
        else fluid
    )

    attempts: list[tuple[str, str]] = []

    if catalogue_item is not None:
        cp_id = catalogue_item.get("coolprop")
        thermo_id = catalogue_item.get("thermo")

        if cp_id:
            attempts.append(("CoolProp", str(cp_id)))
        if thermo_id:
            attempts.append(("thermo", str(thermo_id)))
    else:
        attempts.append(("CoolProp", fluid))
        attempts.append(("thermo", fluid))

    errors: list[str] = []

    for provider, provider_fluid in attempts:
        try:
            if provider == "CoolProp":
                if not COOLPROP_AVAILABLE:
                    continue
                props = _get_properties_coolprop(
                    provider_fluid,
                    temperature_c,
                    pressure_bar_a,
                )
            else:
                if not THERMO_AVAILABLE:
                    continue
                props = _get_properties_thermo(
                    provider_fluid,
                    temperature_c,
                    pressure_bar_a,
                )

            if not _properties_are_usable(props):
                errors.append(
                    f"{provider} returned incomplete density/viscosity data."
                )
                continue

            return {
                "fluid": requested_name,
                "display_name": (
                    catalogue_item.get("name")
                    if catalogue_item is not None
                    else fluid
                ),
                "formula": (
                    catalogue_item.get("formula")
                    if catalogue_item is not None
                    else None
                ),
                "category": (
                    catalogue_item.get("category")
                    if catalogue_item is not None
                    else None
                ),
                "temperature_c": temperature_c,
                "pressure_bar_a": pressure_bar_a,
                **props,
                "_property_provider": provider,
                "_provider_fluid_id": provider_fluid,
            }

        except Exception as exc:
            errors.append(f"{provider}: {exc}")

    raise ValueError(
        f"Unable to calculate automatic properties for '{fluid}' "
        f"at {temperature_c:g} degC and {pressure_bar_a:g} bar(a). "
        "The substance or requested state is not supported by the automatic "
        "property database. Use Manual Properties for formulations, slurries, "
        "solutions or other non-database fluids."
    )
