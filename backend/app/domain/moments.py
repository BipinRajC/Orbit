"""Moment extraction — identify the 3-5 strongest moments from a transcript.

Uses Claude Haiku 4.5 with structured output (tool_use) for guaranteed JSON.
Supports multi-segment moments where 2-3 non-contiguous clips stitch together
into a stronger narrative arc.
"""
from __future__ import annotations

from typing import Any

from app.infrastructure.anthropic import HAIKU_MODEL, structured_call
from app.infrastructure.transcription import format_transcript_for_prompt

EXTRACTION_SYSTEM = """\
You are a world-class content analyst identifying the strongest standalone moments from a \
creator's long-form content for short-form video.

Your goal: find 3-5 moments that work as standalone 30-90 second short-form clips.

Evaluate each potential moment on:
- Complete narrative arc: the clip must have a clear setup → tension/insight → payoff
- Hook quality: the first words must stop the scroll — they create instant curiosity or tension
- Strong closer: the last words must land — an insight, punchline, or emotional beat
- Standalone clarity: makes complete sense without surrounding context
- Emotional intensity: conviction, humour, vulnerability, passion
- Shareability: someone would send this to a friend
- Platform fit: works as a 30-90 second standalone vertical piece

Multi-segment support: If combining 2 non-contiguous segments creates a dramatically stronger \
clip (e.g. a setup at timestamp 120s + its payoff at 510s), return both as segments within \
the same moment. Use this sparingly — most moments should be a single continuous segment.

Constraints:
- 3-5 moments total
- Each moment: 20-90 seconds total duration
- Max 3 segments per moment (usually 1, occasionally 2, rarely 3)
- Each individual segment must be at least 8 seconds
- Segments within a moment must form a coherent narrative when played sequentially
"""


async def extract_moments(
    segments: list[dict],
    memory_reflection: str = "",
) -> list[dict[str, Any]]:
    """
    Extract 3-5 strong moments from transcript segments using Claude Haiku 4.5.

    Args:
        segments: Timestamped transcript segments
        memory_reflection: Creator context from Hindsight (may be empty)

    Returns:
        List of moment dicts ready for DB insertion
    """
    transcript_text = format_transcript_for_prompt(segments)
    memory_section = (
        f"## Creator Context (learned from past sessions)\n{memory_reflection}\n\n"
        if memory_reflection
        else "## Creator Context\nNo prior memory — using universal heuristics.\n\n"
    )

    user_prompt = (
        f"{memory_section}"
        f"## Transcript\n{transcript_text}\n\n"
        "Identify the 3-5 strongest moments for short-form video clips. "
        "Use the extract_moments tool to return your findings."
    )

    result = await structured_call(
        model=HAIKU_MODEL,
        system=EXTRACTION_SYSTEM,
        user=user_prompt,
        tool_name="extract_moments",
        tool_description=(
            "Extract the strongest 3-5 moments from the transcript for short-form video clips."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "moments": {
                    "type": "array",
                    "minItems": 3,
                    "maxItems": 5,
                    "items": {
                        "type": "object",
                        "required": [
                            "segments",
                            "total_duration_seconds",
                            "transcript_snippet",
                            "narrative_summary",
                            "hook_potential",
                            "strength_score",
                            "selection_rationale",
                        ],
                        "properties": {
                            "segments": {
                                "type": "array",
                                "minItems": 1,
                                "maxItems": 3,
                                "items": {
                                    "type": "object",
                                    "required": ["start", "end", "role"],
                                    "properties": {
                                        "start": {
                                            "type": "number",
                                            "description": "Start timestamp in seconds",
                                        },
                                        "end": {
                                            "type": "number",
                                            "description": "End timestamp in seconds",
                                        },
                                        "role": {
                                            "type": "string",
                                            "enum": ["primary", "payoff", "bridge"],
                                            "description": "Role of this segment in the narrative",
                                        },
                                    },
                                },
                            },
                            "total_duration_seconds": {
                                "type": "number",
                                "description": "Total clip duration across all segments",
                            },
                            "transcript_snippet": {
                                "type": "string",
                                "description": "Opening 2-3 sentences of the clip (verbatim from transcript)",
                                "maxLength": 500,
                            },
                            "narrative_summary": {
                                "type": "string",
                                "description": "What makes this a complete story — setup, tension, payoff",
                            },
                            "hook_potential": {
                                "type": "string",
                                "description": "Why the opening line stops the scroll",
                            },
                            "strength_score": {
                                "type": "number",
                                "minimum": 0.0,
                                "maximum": 1.0,
                                "description": "Overall strength as short-form content (0-1)",
                            },
                            "selection_rationale": {
                                "type": "string",
                                "description": "1-2 sentences explaining why this was chosen over alternatives",
                            },
                        },
                    },
                }
            },
            "required": ["moments"],
        },
        max_tokens=2048,
        temperature=0.3,  # Lower temp for analytical task
    )

    return _normalise_moments(result.get("moments", []))


def _normalise_moments(raw_moments: list[dict]) -> list[dict[str, Any]]:
    """Normalise extracted moments into DB-ready dicts."""
    moments = []
    for item in raw_moments[:5]:
        segs = item.get("segments", [])
        if not segs:
            continue

        # Derive legacy start/end from primary segment (or first segment)
        primary = next((s for s in segs if s.get("role") == "primary"), segs[0])
        start_ts = float(primary.get("start", 0))
        end_ts = float(primary.get("end", 0))

        # For multi-segment: use first segment start and last segment end as the span
        if len(segs) > 1:
            all_starts = [float(s.get("start", 0)) for s in segs]
            all_ends = [float(s.get("end", 0)) for s in segs]
            start_ts = min(all_starts)
            end_ts = max(all_ends)

        moments.append({
            "start_timestamp": start_ts,
            "end_timestamp": end_ts,
            "segments": segs,  # full multi-segment data
            "transcript_snippet": str(item.get("transcript_snippet", ""))[:500],
            "strength_score": float(item.get("strength_score", 0.5)),
            "selection_rationale": str(item.get("selection_rationale", "")),
            "narrative_summary": str(item.get("narrative_summary", "")),
            "hook_potential": str(item.get("hook_potential", "")),
            "total_duration_seconds": float(item.get("total_duration_seconds", end_ts - start_ts)),
        })

    return moments
