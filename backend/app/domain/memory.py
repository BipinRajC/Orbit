"""
Memory synthesis — analyse editing events and extract style observations.
Called after a creator completes their review of a project.
"""
from __future__ import annotations

import json
import re
from typing import Any

from app.infrastructure.cascadeflow import get_synthesis_agent, run_prompt
from app.infrastructure.hindsight import retain_observation
from app.infrastructure.supabase import (
    get_editing_events_for_project,
    update_project_status,
)
from app.domain.tags import build_tags

SYNTHESIS_SYSTEM = """\
You are analysing a content creator's editing behaviour from their review session.
Your job is to extract precise, actionable observations about their creative preferences.

Focus on:
- Hook style: what openings did they approve vs reject? Question hooks? Bold claims? "Stop X" patterns?
- Length: did they shorten tweets? By how much? Preferred character range?
- Tone: conversational vs formal, first-person vs passive, punchy vs elaborate?
- Specific words/phrases removed or added repeatedly
- Platform-specific patterns (LinkedIn differs from Instagram)
- What they regenerated and with what guidance — this reveals strong dislikes
- Approval patterns: which hooks/tweets did they keep unchanged?

Return ONLY a JSON array of 6-10 observation strings.
Each observation must be:
- A single, specific, actionable sentence
- Concrete enough to change a generation prompt (not "prefers shorter content")
- Named with the specific behaviour: "Creator ALWAYS...", "Creator NEVER...", "Creator shortens tweets to under X chars..."

No markdown, no explanation outside the JSON array.

Good examples:
[
  "Creator always approves question-style hooks beginning with 'What if' or 'Why does' — never rejects them.",
  "Creator rejects every hook starting with aggressive imperatives like 'Stop doing X' or 'You need to X'.",
  "Creator shortens AI-generated tweets to under 120 characters by cutting trailing context.",
  "Creator removes filler words 'basically', 'essentially', 'actually' from every edited draft.",
  "Creator prefers first-person direct statements over passive or third-person constructions.",
  "Creator approves LinkedIn posts with a specific data point or contrarian claim in the opening line.",
  "Creator regenerates hooks that start with 'In this video' or 'Today I want to talk about' — never keeps them."
]
"""


async def synthesize_and_store_observations(project_id: str) -> int:
    """
    Main entry point: analyse a project's editing events and store
    observations in Hindsight memory. Returns count of stored observations.
    """
    events = await get_editing_events_for_project(project_id)

    # Fetch creator profile for structured tags
    creator_name: str | None = None
    styles: list[str] = []
    try:
        from app.infrastructure.supabase import _db
        prof_res = _db().table("creator_profiles").select(
            "creator_name, styles"
        ).eq("id", "default").execute()
        if prof_res.data:
            creator_name = prof_res.data[0].get("creator_name")
            styles = prof_res.data[0].get("styles") or []
    except Exception:
        pass

    if not events:
        await update_project_status(
            project_id,
            status="archived",
            log_entry={
                "stage": "memory_synthesis",
                "message": "Review completed with no edits — no observations extracted",
            },
        )
        return 0

    summary = _build_events_summary(events)
    if not summary.strip():
        return 0

    agent = get_synthesis_agent()
    raw = await run_prompt(
        agent=agent,
        system=SYNTHESIS_SYSTEM,
        user=f"## Editing Events\n{summary}\n\nExtract creator preference observations.",
    )

    observations = _parse_observations(raw)

    obs_tags = build_tags(
        creator_name=creator_name,
        styles=styles,
        event="complete-review",
        extra=["editing-behaviour", f"project-{project_id[:8]}"],
    )
    for obs in observations:
        await retain_observation(obs, tags=obs_tags)

    # Mark project as archived (review complete)
    await update_project_status(
        project_id,
        status="archived",
        log_entry={
            "stage": "memory_synthesis",
            "message": f"Stored {len(observations)} persona observations from review",
        },
    )
    return len(observations)


def _build_events_summary(events: list[dict[str, Any]]) -> str:
    """Convert raw editing events into a human-readable summary for the LLM."""
    lines = []
    for ev in events:
        event_type = ev.get("event_type", "unknown")
        platform = ev.get("platform", "")
        content_type = ev.get("content_type", "")
        before = ev.get("before_content", "")
        after = ev.get("after_content", "")
        guidance = ev.get("regeneration_guidance", "")

        if event_type == "edit" and before and after:
            lines.append(
                f"EDIT [{platform}/{content_type}]\n"
                f'  Before: "{before[:150]}"\n'
                f'  After:  "{after[:150]}"'
            )
        elif event_type == "approve":
            lines.append(f"APPROVED [{platform}/{content_type}]")
        elif event_type == "reject":
            lines.append(f"REJECTED [{platform}/{content_type}]")
        elif event_type == "regenerate":
            note = f' with guidance: "{guidance}"' if guidance else ""
            lines.append(f"REGENERATED [{platform}/{content_type}]{note}")

    return "\n\n".join(lines)


def _parse_observations(raw: str) -> list[str]:
    cleaned = re.sub(r"```(?:json)?", "", raw).strip()
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return [str(x).strip() for x in data if x]
    except json.JSONDecodeError:
        match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
    return []


async def retain_diff_observation(
    before: str,
    after: str,
    platform: str,
    content_type: str,
    creator_name: str | None = None,
    styles: list[str] | None = None,
) -> None:
    """Immediately store a Hindsight observation derived from a single draft edit.

    Called in the background every time a creator saves an edited draft so the
    memory bank reflects editing behaviour in real-time — not just after a formal
    review session.
    """
    if not before or not after or before.strip() == after.strip():
        return

    before_words = before.split()
    after_words  = after.split()
    delta        = len(after_words) - len(before_words)
    pct          = abs(delta) / max(len(before_words), 1) * 100

    if delta < -10 or pct > 30:
        action = "significantly shortened"
    elif delta < 0:
        action = "trimmed"
    elif delta > 10 or pct > 30:
        action = "significantly expanded"
    elif delta > 0:
        action = "slightly expanded"
    else:
        action = "rewrote (same length)"

    # Truncate content previews for the observation
    before_preview = before[:160].rstrip() + ("…" if len(before) > 160 else "")
    after_preview  = after[:160].rstrip()  + ("…" if len(after)  > 160 else "")

    observation = (
        f"Creator {action} a {platform} {content_type} draft. "
        f"Before ({len(before_words)} words): \"{before_preview}\" → "
        f"After ({len(after_words)} words): \"{after_preview}\""
    )

    tags = build_tags(
        creator_name=creator_name,
        styles=styles,
        platforms=[platform],
        content_type=content_type,
        event="edit",
        extra=["editing-behaviour", "draft-edit"],
    )
    await retain_observation(observation, tags=tags)
