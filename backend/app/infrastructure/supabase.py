"""Supabase client and all repository functions."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from supabase import create_client, Client

from app.config import get_settings

_client: Client | None = None


async def init_supabase() -> None:
    global _client
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        print("⚠️  Supabase not configured — running without persistence")
        return
    _client = create_client(settings.supabase_url, settings.supabase_key)
    print("✅ Supabase connected")


def _db() -> Client:
    if _client is None:
        raise RuntimeError("Supabase client not initialised")
    return _client


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

async def create_project(
    source_url: str,
    target_platforms: list[str] | None = None,
) -> dict[str, Any]:
    from app.config import get_settings
    platforms = target_platforms or get_settings().default_platforms
    result = _db().table("content_projects").insert({
        "source_url": source_url,
        "status": "uploaded",
        "processing_log": [],
        "cost_log": {},
        "memory_context": {},
        "target_platforms": platforms,
    }).execute()
    return result.data[0]


async def list_projects() -> list[dict[str, Any]]:
    result = _db().table("content_projects").select("*").order(
        "created_at", desc=True
    ).execute()
    projects = result.data
    # Attach moment counts
    for p in projects:
        count_result = _db().table("moments").select(
            "id", count="exact"
        ).eq("project_id", p["id"]).execute()
        p["moment_count"] = count_result.count or 0
    return projects


async def get_project_with_details(project_id: str) -> dict[str, Any] | None:
    proj_result = _db().table("content_projects").select("*").eq(
        "id", project_id
    ).single().execute()
    if not proj_result.data:
        return None

    project = proj_result.data

    # Load moments
    moments_result = _db().table("moments").select("*").eq(
        "project_id", project_id
    ).order("sort_order").execute()

    moments = moments_result.data or []

    for moment in moments:
        derivs_result = _db().table("derivatives").select("*").eq(
            "moment_id", moment["id"]
        ).execute()
        moment["derivatives"] = derivs_result.data or []

    project["moments"] = moments
    return project


async def update_project_status(
    project_id: str,
    status: str | None = None,
    log_entry: dict[str, Any] | None = None,
    cost_log: dict[str, Any] | None = None,
    memory_context: dict[str, Any] | None = None,
    title: str | None = None,
    transcript: Any | None = None,
    duration_seconds: int | None = None,
) -> None:
    # Build update payload
    payload: dict[str, Any] = {
        "updated_at": _now(),
    }
    if status is not None:
        payload["status"] = status
    if title is not None:
        payload["title"] = title
    if transcript is not None:
        payload["transcript"] = transcript
    if duration_seconds is not None:
        payload["duration_seconds"] = duration_seconds
    if cost_log is not None:
        payload["cost_log"] = cost_log
    if memory_context is not None:
        payload["memory_context"] = memory_context

    if log_entry:
        # Append to existing processing_log array
        existing = _db().table("content_projects").select(
            "processing_log"
        ).eq("id", project_id).single().execute()
        current_log = existing.data.get("processing_log", []) if existing.data else []
        payload["processing_log"] = current_log + [log_entry]

    _db().table("content_projects").update(payload).eq("id", project_id).execute()


# ---------------------------------------------------------------------------
# Moments
# ---------------------------------------------------------------------------

async def insert_moments(project_id: str, moments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = [
        {
            "project_id": project_id,
            "start_timestamp": m["start_timestamp"],
            "end_timestamp": m["end_timestamp"],
            "transcript_snippet": m["transcript_snippet"],
            "strength_score": m["strength_score"],
            "selection_rationale": m["selection_rationale"],
            "narrative_summary": m.get("narrative_summary", ""),
            "hook_potential": m.get("hook_potential", ""),
            "segments": m.get("segments"),  # JSONB — may be None for legacy
            "sort_order": idx,
        }
        for idx, m in enumerate(moments)
    ]
    if not rows:
        return []
    result = _db().table("moments").insert(rows).execute()
    return result.data


async def get_moment(moment_id: str) -> dict[str, Any] | None:
    result = _db().table("moments").select("*").eq("id", moment_id).single().execute()
    return result.data


async def update_moment_clip(moment_id: str, clip_url: str) -> None:
    """Persist clip_url after successful extraction."""
    _db().table("moments").update({
        "clip_url": clip_url,
        "updated_at": _now(),
    }).eq("id", moment_id).execute()


# ---------------------------------------------------------------------------
# Derivatives
# ---------------------------------------------------------------------------

async def insert_derivatives(
    project_id: str,
    moment_id: str,
    derivatives: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    rows = [
        {
            "project_id": project_id,
            "moment_id": moment_id,
            "platform": d["platform"],
            "content_type": d["content_type"],
            "content": d["content"],
            "status": "draft",
            "generation_model": d.get("model"),
        }
        for d in derivatives
    ]
    if not rows:
        return []
    result = _db().table("derivatives").insert(rows).execute()
    return result.data


async def get_derivative(derivative_id: str) -> dict[str, Any] | None:
    result = _db().table("derivatives").select("*").eq(
        "id", derivative_id
    ).single().execute()
    return result.data


async def update_derivative_content(
    derivative_id: str, content: str
) -> dict[str, Any] | None:
    # Record the before state
    existing = await get_derivative(derivative_id)
    if not existing:
        return None
    await record_editing_event(
        derivative_id=derivative_id,
        event_type="edit",
        before_content=existing["content"],
        after_content=content,
        platform=existing["platform"],
        content_type=existing["content_type"],
    )
    result = _db().table("derivatives").update({
        "content": content,
        "updated_at": _now(),
    }).eq("id", derivative_id).execute()
    return result.data[0] if result.data else None


async def update_derivative_status(
    derivative_id: str, status: str
) -> dict[str, Any] | None:
    result = _db().table("derivatives").update({
        "status": status,
        "updated_at": _now(),
    }).eq("id", derivative_id).execute()
    return result.data[0] if result.data else None


# ---------------------------------------------------------------------------
# Editing Events
# ---------------------------------------------------------------------------

async def record_editing_event(
    derivative_id: str,
    event_type: str,
    before_content: str | None = None,
    after_content: str | None = None,
    regeneration_guidance: str | None = None,
    platform: str | None = None,
    content_type: str | None = None,
) -> None:
    _db().table("editing_events").insert({
        "derivative_id": derivative_id,
        "event_type": event_type,
        "before_content": before_content,
        "after_content": after_content,
        "regeneration_guidance": regeneration_guidance,
        "platform": platform,
        "content_type": content_type,
    }).execute()


async def get_editing_events_for_project(project_id: str) -> list[dict[str, Any]]:
    """Fetch all editing events for all derivatives in a project."""
    # Join via derivatives
    result = _db().table("editing_events").select(
        "*, derivatives!inner(project_id)"
    ).eq("derivatives.project_id", project_id).execute()
    return result.data or []


# ---------------------------------------------------------------------------
# Creator Profile
# ---------------------------------------------------------------------------

async def upsert_profile(processed: dict[str, Any], form_data: dict[str, Any]) -> dict[str, Any]:
    """Upsert the singleton creator profile row (id = 'default')."""
    row = {
        "id": "default",
        "creator_name": processed.get("creator_name", ""),
        "niche":         processed.get("niche", ""),
        "platform":      processed.get("platform", ""),
        "all_platforms": processed.get("all_platforms", []),
        "styles":        processed.get("styles", []),
        "audience":      processed.get("audience", ""),
        "never_use":     processed.get("never_use", ""),
        "hook_length":   processed.get("hook_length", "medium"),
        "voice_inspirations": processed.get("voice_inspirations", ""),
        "form_data":     form_data,
        "updated_at":    _now(),
    }
    result = _db().table("creator_profiles").upsert(row).execute()
    return result.data[0] if result.data else row


async def get_profile() -> dict[str, Any] | None:
    """Return the singleton creator profile, or None if not yet saved."""
    try:
        result = _db().table("creator_profiles").select("*").eq(
            "id", "default"
        ).single().execute()
        return result.data
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------

async def delete_project(project_id: str) -> None:
    """Delete a project and all associated resources.

    Order matters — foreign key dependencies go first:
      1. Supabase Storage  — clips/{project_id}/*
      2. editing_events    — linked via derivative_id
      3. derivatives       — linked via project_id
      4. moments           — linked via project_id
      5. content_projects  — the root row
    """
    # 1. Storage — list and bulk-delete all objects under clips/{project_id}/
    try:
        objects = _db().storage.from_("clips").list(path=project_id)
        if objects:
            paths = [f"{project_id}/{obj['name']}" for obj in objects]
            _db().storage.from_("clips").remove(paths)
    except Exception as exc:
        # Non-fatal — bucket may be empty or Storage may be unreachable
        print(f"⚠️  Storage cleanup failed for project {project_id}: {exc}")

    # 2. editing_events — must go before derivatives
    deriv_result = _db().table("derivatives").select("id").eq(
        "project_id", project_id
    ).execute()
    derivative_ids = [d["id"] for d in (deriv_result.data or [])]
    if derivative_ids:
        _db().table("editing_events").delete().in_(
            "derivative_id", derivative_ids
        ).execute()

    # 3. derivatives
    _db().table("derivatives").delete().eq("project_id", project_id).execute()

    # 4. moments
    _db().table("moments").delete().eq("project_id", project_id).execute()

    # 5. project row
    _db().table("content_projects").delete().eq("id", project_id).execute()


def upload_clip(local_path: str, object_path: str) -> str:
    """Upload a local MP4 to Supabase Storage bucket 'clips' and return its public URL.

    This is synchronous — wrap with asyncio.to_thread() when calling from async code.
    Uses upsert so re-processing the same moment overwrites the existing file.
    """
    with open(local_path, "rb") as f:
        data = f.read()
    _db().storage.from_("clips").upload(
        path=object_path,
        file=data,
        file_options={"content-type": "video/mp4", "upsert": "true"},
    )
    return _db().storage.from_("clips").get_public_url(object_path)
