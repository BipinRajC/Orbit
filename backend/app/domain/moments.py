"""Moment extraction — identify the 3-5 strongest moments from a transcript."""
from __future__ import annotations

import json
import re
from typing import Any

from app.infrastructure.cascadeflow import (
    CostAccumulator,
    get_extraction_agent,
    run_prompt,
)
from app.infrastructure.transcription import format_transcript_for_prompt

EXTRACTION_SYSTEM = """\
You are a content analyst identifying the strongest standalone moments from a creator's long-form content.
Your goal is to find moments that work as short-form clips and social content.

Evaluate each potential moment on:
- Standalone clarity: makes sense without surrounding context
- Emotional intensity: conviction, humour, vulnerability, passion
- Shareability: someone would clip this and send to a friend
- Platform fit: works as a 30-60 second standalone piece
- Novelty: unique insight vs common wisdom
- Retention gravity: creates curiosity that keeps people watching

Return ONLY a valid JSON array of 3-5 objects. No markdown fences, no explanation before or after.

Each object must have these exact keys:
{
  "start_timestamp": <float seconds>,
  "end_timestamp": <float seconds>,
  "transcript_snippet": "<verbatim quote from transcript, max 300 chars>",
  "strength_score": <float 0.0-1.0>,
  "selection_rationale": "<1-2 sentences explaining why this moment is strong>"
}
"""


async def extract_moments(
    segments: list[dict],
    memory_reflection: str = "",
    cost_acc: CostAccumulator | None = None,
) -> list[dict[str, Any]]:
    """
    Extract 3-5 strong moments from transcript segments.

    Args:
        segments: Timestamped transcript segments
        memory_reflection: Creator context from Hindsight (may be empty)
        cost_acc: Optional cost accumulator for tracking cascadeflow spend

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
        "Identify the 3-5 strongest moments. Return only the JSON array."
    )

    agent = get_extraction_agent()
    raw = await run_prompt(
        agent=agent,
        system=EXTRACTION_SYSTEM,
        user=user_prompt,
        cost_acc=cost_acc,
    )

    return _parse_moments(raw)


def _parse_moments(raw: str) -> list[dict[str, Any]]:
    """Parse LLM response into validated moment dicts."""
    # Strip markdown code fences if present
    cleaned = re.sub(r"```(?:json)?", "", raw).strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to extract array from within the response
        match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if match:
            data = json.loads(match.group())
        else:
            raise ValueError(f"Could not parse moments JSON from LLM response: {raw[:200]}")

    if not isinstance(data, list):
        raise ValueError(f"Expected JSON array, got {type(data)}")

    moments = []
    for item in data[:5]:  # cap at 5
        moments.append({
            "start_timestamp": float(item.get("start_timestamp", 0)),
            "end_timestamp": float(item.get("end_timestamp", 0)),
            "transcript_snippet": str(item.get("transcript_snippet", ""))[:500],
            "strength_score": float(item.get("strength_score", 0.5)),
            "selection_rationale": str(item.get("selection_rationale", "")),
        })

    return moments
