"""Pydantic schemas for all API request/response models."""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, HttpUrl


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------

class CreateProjectRequest(BaseModel):
    url: str  # YouTube URL


class ProcessingLogEntry(BaseModel):
    stage: str
    message: str
    timestamp: datetime


class CostLog(BaseModel):
    total_calls: int = 0
    drafter_calls: int = 0
    verifier_calls: int = 0
    total_cost_usd: float = 0.0
    estimated_savings_usd: float = 0.0


class MemoryContext(BaseModel):
    recall_count: int = 0
    recall_items: list[str] = []
    reflection: str = ""
    biases_applied: int = 0


class ProjectResponse(BaseModel):
    id: UUID
    status: str
    source_url: str
    title: str | None
    duration_seconds: int | None
    processing_log: list[dict[str, Any]]
    cost_log: dict[str, Any]
    memory_context: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    moments: list[MomentResponse] = []


class ProjectListItem(BaseModel):
    id: UUID
    status: str
    source_url: str
    title: str | None
    created_at: datetime
    updated_at: datetime
    moment_count: int = 0


# ---------------------------------------------------------------------------
# Moment
# ---------------------------------------------------------------------------

class MomentResponse(BaseModel):
    id: UUID
    project_id: UUID
    start_timestamp: float
    end_timestamp: float
    transcript_snippet: str
    strength_score: float
    selection_rationale: str
    sort_order: int
    created_at: datetime
    derivatives: list[DerivativeResponse] = []


# ---------------------------------------------------------------------------
# Derivative
# ---------------------------------------------------------------------------

class DerivativeResponse(BaseModel):
    id: UUID
    moment_id: UUID
    project_id: UUID
    platform: str
    content_type: str
    content: str
    status: str
    generation_model: str | None
    created_at: datetime
    updated_at: datetime


class UpdateDerivativeRequest(BaseModel):
    content: str


class RegenerateDerivativeRequest(BaseModel):
    guidance: str | None = None


# ---------------------------------------------------------------------------
# Editing Events (internal — stored on approve/reject/edit)
# ---------------------------------------------------------------------------

class EditingEventPayload(BaseModel):
    event_type: str  # edit | approve | reject | regenerate
    before_content: str | None = None
    after_content: str | None = None
    regeneration_guidance: str | None = None
