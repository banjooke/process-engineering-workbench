from __future__ import annotations

from datetime import datetime
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from database.db import get_session
from database.models import Project, HydraulicModel


router = APIRouter(prefix="/projects", tags=["Projects"])


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None


class ProjectRead(BaseModel):
    id: int
    name: str
    description: str | None = None
    created_at: datetime
    updated_at: datetime


class HydraulicModelPayload(BaseModel):
    calculation_intent: str = "pressure_drop"
    flow_value: float
    flow_unit: str = "m³/h"
    inlet_pressure_bar_a: float | None = None
    property_reference_pressure_bar_a: float | None = None
    fluid_config: dict[str, Any]
    elements: list[dict[str, Any]]


class HydraulicModelRead(BaseModel):
    id: int
    project_id: int
    calculation_intent: str
    flow_value: float
    flow_unit: str
    inlet_pressure_bar_a: float | None = None
    property_reference_pressure_bar_a: float | None = None
    fluid_config: dict[str, Any]
    elements: list[dict[str, Any]]
    created_at: datetime
    updated_at: datetime


def _project_to_dict(project: Project) -> dict[str, Any]:
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
    }


def _hydraulic_to_dict(model: HydraulicModel) -> dict[str, Any]:
    try:
        fluid_config = json.loads(model.fluid_config_json or "{}")
    except Exception:
        fluid_config = {}

    try:
        elements = json.loads(model.elements_json or "[]")
    except Exception:
        elements = []

    return {
        "id": model.id,
        "project_id": model.project_id,
        "calculation_intent": model.calculation_intent,
        "flow_value": model.flow_value,
        "flow_unit": model.flow_unit,
        "inlet_pressure_bar_a": model.inlet_pressure_bar_a,
        "property_reference_pressure_bar_a": model.property_reference_pressure_bar_a,
        "fluid_config": fluid_config,
        "elements": elements,
        "created_at": model.created_at,
        "updated_at": model.updated_at,
    }


@router.post("", response_model=ProjectRead)
def create_project(
    request: ProjectCreate,
    session: Session = Depends(get_session),
):
    project = Project(
        name=request.name.strip(),
        description=request.description.strip() if request.description else None,
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return _project_to_dict(project)


@router.get("", response_model=list[ProjectRead])
def list_projects(session: Session = Depends(get_session)):
    projects = session.exec(
        select(Project).order_by(Project.updated_at.desc(), Project.id.desc())
    ).all()
    return [_project_to_dict(project) for project in projects]


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: int,
    session: Session = Depends(get_session),
):
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    return _project_to_dict(project)


@router.put("/{project_id}/hydraulics", response_model=HydraulicModelRead)
def save_project_hydraulics(
    project_id: int,
    request: HydraulicModelPayload,
    session: Session = Depends(get_session),
):
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")

    existing = session.exec(
        select(HydraulicModel).where(HydraulicModel.project_id == project_id)
    ).first()

    now = datetime.utcnow()

    if existing is None:
        existing = HydraulicModel(
            project_id=project_id,
            calculation_intent=request.calculation_intent,
            flow_value=request.flow_value,
            flow_unit=request.flow_unit,
            inlet_pressure_bar_a=request.inlet_pressure_bar_a,
            property_reference_pressure_bar_a=request.property_reference_pressure_bar_a,
            fluid_config_json=json.dumps(request.fluid_config),
            elements_json=json.dumps(request.elements),
            created_at=now,
            updated_at=now,
        )
        session.add(existing)
    else:
        existing.calculation_intent = request.calculation_intent
        existing.flow_value = request.flow_value
        existing.flow_unit = request.flow_unit
        existing.inlet_pressure_bar_a = request.inlet_pressure_bar_a
        existing.property_reference_pressure_bar_a = request.property_reference_pressure_bar_a
        existing.fluid_config_json = json.dumps(request.fluid_config)
        existing.elements_json = json.dumps(request.elements)
        existing.updated_at = now
        session.add(existing)

    project.updated_at = now
    session.add(project)

    session.commit()
    session.refresh(existing)
    return _hydraulic_to_dict(existing)


@router.get("/{project_id}/hydraulics", response_model=HydraulicModelRead)
def get_project_hydraulics(
    project_id: int,
    session: Session = Depends(get_session),
):
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")

    model = session.exec(
        select(HydraulicModel).where(HydraulicModel.project_id == project_id)
    ).first()

    if model is None:
        raise HTTPException(
            status_code=404,
            detail="No hydraulic model has been saved for this project.",
        )

    return _hydraulic_to_dict(model)
