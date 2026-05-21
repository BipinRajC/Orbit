"""All REST API routes for OrbitOS."""
from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse

from app.api.schemas import (
    CreateProjectRequest,
    CreatorProfileRequest,
    DerivativeResponse,
    EditingEventPayload,
    ProjectListItem,
    ProjectResponse,
    RegenerateDerivativeRequest,
    UpdateDerivativeRequest,
)
from app.domain import processing as pipeline
from app.domain.tags import build_tags
from app.infrastructure.supabase import (
    create_project,
    get_project_with_details,
    list_projects,
    update_derivative_content,
    update_derivative_status,
    record_editing_event,
    upsert_profile,
    get_profile,
)
from app.infrastructure.hindsight import retain_observation, recall_memories, recall_memories_rich
from app.domain.generation import regenerate_single_derivative
from app.domain.memory import synthesize_and_store_observations, retain_diff_observation
from app.config import get_settings

router = APIRouter()


async def _get_creator_info() -> tuple[str | None, list[str]]:
    """Fetch creator name and styles from Supabase profile (best-effort)."""
    try:
        row = await get_profile()
        if row:
            return row.get("creator_name"), row.get("styles") or []
    except Exception:
        pass
    return None, []


# ---------------------------------------------------------------------------
# Intelligence graph helpers
# ---------------------------------------------------------------------------

def _short_label(text: str, max_words: int = 4) -> str:
    """Extract a short display label from a memory string."""
    # Strip "Creator profile — X: " prefix
    import re
    cleaned = re.sub(r'^creator (profile —? ?)?', '', text, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r'^(creator )?consistently |^creator ', '', cleaned, flags=re.IGNORECASE).strip()
    words = cleaned.split()
    label = ' '.join(words[:max_words])
    return label[:28].rstrip(',;:') or text[:28]


def _classify_memory(text: str) -> tuple[str, str, float]:
    """Returns (kind, label, weight) for a memory string."""
    t = text.lower()

    # Platform detection
    platform_map = {
        'twitter': 'Twitter / X', 'linkedin': 'LinkedIn',
        'instagram': 'Instagram', 'shorts': 'Short-form',
        'youtube': 'YouTube', 'newsletter': 'Newsletter',
        'tiktok': 'TikTok',
    }
    if 'primary platform' in t or 'posts on' in t:
        for key, label in platform_map.items():
            if key in t:
                return 'platform', label, 0.85
        return 'platform', _short_label(text), 0.75

    # Also detect platform mentions even outside profile entries
    if 'platform' in t:
        for key, label in platform_map.items():
            if key in t:
                return 'platform', label, 0.70

    # Topic / niche
    if 'niche:' in t or 'niche —' in t:
        words = t.split('niche:')[-1].strip().split()
        return 'topic', ' '.join(words[:3]).title(), 0.90

    # Never-use / avoid preferences
    if 'never use' in t or 'avoid' in t:
        return 'preference', 'Avoid patterns', 0.65

    # Editing behaviour / preferences
    edit_keywords = ['shorten', 'remov', 'rewrite', 'reject', 'approv', 'prefer', 'avoid',
                     'punchier', 'casual', 'direct', 'formal', 'hook', 'clickbait', 'emoji']
    if any(k in t for k in edit_keywords):
        return 'preference', _short_label(text), round(0.45 + min(len(text) / 500, 0.45), 2)

    # Trait / style
    style_keywords = ['style', 'tone', 'voice', 'warm', 'playful', 'analytical', 'bold',
                      'witty', 'audience', 'cadence', 'niche', 'content']
    if any(k in t for k in style_keywords):
        return 'trait', _short_label(text), round(0.5 + min(len(text) / 600, 0.40), 2)

    return 'trait', _short_label(text), 0.55


# Tag → kind mapping from Hindsight's own tagging
_TAG_KIND: dict[str, str] = {
    'editing-behaviour': 'preference',
    'hook':              'preference',
    'avoid':             'preference',
    'tone':              'trait',
    'voice':             'trait',
    'style':             'trait',
    'platform':          'platform',
    'niche':             'topic',
    'topic':             'topic',
    'audience':          'trait',
    'event:approve':     'preference',
    'event:reject':      'preference',
    'event:edit':        'preference',
    'event:regenerate':  'preference',
    'event:profile':     'trait',
}

def _classify_memory_with_tags(text: str, tags: list[str]) -> tuple[str, str, float]:
    """Classify using real Hindsight tags first, fall back to keyword heuristic."""
    for tag in (tags or []):
        # Check exact tag first
        kind = _TAG_KIND.get(tag.lower().strip())
        if kind:
            return kind, _short_label(text), 0.80
        # Check tag prefix (e.g. "style:humour" → style → trait)
        prefix = tag.split(":")[0].lower() if ":" in tag else ""
        kind = _TAG_KIND.get(prefix)
        if kind:
            return kind, _short_label(text), 0.78
    # Fall back to keyword heuristic
    return _classify_memory(text)


def _build_intelligence_graph(items: list[dict]) -> dict:
    """Convert rich Hindsight memory dicts into an IntelligenceGraph dict.

    Each item has: {text, tags, mentioned_at, occurred_at}
    Real Hindsight tags take priority over keyword heuristics for classification.
    """
    from collections import defaultdict

    nodes: list[dict] = [{'id': 'creator', 'label': 'Creator Persona', 'full_text': 'Core creator identity node', 'kind': 'root', 'weight': 1.0, 'tags': [], 'mentioned_at': None}]
    edges: list[dict] = []
    seen_labels: set[str] = set()

    for i, item in enumerate(items):
        text = item['text'] if isinstance(item, dict) else item
        tags = item.get('tags', []) if isinstance(item, dict) else []
        mentioned_at = item.get('mentioned_at') if isinstance(item, dict) else None

        kind, label, weight = _classify_memory_with_tags(text, tags)
        if label in seen_labels:
            continue
        seen_labels.add(label)
        node_id = f'{kind}-{i}'
        nodes.append({
            'id': node_id,
            'label': label,
            'full_text': text,
            'kind': kind,
            'weight': weight,
            'tags': tags,
            'mentioned_at': mentioned_at,
        })
        edges.append({'source': 'creator', 'target': node_id, 'kind': 'shapes'})

    non_root = [n for n in nodes if n['kind'] != 'root']

    # Semantic — same-kind nodes (max 3 links per node)
    by_kind: dict[str, list[str]] = defaultdict(list)
    for n in non_root:
        by_kind[n['kind']].append(n['id'])
    for ids in by_kind.values():
        for i in range(len(ids)):
            for j in range(i + 1, min(len(ids), i + 3)):
                edges.append({'source': ids[i], 'target': ids[j], 'kind': 'semantic'})

    # Temporal — consecutive non-root memories
    for i in range(len(non_root) - 1):
        edges.append({'source': non_root[i]['id'], 'target': non_root[i + 1]['id'], 'kind': 'temporal'})

    # Entity — nodes sharing a meaningful keyword
    stop = {'the', 'a', 'an', 'is', 'are', 'and', 'or', 'of', 'in', 'to', 'for',
            'from', 'with', 'that', 'this', 'creator', 'content', 'style', 'uses',
            'their', 'who', 'which', 'what', 'how', 'when', 'where', 'profile',
            'they', 'has', 'have', 'been', 'was', 'not', 'but', 'on', 'as', 'by'}
    kw_to_ids: dict[str, list[str]] = defaultdict(list)
    for n in non_root:
        for w in set((n.get('full_text') or n['label']).lower().split()) - stop:
            if len(w) > 4:
                kw_to_ids[w].append(n['id'])
    entity_seen: set[tuple[str, str]] = set()
    for node_ids in kw_to_ids.values():
        if len(node_ids) >= 2:
            for i in range(len(node_ids)):
                for j in range(i + 1, len(node_ids)):
                    pair = (min(node_ids[i], node_ids[j]), max(node_ids[i], node_ids[j]))
                    if pair not in entity_seen:
                        entity_seen.add(pair)
                        edges.append({'source': node_ids[i], 'target': node_ids[j], 'kind': 'entity'})

    # Causal — platform nodes → preference nodes
    platform_ids = [n['id'] for n in non_root if n['kind'] == 'platform']
    pref_ids = [n['id'] for n in non_root if n['kind'] == 'preference']
    for plat in platform_ids[:3]:
        for pref in pref_ids[:4]:
            edges.append({'source': plat, 'target': pref, 'kind': 'causal'})

    stats = {
        'memories': len(items),
        'biases': sum(1 for n in nodes if n['kind'] == 'preference'),
        'edits': sum(1 for item in items
                     if any(w in (item['text'] if isinstance(item, dict) else item).lower()
                            for w in ['edit', 'shorten', 'rewrite', 'approv', 'reject', 'remov'])),
    }
    return {'project_id': 'global', 'nodes': nodes, 'edges': edges, 'stats': stats}


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
    video_intent = body.video_intent.model_dump() if body.video_intent else None
    background_tasks.add_task(pipeline.run_pipeline, project["id"], platforms, video_intent)
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
) -> dict:
    """Trigger memory synthesis after the creator completes their review."""
    count = await synthesize_and_store_observations(str(project_id))
    return {
        "message": f"Saved {count} memories to Hindsight",
        "observations_saved": count,
        "project_id": str(project_id),
    }


# ---------------------------------------------------------------------------
# Creator Profile
# ---------------------------------------------------------------------------

@router.post("/profile")
async def save_creator_profile(body: CreatorProfileRequest) -> dict:
    """Store creator profile in Supabase AND as Hindsight memories."""
    _HOOK_DESC = {
        "short": "short — one punchy line",
        "medium": "medium — two to three lines",
        "long": "long — a short paragraph",
    }
    observations = [
        f"Creator profile — niche: {body.niche}",
        f"Creator profile — primary platform: {body.platform}",
        f"Creator profile — content style: {', '.join(body.styles)}",
        f"Creator profile — target audience: {body.audience}",
    ]
    if body.all_platforms:
        observations.append(
            f"Creator profile — posts on: {', '.join(body.all_platforms)}"
        )
    if body.hook_length:
        observations.append(
            f"Creator profile — preferred hook length: {_HOOK_DESC.get(body.hook_length, body.hook_length)}"
        )
    if body.voice_inspirations.strip():
        observations.append(
            f"Creator profile — persona inspired by: {body.voice_inspirations.strip()}"
        )
    if body.creator_name.strip():
        observations.append(
            f"Creator profile — creator name: {body.creator_name.strip()}"
        )
    if body.never_use.strip():
        observations.append(
            f"Creator profile — never use in content: {body.never_use}"
        )

    profile_tags = build_tags(
        creator_name=body.creator_name,
        styles=body.styles,
        platforms=body.all_platforms,
        event="profile",
        extra=["creator-profile"],
    )
    for obs in observations:
        await retain_observation(obs, tags=profile_tags)

    # Persist to Supabase so the Profile settings page can reload it
    try:
        processed = {
            "creator_name":      body.creator_name,
            "niche":             body.niche,
            "platform":          body.platform,
            "all_platforms":     body.all_platforms,
            "styles":            body.styles,
            "audience":          body.audience,
            "never_use":         body.never_use,
            "hook_length":       body.hook_length,
            "voice_inspirations": body.voice_inspirations,
        }
        await upsert_profile(processed, body.form_data)
    except Exception:
        pass  # Supabase persistence is best-effort; Hindsight is the source of truth

    return {"stored": len(observations)}


@router.get("/profile")
async def get_creator_profile() -> dict:
    """Return the saved creator profile (form_data for UI, processed fields for AI)."""
    try:
        row = await get_profile()
        if row:
            return {"has_profile": True, "profile": row}
    except Exception:
        pass
    return {"has_profile": False, "profile": None}


@router.get("/profile/status")
async def get_profile_status() -> dict:
    """Check if creator profile has been set up."""
    result = await recall_memories(
        "creator profile niche platform style audience"
    )
    has_profile = any(
        "creator profile" in item.lower()
        for item in result.get("recall_items", [])
    )
    return {"has_profile": has_profile}


# ---------------------------------------------------------------------------
# Clip serving + on-demand 9:16 export
# ---------------------------------------------------------------------------

@router.get("/clips/{project_id}/{moment_id}.mp4")
async def serve_clip(project_id: str, moment_id: str) -> FileResponse:
    """Serve extracted source-aspect MP4 clip files."""
    settings = get_settings()
    clip_path = Path(settings.clip_storage_path) / project_id / f"{moment_id}.mp4"
    if not clip_path.exists():
        raise HTTPException(status_code=404, detail="Clip not found")
    return FileResponse(str(clip_path), media_type="video/mp4")


@router.post("/clips/{project_id}/{moment_id}/export")
async def export_clip_vertical(project_id: str, moment_id: str) -> dict:
    """Generate a 9:16 vertical version of the clip on demand. Returns the URL."""
    import asyncio as _asyncio
    from app.infrastructure.clip_extraction import _crop_to_vertical_on_demand

    settings = get_settings()
    src = str(Path(settings.clip_storage_path) / project_id / f"{moment_id}.mp4")
    dst = str(Path(settings.clip_storage_path) / project_id / f"{moment_id}_9x16.mp4")

    if not Path(src).exists():
        raise HTTPException(status_code=404, detail="Source clip missing — process the project first")

    if not Path(dst).exists():
        try:
            await _asyncio.to_thread(_crop_to_vertical_on_demand, src, dst)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Crop failed: {exc}")

    return {"url": f"/api/clips/{project_id}/{moment_id}_9x16.mp4"}


# ---------------------------------------------------------------------------
# Derivatives
# ---------------------------------------------------------------------------

@router.patch("/derivatives/{derivative_id}", response_model=DerivativeResponse)
async def edit_derivative(
    derivative_id: UUID,
    body: UpdateDerivativeRequest,
    background_tasks: BackgroundTasks,
) -> DerivativeResponse:
    # Capture original content before overwriting it
    from app.infrastructure.supabase import get_derivative
    original = await get_derivative(str(derivative_id))

    derivative = await update_derivative_content(str(derivative_id), body.content)
    if not derivative:
        raise HTTPException(status_code=404, detail="Derivative not found")

    # Fire-and-forget: immediately push an edit observation to Hindsight
    if original and original.get("content") != body.content:
        creator_name, styles = await _get_creator_info()
        background_tasks.add_task(
            retain_diff_observation,
            before=original["content"],
            after=body.content,
            platform=derivative["platform"],
            content_type=derivative["content_type"],
            creator_name=creator_name,
            styles=styles,
        )

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
    creator_name, styles = await _get_creator_info()
    await retain_observation(
        f"Creator approved {derivative['platform']} {derivative['content_type']} without changes",
        tags=build_tags(
            creator_name=creator_name,
            styles=styles,
            platforms=[derivative["platform"]],
            content_type=derivative["content_type"],
            event="approve",
        ),
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
    creator_name, styles = await _get_creator_info()
    await retain_observation(
        f"Creator rejected {derivative['platform']} {derivative['content_type']}",
        tags=build_tags(
            creator_name=creator_name,
            styles=styles,
            platforms=[derivative["platform"]],
            content_type=derivative["content_type"],
            event="reject",
        ),
    )
    return DerivativeResponse(**derivative)


@router.post("/derivatives/{derivative_id}/regenerate", response_model=DerivativeResponse)
async def regenerate_derivative(
    derivative_id: UUID,
    body: RegenerateDerivativeRequest,
    background_tasks: BackgroundTasks,
) -> DerivativeResponse:
    derivative = await regenerate_single_derivative(
        str(derivative_id),
        guidance=body.guidance,
        section=getattr(body, "section", None),
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
    creator_name, styles = await _get_creator_info()
    await retain_observation(
        f"Creator regenerated {derivative['platform']} {derivative['content_type']}"
        + (f" with guidance: {body.guidance}" if body.guidance else ""),
        tags=build_tags(
            creator_name=creator_name,
            styles=styles,
            platforms=[derivative["platform"]],
            content_type=derivative["content_type"],
            event="regenerate",
        ),
    )
    return DerivativeResponse(**derivative)


# ---------------------------------------------------------------------------
# Intelligence graph
# ---------------------------------------------------------------------------

@router.get("/intelligence/graph")
async def get_intelligence_graph_global() -> dict:
    """
    Build a real-time knowledge graph from all Hindsight memories.
    Runs 3 parallel recall queries, deduplicates by text, and preserves
    real Hindsight tags + timestamps so Table/Timeline views show accurate data.
    """
    import asyncio

    queries = [
        "creator voice style tone platform niche audience",
        "editing behaviour hook approve reject regenerate shorten rewrite",
        "creator profile never use avoid content preference patterns",
    ]
    results = await asyncio.gather(
        *[recall_memories_rich(q) for q in queries],
        return_exceptions=True,
    )

    seen: set[str] = set()
    all_items: list[dict] = []
    for r in results:
        if isinstance(r, Exception):
            continue
        for item in r:
            if item["text"] not in seen:
                seen.add(item["text"])
                all_items.append(item)

    graph = _build_intelligence_graph(all_items)
    return graph


@router.get("/intelligence/reflect")
async def get_intelligence_reflect() -> dict:
    """
    Return a fresh creator synthesis + live memory count by calling
    Hindsight reflect_on_creator() on demand. Used by the Intelligence Panel
    to stay up-to-date after onboarding or new memories are stored.
    """
    from app.infrastructure.hindsight import reflect_on_creator, recall_memories

    reflection_task = reflect_on_creator(
        query="Summarise this creator's content preferences, persona, and style."
    )
    recall_task = recall_memories(
        query="creator voice style tone platform niche audience"
    )
    import asyncio
    reflection, recall = await asyncio.gather(reflection_task, recall_task, return_exceptions=True)

    return {
        "reflection": reflection if isinstance(reflection, str) else "",
        "recall_count": recall.get("recall_count", 0) if isinstance(recall, dict) else 0,
        "recall_items": recall.get("recall_items", []) if isinstance(recall, dict) else [],
    }
