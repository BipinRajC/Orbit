"""Derivative generation — hooks, tweets, short-form framing per moment."""
from __future__ import annotations

import asyncio
import json
import re
from typing import Any

from app.infrastructure.cascadeflow import (
    CostAccumulator,
    get_generation_agent,
    run_prompt,
)
from app.infrastructure.supabase import (
    get_derivative,
    insert_derivatives,
    get_moment,
    update_derivative_content,
    update_derivative_status,
)

# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

HOOK_SYSTEM = """\
You are generating short-form video hooks for a creator's audience.
A hook is the opening line/sentence that appears as text overlay or caption on a short video.
It must grab attention in the first 2 seconds.

Rules:
- 1-2 sentences maximum
- No generic phrases like "In this video..." or "Today we discuss..."
- Create curiosity, tension, or a strong claim
- Sound like the creator, not a marketer

Return ONLY a JSON array of 2-3 hook strings. No markdown, no explanation.
Example: ["Hook one here", "Different angle hook", "Question-style hook?"]
"""

TWEET_SYSTEM = """\
You are generating Twitter/X posts for a creator sharing a key insight.
The tweet should stand alone — readers haven't seen the video.

Rules:
- Under 280 characters preferred (under 240 to allow for a link)
- Conversational, direct, no hashtag spam (max 1 if truly relevant)
- The creator's voice: specific, opinionated, not vague
- No "🧵" or thread format — single tweet only

Return ONLY a JSON array of 1-2 tweet strings. No markdown, no explanation.
Example: ["Tweet one text", "Alternative angle tweet"]
"""

FRAMING_SYSTEM = """\
You are generating short-form video framing for a creator's clip.
"Framing" means: the caption/title text, the hook concept, and how to present this clip on TikTok/Reels/Shorts.

Return a single JSON object with these keys:
{
  "caption": "<main caption text, 1-2 sentences>",
  "hook_concept": "<what makes this clip shareable — 1 sentence>",
  "visual_direction": "<brief note on pacing/cut — 1 sentence>"
}

Return ONLY the JSON object. No markdown, no explanation.
"""


# ---------------------------------------------------------------------------
# Per-moment generation
# ---------------------------------------------------------------------------

async def generate_derivatives_for_moment(
    project_id: str,
    moment: dict[str, Any],
    memory_reflection: str = "",
    cost_acc: CostAccumulator | None = None,
) -> list[dict[str, Any]]:
    """
    Generate all derivatives (hooks, tweets, framing) for a single moment.
    Runs hook + tweet + framing generation in parallel.
    Returns list of derivative dicts ready for DB insertion.
    """
    snippet = moment["transcript_snippet"]
    rationale = moment["selection_rationale"]
    timestamps = f"{moment['start_timestamp']:.1f}s – {moment['end_timestamp']:.1f}s"

    memory_section = (
        f"## Creator Context (learned from past sessions)\n{memory_reflection}\n\n"
        if memory_reflection
        else ""
    )

    base_context = (
        f"{memory_section}"
        f"## Source Moment\n"
        f"Timestamp: {timestamps}\n"
        f'"{snippet}"\n\n'
        f"Selection rationale: {rationale}"
    )

    agent = get_generation_agent()

    hooks_raw, tweets_raw, framing_raw = await asyncio.gather(
        run_prompt(agent, HOOK_SYSTEM, base_context, cost_acc),
        run_prompt(agent, TWEET_SYSTEM, base_context, cost_acc),
        run_prompt(agent, FRAMING_SYSTEM, base_context, cost_acc),
    )

    derivatives: list[dict[str, Any]] = []

    # Parse hooks
    for hook in _parse_string_array(hooks_raw):
        derivatives.append({
            "platform": "short_form_video",
            "content_type": "hook",
            "content": hook,
            "model": "cascadeflow",
        })

    # Parse tweets
    for tweet in _parse_string_array(tweets_raw):
        derivatives.append({
            "platform": "twitter",
            "content_type": "tweet",
            "content": tweet,
            "model": "cascadeflow",
        })

    # Parse framing
    framing = _parse_framing(framing_raw)
    if framing:
        derivatives.append({
            "platform": "short_form_video",
            "content_type": "framing",
            "content": json.dumps(framing),
            "model": "cascadeflow",
        })

    return derivatives


# ---------------------------------------------------------------------------
# Single derivative regeneration (used by the /regenerate endpoint)
# ---------------------------------------------------------------------------

async def regenerate_single_derivative(
    derivative_id: str,
    guidance: str | None = None,
) -> dict[str, Any] | None:
    """Regenerate a single derivative, optionally with creator guidance."""
    derivative = await get_derivative(derivative_id)
    if not derivative:
        return None

    moment = await get_moment(derivative["moment_id"])
    if not moment:
        return None

    snippet = moment["transcript_snippet"]
    rationale = moment["selection_rationale"]
    timestamps = f"{moment['start_timestamp']:.1f}s – {moment['end_timestamp']:.1f}s"

    guidance_note = (
        f"\n\n## Creator Guidance for This Regeneration\n{guidance}"
        if guidance
        else ""
    )

    context = (
        f"## Source Moment\n"
        f"Timestamp: {timestamps}\n"
        f'"{snippet}"\n\n'
        f"Selection rationale: {rationale}"
        f"{guidance_note}"
    )

    system_map = {
        "hook": HOOK_SYSTEM,
        "tweet": TWEET_SYSTEM,
        "framing": FRAMING_SYSTEM,
        "caption": FRAMING_SYSTEM,
    }
    system = system_map.get(derivative["content_type"], HOOK_SYSTEM)

    agent = get_generation_agent()
    raw = await run_prompt(agent, system, context)

    # Parse based on type
    if derivative["content_type"] == "framing":
        parsed = _parse_framing(raw)
        new_content = json.dumps(parsed) if parsed else raw.strip()
    else:
        items = _parse_string_array(raw)
        new_content = items[0] if items else raw.strip()

    # Persist and return
    updated = await update_derivative_content(derivative_id, new_content)
    if updated:
        await update_derivative_status(derivative_id, "draft")
    return updated


# ---------------------------------------------------------------------------
# Parsers
# ---------------------------------------------------------------------------

def _parse_string_array(raw: str) -> list[str]:
    cleaned = re.sub(r"```(?:json)?", "", raw).strip()
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return [str(x).strip() for x in data if x]
    except json.JSONDecodeError:
        match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group())
                return [str(x).strip() for x in data if x]
            except Exception:
                pass
    # Last resort: return the raw text as a single item
    return [cleaned] if cleaned else []


def _parse_framing(raw: str) -> dict[str, str] | None:
    cleaned = re.sub(r"```(?:json)?", "", raw).strip()
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
    return None
