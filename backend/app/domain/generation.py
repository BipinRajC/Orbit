"""Derivative generation — production briefs per moment across platforms."""
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
# Cold-start CTA library (high-performing CTAs from top creators)
# Hindsight memory will learn creator-specific CTAs over time
# ---------------------------------------------------------------------------

COLD_START_CTAS = {
    "instagram_reels": [
        "Follow for daily breakdowns like this",
        "Save this for when you need it",
        "Tag someone who needs to hear this",
        "Link in bio for the full episode",
        "Drop a comment if this resonates",
    ],
    "youtube_shorts": [
        "Subscribe — one of these drops every day",
        "Like this if you want part 2",
        "Full episode linked above — go watch",
        "Hit subscribe so you don't miss the next one",
        "Comment what topic you want next",
    ],
    "linkedin": [
        "Repost if this resonates with your network",
        "Follow for more founder insights like this",
        "What's your take? Drop it in the comments",
        "Save this post — you'll need it later",
        "Agree or disagree? Let me know below",
    ],
}

# ---------------------------------------------------------------------------
# Production Brief Prompt — generates all 3 platforms in one call
# ---------------------------------------------------------------------------

PRODUCTION_BRIEF_SYSTEM = """\
You are a world-class short-form content strategist. Given a strong moment from a creator's \
long-form content, you produce production-ready briefs for 3 platforms.

Each brief is a FULL SCRIPT the creator (or their editor) can directly use to produce content.

## Platform Specs:
- **Instagram Reels**: 30-60s, vertical 9:16, fast-paced, pattern interrupt hooks, visual-first
- **YouTube Shorts**: 30-60s, vertical 9:16, slightly more story-driven, can be educational
- **LinkedIn**: 30-90s vertical video OR text post with video, professional tone, insight-driven

## Script Structure (for each platform):
1. **Hook** (0-3s): The opening line/text overlay that stops the scroll. Must create instant curiosity or tension.
2. **Body** (3-45s): The actual script — what the creator says, beat by beat. Write it as spoken words, natural and conversational. Include [PAUSE], [EMPHASIS], [CUT] cues where useful.
3. **CTA** (last 5-10s): The closing call-to-action. Platform-appropriate.
4. **Higgsfield Visual Prompt**: A single prompt for Higgsfield AI to generate the visual. Include: subject description, camera angle, movement, lighting, mood, aspect ratio.

## CTA Guidelines:
Pick ONE CTA that fits the content naturally. Here are proven high-performing CTAs per platform:

### Instagram Reels CTAs:
{ctas_reels}

### YouTube Shorts CTAs:
{ctas_shorts}

### LinkedIn CTAs:
{ctas_linkedin}

If the creator has established CTA preferences (from memory context), use those instead.

## Output Format:
Return ONLY valid JSON — no markdown fences, no explanation before or after.

{{
  "instagram_reels": {{
    "hook": "<the opening line, max 15 words>",
    "body": "<full spoken script, 80-150 words, with [PAUSE] [EMPHASIS] [CUT] cues>",
    "cta": "<the CTA line>",
    "higgsfield_prompt": "<Higgsfield prompt: subject, camera, movement, lighting, mood, 9:16 vertical>"
  }},
  "youtube_shorts": {{
    "hook": "<the opening line, max 15 words>",
    "body": "<full spoken script, 80-150 words, with [PAUSE] [EMPHASIS] [CUT] cues>",
    "cta": "<the CTA line>",
    "higgsfield_prompt": "<Higgsfield prompt: subject, camera, movement, lighting, mood, 9:16 vertical>"
  }},
  "linkedin": {{
    "hook": "<the opening line, max 15 words>",
    "body": "<full spoken script, 100-200 words, professional but human tone>",
    "cta": "<the CTA line>",
    "higgsfield_prompt": "<Higgsfield prompt: subject, camera, movement, lighting, mood, 9:16 or 1:1>"
  }}
}}
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
    Generate production briefs for a single moment across all 3 platforms.
    Returns list of derivative dicts ready for DB insertion (one per platform).
    """
    snippet = moment["transcript_snippet"]
    rationale = moment["selection_rationale"]
    timestamps = f"{moment['start_timestamp']:.1f}s – {moment['end_timestamp']:.1f}s"

    memory_section = (
        f"## Creator Context (learned from past sessions)\n{memory_reflection}\n\n"
        if memory_reflection
        else ""
    )

    user_prompt = (
        f"{memory_section}"
        f"## Source Moment\n"
        f"Timestamp: {timestamps}\n"
        f'"{snippet}"\n\n'
        f"Selection rationale: {rationale}\n\n"
        f"Generate the production briefs for all 3 platforms."
    )

    # Format the system prompt with CTA library
    system = PRODUCTION_BRIEF_SYSTEM.format(
        ctas_reels="\n".join(f"- \"{c}\"" for c in COLD_START_CTAS["instagram_reels"]),
        ctas_shorts="\n".join(f"- \"{c}\"" for c in COLD_START_CTAS["youtube_shorts"]),
        ctas_linkedin="\n".join(f"- \"{c}\"" for c in COLD_START_CTAS["linkedin"]),
    )

    agent = get_generation_agent()
    raw = await run_prompt(agent, system, user_prompt, cost_acc)

    return _parse_production_briefs(raw)


def _parse_production_briefs(raw: str) -> list[dict[str, Any]]:
    """Parse LLM response into platform-specific derivative dicts."""
    cleaned = re.sub(r"```(?:json)?", "", raw).strip()

    data = None
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to extract JSON object from response
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group())
            except Exception:
                pass

    if not data or not isinstance(data, dict):
        return []

    derivatives: list[dict[str, Any]] = []
    platforms = ["instagram_reels", "youtube_shorts", "linkedin"]

    for platform in platforms:
        brief = data.get(platform)
        if not brief or not isinstance(brief, dict):
            continue

        # Ensure all required keys exist
        content = {
            "hook": brief.get("hook", ""),
            "body": brief.get("body", ""),
            "cta": brief.get("cta", ""),
            "higgsfield_prompt": brief.get("higgsfield_prompt", ""),
        }

        # Skip if essentially empty
        if not content["hook"] and not content["body"]:
            continue

        derivatives.append({
            "platform": platform,
            "content_type": "production_brief",
            "content": json.dumps(content),
            "model": "cascadeflow",
        })

    return derivatives


# ---------------------------------------------------------------------------
# Single derivative regeneration (used by the /regenerate endpoint)
# ---------------------------------------------------------------------------

REGEN_SINGLE_SYSTEM = """\
You are regenerating a production brief for a single platform. Given the source moment and \
optional creator guidance, produce an updated brief.

Return ONLY valid JSON with these keys:
{{
  "hook": "<the opening line, max 15 words>",
  "body": "<full spoken script with [PAUSE] [EMPHASIS] [CUT] cues>",
  "cta": "<the CTA line>",
  "higgsfield_prompt": "<Higgsfield prompt: subject, camera, movement, lighting, mood, aspect ratio>"
}}

Platform: {platform}
{platform_notes}
"""

PLATFORM_NOTES = {
    "instagram_reels": "Instagram Reels: 30-60s, vertical 9:16, fast-paced, pattern interrupt hooks, visual-first",
    "youtube_shorts": "YouTube Shorts: 30-60s, vertical 9:16, story-driven, can be educational",
    "linkedin": "LinkedIn: 30-90s video or text+video, professional tone, insight-driven",
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

    platform = derivative["platform"]
    system = REGEN_SINGLE_SYSTEM.format(
        platform=platform,
        platform_notes=PLATFORM_NOTES.get(platform, ""),
    )

    agent = get_generation_agent()
    raw = await run_prompt(agent, system, context)

    # Parse the single brief
    new_content = _parse_single_brief(raw)
    if not new_content:
        return None

    # Persist and return
    updated = await update_derivative_content(derivative_id, json.dumps(new_content))
    if updated:
        await update_derivative_status(derivative_id, "draft")
    return updated


def _parse_single_brief(raw: str) -> dict[str, str] | None:
    """Parse a single platform brief from LLM response."""
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
