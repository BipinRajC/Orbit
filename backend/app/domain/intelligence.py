"""Intelligence layer placeholders.

This module exposes the surfaces the frontend depends on for the
"Intelligence Layer" rollout (onboarding preferences, knowledge graph,
edit-diff adaptation, long-video chunking strategy). Real implementations
will land in subsequent PRs — for now these return deterministic stubs so
that the UI can be built end-to-end.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


# ---------------------------------------------------------------------------
# Onboarding preferences (collected over 2 stages)
# ---------------------------------------------------------------------------

# In-memory store keyed by user id. Replaced by Supabase table in production.
_PREFERENCES: dict[str, dict[str, Any]] = {}


async def save_preferences(user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Persist onboarding answers. TODO: write to Supabase `user_preferences`."""
    existing = _PREFERENCES.get(user_id, {})
    existing.update(payload)
    existing["updated_at"] = datetime.now(timezone.utc).isoformat()
    _PREFERENCES[user_id] = existing
    return existing


async def get_preferences(user_id: str) -> dict[str, Any]:
    return _PREFERENCES.get(user_id, {})


# ---------------------------------------------------------------------------
# Knowledge graph (memory visualization)
# ---------------------------------------------------------------------------

async def build_intelligence_graph(project_id: str) -> dict[str, Any]:
    """Return a node/edge graph describing what the model "knows" about the creator.

    Placeholder shape:
        {
          "nodes": [{ "id", "label", "kind", "weight" }],
          "edges": [{ "source", "target", "kind" }],
          "stats": { "memories": int, "biases": int, "edits": int }
        }
    """
    # TODO: assemble from hindsight memory bank + editing_events table.
    nodes = [
        {"id": "creator", "label": "Creator Voice", "kind": "root", "weight": 1.0},
        {"id": "tone-direct", "label": "Direct tone", "kind": "trait", "weight": 0.72},
        {"id": "tone-warm", "label": "Warm phrasing", "kind": "trait", "weight": 0.61},
        {"id": "platform-twitter", "label": "Twitter", "kind": "platform", "weight": 0.85},
        {"id": "platform-shorts", "label": "Short-form video", "kind": "platform", "weight": 0.55},
        {"id": "edit-shorter-hooks", "label": "Prefers shorter hooks", "kind": "preference", "weight": 0.78},
        {"id": "edit-no-emoji", "label": "Avoids emoji", "kind": "preference", "weight": 0.42},
        {"id": "topic-ai", "label": "AI / Tech", "kind": "topic", "weight": 0.90},
    ]
    edges = [
        {"source": "creator", "target": "tone-direct", "kind": "expresses"},
        {"source": "creator", "target": "tone-warm", "kind": "expresses"},
        {"source": "creator", "target": "platform-twitter", "kind": "posts_on"},
        {"source": "creator", "target": "platform-shorts", "kind": "posts_on"},
        {"source": "platform-twitter", "target": "edit-shorter-hooks", "kind": "shaped_by"},
        {"source": "platform-twitter", "target": "edit-no-emoji", "kind": "shaped_by"},
        {"source": "creator", "target": "topic-ai", "kind": "focuses_on"},
        {"source": "tone-direct", "target": "edit-shorter-hooks", "kind": "reinforces"},
    ]
    stats = {"memories": len(nodes) - 1, "biases": len(edges), "edits": 12}
    return {"project_id": project_id, "nodes": nodes, "edges": edges, "stats": stats}


# ---------------------------------------------------------------------------
# Edit diff → adaptive learning
# ---------------------------------------------------------------------------

async def record_edit_diff(
    derivative_id: str,
    before: str,
    after: str,
) -> dict[str, Any]:
    """Compare before/after and surface the change signal back to the user.

    Placeholder: returns a heuristic summary. TODO: feed into hindsight as an
    observation so future generations skew toward the creator's edits.
    """
    delta = len(after) - len(before)
    return {
        "derivative_id": derivative_id,
        "char_delta": delta,
        "shortened": delta < 0,
        "summary": (
            "Creator tightened the draft — biasing future hooks toward fewer words."
            if delta < 0
            else "Creator expanded the draft — biasing future hooks toward richer phrasing."
        ),
        "applied_to_memory": True,
    }


# ---------------------------------------------------------------------------
# Long-video chunking strategy
# ---------------------------------------------------------------------------

def pick_chunking_strategy(duration_seconds: int) -> dict[str, Any]:
    """Choose how to slice a video for moment detection.

    TODO: replace with learned heuristic. Long videos currently bias toward
    initial-chunking (scan from the start) which misses late-video gold.
    """
    if duration_seconds < 600:  # < 10 min
        strategy = "whole"
    elif duration_seconds < 1800:  # < 30 min
        strategy = "uniform"
    else:
        strategy = "initial"  # known bias — flagged for future fix
    return {
        "duration_seconds": duration_seconds,
        "strategy": strategy,
        "biased": strategy == "initial",
        "note": "Long videos currently scan the first third — full coverage coming soon.",
    }
