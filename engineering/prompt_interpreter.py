import re
from typing import Any

NUMBER = r"(-?\d+(?:\.\d+)?)"


def _first_float(patterns: list[str], text: str) -> float | None:
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return float(match.group(1))
    return None


def _material(text: str) -> str | None:
    lower = text.lower()
    if "stainless" in lower:
        return "Stainless Steel"
    if "commercial steel" in lower or "carbon steel" in lower or "steel pipe" in lower:
        return "Commercial Steel"
    if "copper" in lower:
        return "Copper"
    if "pvc" in lower:
        return "PVC"
    if "cast iron" in lower:
        return "Cast Iron"
    if "concrete" in lower:
        return "Concrete"
    return None


def _nps(text: str) -> str | None:
    patterns = [
        rf"NPS\s*{NUMBER}",
        rf"{NUMBER}\s*(?:inch|in\.?|\")\s*(?:pipe|line)?",
    ]
    value = _first_float(patterns, text)
    if value is None:
        return None
    return f"{value:g}"


def _schedule(text: str) -> str | None:
    match = re.search(r"(?:sch(?:edule)?\s*)(10|40|80)", text, flags=re.IGNORECASE)
    if not match:
        return None
    return f"Sch {match.group(1)}"


def _quantity_before(text: str, phrase: str) -> int | None:
    number_words = {
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    }
    pattern = rf"(?:\b(\d+)\b|\b({'|'.join(number_words)})\b)\s+(?:standard\s+)?{phrase}"
    match = re.search(pattern, text, flags=re.IGNORECASE)
    if not match:
        return None
    if match.group(1):
        return int(match.group(1))
    return number_words[match.group(2).lower()]


def interpret_hydraulics_prompt(prompt: str) -> dict[str, Any]:
    text = " ".join(prompt.strip().split())
    lower = text.lower()
    missing: list[str] = []
    assumptions: list[str] = []
    elements: list[dict[str, Any]] = []

    # Calculation intent
    if "pressure profile" in lower:
        calculation_intent = "pressure_profile"
    elif "outlet pressure" in lower or "discharge pressure" in lower:
        calculation_intent = "outlet_pressure"
    else:
        calculation_intent = "pressure_drop"

    # Explicit manual properties. Viscosity is normalized to Pa.s.
    density_kg_m3 = _first_float([
        rf"(?:density|rho)\s*(?:of|=|is)?\s*{NUMBER}\s*kg\s*/\s*m(?:3|³)",
        rf"{NUMBER}\s*kg\s*/\s*m(?:3|³)\s*(?:density)?",
    ], text)

    viscosity_pa_s = None
    cp_match = re.search(
        rf"(?:viscosity|dynamic viscosity|mu)\s*(?:of|=|is)?\s*{NUMBER}\s*cP\b",
        text,
        flags=re.IGNORECASE,
    )
    if cp_match:
        viscosity_pa_s = float(cp_match.group(1)) * 0.001
    else:
        viscosity_pa_s = _first_float([
            rf"(?:viscosity|dynamic viscosity|mu)\s*(?:of|=|is)?\s*{NUMBER}\s*Pa\s*[.·]?\s*s\b",
        ], text)

    manual_fluid = density_kg_m3 is not None or viscosity_pa_s is not None

    # Fluid identity. Known CoolProp names remain canonical; otherwise preserve
    # a custom name when it appears after "for" and before temperature/flow wording.
    known_fluids = [
        "Water", "Air", "Nitrogen", "Oxygen", "Hydrogen", "Methane",
        "CarbonDioxide", "Ammonia", "Propane", "Ethanol", "Benzene",
    ]
    aliases = {
        "Nitrogen": ["nitrogen", "n2"],
        "Oxygen": ["oxygen", "o2"],
        "Hydrogen": ["hydrogen", "h2"],
        "Methane": ["methane", "ch4"],
        "CarbonDioxide": ["carbon dioxide", "co2"],
        "Ammonia": ["ammonia", "nh3"],
    }
    fluid = None
    for candidate in known_fluids:
        candidate_aliases = aliases.get(candidate, [candidate.lower()])
        if any(re.search(rf"\b{re.escape(alias)}\b", lower) for alias in candidate_aliases):
            fluid = candidate
            break

    if fluid is None:
        custom_match = re.search(
            r"(?:pressure drop|delta\s*p|Δp).*?\bfor\s+(.+?)\s+(?:at\s+-?\d|with\s+density|flowing\s+at)",
            text,
            flags=re.IGNORECASE,
        )
        if custom_match:
            fluid = custom_match.group(1).strip(" ,.;")

    if fluid is None:
        missing.append("fluid name")

    temperature_c = _first_float([
        rf"{NUMBER}\s*°?\s*c\b",
        rf"(?:temperature|temp(?:erature)?)\s*(?:of|=|at)?\s*{NUMBER}\s*°?\s*c?",
    ], text)
    if temperature_c is None:
        missing.append("temperature")

    # Flow
    flow_patterns = [
        (rf"{NUMBER}\s*m(?:³|3)\s*/\s*h", "m³/h"),
        (rf"{NUMBER}\s*m(?:³|3)\s*/\s*s", "m³/s"),
        (rf"{NUMBER}\s*kg\s*/\s*h", "kg/h"),
        (rf"{NUMBER}\s*kg\s*/\s*s", "kg/s"),
        (rf"{NUMBER}\s*nm(?:³|3)\s*/\s*h", "Nm³/h"),
    ]
    flow_value = None
    flow_unit = None
    for pattern, unit in flow_patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            flow_value = float(match.group(1))
            flow_unit = unit
            break
    if flow_value is None:
        missing.append("flow rate and unit")

    inlet_pressure_bar_a = _first_float([
        rf"(?:inlet|source|upstream|tank|vessel)\s*(?:pressure)?\s*(?:is|=|at)?\s*{NUMBER}\s*bar\s*\(?a\)?",
        rf"{NUMBER}\s*bar\s*\(?a\)?\s*(?:inlet|source|upstream)",
        rf"{NUMBER}\s*bar\s*\(a\)",
    ], text)

    # Pipe basis: custom ID takes precedence over NPS/schedule.
    # Pipe diameter. Explicit ID/internal-diameter wording is preferred.
    # In ordinary hydraulics prompts, an unqualified "pipe diameter" is interpreted
    # as the hydraulic/internal diameter, but the assumption is surfaced for review.
    custom_id_mm = _first_float([
        rf"(?:ID|I\.D\.|internal diameter|inside diameter)\s*(?:of|=|is)?\s*{NUMBER}\s*mm",
        rf"{NUMBER}\s*mm\s*(?:ID|I\.D\.|internal diameter|inside diameter)",
        rf"(?:pipe|line)\s*(?:internal\s+|inside\s+)?diameter\s*(?:of|=|is)?\s*{NUMBER}\s*mm",
        rf"diameter\s*(?:of|=|is)?\s*{NUMBER}\s*mm",
        rf"{NUMBER}\s*mm\s+(?:diameter\s+)?(?:pipe|line)",
    ], text)

    explicit_id_wording = bool(re.search(
        r"\b(?:ID|I\.D\.|internal diameter|inside diameter)\b",
        text,
        flags=re.IGNORECASE,
    ))
    if custom_id_mm is not None and not explicit_id_wording:
        assumptions.append(
            f'Unqualified pipe diameter ({custom_id_mm:g} mm) was interpreted as internal diameter for the hydraulic calculation. Verify if this is actually OD.'
        )
    material = _material(text)
    nps = _nps(text)
    schedule = _schedule(text)
    pipe_mode = "custom" if custom_id_mm is not None else "standard"

    # Pipe lengths
    pipe_lengths: list[float] = []
    pipe_patterns = [
        rf"(?:through|via|over|use)\s+{NUMBER}\s*m\s+(?:of\s+)?(?:an?\s+)?(?:\d+(?:\.\d+)?\s*mm\s*ID\s*)?(?:.*?\s)?pipe",
        rf"{NUMBER}\s*m\s+(?:of\s+)?(?:(?:nps\s*\d+(?:\.\d+)?)\s*)?(?:(?:sch(?:edule)?\s*\d+)\s*)?(?:(?:commercial|carbon|stainless)\s+steel\s*)?pipe",
    ]
    for pattern in pipe_patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            value = float(match.group(1))
            if value not in pipe_lengths:
                pipe_lengths.append(value)

    if not pipe_lengths:
        generic_length = _first_float([
            rf"(?:pipe length|length)\s*(?:of|=|is)?\s*{NUMBER}\s*m",
            rf"{NUMBER}\s*m\s+(?:long\s+)?pipe",
        ], text)
        if generic_length is not None:
            pipe_lengths = [generic_length]

    if not pipe_lengths:
        missing.append("pipe length")

    if pipe_mode == "custom":
        if custom_id_mm is None:
            missing.append("pipe internal diameter")
        if material is None:
            missing.append("pipe material / roughness")
    else:
        if nps is None:
            missing.append("pipe nominal size (NPS)")
        if schedule is None:
            missing.append("pipe schedule")
        if material is None:
            missing.append("pipe material / roughness")

    for idx, length_m in enumerate(pipe_lengths, start=1):
        elements.append({
            "type": "Pipe",
            "description": f"Pipe {idx}",
            "pipe_mode": pipe_mode,
            "nps": nps if pipe_mode == "standard" else None,
            "schedule": schedule if pipe_mode == "standard" else None,
            "material": material,
            "custom_id_mm": custom_id_mm if pipe_mode == "custom" else None,
            "custom_roughness_mm": None,
            "length_m": length_m,
            "dz_m": 0.0,
        })

    # Fittings
    fitting_specs = [
        ("90° elbow", r"90(?:°|\s*degrees?|\s*deg\.?)?[-\s]*(?:elbows?|bends?)"),
        ("45° elbow", r"45(?:°|\s*degrees?|\s*deg\.?)?[-\s]*(?:elbows?|bends?)"),
        ("Gate valve", r"(?:fully\s+open\s+)?gate\s+valves?"),
        ("Globe valve", r"(?:fully\s+open\s+)?globe\s+valves?"),
        ("Ball valve", r"(?:fully\s+open\s+)?ball\s+valves?"),
        ("Check valve", r"check\s+valves?"),
    ]
    for description, phrase in fitting_specs:
        qty = _quantity_before(text, phrase)
        if qty is None and re.search(phrase, text, flags=re.IGNORECASE):
            qty = 1
        if qty:
            elements.append({
                "type": "Resistance / Fitting",
                "description": description,
                "fitting_mode": "database",
                "fitting_pipe_basis": "inherit",
                "fitting_search": description,
                "quantity": qty,
            })

    equipment_patterns = [
        ("Heat exchanger", rf"heat exchanger.*?{NUMBER}\s*bar"),
        ("Filter", rf"filter.*?{NUMBER}\s*bar"),
        ("Control valve", rf"control valve.*?{NUMBER}\s*bar"),
        ("Equipment", rf"equipment.*?(?:pressure drop|Δp|dp).*?{NUMBER}\s*bar"),
    ]
    for description, pattern in equipment_patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            elements.append({
                "type": "Known Equipment ΔP",
                "description": description,
                "known_dp_bar": float(match.group(1)),
            })
            break

    elevation = None
    elevation_assumption = None
    for pattern, sign in [
        (rf"{NUMBER}\s*m\s+(?:above|higher than|higher)", 1.0),
        (rf"{NUMBER}\s*m\s+(?:below|lower than|lower)", -1.0),
        (rf"(?:elevation|elevation increase|rise|static head|elevation difference)\s*(?:of|=|is)?\s*\+?{NUMBER}\s*m", 1.0),
        (rf"{NUMBER}\s*m\s+(?:elevation\s+)?(?:increase|rise|gain|static head)", 1.0),
        (rf"(?:discharges?|outlet|flows?)\s+(?:to|into|at)\s+(?:an?\s+)?(?:receiving\s+)?tank.*?{NUMBER}\s*m\s+(?:above|higher)", 1.0),
    ]:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            elevation = sign * abs(float(match.group(1)))
            break

    # Natural-language shorthand such as "discharges to a tank 50 m high" is
    # common, but can be ambiguous (tank height vs elevation difference).
    # Interpret it as outlet elevation and explicitly surface the assumption.
    if elevation is None:
        tank_high_match = re.search(
            rf"(?:discharges?|outlet|flows?)\s+(?:to|into)\s+(?:an?\s+)?(?:receiving\s+)?tank\s*(?:that is|at)?\s*{NUMBER}\s*m\s+high",
            text,
            flags=re.IGNORECASE,
        )
        if tank_high_match:
            elevation = abs(float(tank_high_match.group(1)))
            elevation_assumption = (
                f'"Tank {elevation:g} m high" was interpreted as the receiving/outlet elevation being {elevation:g} m above the line inlet. Verify that this is the intended static elevation difference.'
            )

    if elevation_assumption:
        assumptions.append(elevation_assumption)
    if elevation is not None and abs(elevation) > 0:
        elements.append({
            "type": "Elevation Change",
            "description": "Net elevation change",
            "dz_m": elevation,
        })

    if "several bends" in lower or "several elbows" in lower:
        missing.append("number and type of fittings")

    # Pressure requirement is intent/phase dependent. Rule fallback currently
    # treats manual density+viscosity custom fluids as liquids unless stated gas.
    phase_type = "Gas" if re.search(r"\b(gas|vapou?r)\b", lower) else "Liquid"
    if (calculation_intent in {"outlet_pressure", "pressure_profile"} or phase_type == "Gas") and inlet_pressure_bar_a is None:
        missing.append("inlet absolute pressure, bar(a)")

    if manual_fluid:
        if density_kg_m3 is None:
            missing.append("manual liquid density, kg/m³")
        if viscosity_pa_s is None:
            missing.append("manual liquid dynamic viscosity, Pa·s")
        mode = "manual"
    else:
        mode = "coolprop" if fluid else None

    assumptions.append("Rule-based fallback does not invent missing engineering inputs.")
    assumptions.append("Review element order and all interpreted values before applying the model.")
    if pipe_mode == "custom" and any(e["type"] == "Resistance / Fitting" for e in elements):
        assumptions.append(
            "For custom-ID piping, the current MVP may use internal diameter as the nominal-size basis for Crane fT lookup; verify DN/NPS before final design."
        )

    missing = list(dict.fromkeys(missing))

    return {
        "prompt": prompt,
        "status": "ready" if not missing else "needs_input",
        "calculation_intent": calculation_intent,
        "fluid": {
            "mode": mode,
            "fluid": fluid,
            "temperature_c": temperature_c,
            "phase_type": phase_type,
            "density_kg_m3": density_kg_m3,
            "dynamic_viscosity_pa_s": viscosity_pa_s,
            "vapor_pressure_bar_a": None,
            "molecular_weight_kg_kmol": None,
            "compressibility_factor": None,
            "gamma": None,
        },
        "flow": {"value": flow_value, "unit": flow_unit},
        "inlet_pressure_bar_a": inlet_pressure_bar_a,
        "property_reference_pressure_bar_a": None,
        "pipe_basis": {
            "pipe_mode": pipe_mode,
            "nps": nps,
            "schedule": schedule,
            "material": material,
            "custom_id_mm": custom_id_mm,
            "custom_roughness_mm": None,
        },
        "elements": elements,
        "missing": missing,
        "assumptions": assumptions,
    }
