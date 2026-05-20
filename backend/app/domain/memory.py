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

SYNTHESIS_SYSTEM = """\
You are analysing a content creator's editing behaviour from their review session.
Extract concise, actionable observations in THREE categories:

1. STYLE OBSERVATIONS — patterns about how they write:
   - How they modified language (shortened? softened? punchier? removed filler?)
   - What they approved vs rejected (hook styles, tones, lengths, platforms)
   - Voice characteristics (formal/casual, direct/hedged, punchy/elaborate)

2. VOICE EXAMPLES — verbatim phrases from content they approved or edited to:
   - Pull 1-2 actual sentences that exemplify their writing style
   - Format: 'Voice example: "[exact phrase from their approved/edited content]"'
   - These give future generation a concrete target to match

3. NEGATIVE PATTERNS — specific things they removed, rewrote, or rejected:
   - Specific words, phrases, or structures they avoided
   - Format: 'Never use: [specific pattern] — creator [rejected/rewrote away from] this'
   - Be specific (exact words/phrases), not abstract

Return ONLY a JSON array of 3-7 observation strings mixing all three types.
Each observation must be a single sentence.
No markdown, no explanation outside the JSON array.

Example:
[
  "Creator shortens tweets by cutting filler — removes 'honestly', 'basically', 'the truth is'.",
  "Creator approves question-style hooks and rejects aggressive clickbait openers.",
  "Voice example: 'Most people get this backwards — here is why.'",
  "Never use: hooks starting with 'Stop doing X' or 'You need to...' — creator consistently rejects these.",
  "Creator prefers direct first-person statements over passive or hedged constructions."
]
"""


async def synthesize_and_store_observations(project_id: str) -> None:
    """
    Main entry point: analyse a project's editing events and store
    observations in Hindsight memory.
    """
    events = await get_editing_events_for_project(project_id)
    if not events:
        return

    summary = _build_events_summary(events)
    if not summary.strip():
        return

    agent = get_synthesis_agent()
    raw = await run_prompt(
        agent=agent,
        system=SYNTHESIS_SYSTEM,
        user=f"## Editing Events\n{summary}\n\nExtract creator preference observations.",
    )

    observations = _parse_observations(raw)

    for obs in observations:
        await retain_observation(obs, tags=["editing-behaviour", f"project-{project_id[:8]}"])

    # Mark project as archived (review complete)
    await update_project_status(
        project_id,
        status="archived",
        log_entry={
            "stage": "memory_synthesis",
            "message": f"Stored {len(observations)} observations from review",
        },
    )


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
                f'  Before: "{before[:200]}"\n'
                f'  After:  "{after[:200]}"'
            )
        elif event_type == "approve":
            content = (before or after or "")[:200]
            snippet = f'\n  Approved content: "{content}"' if content else ""
            lines.append(f"APPROVED [{platform}/{content_type}]{snippet}")
        elif event_type == "reject":
            content = (before or after or "")[:200]
            snippet = f'\n  Rejected content: "{content}"' if content else ""
            lines.append(f"REJECTED [{platform}/{content_type}]{snippet}")
        elif event_type == "regenerate":
            content = (before or "")[:150]
            note = f' with guidance: "{guidance}"' if guidance else ""
            snippet = f'\n  Original content: "{content}"' if content else ""
            lines.append(f"REGENERATED [{platform}/{content_type}]{note}{snippet}")

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
