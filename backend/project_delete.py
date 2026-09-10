from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlmodel import Session

from database.db import get_session


router = APIRouter(tags=["Projects"])


@router.delete("/projects/{project_id}")
def delete_project(
    project_id: int,
    session: Session = Depends(get_session),
):
    """Delete one project and its dependent hydraulic model/scenarios.

    This version deliberately uses the existing SQLite/SQLModel table names
    rather than importing Project/HydraulicModel/Scenario classes here. That
    avoids circular/import/type-checking problems in a separate router file.
    """

    # Confirm that the project exists and keep its name for the response.
    project_row = session.execute(
        text("SELECT id, name FROM project WHERE id = :project_id"),
        {"project_id": project_id},
    ).mappings().first()

    if project_row is None:
        raise HTTPException(status_code=404, detail="Project not found.")

    project_name = project_row["name"]

    try:
        # Delete child records first so the project can be removed safely.
        scenario_result = session.execute(
            text("DELETE FROM scenario WHERE project_id = :project_id"),
            {"project_id": project_id},
        )

        hydraulic_result = session.execute(
            text("DELETE FROM hydraulicmodel WHERE project_id = :project_id"),
            {"project_id": project_id},
        )

        session.execute(
            text("DELETE FROM project WHERE id = :project_id"),
            {"project_id": project_id},
        )

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
        "deleted_scenarios": scenario_result.rowcount,
        "deleted_hydraulic_models": hydraulic_result.rowcount,
    }
