"""Derivative generation — per-platform production briefs via Claude Sonnet 4.5."""
from __future__ import annotations

import asyncio
import json
from typing import Any

from app.infrastructure.anthropic import SONNET_MODEL, structured_call
from app.infrastructure.supabase import (
    get_derivative,
    get_moment,
    update_derivative_content,
    update_derivative_status,
)

# ---------------------------------------------------------------------------
# Platform specs injected into each generation prompt
# ---------------------------------------------------------------------------

PLATFORM_SPECS = {
    "instagram_reels": (
        "Instagram Reels — 30-60s vertical 9:16. "
        "Fast-paced, visual-first. Hook = pattern interrupt or text overlay. "
        "Viewers decide in 2s. Energy must be high from frame 1."
    ),
    "youtube_shorts": (
        "YouTube Shorts — 30-60s vertical 9:16. "
        "Story-driven, slightly educational. Hook = bold claim or intriguing question. "
        "Viewers tolerate a slightly slower build."
    ),
    "linkedin": (
        "LinkedIn — 30-90s vertical video. "
        "Professional but human. Hook = contrarian take or specific data point. "
        "Value-first, insight-driven. Viewer is a professional with 2 minutes."
    ),
}

# ---------------------------------------------------------------------------
# Output schema (shared across all platforms)
# ---------------------------------------------------------------------------

BRIEF_SCHEMA = {
    "type": "object",
    "required": ["hook", "angle", "script", "cta", "higgsfield_prompt", "editing_notes"],
    "properties": {
        "hook": {
            "type": "string",
            "description": "Opening line — max 15 words. Must stop the scroll instantly.",
        },
        "angle": {
            "type": "string",
            "description": "The specific lens or framing for this platform's audience.",
        },
        "script": {
            "type": "object",
            "required": ["opening", "body", "closer"],
            "properties": {
                "opening": {
                    "type": "string",
                    "description": "First 3 seconds — what creator says/does. Include [TEXT OVERLAY] cues.",
                },
                "body": {
                    "type": "string",
                    "description": "Main content — spoken script with [CUT], [PAUSE], [EMPHASIS] cues.",
                },
                "closer": {
                    "type": "string",
                    "description": "Final beat — the landing moment. Must feel complete, not cut off.",
                },
            },
        },
        "cta": {
            "type": "string",
            "description": "Call to action — 1 sentence, platform-appropriate.",
        },
        "higgsfield_prompt": {
            "type": "string",
            "description": (
                "Higgsfield AI visual prompt: subject, camera angle, movement, "
                "lighting, mood, aspect ratio 9:16, cinematic grade."
            ),
        },
        "editing_notes": {
            "type": "string",
            "description": "Editor instructions: pacing, text overlays, music cues, transitions.",
        },
    },
}

GENERATION_SYSTEM = """\
You are a world-class short-form content strategist and scriptwriter.

Given a strong moment from a creator's long-form content and a target platform, \
you produce a single production-ready brief the creator or their editor can \
film and edit directly.

Rules:
- Scripts must sound NATURAL and CONVERSATIONAL — not like marketing copy
- Every word earns its place — no filler, no hedging
- The hook must be the actual first words of the clip (not a rewritten version)
- The closer must feel intentional — an insight, punchline, or emotional beat
- Editing cues like [CUT], [PAUSE], [TEXT OVERLAY] are directions, not spoken aloud
- The higgsfield_prompt generates a visual if the creator needs b-roll or a thumbnail
"""


async def generate_brief_for_platform(
    moment: dict[str, Any],
    platform: str,
    memory_reflection: str = "",
) -> dict[str, Any] | None:
    """
    Generate a single production brief for one platform using Claude Sonnet 4.5.
    Returns a derivative dict ready for DB insertion, or None on failure.
    """
    spec = PLATFORM_SPECS.get(platform, "")
    snippet = moment.get("transcript_snippet", "")
    narrative = moment.get("narrative_summary") or moment.get("selection_rationale", "")
    hook_potential = moment.get("hook_potential", "")

    # Build timestamps string — handle multi-segment
    segs = moment.get("segments")
    if segs:
        ts_parts = [f"{s['start']:.1f}s–{s['end']:.1f}s" for s in segs]
        timestamps = " + ".join(ts_parts)
    else:
        timestamps = f"{moment.get('start_timestamp', 0):.1f}s–{moment.get('end_timestamp', 0):.1f}s"

    memory_section = (
        f"## Creator Voice & Preferences\n{memory_reflection}\n\n"
        if memory_reflection
        else ""
    )

    user_prompt = (
        f"{memory_section}"
        f"## Platform\n{spec}\n\n"
        f"## Source Clip\n"
        f"Timestamps: {timestamps}\n"
        f'Opening words: "{snippet}"\n\n'
        f"Narrative arc: {narrative}\n"
        f"Hook potential: {hook_potential}\n\n"
        "Generate the production brief for this platform using the generate_brief tool."
    )

    try:
        result = await structured_call(
            model=SONNET_MODEL,
            system=GENERATION_SYSTEM,
            user=user_prompt,
            tool_name="generate_brief",
            tool_description=f"Generate a production-ready brief for {platform}.",
            input_schema=BRIEF_SCHEMA,
            max_tokens=2048,
            temperature=0.8,
        )
    except Exception as exc:
        import logging
        logging.getLogger("contentos.generation").error(
            "Brief generation failed for %s: %s", platform, exc
        )
        return None

    # Flatten script sub-object for storage compatibility
    script = result.get("script", {})
    content = {
        "hook": result.get("hook", ""),
        "angle": result.get("angle", ""),
        "script": {
            "opening": script.get("opening", ""),
            "body": script.get("body", ""),
            "closer": script.get("closer", ""),
        },
        "cta": result.get("cta", ""),
        "higgsfield_prompt": result.get("higgsfield_prompt", ""),
        "editing_notes": result.get("editing_notes", ""),
    }

    return {
        "platform": platform,
        "content_type": "production_brief",
        "content": json.dumps(content),
        "model": SONNET_MODEL,
    }


async def generate_derivatives_for_moment(
    project_id: str,
    moment: dict[str, Any],
    memory_reflection: str = "",
    target_platforms: list[str] | None = None,
) -> list[dict[str, Any]]:
    """
    Generate production briefs for a single moment across selected platforms.
    Calls are made concurrently (no Groq rate-limit concern with Anthropic).
    Returns list of derivative dicts ready for DB insertion.
    """
    from app.config import get_settings
    platforms = target_platforms or get_settings().default_platforms

    tasks = [
        generate_brief_for_platform(moment, platform, memory_reflection)
        for platform in platforms
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    derivatives = []
    for r in results:
        if isinstance(r, dict):
            derivatives.append(r)
    return derivatives


# ---------------------------------------------------------------------------
# Single derivative regeneration (used by the /regenerate endpoint)
# ---------------------------------------------------------------------------

REGEN_SYSTEM = """\
You are regenerating a production brief for a single platform.
Apply the creator's guidance while keeping the original moment's essence.
Return an improved brief using the generate_brief tool.
"""

PLATFORM_NOTES = {
    "instagram_reels": PLATFORM_SPECS["instagram_reels"],
    "youtube_shorts": PLATFORM_SPECS["youtube_shorts"],
    "linkedin": PLATFORM_SPECS["linkedin"],
}


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

    platform = derivative["platform"]
    spec = PLATFORM_NOTES.get(platform, "")
    snippet = moment.get("transcript_snippet", "")
    narrative = moment.get("narrative_summary") or moment.get("selection_rationale", "")

    segs = moment.get("segments")
    if segs:
        ts_parts = [f"{s['start']:.1f}s–{s['end']:.1f}s" for s in segs]
        timestamps = " + ".join(ts_parts)
    else:
        timestamps = f"{moment.get('start_timestamp', 0):.1f}s–{moment.get('end_timestamp', 0):.1f}s"

    guidance_section = (
        f"\n\n## Creator Guidance\n{guidance}"
        if guidance
        else ""
    )

    user_prompt = (
        f"## Platform\n{spec}\n\n"
        f"## Source Clip\nTimestamps: {timestamps}\n"
        f'Opening words: "{snippet}"\nNarrative arc: {narrative}'
        f"{guidance_section}\n\n"
        "Regenerate the production brief using the generate_brief tool."
    )

    try:
        result = await structured_call(
            model=SONNET_MODEL,
            system=REGEN_SYSTEM,
            user=user_prompt,
            tool_name="generate_brief",
            tool_description=f"Regenerate the production brief for {platform}.",
            input_schema=BRIEF_SCHEMA,
            max_tokens=2048,
            temperature=0.9,
        )
    except Exception:
        return None

    script = result.get("script", {})
    new_content = {
        "hook": result.get("hook", ""),
        "angle": result.get("angle", ""),
        "script": {
            "opening": script.get("opening", ""),
            "body": script.get("body", ""),
            "closer": script.get("closer", ""),
        },
        "cta": result.get("cta", ""),
        "higgsfield_prompt": result.get("higgsfield_prompt", ""),
        "editing_notes": result.get("editing_notes", ""),
    }

    updated = await update_derivative_content(derivative_id, json.dumps(new_content))
    if updated:
        await update_derivative_status(derivative_id, "draft")
    return updated
