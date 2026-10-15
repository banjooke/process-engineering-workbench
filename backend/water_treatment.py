"""Owned-scenario duplication, read-only comparison and in-memory reports."""
from copy import deepcopy
from datetime import datetime, timezone
import json
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlmodel import Session

from backend.auth import get_current_user_id
from backend.scenarios import _require_project, _get_scenario, create_scenario, ScenarioPayload
from backend.water_documents import TASK, prepare_document, require_saved_document, validate_draft
from database.db import get_session
from reports.water_treatment_report import build_report_data, render_report, safe_filename

router = APIRouter(tags=["Water treatment"])


class ComparisonRequest(BaseModel):
    scenario_ids: list[int] = Field(min_length=2, max_length=5)


class ReportRequest(BaseModel):
    scenario_id: int = Field(gt=0)
    comparison_ids: list[int] = Field(default_factory=list, max_length=5)


def owned_calculations(project_id, ids, user_id, session):
    project = _require_project(project_id, user_id, session)
    if len(ids) != len(set(ids)):
        raise HTTPException(422, "Select distinct scenarios.")
    scenarios = []
    for scenario_id in ids:
        scenario = _get_scenario(project_id, scenario_id, session)
        try:
            document = require_saved_document(json.loads(scenario.fluid_config_json))
        except (ValueError, TypeError, KeyError, OverflowError):
            raise HTTPException(422, "Select compatible calculated Design Basis scenarios. Recalculate and save incomplete, stale or invalid results.") from None
        scenarios.append((scenario, document))
    return project, scenarios


@router.post("/projects/{project_id}/scenarios/{scenario_id}/water-treatment/duplicate")
def duplicate_scenario(project_id: int, scenario_id: int, user_id: UUID = Depends(get_current_user_id), session: Session = Depends(get_session)):
    _require_project(project_id, user_id, session)
    original = _get_scenario(project_id, scenario_id, session)
    try:
        config = json.loads(original.fluid_config_json)
        if config.get("engineering_task") != TASK:
            raise ValueError("Different task")
        document = deepcopy(config["water_treatment"])
        validate_draft(document["draft"])
        document.update(schema_version="water-treatment-scenario/1", engine_version="ww-engine/0.2.0", tool="design_basis", result=None, checks=[], calculated_at=None, calculated_inputs=None, result_status="draft", stale=True)
        document = prepare_document(document)
    except (ValueError, TypeError, KeyError):
        raise HTTPException(422, "Only supported Design Basis inputs can be duplicated. The original is unchanged.") from None
    return create_scenario(project_id, ScenarioPayload(name=f"Copy of {original.name}"[:200], description=original.description, calculation_intent=TASK, flow_value=0, flow_unit="m³/d", fluid_config={"engineering_task": TASK, "water_treatment": document}, elements=[]), user_id, session)


@router.post("/projects/{project_id}/water-treatment/compare")
def compare_scenarios(project_id: int, request: ComparisonRequest, user_id: UUID = Depends(get_current_user_id), session: Session = Depends(get_session)):
    project, scenarios = owned_calculations(project_id, request.scenario_ids, user_id, session)
    return build_report_data(project, scenarios[0], scenarios, datetime.now(timezone.utc))["comparison"]


@router.post("/projects/{project_id}/water-treatment/reports/{report_format}")
def download_report(project_id: int, report_format: Literal["pdf", "docx"], request: ReportRequest, user_id: UUID = Depends(get_current_user_id), session: Session = Depends(get_session)):
    if request.comparison_ids and (len(request.comparison_ids) < 2 or request.scenario_id not in request.comparison_ids):
        raise HTTPException(422, "Comparison reports require two to five scenarios including the primary scenario.")
    ids = request.comparison_ids or [request.scenario_id]
    project, scenarios = owned_calculations(project_id, ids, user_id, session)
    primary = next(pair for pair in scenarios if pair[0].id == request.scenario_id)
    data = build_report_data(project, primary, scenarios if request.comparison_ids else [], datetime.now(timezone.utc))
    try:
        content = render_report(data, report_format)
    except Exception:
        raise HTTPException(500, "Report generation failed. Your saved scenario is unchanged. Please try again.") from None
    filename = safe_filename(project.name, primary[0].name, report_format)
    media = "application/pdf" if report_format == "pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return Response(content, media_type=media, headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"})
