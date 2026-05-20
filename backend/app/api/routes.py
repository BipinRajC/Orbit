"""All REST API routes for ContentOS."""
from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse

from app.api.schemas import (
    CreateProjectRequest,
    DerivativeResponse,
    EditingEventPayload,
    ProjectListItem,
    ProjectResponse,
    RegenerateDerivativeRequest,
    UpdateDerivativeRequest,
)
from app.domain import processing as pipeline
from app.infrastructure.supabase import (
    create_project,
    get_project_with_details,
    list_projects,
    update_derivative_content,
    update_derivative_status,
    record_editing_event,
)
from app.domain.generation import regenerate_single_derivative
from app.domain.memory import synthesize_and_store_observations
from app.config import get_settings

router = APIRouter()


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

@router.post("/projects", response_model=ProjectListItem, status_code=201)
async def create_new_project(
    body: CreateProjectRequest,
    background_tasks: BackgroundTasks,
) -> ProjectListItem:
    """Create a project and kick off the pipeline in the background."""
    settings = get_settings()
    platforms = body.target_platforms or settings.default_platforms

    project = await create_project(source_url=body.url, target_platforms=platforms)
    background_tasks.add_task(pipeline.run_pipeline, project["id"], platforms)
    return ProjectListItem(**{
        "id": project["id"],
        "status": project["status"],
        "source_url": project["source_url"],
        "title": project.get("title"),
        "created_at": project["created_at"],
        "updated_at": project["updated_at"],
        "moment_count": 0,
    })


@router.get("/projects", response_model=list[ProjectListItem])
async def get_projects() -> list[ProjectListItem]:
    projects = await list_projects()
    return [ProjectListItem(**p) for p in projects]


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: UUID) -> ProjectResponse:
    project = await get_project_with_details(str(project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse(**project)


@router.post("/projects/{project_id}/complete-review")
async def complete_review(
    project_id: UUID,
    background_tasks: BackgroundTasks,
) -> dict:
    """Trigger memory synthesis after the creator completes their review."""
    background_tasks.add_task(
        synthesize_and_store_observations, str(project_id)
    )
    return {"message": "Review synthesis started", "project_id": str(project_id)}


# ---------------------------------------------------------------------------
# Clip serving
# ---------------------------------------------------------------------------

@router.get("/clips/{project_id}/{moment_id}.mp4")
async def serve_clip(project_id: str, moment_id: str) -> FileResponse:
    """Serve extracted 9:16 MP4 clip files."""
    settings = get_settings()
    clip_path = Path(settings.clip_storage_path) / project_id / f"{moment_id}.mp4"
    if not clip_path.exists():
        raise HTTPException(status_code=404, detail="Clip not found")
    return FileResponse(str(clip_path), media_type="video/mp4")


# ---------------------------------------------------------------------------
# Derivatives
# ---------------------------------------------------------------------------

@router.patch("/derivatives/{derivative_id}", response_model=DerivativeResponse)
async def edit_derivative(
    derivative_id: UUID,
    body: UpdateDerivativeRequest,
) -> DerivativeResponse:
    derivative = await update_derivative_content(str(derivative_id), body.content)
    if not derivative:
        raise HTTPException(status_code=404, detail="Derivative not found")
    return DerivativeResponse(**derivative)


@router.post("/derivatives/{derivative_id}/approve", response_model=DerivativeResponse)
async def approve_derivative(derivative_id: UUID) -> DerivativeResponse:
    derivative = await update_derivative_status(str(derivative_id), "approved")
    if not derivative:
        raise HTTPException(status_code=404, detail="Derivative not found")
    await record_editing_event(
        derivative_id=str(derivative_id),
        event_type="approve",
        platform=derivative["platform"],
        content_type=derivative["content_type"],
    )
    return DerivativeResponse(**derivative)


@router.post("/derivatives/{derivative_id}/reject", response_model=DerivativeResponse)
async def reject_derivative(derivative_id: UUID) -> DerivativeResponse:
    derivative = await update_derivative_status(str(derivative_id), "rejected")
    if not derivative:
        raise HTTPException(status_code=404, detail="Derivative not found")
    await record_editing_event(
        derivative_id=str(derivative_id),
        event_type="reject",
        platform=derivative["platform"],
        content_type=derivative["content_type"],
    )
    return DerivativeResponse(**derivative)


@router.post("/derivatives/{derivative_id}/regenerate", response_model=DerivativeResponse)
async def regenerate_derivative(
    derivative_id: UUID,
    body: RegenerateDerivativeRequest,
    background_tasks: BackgroundTasks,
) -> DerivativeResponse:
    derivative = await regenerate_single_derivative(
        str(derivative_id), guidance=body.guidance
    )
    if not derivative:
        raise HTTPException(status_code=404, detail="Derivative not found")
    await record_editing_event(
        derivative_id=str(derivative_id),
        event_type="regenerate",
        platform=derivative["platform"],
        content_type=derivative["content_type"],
        regeneration_guidance=body.guidance,
    )
    return DerivativeResponse(**derivative)
