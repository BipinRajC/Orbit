"""Moment extraction — identify the 3-5 strongest moments from a transcript.

Uses Claude Haiku 4.5 with structured output (tool_use) for guaranteed JSON.
Supports multi-segment moments where 2-3 non-contiguous clips stitch together
into a stronger narrative arc.
"""
from __future__ import annotations

import asyncio
from typing import Any

from app.infrastructure.anthropic import HAIKU_MODEL, structured_call
from app.infrastructure.transcription import format_transcript_for_prompt


def _fmt_time(seconds: float) -> str:
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m:02d}:{s:02d}"

EXTRACTION_SYSTEM = """\
You are a world-class content analyst identifying the strongest standalone moments from a \
specific portion of a creator's long-form content for short-form video.

Your goal: find the best moments from the provided transcript excerpt that work as \
standalone 30-90 second short-form clips.

Evaluate each potential moment on:
- Complete narrative arc: clear setup → tension/insight → payoff
- Hook quality: the first words stop the scroll — instant curiosity or tension
- Strong closer: the last words land — an insight, punchline, or emotional beat
- Standalone clarity: makes complete sense without surrounding context
- Emotional intensity: conviction, humour, vulnerability, passion
- Shareability: someone would send this to a friend
- Platform fit: works as a 30-90 second standalone vertical piece

Constraints:
- Return the number of moments specified in the prompt
- Each moment must be a single continuous segment — no combining non-contiguous parts
- Each moment: 30-90 seconds total duration
- Each segment must be at least 25 seconds
"""

_MOMENT_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "moments": {
            "type": "array",
            "minItems": 1,
            "maxItems": 3,
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
                        "maxItems": 1,
                        "items": {
                            "type": "object",
                            "required": ["start", "end", "role"],
                            "properties": {
                                "start": {"type": "number", "description": "Start timestamp in seconds"},
                                "end": {"type": "number", "description": "End timestamp in seconds"},
                                "role": {
                                    "type": "string",
                                    "enum": ["primary", "payoff", "bridge"],
                                },
                            },
                        },
                    },
                    "total_duration_seconds": {"type": "number"},
                    "transcript_snippet": {"type": "string", "maxLength": 500},
                    "narrative_summary": {"type": "string"},
                    "hook_potential": {"type": "string"},
                    "strength_score": {"type": "number", "minimum": 0.0, "maximum": 1.0},
                    "selection_rationale": {"type": "string"},
                },
            },
        }
    },
    "required": ["moments"],
}


async def extract_moments(
    segments: list[dict],
    memory_reflection: str = "",
    video_intent: dict | None = None,
) -> list[dict[str, Any]]:
    """
    Split transcript into chunks, extract candidate moments from each in parallel,
    then return the top 5 by strength score.

    This guarantees coverage across the full video — every portion is independently
    analyzed and the best moments surface regardless of where they appear.
    """
    memory_section = (
        f"## Creator Context (learned from past sessions)\n{memory_reflection}\n\n"
        if memory_reflection
        else "## Creator Context\nNo prior memory — using universal heuristics.\n\n"
    )

    chunks = _split_into_chunks(segments)
    tasks = [
        _extract_from_chunk(chunk, idx + 1, len(chunks), memory_section, video_intent)
        for idx, chunk in enumerate(chunks)
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_candidates: list[dict] = []
    for r in results:
        if isinstance(r, list):
            all_candidates.extend(r)

    # Sort by strength score across all chunks, return top 5
    all_candidates.sort(key=lambda x: x.get("strength_score", 0.0), reverse=True)
    return all_candidates[:5]


def _split_into_chunks(
    segments: list[dict],
    max_chars: int = 55000,
) -> list[list[dict]]:
    """Split transcript segments into chunks each fitting within max_chars when formatted."""
    chunks: list[list[dict]] = []
    current: list[dict] = []
    current_len = 0

    for seg in segments:
        line = f"[{_fmt_time(seg['start'])} - {_fmt_time(seg['end'])}] {seg['text']}\n"
        if current_len + len(line) > max_chars and current:
            chunks.append(current)
            current = [seg]
            current_len = len(line)
        else:
            current.append(seg)
            current_len += len(line)

    if current:
        chunks.append(current)

    return chunks or [segments]


async def _extract_from_chunk(
    chunk: list[dict],
    chunk_num: int,
    total_chunks: int,
    memory_section: str,
    video_intent: dict | None = None,
) -> list[dict[str, Any]]:
    """Extract candidate moments from a single transcript chunk."""
    transcript_text = format_transcript_for_prompt(chunk, max_chars=55000)
    start_label = _fmt_time(chunk[0]["start"]) if chunk else "00:00"
    end_label = _fmt_time(chunk[-1]["end"]) if chunk else "00:00"

    # Single chunk = full video, ask for 3-5. Multiple chunks = ask for 1-3 per portion.
    if total_chunks == 1:
        min_moments, max_moments = 3, 5
        count_instruction = "Find the strongest 3-5 moments from this video."
    else:
        min_moments, max_moments = 1, 3
        count_instruction = "Find the strongest 1-3 moments from this portion."

    schema = {
        **_MOMENT_SCHEMA,
        "properties": {
            "moments": {
                **_MOMENT_SCHEMA["properties"]["moments"],
                "minItems": min_moments,
                "maxItems": max_moments,
            }
        },
    }

    intent_section = ""
    if video_intent and (video_intent.get("topic") or video_intent.get("goal")):
        topic = video_intent.get("topic", "")
        goal = video_intent.get("goal", "")
        goal_guidance = {
            "grow_followers": "Prioritise moments with maximum hook strength and scroll-stopping power.",
            "inspire": "Prioritise emotionally resonant, vulnerable, or motivational moments.",
            "teach_skill": "Prioritise moments with clear, standalone instructional value.",
            "build_trust": "Prioritise moments that show personality, authenticity, and depth.",
        }.get(goal, "")
        intent_section = (
            f"## Video Brief\n"
            f"Topic: {topic}\n"
            + (f"Goal: {goal_guidance}\n" if goal_guidance else "")
            + "\n"
        )

    user_prompt = (
        f"{memory_section}"
        f"{intent_section}"
        f"## Transcript Portion {chunk_num}/{total_chunks} [{start_label} – {end_label}]\n"
        f"{transcript_text}\n\n"
        f"{count_instruction} "
        "Use the extract_moments tool to return your findings."
    )

    try:
        result = await structured_call(
            model=HAIKU_MODEL,
            system=EXTRACTION_SYSTEM,
            user=user_prompt,
            tool_name="extract_moments",
            tool_description="Extract moments from this transcript portion.",
            input_schema=schema,
            max_tokens=2048,
            temperature=0.3,
        )
        return _normalise_moments(result.get("moments", []))
    except Exception:
        return []


def _normalise_moments(raw_moments: list[dict]) -> list[dict[str, Any]]:
    """Normalise extracted moments into DB-ready dicts."""
    MIN_SEGMENT_SECS = 25.0
    MIN_TOTAL_SECS = 30.0

    moments = []
    for item in raw_moments:
        segs = item.get("segments", [])
        if not segs:
            continue

        # Enforce minimum duration per segment
        enforced_segs = []
        for seg in segs:
            s = float(seg.get("start", 0))
            e = float(seg.get("end", 0))
            if e - s < MIN_SEGMENT_SECS:
                e = s + MIN_SEGMENT_SECS
            enforced_segs.append({**seg, "start": s, "end": e})
        segs = enforced_segs

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

        # Enforce minimum total duration
        if end_ts - start_ts < MIN_TOTAL_SECS:
            end_ts = start_ts + MIN_TOTAL_SECS

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
