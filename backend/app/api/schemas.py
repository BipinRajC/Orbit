"""Pydantic schemas for all API request/response models."""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------

class CreateProjectRequest(BaseModel):
    url: str  # YouTube URL
    target_platforms: list[str] | None = None  # defaults to all 3 if omitted
    video_intent: "VideoIntentData | None" = None


class VideoIntentData(BaseModel):
    topic: str = ""   # e.g. "30-min full body workout for beginners"
    goal: str = ""    # grow_followers | inspire | teach_skill | build_trust


class CreatorProfileRequest(BaseModel):
    niche: str             # fitness / business / tech / lifestyle / education / other
    platform: str          # primary platform (instagram / youtube / linkedin / tiktok)
    styles: list[str]      # energetic, calm, motivational, educational, funny, raw
    audience: str          # beginners / intermediate / enthusiasts / professionals
    never_use: str = ""    # freetext — things to avoid (emoji, hype words, exclamation marks…)
    # Extended fields (filled by onboarding stage 2)
    hook_length: str = ""           # short | medium | long
    all_platforms: list[str] = []   # all selected platforms (not just primary)
    voice_inspirations: str = ""    # comma-separated creator names to emulate
    creator_name: str = ""          # creator's name or handle
    # Raw form state — stored in Supabase so the Profile settings page can
    # pre-populate every chip/field exactly as the user left it
    form_data: dict = {}            # mirrors the localStorage creator_profile_data blob


class ProcessingLogEntry(BaseModel):
    stage: str
    message: str
    timestamp: datetime


class CostLog(BaseModel):
    total_cost_usd: float = 0.0
    # Legacy cascadeflow fields — kept for backwards compatibility
    total_calls: int = 0
    drafter_calls: int = 0
    verifier_calls: int = 0
    drafter_pct: int = 0
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
    target_platforms: list[str] = []
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

class SegmentResponse(BaseModel):
    start: float
    end: float
    role: str  # primary | payoff | bridge


class MomentResponse(BaseModel):
    id: UUID
    project_id: UUID
    start_timestamp: float
    end_timestamp: float
    transcript_snippet: str
    strength_score: float
    selection_rationale: str
    narrative_summary: str | None = None
    hook_potential: str | None = None
    segments: list[SegmentResponse] | None = None
    clip_url: str | None = None
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
    section: str | None = None  # optional: target a specific field for focused regen


# ---------------------------------------------------------------------------
# Editing Events (internal — stored on approve/reject/edit)
# ---------------------------------------------------------------------------

class EditingEventPayload(BaseModel):
    event_type: str  # edit | approve | reject | regenerate
    before_content: str | None = None
    after_content: str | None = None
    regeneration_guidance: str | None = None
