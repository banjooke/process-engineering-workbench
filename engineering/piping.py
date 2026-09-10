from __future__ import annotations

from typing import Any


# ============================================================
# STANDARD PIPE DATABASE
# ============================================================

PIPE_DATABASE = {
    "1/2": {
        "od_mm": 21.34,
        "walls_mm": {
            "Sch 10": 2.11,
            "Sch 40": 2.77,
            "Sch 80": 3.73,
        },
    },

    "3/4": {
        "od_mm": 26.67,
        "walls_mm": {
            "Sch 10": 2.11,
            "Sch 40": 2.87,
            "Sch 80": 3.91,
        },
    },

    "1": {
        "od_mm": 33.40,
        "walls_mm": {
            "Sch 10": 2.77,
            "Sch 40": 3.38,
            "Sch 80": 4.55,
        },
    },

    "1 1/4": {
        "od_mm": 42.16,
        "walls_mm": {
            "Sch 10": 2.77,
            "Sch 40": 3.56,
            "Sch 80": 4.85,
        },
    },

    "1 1/2": {
        "od_mm": 48.26,
        "walls_mm": {
            "Sch 10": 2.77,
            "Sch 40": 3.68,
            "Sch 80": 5.08,
        },
    },

    "2": {
        "od_mm": 60.33,
        "walls_mm": {
            "Sch 10": 2.77,
            "Sch 40": 3.91,
            "Sch 80": 5.54,
        },
    },

    "2 1/2": {
        "od_mm": 73.03,
        "walls_mm": {
            "Sch 10": 3.05,
            "Sch 40": 5.16,
            "Sch 80": 7.01,
        },
    },

    "3": {
        "od_mm": 88.90,
        "walls_mm": {
            "Sch 10": 3.05,
            "Sch 40": 5.49,
            "Sch 80": 7.62,
        },
    },

    "4": {
        "od_mm": 114.30,
        "walls_mm": {
            "Sch 10": 3.05,
            "Sch 40": 6.02,
            "Sch 80": 8.56,
        },
    },

    "5": {
        "od_mm": 141.30,
        "walls_mm": {
            "Sch 10": 3.40,
            "Sch 40": 6.55,
            "Sch 80": 9.53,
        },
    },

    "6": {
        "od_mm": 168.28,
        "walls_mm": {
            "Sch 10": 3.40,
            "Sch 40": 7.11,
            "Sch 80": 10.97,
        },
    },

    "8": {
        "od_mm": 219.08,
        "walls_mm": {
            "Sch 10": 3.76,
            "Sch 40": 8.18,
            "Sch 80": 12.70,
        },
    },

    "10": {
        "od_mm": 273.05,
        "walls_mm": {
            "Sch 10": 4.19,
            "Sch 40": 9.27,
            "Sch 80": 15.09,
        },
    },

    "12": {
        "od_mm": 323.85,
        "walls_mm": {
            "Sch 10": 4.57,
            "Sch 40": 10.31,
            "Sch 80": 17.48,
        },
    },
}


# ============================================================
# MATERIAL ROUGHNESS DATABASE
# Absolute roughness in mm
# ============================================================

MATERIAL_ROUGHNESS_MM = {
    "Commercial Steel": 0.045,
    "Stainless Steel": 0.015,
    "Copper": 0.0015,
    "PVC": 0.0015,
    "Cast Iron": 0.26,
    "Concrete": 0.30,
}


# ============================================================
# HELPERS
# ============================================================

def get_internal_diameter_mm(
    nps: str,
    schedule: str,
) -> float:
    """
    Return the internal diameter in mm
    for a standard NPS/schedule combination.
    """

    if nps not in PIPE_DATABASE:
        raise ValueError(
            f"Unknown NPS: {nps}"
        )

    pipe_record = PIPE_DATABASE[nps]

    walls = pipe_record["walls_mm"]

    if schedule not in walls:
        raise ValueError(
            f"Schedule '{schedule}' is not available "
            f"for NPS {nps}."
        )

    od_mm = pipe_record["od_mm"]
    wall_mm = walls[schedule]

    id_mm = od_mm - (2.0 * wall_mm)

    if id_mm <= 0:
        raise ValueError(
            f"Calculated pipe ID is invalid for "
            f"NPS {nps}, {schedule}."
        )

    return id_mm


def get_roughness_mm(
    material: str,
) -> float:
    """
    Return absolute roughness in mm
    for the selected pipe material.
    """

    if material not in MATERIAL_ROUGHNESS_MM:
        raise ValueError(
            f"Unknown pipe material: {material}"
        )

    return MATERIAL_ROUGHNESS_MM[material]


# ============================================================
# CATALOG FOR FRONTEND
# ============================================================

def get_piping_catalog() -> dict[str, Any]:
    """
    Return the piping database in a JSON-friendly format
    for the frontend.
    """

    sizes = []

    for nps, record in PIPE_DATABASE.items():

        schedules = []

        for schedule, wall_mm in record["walls_mm"].items():

            id_mm = (
                record["od_mm"]
                - 2.0 * wall_mm
            )

            schedules.append(
                {
                    "schedule": schedule,
                    "wall_mm": wall_mm,
                    "id_mm": id_mm,
                }
            )

        sizes.append(
            {
                "nps": nps,
                "od_mm": record["od_mm"],
                "schedules": schedules,
            }
        )


    materials = []

    for material, roughness_mm in MATERIAL_ROUGHNESS_MM.items():

        materials.append(
            {
                "material": material,
                "roughness_mm": roughness_mm,
            }
        )


    return {
        "sizes": sizes,
        "materials": materials,
    }