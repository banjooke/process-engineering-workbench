import math
from typing import Any

from engineering.fluids import get_fluid_properties


# ============================================================
# CONSTANTS
# ============================================================

G = 9.80665
R_UNIVERSAL = 8.314462618  # J/mol/K


# ============================================================
# OPTIONAL COOLPROP SUPPORT
# ============================================================

try:
    from CoolProp.CoolProp import (
        PropsSI,
        get_global_param_string,
    )

    COOLPROP_AVAILABLE = True

except ImportError:
    COOLPROP_AVAILABLE = False


# ============================================================
# PIPE DATABASE
# ============================================================

PIPE_BASE = [
    ("1/2", 15, 21.3),
    ("3/4", 20, 26.7),
    ("1", 25, 33.4),
    ("1 1/4", 32, 42.2),
    ("1 1/2", 40, 48.3),
    ("2", 50, 60.3),
    ("2 1/2", 65, 73.0),
    ("3", 80, 88.9),
    ("3 1/2", 90, 101.6),
    ("4", 100, 114.3),
    ("5", 125, 141.3),
    ("6", 150, 168.3),
    ("8", 200, 219.1),
    ("10", 250, 273.0),
    ("12", 300, 323.9),
]


WALLS = {
    "Sch 10": {
        "1/2": 2.11,
        "3/4": 2.11,
        "1": 2.77,
        "1 1/4": 2.77,
        "1 1/2": 2.77,
        "2": 2.77,
        "2 1/2": 3.05,
        "3": 3.05,
        "3 1/2": 3.05,
        "4": 3.05,
        "5": 3.40,
        "6": 3.40,
        "8": 3.76,
        "10": 4.19,
        "12": 4.57,
    },

    "Sch 40": {
        "1/2": 2.77,
        "3/4": 2.87,
        "1": 3.38,
        "1 1/4": 3.56,
        "1 1/2": 3.68,
        "2": 3.91,
        "2 1/2": 5.16,
        "3": 5.49,
        "3 1/2": 5.74,
        "4": 6.02,
        "5": 6.55,
        "6": 7.11,
        "8": 8.18,
        "10": 9.27,
        "12": 10.31,
    },

    "Sch 80": {
        "1/2": 3.73,
        "3/4": 3.91,
        "1": 4.55,
        "1 1/4": 4.85,
        "1 1/2": 5.08,
        "2": 5.54,
        "2 1/2": 7.01,
        "3": 7.62,
        "3 1/2": 8.08,
        "4": 8.56,
        "5": 9.53,
        "6": 10.97,
        "8": 12.70,
        "10": 15.09,
        "12": 17.48,
    },
}


ROUGHNESS_DATABASE_MM = {
    "Commercial steel": 0.045,
    "Stainless steel": 0.015,
    "Copper": 0.0015,
    "PVC / smooth plastic": 0.0015,
    "Cast iron": 0.26,
    "Concrete": 0.30,
}


# ============================================================
# BASIC PIPE HELPERS
# ============================================================

def pipe_id_from_schedule(
    nps: str,
    schedule: str,
) -> float | None:

    pipe = next(
        (row for row in PIPE_BASE if row[0] == nps),
        None,
    )

    if pipe is None:
        return None

    od_mm = pipe[2]

    wall_mm = WALLS.get(
        schedule,
        {},
    ).get(nps)

    if wall_mm is None:
        return None

    return od_mm - 2.0 * wall_mm


def dn_from_nps(
    nps: str,
) -> float | None:

    pipe = next(
        (row for row in PIPE_BASE if row[0] == nps),
        None,
    )

    if pipe is None:
        return None

    return float(pipe[1])


# ============================================================
# SIMPLE CALCULATION FUNCTIONS
#
# These are retained because your existing FastAPI endpoints
# already use them.
# ============================================================

def calculate_velocity(
    flow_rate_m3_h: float,
    pipe_diameter_m: float,
) -> float:

    if pipe_diameter_m <= 0:
        raise ValueError(
            "Pipe diameter must be greater than zero."
        )

    flow_rate_m3_s = flow_rate_m3_h / 3600.0

    area = (
        math.pi
        * pipe_diameter_m ** 2
        / 4.0
    )

    return flow_rate_m3_s / area


def calculate_reynolds_number(
    density_kg_m3: float,
    velocity_m_s: float,
    pipe_diameter_m: float,
    dynamic_viscosity_pa_s: float,
) -> float:

    if dynamic_viscosity_pa_s <= 0:
        raise ValueError(
            "Dynamic viscosity must be greater than zero."
        )

    return (
        density_kg_m3
        * velocity_m_s
        * pipe_diameter_m
        / dynamic_viscosity_pa_s
    )


def classify_flow(
    reynolds_number: float,
) -> str:

    if reynolds_number < 2300:
        return "Laminar"

    if reynolds_number < 4000:
        return "Transitional"

    return "Turbulent"


# ============================================================
# FRICTION FACTOR
# ============================================================

def churchill_friction_factor(
    reynolds_number: float,
    relative_roughness: float,
) -> float:

    term = (
        (7.0 / reynolds_number) ** 0.9
        + 0.27 * relative_roughness
    )

    a_term = (
        2.457
        * math.log(1.0 / term)
    ) ** 16

    b_term = (
        37530.0 / reynolds_number
    ) ** 16

    return 8.0 * (
        (8.0 / reynolds_number) ** 12
        + 1.0 / (a_term + b_term) ** 1.5
    ) ** (1.0 / 12.0)


def colebrook_friction_factor(
    reynolds_number: float,
    relative_roughness: float,
) -> float:

    if reynolds_number < 2300:
        return 64.0 / reynolds_number

    initial = (
        (relative_roughness / 3.7) ** 1.11
        + 6.9 / reynolds_number
    )

    friction = (
        -1.8 * math.log10(initial)
    ) ** -2

    for _ in range(100):

        rhs = -2.0 * math.log10(
            relative_roughness / 3.7
            + 2.51
            / (
                reynolds_number
                * math.sqrt(friction)
            )
        )

        friction_new = 1.0 / rhs ** 2

        if abs(
            friction_new - friction
        ) < 1e-10:

            return friction_new

        friction = friction_new

    return friction


def friction_factor(
    reynolds_number: float,
    relative_roughness: float,
) -> tuple[float, str]:

    if reynolds_number <= 0:
        return 0.0, "Undefined"

    if reynolds_number < 2300:

        return (
            64.0 / reynolds_number,
            "Laminar: 64/Re",
        )

    if reynolds_number < 4000:

        return (
            churchill_friction_factor(
                reynolds_number,
                relative_roughness,
            ),
            "Transition: Churchill",
        )

    return (
        colebrook_friction_factor(
            reynolds_number,
            relative_roughness,
        ),
        "Turbulent: Colebrook-White",
    )


# Compatibility function used by your current API
def calculate_friction_factor(
    reynolds_number: float,
    roughness_m: float,
    pipe_diameter_m: float,
) -> float:

    relative_roughness = (
        roughness_m
        / pipe_diameter_m
    )

    friction, _ = friction_factor(
        reynolds_number,
        relative_roughness,
    )

    return friction


def calculate_pressure_drop(
    friction_factor: float,
    pipe_length_m: float,
    pipe_diameter_m: float,
    density_kg_m3: float,
    velocity_m_s: float,
) -> float:

    return (
        friction_factor
        * (
            pipe_length_m
            / pipe_diameter_m
        )
        * density_kg_m3
        * velocity_m_s ** 2
        / 2.0
    )


# ============================================================
# COOLPROP HELPERS
# ============================================================

def get_available_fluids() -> list[str]:

    if not COOLPROP_AVAILABLE:
        return [
            "Water",
            "Air",
        ]

    try:

        fluid_string = (
            get_global_param_string(
                "FluidsList"
            )
        )

        return sorted(
            fluid.strip()
            for fluid in fluid_string.split(",")
            if fluid.strip()
        )

    except Exception:

        return [
            "Water",
            "Air",
        ]


def coolprop_property(
    output: str,
    temperature_k: float,
    pressure_pa: float,
    fluid: str,
) -> float | None:

    if not COOLPROP_AVAILABLE:
        return None

    try:

        return PropsSI(
            output,
            "T",
            temperature_k,
            "P",
            max(
                pressure_pa,
                1000.0,
            ),
            fluid,
        )

    except Exception:

        return None


def vapor_pressure_pa(
    temperature_k: float,
    fluid: str,
) -> float | None:

    if not COOLPROP_AVAILABLE:
        return None

    try:

        return PropsSI(
            "P",
            "T",
            temperature_k,
            "Q",
            0,
            fluid,
        )

    except Exception:

        return None


# ============================================================
# FLUID STATE
# ============================================================

def get_fluid_state(
    fluid_config: dict[str, Any],
    pressure_pa: float,
) -> dict[str, Any] | None:
    """
    Return the solver-facing fluid state.

    Manual-property calculations retain the existing behaviour.

    For automatic properties, the hydraulics engine now calls the shared
    engineering.fluids interface. That interface selects the installed
    property provider internally (CoolProp first when appropriate, then
    thermo fallback) while returning one provider-independent schema.

    This keeps pressure drop, system curve and pump sizing independent of
    the property-library choice made behind the scenes.
    """

    phase = str(
        fluid_config.get(
            "phase_type",
            "Liquid",
        )
    )

    fluid = str(
        fluid_config.get(
            "fluid",
            "Water",
        )
    )

    temperature_c = float(
        fluid_config.get(
            "temperature_c",
            25.0,
        )
    )

    use_manual = bool(
        fluid_config.get(
            "use_manual_properties",
            True,
        )
    )

    # --------------------------------------------------------
    # MANUAL LIQUID
    # --------------------------------------------------------
    if phase == "Liquid" and use_manual:

        density = float(
            fluid_config.get(
                "density_kg_m3",
                997.0,
            )
        )

        viscosity = float(
            fluid_config.get(
                "dynamic_viscosity_pa_s",
                0.00089,
            )
        )

        vapor_pressure_bar_a = float(
            fluid_config.get(
                "vapor_pressure_bar_a",
                0.0317,
            )
        )

        return {
            "rho": density,
            "mu": viscosity,
            "vp": vapor_pressure_bar_a * 100000.0,
            "gamma": None,
            "a": None,
            "z": None,
            "mw_kg_kmol": None,
            "basis": "User-specified liquid properties",
            "property_provider": "Manual",
        }

    # --------------------------------------------------------
    # MANUAL GAS
    # --------------------------------------------------------
    if phase != "Liquid" and use_manual:

        temperature_k = temperature_c + 273.15

        molecular_weight_kg_kmol = float(
            fluid_config.get(
                "molecular_weight_kg_kmol",
                28.965,
            )
        )

        molecular_weight_kg_mol = (
            molecular_weight_kg_kmol / 1000.0
        )

        z_factor = max(
            float(
                fluid_config.get(
                    "compressibility_factor",
                    1.0,
                )
            ),
            1e-6,
        )

        viscosity = float(
            fluid_config.get(
                "dynamic_viscosity_pa_s",
                1.85e-5,
            )
        )

        gamma = float(
            fluid_config.get(
                "gamma",
                1.4,
            )
        )

        density = (
            pressure_pa
            * molecular_weight_kg_mol
            / (
                z_factor
                * R_UNIVERSAL
                * temperature_k
            )
        )

        specific_gas_constant = (
            R_UNIVERSAL
            / molecular_weight_kg_mol
        )

        speed_of_sound = math.sqrt(
            max(
                gamma
                * z_factor
                * specific_gas_constant
                * temperature_k,
                1e-12,
            )
        )

        return {
            "rho": density,
            "mu": viscosity,
            "vp": None,
            "gamma": gamma,
            "a": speed_of_sound,
            "z": z_factor,
            "mw_kg_kmol": molecular_weight_kg_kmol,
            "basis": (
                "User-specified gas model "
                "(MW, Z, viscosity, gamma)"
            ),
            "property_provider": "Manual",
        }

    # --------------------------------------------------------
    # AUTOMATIC DATABASE PROPERTIES
    # --------------------------------------------------------
    try:
        properties = get_fluid_properties(
            fluid=fluid,
            temperature_c=temperature_c,
            pressure_bar_a=max(
                float(pressure_pa) / 100000.0,
                0.01,
            ),
        )
    except Exception:
        return None

    density = properties.get("density_kg_m3")
    viscosity = properties.get(
        "dynamic_viscosity_pa_s"
    )

    if (
        density is None
        or viscosity is None
        or float(density) <= 0
        or float(viscosity) <= 0
    ):
        return None

    provider = str(
        properties.get(
            "_property_provider",
            "Automatic database",
        )
    )

    vapor_pressure_bar_a = properties.get(
        "vapor_pressure_bar_a"
    )

    speed_of_sound = properties.get(
        "speed_of_sound_m_s"
    )

    gamma = properties.get("gamma")
    z_factor = properties.get(
        "compressibility_factor"
    )
    molecular_weight = properties.get(
        "molecular_weight_kg_kmol"
    )

    return {
        "rho": float(density),
        "mu": float(viscosity),
        "vp": (
            float(vapor_pressure_bar_a)
            * 100000.0
            if vapor_pressure_bar_a is not None
            else None
        ),
        "gamma": (
            float(gamma)
            if gamma is not None
            else None
        ),
        "a": (
            float(speed_of_sound)
            if speed_of_sound is not None
            else None
        ),
        "z": (
            float(z_factor)
            if z_factor is not None
            else None
        ),
        "mw_kg_kmol": (
            float(molecular_weight)
            if molecular_weight is not None
            else None
        ),
        "basis": f"Automatic database ({provider})",
        "property_provider": provider,
    }


# ============================================================
# FLOW CONVERSION
# ============================================================

def calculate_mass_flow(
    flow_value: float,
    flow_unit: str,
    fluid_config: dict[str, Any],
    inlet_pressure_pa: float,
) -> float:

    inlet_state = get_fluid_state(
        fluid_config,
        inlet_pressure_pa,
    )

    if inlet_state is None:
        raise ValueError(
            "Fluid properties could not "
            "be evaluated."
        )

    density = inlet_state["rho"]

    if flow_unit == "kg/h":
        return flow_value / 3600.0

    if flow_unit == "kg/s":
        return flow_value

    if flow_unit == "m³/h":
        return (
            density
            * flow_value
            / 3600.0
        )

    if flow_unit == "m³/s":
        return (
            density
            * flow_value
        )

    if flow_unit == "Nm³/h":

        normal_temperature_k = 273.15
        normal_pressure_pa = 1.01325e5

        phase = fluid_config.get(
            "phase_type",
            "Gas",
        )

        if phase != "Gas":

            return (
                density
                * flow_value
                / 3600.0
            )

        if fluid_config.get(
            "use_manual_properties",
            True,
        ):

            molecular_weight = (
                float(
                    fluid_config.get(
                        "molecular_weight_kg_kmol",
                        28.965,
                    )
                )
                / 1000.0
            )

            z_factor = max(
                float(
                    fluid_config.get(
                        "compressibility_factor",
                        1.0,
                    )
                ),
                1e-6,
            )

            normal_density = (
                normal_pressure_pa
                * molecular_weight
                / (
                    z_factor
                    * R_UNIVERSAL
                    * normal_temperature_k
                )
            )

        else:

            normal_state = get_fluid_state(
                fluid_config=fluid_config,
                pressure_pa=normal_pressure_pa,
            )

            if normal_state is None:

                raise ValueError(
                    "Normal gas density "
                    "could not be evaluated."
                )

            normal_density = float(
                normal_state["rho"]
            )

        return (
            normal_density
            * flow_value
            / 3600.0
        )

    raise ValueError(
        f"Unsupported flow unit: {flow_unit}"
    )


# ============================================================
# ENGINEERING WARNINGS
# ============================================================

def build_engineering_warnings(
    result: dict[str, Any],
    fluid_config: dict[str, Any],
) -> list[dict[str, str]]:

    warnings = []

    phase = fluid_config.get(
        "phase_type",
        "Liquid",
    )

    if phase == "Liquid":

        minimum_pressure = result[
            "min_pressure_pa"
        ]

        state = get_fluid_state(
            fluid_config,
            minimum_pressure,
        )

        if (
            state is not None
            and state.get("vp") is not None
        ):

            vapor_pressure = state["vp"]

            margin = (
                minimum_pressure
                - vapor_pressure
            )

            if margin <= 0:

                warnings.append({
                    "level": "error",
                    "code": "FLASHING_RISK",
                    "message": (
                        "Minimum calculated pressure "
                        "is at or below the fluid "
                        "vapor pressure."
                    ),
                })

            elif margin < 20000.0:

                warnings.append({
                    "level": "warning",
                    "code": "LOW_VAPOR_MARGIN",
                    "message": (
                        "Minimum pressure is less "
                        "than 0.2 bar above vapor "
                        "pressure."
                    ),
                })

    else:

        max_mach = result.get(
            "max_mach",
            0.0,
        )

        if max_mach >= 1.0:

            warnings.append({
                "level": "error",
                "code": "CHOKING_RISK",
                "message": (
                    "Calculated Mach number "
                    "reaches or exceeds 1.0."
                ),
            })

        elif max_mach >= 0.7:

            warnings.append({
                "level": "error",
                "code": "VERY_HIGH_MACH",
                "message": (
                    "Very high gas Mach number. "
                    "Results require specialist "
                    "compressible-flow review."
                ),
            })

        elif max_mach >= 0.3:

            warnings.append({
                "level": "warning",
                "code": "COMPRESSIBILITY",
                "message": (
                    "Gas compressibility is "
                    "significant because Mach "
                    "number exceeds 0.3."
                ),
            })

    return warnings


# ============================================================
# COMPLETE LINE SOLVER
# ============================================================

def solve_line(
    fluid_config: dict[str, Any],
    flow_value: float,
    flow_unit: str,
    inlet_pressure_bar_a: float,
    elements: list[dict[str, Any]],
) -> dict[str, Any]:

    if not elements:
        raise ValueError(
            "No line elements have been added."
        )

    if inlet_pressure_bar_a <= 0:
        raise ValueError(
            "Inlet absolute pressure must "
            "be greater than zero."
        )

    inlet_pressure_pa = (
        inlet_pressure_bar_a
        * 100000.0
    )

    mass_flow_kg_s = calculate_mass_flow(
        flow_value=flow_value,
        flow_unit=flow_unit,
        fluid_config=fluid_config,
        inlet_pressure_pa=inlet_pressure_pa,
    )

    if mass_flow_kg_s <= 0:

        raise ValueError(
            "Mass flow must be greater "
            "than zero."
        )

    pressure_pa = inlet_pressure_pa

    distance_m = 0.0
    elevation_m = 0.0

    cumulative_resistance_dp = 0.0
    cumulative_static_dp = 0.0

    rows = []

    profile = [{
        "distance_m": 0.0,
        "pressure_bar_a": (
            pressure_pa / 100000.0
        ),
        "elevation_m": 0.0,
        "cumulative_resistance_drop_bar": 0.0,
        "element": "Inlet",
        "velocity_m_s": None,
        "mach": None,
    }]

    minimum_pressure_pa = pressure_pa
    maximum_mach = 0.0

    # ========================================================
    # ELEMENT LOOP
    # ========================================================

    for index, element in enumerate(
        elements,
        start=1,
    ):

        element_type = element["type"]

        description = element.get(
            "description",
            element_type,
        )

        pressure_in_pa = pressure_pa

        dp_friction_pa = 0.0
        dp_local_pa = 0.0
        dp_equipment_pa = 0.0
        dp_static_pa = 0.0

        velocity_m_s = None
        reynolds_number = None
        friction = None
        friction_method = None
        mach = None

        # ====================================================
        # PIPE
        # ====================================================

        if element_type == "Pipe":

            length_m = float(
                element["length_m"]
            )

            diameter_m = (
                float(
                    element["id_mm"]
                )
                / 1000.0
            )

            roughness_m = (
                float(
                    element.get(
                        "roughness_mm",
                        0.045,
                    )
                )
                / 1000.0
            )

            elevation_change_m = float(
                element.get(
                    "dz_m",
                    0.0,
                )
            )

            if length_m <= 0:

                raise ValueError(
                    f"Pipe element {index} "
                    "has invalid length."
                )

            if diameter_m <= 0:

                raise ValueError(
                    f"Pipe element {index} "
                    "has invalid diameter."
                )

            # Divide pipe into smaller steps.
            # This allows pressure-dependent gas properties
            # to be recalculated along the pipe.

            number_steps = max(
                5,
                min(
                    200,
                    int(
                        max(
                            length_m,
                            1.0,
                        )
                        * 4
                    ),
                ),
            )

            dx = (
                length_m
                / number_steps
            )

            dz_step = (
                elevation_change_m
                / number_steps
            )

            for _ in range(number_steps):

                state = get_fluid_state(
                    fluid_config,
                    pressure_pa,
                )

                if state is None:

                    raise ValueError(
                        "Fluid properties could "
                        f"not be evaluated at "
                        f"element {index}."
                    )

                density = state["rho"]
                viscosity = state["mu"]

                area_m2 = (
                    math.pi
                    * diameter_m ** 2
                    / 4.0
                )

                velocity_m_s = (
                    mass_flow_kg_s
                    / (
                        density
                        * area_m2
                    )
                )

                reynolds_number = (
                    density
                    * velocity_m_s
                    * diameter_m
                    / viscosity
                )

                (
                    friction,
                    friction_method,
                ) = friction_factor(
                    reynolds_number,
                    roughness_m
                    / diameter_m,
                )

                step_friction_dp = (
                    friction
                    * (
                        dx
                        / diameter_m
                    )
                    * density
                    * velocity_m_s ** 2
                    / 2.0
                )

                step_static_dp = (
                    density
                    * G
                    * dz_step
                )

                new_pressure_pa = (
                    pressure_pa
                    - step_friction_dp
                    - step_static_dp
                )

                if new_pressure_pa <= 1000.0:

                    raise ValueError(
                        "Calculated absolute "
                        "pressure approaches zero "
                        f"in element {index} "
                        f"({description})."
                    )

                dp_friction_pa += (
                    step_friction_dp
                )

                dp_static_pa += (
                    step_static_dp
                )

                cumulative_resistance_dp += (
                    step_friction_dp
                )

                cumulative_static_dp += (
                    step_static_dp
                )

                pressure_pa = (
                    new_pressure_pa
                )

                distance_m += dx
                elevation_m += dz_step

                state_after = (
                    get_fluid_state(
                        fluid_config,
                        pressure_pa,
                    )
                )

                if (
                    state_after
                    and state_after.get("a")
                ):

                    mach = (
                        velocity_m_s
                        / state_after["a"]
                    )

                    maximum_mach = max(
                        maximum_mach,
                        mach,
                    )

                profile.append({
                    "distance_m": distance_m,
                    "pressure_bar_a": (
                        pressure_pa
                        / 100000.0
                    ),
                    "elevation_m": elevation_m,
                    "cumulative_resistance_drop_bar": (
                        cumulative_resistance_dp
                        / 100000.0
                    ),
                    "element": (
                        f"{index}. "
                        f"{description}"
                    ),
                    "velocity_m_s": (
                        velocity_m_s
                    ),
                    "mach": mach,
                })

                minimum_pressure_pa = min(
                    minimum_pressure_pa,
                    pressure_pa,
                )

        # ====================================================
        # FITTING / LOCAL RESISTANCE
        # ====================================================

        elif (
            element_type
            == "Resistance / Fitting"
        ):

            state = get_fluid_state(
                fluid_config,
                pressure_pa,
            )

            if state is None:

                raise ValueError(
                    "Fluid properties could not "
                    f"be evaluated at element "
                    f"{index}."
                )

            density = state["rho"]
            viscosity = state["mu"]

            diameter_m = (
                float(
                    element["id_mm"]
                )
                / 1000.0
            )

            area_m2 = (
                math.pi
                * diameter_m ** 2
                / 4.0
            )

            velocity_m_s = (
                mass_flow_kg_s
                / (
                    density
                    * area_m2
                )
            )

            reynolds_number = (
                density
                * velocity_m_s
                * diameter_m
                / viscosity
            )

            roughness_m = (
                float(
                    element.get(
                        "roughness_mm",
                        0.045,
                    )
                )
                / 1000.0
            )

            (
                friction,
                friction_method,
            ) = friction_factor(
                reynolds_number,
                roughness_m
                / diameter_m,
            )

            k_total = float(
                element["k_total"]
            )

            dp_local_pa = (
                k_total
                * density
                * velocity_m_s ** 2
                / 2.0
            )

            pressure_pa -= dp_local_pa

            cumulative_resistance_dp += (
                dp_local_pa
            )

            state_after = get_fluid_state(
                fluid_config,
                pressure_pa,
            )

            if (
                state_after
                and state_after.get("a")
            ):

                mach = (
                    velocity_m_s
                    / state_after["a"]
                )

                maximum_mach = max(
                    maximum_mach,
                    mach,
                )

            profile.append({
                "distance_m": distance_m,
                "pressure_bar_a": (
                    pressure_pa
                    / 100000.0
                ),
                "elevation_m": elevation_m,
                "cumulative_resistance_drop_bar": (
                    cumulative_resistance_dp
                    / 100000.0
                ),
                "element": (
                    f"{index}. "
                    f"{description}"
                ),
                "velocity_m_s": velocity_m_s,
                "mach": mach,
            })

            minimum_pressure_pa = min(
                minimum_pressure_pa,
                pressure_pa,
            )

        # ====================================================
        # KNOWN EQUIPMENT PRESSURE DROP
        # ====================================================

        elif (
            element_type
            == "Known Equipment ΔP"
        ):

            dp_equipment_pa = (
                float(
                    element["known_dp_bar"]
                )
                * 100000.0
            )

            pressure_pa -= (
                dp_equipment_pa
            )

            cumulative_resistance_dp += (
                dp_equipment_pa
            )

            profile.append({
                "distance_m": distance_m,
                "pressure_bar_a": (
                    pressure_pa
                    / 100000.0
                ),
                "elevation_m": elevation_m,
                "cumulative_resistance_drop_bar": (
                    cumulative_resistance_dp
                    / 100000.0
                ),
                "element": (
                    f"{index}. "
                    f"{description}"
                ),
                "velocity_m_s": None,
                "mach": None,
            })

            minimum_pressure_pa = min(
                minimum_pressure_pa,
                pressure_pa,
            )

        # ====================================================
        # ELEVATION
        # ====================================================

        elif (
            element_type
            == "Elevation Change"
        ):

            elevation_change_m = float(
                element["dz_m"]
            )

            state = get_fluid_state(
                fluid_config,
                pressure_pa,
            )

            if state is None:

                raise ValueError(
                    "Fluid properties could not "
                    f"be evaluated at element "
                    f"{index}."
                )

            density = state["rho"]

            dp_static_pa = (
                density
                * G
                * elevation_change_m
            )

            pressure_pa -= dp_static_pa

            cumulative_static_dp += (
                dp_static_pa
            )

            elevation_m += (
                elevation_change_m
            )

            profile.append({
                "distance_m": distance_m,
                "pressure_bar_a": (
                    pressure_pa
                    / 100000.0
                ),
                "elevation_m": elevation_m,
                "cumulative_resistance_drop_bar": (
                    cumulative_resistance_dp
                    / 100000.0
                ),
                "element": (
                    f"{index}. "
                    f"{description}"
                ),
                "velocity_m_s": None,
                "mach": None,
            })

            minimum_pressure_pa = min(
                minimum_pressure_pa,
                pressure_pa,
            )

        else:

            raise ValueError(
                "Unsupported line element "
                f"type: {element_type}"
            )

        # ====================================================
        # PRESSURE SAFETY CHECK
        # ====================================================

        if pressure_pa <= 1000.0:

            raise ValueError(
                "Calculated absolute pressure "
                "approaches zero after "
                f"element {index} "
                f"({description})."
            )

        # ====================================================
        # ELEMENT RESULT
        # ====================================================

        rows.append({
            "index": index,
            "element_type": element_type,
            "description": description,

            "pressure_in_bar_a": (
                pressure_in_pa
                / 100000.0
            ),

            "pressure_out_bar_a": (
                pressure_pa
                / 100000.0
            ),

            "pipe_friction_dp_bar": (
                dp_friction_pa
                / 100000.0
            ),

            "local_resistance_dp_bar": (
                dp_local_pa
                / 100000.0
            ),

            "equipment_dp_bar": (
                dp_equipment_pa
                / 100000.0
            ),

            "elevation_dp_bar": (
                dp_static_pa
                / 100000.0
            ),

            "velocity_m_s": velocity_m_s,

            "reynolds_number": (
                reynolds_number
            ),

            "friction_factor": friction,

            "friction_method": (
                friction_method
            ),

            "mach": mach,
        })

    # ========================================================
    # RESULTS
    # ========================================================

    result = {
        "inlet_pressure_bar_a": (
            inlet_pressure_bar_a
        ),

        "outlet_pressure_bar_a": (
            pressure_pa
            / 100000.0
        ),

        "outlet_pressure_pa": (
            pressure_pa
        ),

        "total_dp_bar": (
            (
                inlet_pressure_pa
                - pressure_pa
            )
            / 100000.0
        ),

        "total_dp_pa": (
            inlet_pressure_pa
            - pressure_pa
        ),

        "resistance_dp_bar": (
            cumulative_resistance_dp
            / 100000.0
        ),

        "resistance_dp_pa": (
            cumulative_resistance_dp
        ),

        "static_dp_bar": (
            cumulative_static_dp
            / 100000.0
        ),

        "static_dp_pa": (
            cumulative_static_dp
        ),

        "minimum_pressure_bar_a": (
            minimum_pressure_pa
            / 100000.0
        ),

        "min_pressure_pa": (
            minimum_pressure_pa
        ),

        "maximum_mach": (
            maximum_mach
        ),

        "max_mach": (
            maximum_mach
        ),

        "mass_flow_kg_s": (
            mass_flow_kg_s
        ),

        "mdot": (
            mass_flow_kg_s
        ),

        "total_line_length_m": (
            distance_m
        ),

        "net_elevation_change_m": (
            elevation_m
        ),

        "elements": rows,

        "profile": profile,
    }

    result["warnings"] = (
        build_engineering_warnings(
            result=result,
            fluid_config=fluid_config,
        )
    )

    return result

# ============================================================
# SYSTEM CURVE
# ============================================================

def build_system_curve(
    fluid_config: dict[str, Any],
    design_flow_value: float,
    flow_unit: str,
    inlet_pressure_bar_a: float,
    elements: list[dict[str, Any]],
    max_flow_factor: float = 1.5,
    number_points: int = 21,
) -> dict[str, Any]:
    """
    Build a liquid-system curve by repeatedly calling the existing
    solve_line() calculation at different flow rates.

    Notes
    -----
    - Version 1 is intentionally limited to liquid systems.
    - Pipe, fitting, elevation and known-equipment losses are evaluated
      using the same line solver used for the normal hydraulic calculation.
    - "Known Equipment ΔP" is treated as the fixed pressure drop entered
      by the user at every flow point. A future equipment-curve model can
      replace this with flow-dependent scaling when equipment data exist.
    - The zero-flow point is evaluated as the limiting static/fixed-loss
      condition because solve_line() correctly rejects zero mass flow.
    """

    if not elements:
        raise ValueError(
            "No line elements have been added."
        )

    phase = str(
        fluid_config.get(
            "phase_type",
            "Liquid",
        )
    )

    if phase != "Liquid":
        raise ValueError(
            "System-curve generation is currently limited "
            "to liquid systems. Gas system curves require "
            "a separate compressible-flow treatment."
        )

    if design_flow_value <= 0:
        raise ValueError(
            "Design flow must be greater than zero."
        )

    if inlet_pressure_bar_a <= 0:
        raise ValueError(
            "Inlet absolute pressure must be greater than zero."
        )

    if max_flow_factor <= 0:
        raise ValueError(
            "Maximum flow factor must be greater than zero."
        )

    number_points = int(number_points)

    if number_points < 2:
        raise ValueError(
            "System curve requires at least two points."
        )

    if number_points > 101:
        raise ValueError(
            "System curve is limited to 101 points."
        )

    inlet_pressure_pa = (
        inlet_pressure_bar_a
        * 100000.0
    )

    inlet_state = get_fluid_state(
        fluid_config,
        inlet_pressure_pa,
    )

    if inlet_state is None:
        raise ValueError(
            "Fluid properties could not be evaluated "
            "at the system-curve reference condition."
        )

    reference_density = float(
        inlet_state["rho"]
    )

    if reference_density <= 0:
        raise ValueError(
            "Reference liquid density must be greater than zero."
        )

    max_flow_value = (
        design_flow_value
        * max_flow_factor
    )

    flow_values = [
        max_flow_value
        * i
        / (number_points - 1)
        for i in range(number_points)
    ]

    def zero_flow_limit() -> dict[str, float]:
        """
        Evaluate the Q -> 0 limit:
        friction and fitting dynamic losses vanish, while elevation
        and explicitly entered fixed equipment pressure drops remain.
        """
        pressure_pa = inlet_pressure_pa
        static_dp_pa = 0.0
        fixed_equipment_dp_pa = 0.0

        for index, element in enumerate(
            elements,
            start=1,
        ):
            element_type = element["type"]

            if element_type == "Pipe":
                dz_m = float(
                    element.get(
                        "dz_m",
                        0.0,
                    )
                )

                if dz_m != 0.0:
                    state = get_fluid_state(
                        fluid_config,
                        pressure_pa,
                    )

                    if state is None:
                        raise ValueError(
                            "Fluid properties could not be "
                            "evaluated while determining the "
                            f"zero-flow limit at element {index}."
                        )

                    dp_static = (
                        float(state["rho"])
                        * G
                        * dz_m
                    )

                    pressure_pa -= dp_static
                    static_dp_pa += dp_static

            elif (
                element_type
                == "Elevation Change"
            ):
                dz_m = float(
                    element["dz_m"]
                )

                state = get_fluid_state(
                    fluid_config,
                    pressure_pa,
                )

                if state is None:
                    raise ValueError(
                        "Fluid properties could not be "
                        "evaluated while determining the "
                        f"zero-flow limit at element {index}."
                    )

                dp_static = (
                    float(state["rho"])
                    * G
                    * dz_m
                )

                pressure_pa -= dp_static
                static_dp_pa += dp_static

            elif (
                element_type
                == "Known Equipment ΔP"
            ):
                dp_equipment = (
                    float(
                        element["known_dp_bar"]
                    )
                    * 100000.0
                )

                pressure_pa -= dp_equipment
                fixed_equipment_dp_pa += (
                    dp_equipment
                )

            elif (
                element_type
                == "Resistance / Fitting"
            ):
                # Dynamic K-loss tends to zero as Q -> 0.
                pass

            else:
                raise ValueError(
                    "Unsupported line element type: "
                    f"{element_type}"
                )

            if pressure_pa <= 1000.0:
                raise ValueError(
                    "The zero-flow static/fixed-loss condition "
                    "drives calculated absolute pressure too low."
                )

        total_dp_pa = (
            static_dp_pa
            + fixed_equipment_dp_pa
        )

        return {
            "total_dp_pa": total_dp_pa,
            "static_dp_pa": static_dp_pa,
            "resistance_dp_pa": (
                fixed_equipment_dp_pa
            ),
            "outlet_pressure_bar_a": (
                pressure_pa / 100000.0
            ),
        }

    zero_point = zero_flow_limit()

    points: list[dict[str, Any]] = []

    for flow_value in flow_values:
        if flow_value == 0.0:
            total_dp_pa = zero_point[
                "total_dp_pa"
            ]
            static_dp_pa = zero_point[
                "static_dp_pa"
            ]
            resistance_dp_pa = zero_point[
                "resistance_dp_pa"
            ]
            outlet_pressure_bar_a = zero_point[
                "outlet_pressure_bar_a"
            ]
            warnings: list[dict[str, str]] = []

        else:
            solved = solve_line(
                fluid_config=fluid_config,
                flow_value=flow_value,
                flow_unit=flow_unit,
                inlet_pressure_bar_a=(
                    inlet_pressure_bar_a
                ),
                elements=elements,
            )

            total_dp_pa = float(
                solved["total_dp_pa"]
            )
            static_dp_pa = float(
                solved["static_dp_pa"]
            )
            resistance_dp_pa = float(
                solved["resistance_dp_pa"]
            )
            outlet_pressure_bar_a = float(
                solved["outlet_pressure_bar_a"]
            )
            warnings = list(
                solved.get(
                    "warnings",
                    [],
                )
            )

        total_head_m = (
            total_dp_pa
            / (
                reference_density
                * G
            )
        )

        static_head_m = (
            static_dp_pa
            / (
                reference_density
                * G
            )
        )

        resistance_head_m = (
            resistance_dp_pa
            / (
                reference_density
                * G
            )
        )

        points.append({
            "flow_value": flow_value,
            "flow_unit": flow_unit,
            "total_dp_bar": (
                total_dp_pa
                / 100000.0
            ),
            "total_dp_pa": total_dp_pa,
            "total_head_m": total_head_m,
            "static_dp_bar": (
                static_dp_pa
                / 100000.0
            ),
            "static_head_m": static_head_m,
            "resistance_dp_bar": (
                resistance_dp_pa
                / 100000.0
            ),
            "resistance_head_m": (
                resistance_head_m
            ),
            "outlet_pressure_bar_a": (
                outlet_pressure_bar_a
            ),
            "warning_count": len(
                warnings
            ),
            "warnings": warnings,
        })

    design_result = solve_line(
        fluid_config=fluid_config,
        flow_value=design_flow_value,
        flow_unit=flow_unit,
        inlet_pressure_bar_a=(
            inlet_pressure_bar_a
        ),
        elements=elements,
    )

    design_total_dp_pa = float(
        design_result["total_dp_pa"]
    )

    design_point = {
        "flow_value": design_flow_value,
        "flow_unit": flow_unit,
        "total_dp_bar": (
            design_total_dp_pa
            / 100000.0
        ),
        "total_head_m": (
            design_total_dp_pa
            / (
                reference_density
                * G
            )
        ),
        "outlet_pressure_bar_a": float(
            design_result[
                "outlet_pressure_bar_a"
            ]
        ),
    }

    return {
        "phase_type": phase,
        "flow_unit": flow_unit,
        "design_flow_value": (
            design_flow_value
        ),
        "max_flow_value": max_flow_value,
        "max_flow_factor": max_flow_factor,
        "number_points": number_points,
        "reference_density_kg_m3": (
            reference_density
        ),
        "inlet_pressure_bar_a": (
            inlet_pressure_bar_a
        ),
        "design_point": design_point,
        "points": points,
        "assumptions": [
            (
                "System curve uses the existing "
                "solve_line() hydraulic model."
            ),
            (
                "Version 1 is limited to liquid systems."
            ),
            (
                "Known Equipment ΔP is held constant "
                "across the generated flow range."
            ),
            (
                "System head is calculated using the "
                "inlet/reference liquid density."
            ),
        ],
    }


# ============================================================
# PUMP DUTY SIZING
# ============================================================

def size_pump_duty(
    fluid_config: dict[str, Any],
    design_flow_value: float,
    flow_unit: str,
    source_pressure_bar_a: float,
    destination_pressure_bar_a: float,
    elements: list[dict[str, Any]],
    pump_efficiency: float = 0.70,
    motor_margin: float = 1.10,
    pump_after_element_index: int = 0,
) -> dict[str, Any]:
    """
    Calculate the liquid pump duty required at the specified design flow.

    The hydraulic line definition already contains friction, fittings,
    equipment losses and elevation. Boundary pressure difference is then
    added separately:

        required pump dP
            = hydraulic-system dP
            + destination pressure
            - source pressure

    For pump sizing, the unpumped source pressure must NOT be used as the
    numerical pressure datum for the line-loss solver. A system may require
    the pump precisely because the unpumped pressure would otherwise fall
    below zero before reaching the destination.

    Therefore liquid properties are evaluated/frozen at the source boundary,
    and the existing line solver is run at a safe computational pressure
    datum. Absolute pressures from that internal solve are not returned as
    physical pressure predictions.
    """

    phase = str(fluid_config.get("phase_type", "Liquid")).strip().lower()
    if phase != "liquid":
        raise ValueError(
            "Pump-duty sizing version 1 is limited to liquid systems."
        )

    if not elements:
        raise ValueError(
            "At least one hydraulic line element is required for pump sizing."
        )

    if not math.isfinite(float(design_flow_value)) or float(design_flow_value) <= 0:
        raise ValueError("Design flow must be greater than zero.")

    if (
        not math.isfinite(float(source_pressure_bar_a))
        or float(source_pressure_bar_a) <= 0
    ):
        raise ValueError("Source pressure must be a positive absolute pressure.")

    if (
        not math.isfinite(float(destination_pressure_bar_a))
        or float(destination_pressure_bar_a) <= 0
    ):
        raise ValueError(
            "Destination pressure must be a positive absolute pressure."
        )

    if (
        not math.isfinite(float(pump_efficiency))
        or not 0 < float(pump_efficiency) <= 1
    ):
        raise ValueError("Pump efficiency must be greater than 0 and at most 1.")

    if not math.isfinite(float(motor_margin)) or float(motor_margin) < 1:
        raise ValueError("Motor margin must be at least 1.0.")

    source_pressure_bar_a = float(source_pressure_bar_a)
    destination_pressure_bar_a = float(destination_pressure_bar_a)
    pump_efficiency = float(pump_efficiency)
    motor_margin = float(motor_margin)

    pump_after_element_index = int(pump_after_element_index)
    if pump_after_element_index < 0 or pump_after_element_index > len(elements):
        raise ValueError(
            "Pump location must be between the source boundary and the final line element."
        )

    # Evaluate the real liquid properties at the actual source boundary.
    source_state = get_fluid_state(
        fluid_config=fluid_config,
        pressure_pa=source_pressure_bar_a * 100000.0,
    )
    if source_state is None:
        raise ValueError("Unable to evaluate liquid properties at the source boundary.")

    density_kg_m3 = float(source_state["rho"])
    viscosity_pa_s = float(source_state["mu"])
    source_vapor_pressure = source_state.get("vp")
    if source_vapor_pressure is None:
        raise ValueError(
            "Vapor pressure is required to calculate NPSHa for pump sizing."
        )
    vapor_pressure_pa = float(source_vapor_pressure)

    if density_kg_m3 <= 0:
        raise ValueError("Liquid density must be greater than zero.")
    if viscosity_pa_s <= 0:
        raise ValueError("Liquid dynamic viscosity must be greater than zero.")

    # Freeze the source-state liquid properties so the line-loss calculation
    # remains physically representative while using a safe numerical pressure
    # coordinate. This prevents the no-pump line solver from failing merely
    # because the pump head has not yet been applied.
    solver_fluid_config = dict(fluid_config)
    solver_fluid_config.update(
        {
            "phase_type": "Liquid",
            "use_manual_properties": True,
            "density_kg_m3": density_kg_m3,
            "dynamic_viscosity_pa_s": viscosity_pa_s,
            "vapor_pressure_bar_a": vapor_pressure_pa / 100000.0,
        }
    )

    # --------------------------------------------------------
    # SUCTION SIDE / NPSHa
    # --------------------------------------------------------
    #
    # pump_after_element_index = 0 means the pump is located directly
    # at the source boundary.  A value of N means elements[:N] form the
    # suction line and the remaining elements form the discharge/system line.
    #
    suction_elements = elements[:pump_after_element_index]

    suction_pressure_bar_a = source_pressure_bar_a
    suction_velocity_m_s = 0.0
    suction_total_dp_bar = 0.0
    suction_resistance_dp_bar = 0.0
    suction_static_dp_bar = 0.0

    if suction_elements:
        suction_result = solve_line(
            fluid_config=solver_fluid_config,
            flow_value=float(design_flow_value),
            flow_unit=flow_unit,
            inlet_pressure_bar_a=source_pressure_bar_a,
            elements=suction_elements,
        )

        suction_pressure_bar_a = float(
            suction_result["outlet_pressure_bar_a"]
        )
        suction_total_dp_bar = float(
            suction_result.get("total_dp_bar", 0.0)
        )
        suction_resistance_dp_bar = float(
            suction_result.get("resistance_dp_bar", 0.0)
        )
        suction_static_dp_bar = float(
            suction_result.get("static_dp_bar", 0.0)
        )

        for row in reversed(suction_result.get("elements", [])):
            velocity = row.get("velocity_m_s")
            if velocity is not None:
                suction_velocity_m_s = float(velocity)
                break

    suction_pressure_pa = suction_pressure_bar_a * 100000.0

    pressure_npsh_m = (
        suction_pressure_pa - vapor_pressure_pa
    ) / (density_kg_m3 * G)

    suction_velocity_head_m = (
        suction_velocity_m_s ** 2
        / (2.0 * G)
    )

    npsha_m = (
        pressure_npsh_m
        + suction_velocity_head_m
    )

    suction_total_head_m = (
        suction_total_dp_bar * 100000.0
        / (density_kg_m3 * G)
    )
    suction_resistance_head_m = (
        suction_resistance_dp_bar * 100000.0
        / (density_kg_m3 * G)
    )
    suction_static_head_m = (
        suction_static_dp_bar * 100000.0
        / (density_kg_m3 * G)
    )

    computational_pressure_bar_a = 1000.0

    line_result = solve_line(
        fluid_config=solver_fluid_config,
        flow_value=float(design_flow_value),
        flow_unit=flow_unit,
        inlet_pressure_bar_a=computational_pressure_bar_a,
        elements=elements,
    )

    system_dp_bar = float(line_result["total_dp_bar"])
    resistance_dp_bar = float(line_result.get("resistance_dp_bar", 0.0))
    static_dp_bar = float(line_result.get("static_dp_bar", 0.0))

    boundary_dp_bar = destination_pressure_bar_a - source_pressure_bar_a
    net_required_dp_bar = system_dp_bar + boundary_dp_bar
    net_required_dp_pa = net_required_dp_bar * 1.0e5

    system_head_m = system_dp_bar * 1.0e5 / (density_kg_m3 * G)
    resistance_head_m = resistance_dp_bar * 1.0e5 / (density_kg_m3 * G)
    static_head_m = static_dp_bar * 1.0e5 / (density_kg_m3 * G)
    boundary_head_m = boundary_dp_bar * 1.0e5 / (density_kg_m3 * G)
    net_required_head_m = net_required_dp_pa / (density_kg_m3 * G)

    positive_pump_dp_pa = max(net_required_dp_pa, 0.0)
    positive_pump_head_m = max(net_required_head_m, 0.0)

    mass_flow_kg_s = float(line_result["mass_flow_kg_s"])
    actual_flow_m3_s = mass_flow_kg_s / density_kg_m3

    hydraulic_power_kw = positive_pump_dp_pa * actual_flow_m3_s / 1000.0
    shaft_power_kw = hydraulic_power_kw / pump_efficiency
    minimum_motor_rating_kw = shaft_power_kw * motor_margin

    warnings: list[str] = list(line_result.get("warnings", []))

    if net_required_dp_bar <= 0:
        warnings.append(
            "The calculated net required pump differential pressure is zero "
            "or negative. The specified boundary pressures and hydraulic "
            "system do not require positive pump head at the design flow."
        )

    if npsha_m <= 0:
        warnings.append(
            "Calculated NPSHa is zero or negative. The pump suction condition "
            "is at or below the liquid vapor-pressure limit and is not acceptable."
        )

    if pump_efficiency < 0.50:
        warnings.append(
            "Entered pump efficiency is below 50%. Verify that the value is "
            "appropriate for the intended pump type and operating point."
        )

    if motor_margin < 1.05:
        warnings.append(
            "Motor margin is below 5%. Verify the project motor-sizing "
            "standard and transient/operating requirements."
        )

    # The line solver's absolute pressures used a computational datum and
    # must not be mistaken for the real pumped pressure profile.
    line_result["inlet_pressure_bar_a"] = None
    line_result["outlet_pressure_bar_a"] = None
    line_result["minimum_pressure_bar_a"] = None
    line_result["absolute_pressure_available"] = False

    for row in line_result.get("elements", []):
        row["pressure_in_bar_a"] = None
        row["pressure_out_bar_a"] = None

    for point in line_result.get("profile", []):
        point["pressure_bar_a"] = None

    return {
        "phase_type": "Liquid",
        "design_flow_value": float(design_flow_value),
        "flow_unit": flow_unit,
        "source_pressure_bar_a": source_pressure_bar_a,
        "destination_pressure_bar_a": destination_pressure_bar_a,
        "reference_density_kg_m3": density_kg_m3,
        "reference_dynamic_viscosity_pa_s": viscosity_pa_s,
        "mass_flow_kg_s": mass_flow_kg_s,
        "actual_flow_m3_s": actual_flow_m3_s,
        "system": {
            "total_dp_bar": system_dp_bar,
            "total_head_m": system_head_m,
            "resistance_dp_bar": resistance_dp_bar,
            "resistance_head_m": resistance_head_m,
            "static_dp_bar": static_dp_bar,
            "static_head_m": static_head_m,
        },
        "boundary": {
            "pressure_difference_bar": boundary_dp_bar,
            "pressure_head_m": boundary_head_m,
        },
        "npsha": {
            "available_head_m": npsha_m,
            "pump_after_element_index": pump_after_element_index,
            "suction_element_count": len(suction_elements),
            "suction_pressure_bar_a": suction_pressure_bar_a,
            "vapor_pressure_bar_a": vapor_pressure_pa / 100000.0,
            "suction_velocity_m_s": suction_velocity_m_s,
            "suction_velocity_head_m": suction_velocity_head_m,
            "pressure_npsh_m": pressure_npsh_m,
            "suction_total_dp_bar": suction_total_dp_bar,
            "suction_total_head_m": suction_total_head_m,
            "suction_resistance_dp_bar": suction_resistance_dp_bar,
            "suction_resistance_head_m": suction_resistance_head_m,
            "suction_static_dp_bar": suction_static_dp_bar,
            "suction_static_head_m": suction_static_head_m,
        },
        "pump_duty": {
            "required_differential_pressure_bar": net_required_dp_bar,
            "required_differential_head_m": net_required_head_m,
            "positive_required_head_m": positive_pump_head_m,
            "hydraulic_power_kw": hydraulic_power_kw,
            "pump_efficiency": pump_efficiency,
            "shaft_power_kw": shaft_power_kw,
            "motor_margin": motor_margin,
            "minimum_motor_rating_kw": minimum_motor_rating_kw,
        },
        "line_result": line_result,
        "warnings": warnings,
        "assumptions": [
            "Pump-duty sizing version 1 is limited to liquid systems.",
            (
                "Liquid density and viscosity are evaluated at the actual "
                "source boundary and frozen for the pump-duty line-loss calculation."
            ),
            (
                "A safe computational pressure datum is used internally for "
                "line-loss calculation; it is not a physical system pressure."
            ),
            (
                "The hydraulic line definition already includes pipe, fitting, "
                "equipment and elevation losses."
            ),
            (
                "Source and destination pressures are absolute boundary "
                "pressures; their difference is added to the hydraulic-system loss."
            ),
            (
                "Elevation is not added separately by the pump-sizing function "
                "because it is already included in the hydraulic line model."
            ),
            (
                "Known Equipment ΔP follows the current hydraulic-model "
                "treatment and is fixed unless the equipment model itself "
                "defines flow dependence."
            ),
            (
                "Minimum motor rating is calculated shaft power multiplied by "
                "the entered motor margin; standard motor-size rounding is not yet applied."
            ),
            (
                "NPSHa is calculated from the defined suction-side elements and "
                "the pump suction velocity head. NPSHr is not predicted; compare "
                "NPSHa with vendor NPSHr plus the applicable project margin."
            ),
            (
                "Pump-curve intersection, BEP checks, physical discharge pressure "
                "profile and vendor pump selection are not included in this version."
            ),
        ],
    }

