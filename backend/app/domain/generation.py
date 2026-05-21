"""Derivative generation — per-platform short-form deliverables via Claude Sonnet 4.5."""
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
# Platform specs — detailed rules injected into each generation prompt
# ---------------------------------------------------------------------------

PLATFORM_SPECS: dict[str, dict] = {
    "instagram_reels": {
        "name": "Instagram Reels",
        "duration": "15-60s sweet spot",
        "title_rule": "8-12 words, hooky, no clickbait emoji",
        "description_rule": "Reels has no separate description — set to same as caption",
        "caption_rule": "2200 char max but FRONT-LOAD the hook in first 125 chars. End with 5-8 niche hashtags. Use line breaks for scannability.",
        "spoken_script_rule": "Hook in first 1.5s. Punchy delivery. Pattern interrupts every 3-5s.",
        "editor_notes_rule": "Jump cuts, dynamic captions (Instagram-style yellow/white), trending audio mention, vertical 9:16.",
    },
    "youtube_shorts": {
        "name": "YouTube Shorts",
        "duration": "30-60s",
        "title_rule": "Max 100 chars. Question-led or curiosity-gap.",
        "description_rule": "200-500 chars. First 2 lines are the hook (appears above 'more'). Include 2-3 relevant hashtags at end. Can include channel link / playlist link.",
        "caption_rule": "Same as description for Shorts (no separate caption field on YT). Set equal to description.",
        "spoken_script_rule": "Hook in first 3s. Closes with subscribe CTA or rhetorical question.",
        "editor_notes_rule": "Captions burned-in (YouTube auto-captions are unreliable for Shorts). Vertical 9:16. No black bars.",
    },
    "tiktok": {
        "name": "TikTok",
        "duration": "21-34s sweet spot (TikTok algorithm preference)",
        "title_rule": "Not used by TikTok — set to a 6-10 word internal label for the creator.",
        "description_rule": "Same as caption for TikTok (TikTok has only the caption field).",
        "caption_rule": "150 char max. First sentence is the hook. End with 3-5 hashtags MIXING one big trend hashtag + niche tags. Mention trending sound if applicable.",
        "spoken_script_rule": "Hook in first 1s. TikTok scroll is brutal. Pattern interrupt at 3s, 8s, 15s.",
        "editor_notes_rule": "Suggest trending sound category (e.g., 'use a chill lo-fi beat trending in [niche]'). Auto-captions ON. Vertical 9:16. Quick cuts.",
    },
    "linkedin": {
        "name": "LinkedIn",
        "duration": "30-90s (LinkedIn tolerates longer)",
        "title_rule": "Professional headline, 6-12 words. No clickbait. Curiosity + value framing.",
        "description_rule": "Not used separately on LinkedIn — set equal to caption.",
        "caption_rule": "1500-3000 chars. Open with a contrarian or insightful one-liner. Use line breaks every 1-2 sentences. End with a question to drive comments. Hashtags: 3-5 professional tags at end.",
        "spoken_script_rule": "Polished but conversational. Front-load the insight. No 'guys', no 'what's up'.",
        "editor_notes_rule": "Captions burned-in (LinkedIn autoplay is muted). 9:16 or 1:1 both work. Clean transitions, no jump-cut chaos.",
    },
}

# ---------------------------------------------------------------------------
# Unified ShortFormDeliverable schema (all platforms)
# ---------------------------------------------------------------------------

DELIVERABLE_SCHEMA = {
    "type": "object",
    "required": ["title", "description", "caption", "spoken_script",
                 "why_this_clip", "visual_direction", "editor_notes"],
    "properties": {
        "title": {
            "type": "string",
            "description": "Platform-native short title / headline for the clip. Catchy, not the long-form video title.",
        },
        "description": {
            "type": "string",
            "description": (
                "The post description text the creator pastes into the platform's "
                "'description' field. Length and tone per PLATFORM rules. NOT the spoken script."
            ),
        },
        "caption": {
            "type": "string",
            "description": (
                "Social caption (the text people read on the post itself). Includes hashtags / "
                "mentions / line breaks per PLATFORM rules."
            ),
        },
        "spoken_script": {
            "type": "string",
            "description": (
                "What the creator says on camera, in their voice, with stage directions "
                "in brackets: [CUT], [PAUSE 0.5s], [EMPHASIS], [TEXT OVERLAY: ...]. "
                "Should be performable as-is."
            ),
        },
        "why_this_clip": {
            "type": "string",
            "description": (
                "2-3 sentences explaining to the creator WHY this moment was chosen — "
                "specific narrative arc, hook quality, emotional beat, or persona fit. "
                "Convinces the creator to trust the pick."
            ),
        },
        "visual_direction": {
            "type": "string",
            "description": (
                "Tool-agnostic visual prompt for AI generators (Higgsfield / Veo 3 / Kling / "
                "Seedance / Google Omni / GPT Image). 9:16 aspect, describe scene, lighting, "
                "subject, mood, b-roll cuts, thumbnail style. No tool-specific syntax."
            ),
        },
        "editor_notes": {
            "type": "string",
            "description": (
                "Instructions for an AI video editor: cut points, transitions, on-screen "
                "caption styling, zoom moments, sound design / music vibe, pacing. "
                "Specific and actionable."
            ),
        },
    },
}


def _build_generation_prompt(platform: str, moment: dict, persona_reflection: str | None) -> str:
    spec = PLATFORM_SPECS.get(platform, {})
    persona_block = (
        f"\n## Creator persona (from long-term memory)\n{persona_reflection}\n"
        if persona_reflection else ""
    )
    start = moment.get("start_timestamp", 0)
    end = moment.get("end_timestamp", 0)
    return f"""You are producing ONE polished, copy-pasteable short-form deliverable for {spec.get('name', platform)}.

The creator is a YouTube long-form creator turning a moment from their long video into a short.
Your output must be SO COMPLETE that the creator can use it without further editing.
{persona_block}
## Platform rules for {spec.get('name', platform)}
- Duration: {spec.get('duration')}
- Title: {spec.get('title_rule')}
- Description: {spec.get('description_rule')}
- Caption: {spec.get('caption_rule')}
- Spoken script: {spec.get('spoken_script_rule')}
- Editor notes: {spec.get('editor_notes_rule')}

## The clip
- Time range: {start:.1f}s \u2013 {end:.1f}s
- Transcript excerpt: {moment.get('transcript_snippet', '')[:500]}
- Why this moment (extractor's note): {moment.get('selection_rationale', '')}
- Narrative summary: {moment.get('narrative_summary', '')}
- Hook potential: {moment.get('hook_potential', '')}

## Output instructions
Call the `generate_deliverable` tool with all 7 fields. Be specific. No placeholders.
The creator's persona MUST come through in every field \u2014 match their style and energy.
"""


async def generate_deliverable_for_platform(
    moment: dict[str, Any],
    platform: str,
    memory_reflection: str = "",
) -> dict[str, Any] | None:
    """
    Generate a single short-form deliverable for one platform using Claude Sonnet 4.5.
    Returns a derivative dict ready for DB insertion, or None on failure.
    """
    user_prompt = _build_generation_prompt(platform, moment, memory_reflection or None)

    try:
        result = await structured_call(
            model=SONNET_MODEL,
            system="You are a world-class short-form content strategist. Produce copy-pasteable deliverables.",
            user=user_prompt,
            tool_name="generate_deliverable",
            tool_description=f"Generate a complete short-form deliverable for {platform}.",
            input_schema=DELIVERABLE_SCHEMA,
            max_tokens=6000,
            temperature=0.8,
        )
    except Exception as exc:
        import logging
        logging.getLogger("orbitos.generation").error(
            "Deliverable generation failed for %s: %s", platform, exc
        )
        return None

    content = {
        "title": result.get("title", ""),
        "description": result.get("description", ""),
        "caption": result.get("caption", ""),
        "spoken_script": result.get("spoken_script", ""),
        "why_this_clip": result.get("why_this_clip", ""),
        "visual_direction": result.get("visual_direction", ""),
        "editor_notes": result.get("editor_notes", ""),
    }

    return {
        "platform": platform,
        "content_type": "short_form_deliverable",
        "content": json.dumps(content),
        "model": SONNET_MODEL,
    }


# Keep legacy alias so existing call sites don't break immediately
generate_brief_for_platform = generate_deliverable_for_platform


async def generate_derivatives_for_moment(
    project_id: str,
    moment: dict[str, Any],
    memory_reflection: str = "",
    target_platforms: list[str] | None = None,
) -> list[dict[str, Any]]:
    """
    Generate short-form deliverables for a single moment across all target platforms.
    Calls are made concurrently.
    """
    from app.config import get_settings
    platforms = target_platforms or get_settings().default_platforms

    tasks = [
        generate_deliverable_for_platform(moment, platform, memory_reflection)
        for platform in platforms
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    derivatives = []
    for r in results:
        if isinstance(r, dict):
            derivatives.append(r)
    return derivatives


# ---------------------------------------------------------------------------
# Single derivative regeneration
# ---------------------------------------------------------------------------

REGEN_SYSTEM = """\
You are regenerating a short-form deliverable for a single platform.
Apply the creator's guidance while keeping the original moment's essence.
Return a complete improved deliverable using the generate_deliverable tool.
All 7 fields must be present even if only one was targeted.
"""


async def regenerate_single_derivative(
    derivative_id: str,
    guidance: str | None = None,
    section: str | None = None,
) -> dict[str, Any] | None:
    """
    Regenerate a single derivative, optionally with creator guidance.
    If section is provided, instruct Claude to focus on that field only
    but still return the full 7-field schema.
    """
    derivative = await get_derivative(derivative_id)
    if not derivative:
        return None

    moment = await get_moment(derivative["moment_id"])
    if not moment:
        return None

    platform = derivative["platform"]
    spec = PLATFORM_SPECS.get(platform, {})

    start = moment.get("start_timestamp", 0)
    end = moment.get("end_timestamp", 0)
    snippet = moment.get("transcript_snippet", "")
    narrative = moment.get("narrative_summary") or moment.get("selection_rationale", "")

    # Include existing content so Claude can preserve unchanged fields
    existing_content = {}
    try:
        existing_content = json.loads(derivative.get("content", "{}"))
    except Exception:
        pass

    section_instruction = (
        f"\n\nFocus your changes on the `{section}` field. Keep other fields as close to the existing content as possible."
        if section else ""
    )
    guidance_section = (
        f"\n\n## Creator guidance\n{guidance}"
        if guidance else ""
    )

    user_prompt = (
        f"## Platform: {spec.get('name', platform)}\n"
        f"Duration: {spec.get('duration', '')}\n\n"
        f"## Source clip\n"
        f"Time: {start:.1f}s – {end:.1f}s\n"
        f'Transcript: "{snippet}"\n'
        f"Narrative: {narrative}\n"
        f"\n## Existing deliverable (preserve unchanged fields)\n"
        f"{json.dumps(existing_content, indent=2)}"
        f"{guidance_section}"
        f"{section_instruction}\n\n"
        "Return the full improved deliverable using the generate_deliverable tool."
    )

    try:
        result = await structured_call(
            model=SONNET_MODEL,
            system=REGEN_SYSTEM,
            user=user_prompt,
            tool_name="generate_deliverable",
            tool_description=f"Regenerate the short-form deliverable for {platform}.",
            input_schema=DELIVERABLE_SCHEMA,
            max_tokens=6000,
            temperature=0.9,
        )
    except Exception:
        return None

    new_content = {
        "title": result.get("title", ""),
        "description": result.get("description", ""),
        "caption": result.get("caption", ""),
        "spoken_script": result.get("spoken_script", ""),
        "why_this_clip": result.get("why_this_clip", ""),
        "visual_direction": result.get("visual_direction", ""),
        "editor_notes": result.get("editor_notes", ""),
    }

    updated = await update_derivative_content(derivative_id, json.dumps(new_content))
    if updated:
        await update_derivative_status(derivative_id, "draft")
    return updated
