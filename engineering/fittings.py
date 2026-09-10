from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

PROJECT_ROOT = BASE_DIR.parent

DEFAULT_DATABASE_PATHS = [
    PROJECT_ROOT / "crane_resistance_coefficient_K_database.xlsx",
    BASE_DIR / "crane_resistance_coefficient_K_database.xlsx",
]


# ============================================================
# DATABASE CACHE
# ============================================================

_K_DATABASE: pd.DataFrame | None = None
_FT_DATABASE: pd.DataFrame | None = None
_DATABASE_PATH: Path | None = None


# ============================================================
# DATABASE LOADING
# ============================================================

def find_database_path() -> Path | None:
    for path in DEFAULT_DATABASE_PATHS:
        if path.exists():
            return path

    return None


def load_fitting_database(
    force_reload: bool = False,
) -> tuple[
    pd.DataFrame | None,
    pd.DataFrame | None,
]:
    global _K_DATABASE
    global _FT_DATABASE
    global _DATABASE_PATH

    if (
        not force_reload
        and _K_DATABASE is not None
    ):
        return (
            _K_DATABASE,
            _FT_DATABASE,
        )

    database_path = find_database_path()

    if database_path is None:
        _K_DATABASE = None
        _FT_DATABASE = None
        _DATABASE_PATH = None

        return None, None

    try:
        k_database = pd.read_excel(
            database_path,
            sheet_name="K_Database",
        )

        ft_database = pd.read_excel(
            database_path,
            sheet_name="Friction_Factor_fT",
        )

    except Exception as exc:
        raise RuntimeError(
            f"Unable to read Crane fitting database: {exc}"
        ) from exc

    _K_DATABASE = k_database
    _FT_DATABASE = ft_database
    _DATABASE_PATH = database_path

    return (
        _K_DATABASE,
        _FT_DATABASE,
    )


# ============================================================
# STATUS
# ============================================================

def fitting_database_available() -> bool:
    kdb, _ = load_fitting_database()

    return (
        kdb is not None
        and not kdb.empty
    )


def get_database_info() -> dict[str, Any]:
    kdb, ft_table = load_fitting_database()

    return {
        "available": (
            kdb is not None
            and not kdb.empty
        ),

        "database_path": (
            str(_DATABASE_PATH)
            if _DATABASE_PATH
            else None
        ),

        "fitting_records": (
            len(kdb)
            if kdb is not None
            else 0
        ),

        "ft_records": (
            len(ft_table)
            if ft_table is not None
            else 0
        ),
    }


# ============================================================
# CLEAN VALUE HELPERS
# ============================================================

def clean_value(
    value: Any,
) -> Any:
    if pd.isna(value):
        return None

    if isinstance(
        value,
        (
            int,
            float,
            str,
            bool,
        ),
    ):
        return value

    return str(value)


def fitting_label(
    row: pd.Series,
) -> str:
    """
    Produce a readable unique label from a Crane database row.
    """

    parts: list[str] = []

    component = clean_value(
        row.get("Component")
    )

    configuration = clean_value(
        row.get("Configuration")
    )

    size_range = clean_value(
        row.get("Size Range (mm)")
    )

    geometry = clean_value(
        row.get("Angle / Geometry")
    )

    if component:
        parts.append(
            str(component)
        )

    if configuration:
        parts.append(
            str(configuration)
        )

    if size_range:
        parts.append(
            f"Size {size_range} mm"
        )

    if geometry:
        parts.append(
            str(geometry)
        )

    return " — ".join(parts)


# ============================================================
# fT TABLE
# ============================================================

def _parse_ft_size_range(
    value: Any,
) -> tuple[float, float]:
    """
    Parse entries such as:
        80
        125-150
        125–150
    """

    text = (
        str(value)
        .strip()
        .replace("–", "-")
        .replace("—", "-")
    )

    if "-" in text:
        low_text, high_text = (
            text.split(
                "-",
                1,
            )
        )

        return (
            float(
                low_text.strip()
            ),
            float(
                high_text.strip()
            ),
        )

    number = float(text)

    return (
        number,
        number,
    )


def get_crane_ft(
    nominal_size_mm: float,
) -> float | None:
    """
    Return Crane complete-turbulence fT.

    Exact/range matches are preferred.

    If the DN falls between ranges, the nearest
    available nominal-size range is used.
    """

    _, ft_table = load_fitting_database()

    if (
        ft_table is None
        or ft_table.empty
    ):
        return None

    size_column = (
        "Nominal Size / Range (mm)"
    )

    ft_column = (
        "fT (complete turbulence)"
    )

    if (
        size_column
        not in ft_table.columns
        or ft_column
        not in ft_table.columns
    ):
        return None

    nominal_size_mm = float(
        nominal_size_mm
    )

    candidates: list[
        tuple[
            float,
            float,
        ]
    ] = []

    for _, row in ft_table.iterrows():

        size_value = row.get(
            size_column
        )

        ft_value = row.get(
            ft_column
        )

        if (
            pd.isna(size_value)
            or pd.isna(ft_value)
        ):
            continue

        try:
            low, high = (
                _parse_ft_size_range(
                    size_value
                )
            )

            ft = float(
                ft_value
            )

        except (
            TypeError,
            ValueError,
        ):
            continue

        if (
            low
            <= nominal_size_mm
            <= high
        ):
            return ft

        midpoint = (
            0.5
            * (
                low
                + high
            )
        )

        candidates.append(
            (
                abs(
                    nominal_size_mm
                    - midpoint
                ),
                ft,
            )
        )

    if not candidates:
        return None

    candidates.sort(
        key=lambda item:
            item[0]
    )

    return candidates[0][1]


# ============================================================
# DATABASE RECORDS
# ============================================================

def get_simple_fitting_database() -> pd.DataFrame:
    """
    Return database rows that can be calculated automatically.

    Currently:
        Fixed K
        Multiplier × fT

    Variable correlations/formula entries remain excluded
    until their dedicated calculation models are implemented.
    """

    kdb, _ = load_fitting_database()

    if (
        kdb is None
        or kdb.empty
    ):
        return pd.DataFrame()

    required_columns = {
        "K Basis",
        "Component",
        "Configuration",
    }

    if not required_columns.issubset(
        kdb.columns
    ):
        raise RuntimeError(
            "Crane fitting database does not contain "
            "the expected columns."
        )

    simple = kdb[
        kdb["K Basis"].isin(
            [
                "Fixed",
                "Multiplier × fT",
            ]
        )
    ].copy()

    simple["selection_label"] = (
        simple.apply(
            fitting_label,
            axis=1,
        )
    )

    return simple


# ============================================================
# FRONTEND CATALOG
# ============================================================

def get_fitting_catalog() -> dict[str, Any]:
    """
    JSON-friendly fitting catalog for the frontend.
    """

    simple = (
        get_simple_fitting_database()
    )

    if simple.empty:
        return {
            "source": "Crane",
            "available": False,
            "count": 0,
            "categories": [],
            "records": [],
        }

    records: list[
        dict[str, Any]
    ] = []

    for index, row in simple.iterrows():

        record = {
            "id": int(index),

            "category":
                clean_value(
                    row.get(
                        "Category"
                    )
                ),

            "component":
                clean_value(
                    row.get(
                        "Component"
                    )
                ),

            "configuration":
                clean_value(
                    row.get(
                        "Configuration"
                    )
                ),

            "size_range_mm":
                clean_value(
                    row.get(
                        "Size Range (mm)"
                    )
                ),

            "angle_geometry":
                clean_value(
                    row.get(
                        "Angle / Geometry"
                    )
                ),

            "k_basis":
                clean_value(
                    row.get(
                        "K Basis"
                    )
                ),

            "multiplier_on_ft":
                clean_value(
                    row.get(
                        "Multiplier on fT"
                    )
                ),

            "fixed_k":
                clean_value(
                    row.get(
                        "Fixed K"
                    )
                ),

            "k_expression":
                clean_value(
                    row.get(
                        "K Expression"
                    )
                ),

            "notes":
                clean_value(
                    row.get(
                        "Notes"
                    )
                ),

            "crane_page":
                clean_value(
                    row.get(
                        "Crane Page"
                    )
                ),

            "selection_label":
                row[
                    "selection_label"
                ],
        }

        records.append(
            record
        )

    categories = sorted(
        {
            str(record["category"])
            for record in records
            if record["category"]
        }
    )

    return {
        "source":
            "Crane",

        "available":
            True,

        "count":
            len(records),

        "categories":
            categories,

        "records":
            records,
    }


# ============================================================
# LOOKUP
# ============================================================

def find_fitting_record(
    selection_label: str,
) -> pd.Series | None:

    simple = (
        get_simple_fitting_database()
    )

    if simple.empty:
        return None

    rows = simple[
        simple[
            "selection_label"
        ]
        == selection_label
    ]

    if rows.empty:
        return None

    return rows.iloc[0]


# ============================================================
# K CALCULATION
# ============================================================

def calculate_database_k(
    selection_label: str,
    nominal_size_mm: float,
) -> dict[str, Any]:
    """
    Calculate K per item from the database.
    """

    row = find_fitting_record(
        selection_label
    )

    if row is None:
        raise ValueError(
            "The selected fitting was not found "
            "in the Crane database."
        )

    basis = str(
        row.get(
            "K Basis",
            "",
        )
    ).strip()

    if basis == "Fixed":

        fixed_k = row.get(
            "Fixed K"
        )

        if pd.isna(
            fixed_k
        ):
            raise ValueError(
                "Selected fitting is marked as Fixed K "
                "but has no Fixed K value."
            )

        k_value = float(
            fixed_k
        )

        return {
            "k_each":
                k_value,

            "method":
                "Fixed K",

            "basis":
                basis,

            "ft":
                None,

            "multiplier":
                None,

            "expression":
                f"K = {k_value:g}",
        }

    if basis == "Multiplier × fT":

        multiplier = row.get(
            "Multiplier on fT"
        )

        if pd.isna(
            multiplier
        ):
            raise ValueError(
                "Selected fitting has no fT multiplier."
            )

        multiplier = float(
            multiplier
        )

        ft = get_crane_ft(
            nominal_size_mm
        )

        if ft is None:
            raise ValueError(
                "Crane fT could not be determined "
                "for the selected nominal pipe size."
            )

        k_value = (
            multiplier
            * ft
        )

        return {
            "k_each":
                k_value,

            "method":
                "Multiplier × fT",

            "basis":
                basis,

            "ft":
                ft,

            "multiplier":
                multiplier,

            "expression":
                (
                    f"K = {multiplier:g} × "
                    f"{ft:.6g} = {k_value:.6g}"
                ),
        }

    raise ValueError(
        f"Unsupported K basis: {basis}"
    )


# ============================================================
# FULL FITTING CALCULATION
# ============================================================

def calculate_fitting_k(
    selection_label: str,
    nominal_size_mm: float,
    quantity: int = 1,
    override_k_each: float | None = None,
) -> dict[str, Any]:

    if quantity < 1:
        raise ValueError(
            "Fitting quantity must be at least 1."
        )

    database_result = (
        calculate_database_k(
            selection_label=
                selection_label,

            nominal_size_mm=
                nominal_size_mm,
        )
    )

    database_k_each = float(
        database_result[
            "k_each"
        ]
    )

    if (
        override_k_each
        is not None
    ):

        if (
            override_k_each
            < 0
        ):
            raise ValueError(
                "Override K cannot be negative."
            )

        k_each = float(
            override_k_each
        )

        method = (
            "User override"
        )

    else:
        k_each = (
            database_k_each
        )

        method = (
            database_result[
                "method"
            ]
        )

    k_total = (
        k_each
        * quantity
    )

    return {
        "selection_label":
            selection_label,

        "nominal_size_mm":
            nominal_size_mm,

        "quantity":
            quantity,

        "database_k_each":
            database_k_each,

        "k_each":
            k_each,

        "k_total":
            k_total,

        "method":
            method,

        "database_method":
            database_result[
                "method"
            ],

        "ft":
            database_result[
                "ft"
            ],

        "multiplier":
            database_result[
                "multiplier"
            ],

        "expression":
            database_result[
                "expression"
            ],
    }