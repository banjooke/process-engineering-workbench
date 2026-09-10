from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from database.db import get_session
from database.models import Project, Scenario


router = APIRouter(tags=["Scenarios"])


class ScenarioPayload(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None
    calculation_intent: Literal[
        "pressure_drop",
        "outlet_pressure",
        "pressure_profile",
    ] = "pressure_drop"
    flow_value: float = Field(gt=0)
    flow_unit: str = "m³/h"
    inlet_pressure_bar_a: float | None = None
    property_reference_pressure_bar_a: float | None = None
    fluid_config: dict[str, Any]
    elements: list[dict[str, Any]]


class ScenarioResponse(BaseModel):
    id: int
    project_id: int
    name: str
    description: str | None
    calculation_intent: str
    flow_value: float
    flow_unit: str
    inlet_pressure_bar_a: float | None
    property_reference_pressure_bar_a: float | None
    fluid_config: dict[str, Any]
    elements: list[dict[str, Any]]
    created_at: datetime
    updated_at: datetime


def _require_project(project_id: int, session: Session) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project


def _get_scenario(project_id: int, scenario_id: int, session: Session) -> Scenario:
    scenario = session.get(Scenario, scenario_id)
    if scenario is None or scenario.project_id != project_id:
        raise HTTPException(status_code=404, detail="Scenario not found.")
    return scenario


def _response(scenario: Scenario) -> ScenarioResponse:
    try:
        fluid_config = json.loads(scenario.fluid_config_json)
    except Exception:
        fluid_config = {}

    try:
        elements = json.loads(scenario.elements_json)
    except Exception:
        elements = []

    return ScenarioResponse(
        id=int(scenario.id),
        project_id=scenario.project_id,
        name=scenario.name,
        description=scenario.description,
        calculation_intent=scenario.calculation_intent,
        flow_value=scenario.flow_value,
        flow_unit=scenario.flow_unit,
        inlet_pressure_bar_a=scenario.inlet_pressure_bar_a,
        property_reference_pressure_bar_a=scenario.property_reference_pressure_bar_a,
        fluid_config=fluid_config,
        elements=elements,
        created_at=scenario.created_at,
        updated_at=scenario.updated_at,
    )


@router.post(
    "/projects/{project_id}/scenarios",
    response_model=ScenarioResponse,
)
def create_scenario(
    project_id: int,
    payload: ScenarioPayload,
    session: Session = Depends(get_session),
):
    """
    Create a NEW scenario row.

    Important: this route deliberately does not search for an existing scenario
    and does not overwrite the project's HydraulicModel. Every call to POST
    creates a separate Scenario record linked to the same project.
    """
    project = _require_project(project_id, session)

    scenario = Scenario(
        project_id=project_id,
        name=payload.name.strip(),
        description=payload.description,
        calculation_intent=payload.calculation_intent,
        flow_value=payload.flow_value,
        flow_unit=payload.flow_unit,
        inlet_pressure_bar_a=payload.inlet_pressure_bar_a,
        property_reference_pressure_bar_a=payload.property_reference_pressure_bar_a,
        fluid_config_json=json.dumps(payload.fluid_config),
        elements_json=json.dumps(payload.elements),
    )

    session.add(scenario)
    project.updated_at = datetime.utcnow()
    session.add(project)
    session.commit()
    session.refresh(scenario)

    return _response(scenario)


@router.get(
    "/projects/{project_id}/scenarios",
    response_model=list[ScenarioResponse],
)
def list_scenarios(
    project_id: int,
    session: Session = Depends(get_session),
):
    _require_project(project_id, session)

    scenarios = session.exec(
        select(Scenario)
        .where(Scenario.project_id == project_id)
        .order_by(Scenario.id)
    ).all()

    return [_response(scenario) for scenario in scenarios]


@router.get(
    "/projects/{project_id}/scenarios/{scenario_id}",
    response_model=ScenarioResponse,
)
def get_scenario(
    project_id: int,
    scenario_id: int,
    session: Session = Depends(get_session),
):
    scenario = _get_scenario(project_id, scenario_id, session)
    return _response(scenario)


@router.put(
    "/projects/{project_id}/scenarios/{scenario_id}",
    response_model=ScenarioResponse,
)
def update_scenario(
    project_id: int,
    scenario_id: int,
    payload: ScenarioPayload,
    session: Session = Depends(get_session),
):
    project = _require_project(project_id, session)
    scenario = _get_scenario(project_id, scenario_id, session)

    scenario.name = payload.name.strip()
    scenario.description = payload.description
    scenario.calculation_intent = payload.calculation_intent
    scenario.flow_value = payload.flow_value
    scenario.flow_unit = payload.flow_unit
    scenario.inlet_pressure_bar_a = payload.inlet_pressure_bar_a
    scenario.property_reference_pressure_bar_a = (
        payload.property_reference_pressure_bar_a
    )
    scenario.fluid_config_json = json.dumps(payload.fluid_config)
    scenario.elements_json = json.dumps(payload.elements)
    scenario.updated_at = datetime.utcnow()

    project.updated_at = datetime.utcnow()

    session.add(scenario)
    session.add(project)
    session.commit()
    session.refresh(scenario)

    return _response(scenario)


@router.delete("/projects/{project_id}/scenarios/{scenario_id}")
def delete_scenario(
    project_id: int,
    scenario_id: int,
    session: Session = Depends(get_session),
):
    project = _require_project(project_id, session)
    scenario = _get_scenario(project_id, scenario_id, session)

    deleted_id = int(scenario.id)
    deleted_name = scenario.name

    session.delete(scenario)
    project.updated_at = datetime.utcnow()
    session.add(project)
    session.commit()

    return {
        "status": "deleted",
        "project_id": project_id,
        "scenario_id": deleted_id,
        "scenario_name": deleted_name,
    }
