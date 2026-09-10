from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field


class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    name: str
    description: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class HydraulicModel(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    project_id: int = Field(foreign_key="project.id", index=True)

    calculation_intent: str = "pressure_drop"

    flow_value: float
    flow_unit: str = "m³/h"

    inlet_pressure_bar_a: Optional[float] = None
    property_reference_pressure_bar_a: Optional[float] = None

    fluid_config_json: str
    elements_json: str

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Scenario(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)

    project_id: int = Field(foreign_key="project.id", index=True)

    name: str
    description: Optional[str] = None

    calculation_intent: str = "pressure_drop"

    flow_value: float
    flow_unit: str = "m³/h"

    inlet_pressure_bar_a: Optional[float] = None
    property_reference_pressure_bar_a: Optional[float] = None

    fluid_config_json: str
    elements_json: str

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)