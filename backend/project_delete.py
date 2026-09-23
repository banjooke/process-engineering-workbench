from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from uuid import UUID

from database.db import get_session
from database.models import HydraulicModel, Project, Scenario
from backend.auth import get_current_user_id


router = APIRouter(tags=["Projects"])


@router.delete("/projects/{project_id}")
def delete_project(
    project_id: int,
    user_id: UUID = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """Delete one authenticated user's project and its dependent records."""
    project = session.exec(
        select(Project).where(Project.id == project_id, Project.user_id == user_id)
    ).first()

    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")

    project_name = project.name

    try:
        scenarios = session.exec(
            select(Scenario).where(Scenario.project_id == project_id)
        ).all()
        hydraulic_models = session.exec(
            select(HydraulicModel).where(HydraulicModel.project_id == project_id)
        ).all()

        for scenario in scenarios:
            session.delete(scenario)
        for hydraulic_model in hydraulic_models:
            session.delete(hydraulic_model)
        session.delete(project)

        session.commit()

    except Exception as exc:
        session.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Unable to delete project: {exc}",
        ) from exc

    return {
        "status": "deleted",
        "project_id": project_id,
        "project_name": project_name,
        "deleted_scenarios": len(scenarios),
        "deleted_hydraulic_models": len(hydraulic_models),
    }
