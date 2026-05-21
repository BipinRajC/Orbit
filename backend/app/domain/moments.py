"""Moment extraction — identify the 7 strongest moments spread across the full video.

Uses Claude Haiku 4.5 with structured output (tool_use) for guaranteed JSON.
Strategy: split transcript into 5 equal-duration time chunks, extract 1-2 candidates
per chunk, then greedily select up to 7 moments enforcing a minimum 30-second gap
between picks. Final list is sorted chronologically.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.infrastructure.anthropic import HAIKU_MODEL, structured_call
from app.infrastructure.transcription import format_transcript_for_prompt

logger = logging.getLogger(__name__)

NUM_CHUNKS = 5
TARGET_MOMENT_COUNT = 7
MIN_MOMENT_SECS = 30
MAX_MOMENT_SECS = 45
# Preferred spacing between picks. We relax this progressively if we can't fill
# `TARGET_MOMENT_COUNT` at the preferred gap, so a strict gap never under-fills.
MIN_GAP_BETWEEN_MOMENTS_SECS = 25
MIN_GAP_FLOOR_SECS = 8
# Per-chunk candidates we ask Claude for. Higher = more raw material so the
# downstream selector has slack after duration / gap filtering.
MAX_CANDIDATES_PER_CHUNK = 3


def _fmt_time(seconds: float) -> str:
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m:02d}:{s:02d}"


def _format_chunk_with_seconds(segments: list[dict], max_chars: int = 55000) -> str:
    """
    Format transcript segments for moment extraction with EXPLICIT absolute-seconds
    markers. Avoids Claude misreading `MM:SS` time labels as raw integers (which was
    causing every chunk's moments to collapse into the first minute of the video).
    """
    lines: list[str] = []
    total = 0
    for seg in segments:
        start = float(seg.get("start", 0.0))
        end = float(seg.get("end", 0.0))
        text = str(seg.get("text", "")).strip()
        line = f"[start_s={start:.1f} end_s={end:.1f}] {text}"
        if total + len(line) > max_chars:
            lines.append("... [transcript truncated]")
            break
        lines.append(line)
        total += len(line) + 1
    return "\n".join(lines)


def _build_persona_block(persona_styles: list[str] | None) -> str:
    styles = persona_styles or []
    if not styles:
        return ""
    guidance_lines = []
    style_set = set(styles)
    if style_set & {"humour", "wit", "hype-energy"}:
        guidance_lines.append("- Prioritise punchlines, comedic beats, and big reactions.")
    if style_set & {"storytelling", "personal"}:
        guidance_lines.append("- Prioritise narrative arcs with clear setup-conflict-payoff.")
    if style_set & {"informational", "educational", "tutorial"}:
        guidance_lines.append("- Prioritise self-contained insights or step-by-step demos.")
    if style_set & {"hot-take", "commentary"}:
        guidance_lines.append("- Prioritise strong opinions and contrarian framings.")
    if style_set & {"inspirational"}:
        guidance_lines.append("- Prioritise emotional peaks and motivational closers.")
    if not guidance_lines:
        guidance_lines.append("- Apply general quality heuristics.")
    lines = "\n".join(guidance_lines)
    return (
        f"\n## Creator persona signals\n"
        f"This creator's dominant styles are: {', '.join(styles)}.\n"
        f"When picking moments, weight these heavily:\n{lines}\n"
    )


EXTRACTION_SYSTEM = """\
You are a world-class content analyst identifying the strongest standalone moments from a \
specific portion of a creator's long-form YouTube video for short-form clips.

Your goal: find the best moments from the provided transcript excerpt that work as \
standalone 30-45 second short-form clips.

Evaluate each potential moment on:
- Complete narrative arc: clear setup \u2192 tension/insight \u2192 payoff
- Hook quality: the first words stop the scroll \u2014 instant curiosity or tension
- Strong closer: the last words land \u2014 an insight, punchline, or emotional beat
- Standalone clarity: makes complete sense without surrounding context
- Emotional intensity: conviction, humour, vulnerability, passion
- Shareability: someone would send this to a friend

Hard constraints:
- Each moment MUST be between 30 and 45 seconds total duration
- Each moment must be a single continuous segment
- Return ONLY the number of moments requested in the prompt
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
                                "end": {"type": "number", "description": "End timestamp in seconds. Must be start + 30 to start + 45."},
                                "role": {
                                    "type": "string",
                                    "enum": ["primary", "payoff", "bridge"],
                                },
                            },
                        },
                    },
                    "total_duration_seconds": {
                        "type": "number",
                        "minimum": 30,
                        "maximum": 45,
                        "description": "Must be between 30 and 45 seconds.",
                    },
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


def _split_transcript_by_time(
    segments: list[dict], num_chunks: int
) -> list[list[dict]]:
    """Split transcript segments into N equal-duration chunks based on timestamps."""
    if not segments:
        return [[] for _ in range(num_chunks)]
    total_duration = segments[-1]["end"]
    chunk_size = total_duration / num_chunks
    chunks: list[list[dict]] = [[] for _ in range(num_chunks)]
    for seg in segments:
        idx = min(int(seg["start"] / chunk_size), num_chunks - 1)
        chunks[idx].append(seg)
    return chunks


def _filter_by_duration(moments: list[dict]) -> list[dict]:
    """Drop moments whose duration is outside the 30-45s window."""
    valid = []
    for m in moments:
        duration = m.get("end_timestamp", 0) - m.get("start_timestamp", 0)
        if MIN_MOMENT_SECS <= duration <= MAX_MOMENT_SECS:
            valid.append(m)
    return valid


def _greedy_select(
    candidates: list[dict],
    target: int,
    min_gap: float,
) -> list[dict]:
    """
    Greedy selection: sort by strength_score desc, pick up to `target` moments
    ensuring at least `min_gap` seconds between any two selected start timestamps.
    """
    sorted_candidates = sorted(
        candidates, key=lambda x: x.get("strength_score", 0.0), reverse=True
    )
    selected: list[dict] = []
    for candidate in sorted_candidates:
        start = candidate.get("start_timestamp", 0)
        too_close = any(
            abs(start - s.get("start_timestamp", 0)) < min_gap
            for s in selected
        )
        if not too_close:
            selected.append(candidate)
        if len(selected) >= target:
            break
    return selected


def _bucket_select(
    candidates: list[dict],
    total_duration: float,
    num_chunks: int,
    target: int,
    min_gap: float,
) -> list[dict]:
    """
    Spread-aware selection: bucket candidates by which chunk they fall in,
    then round-robin pick the highest-scoring moment per chunk while enforcing
    `min_gap`. After one pass everyone gets a shot; remaining slots are filled
    by global score order, still respecting `min_gap`.
    """
    if total_duration <= 0 or num_chunks <= 0:
        return _greedy_select(candidates, target, min_gap)

    chunk_size = total_duration / num_chunks
    buckets: list[list[dict]] = [[] for _ in range(num_chunks)]
    for c in candidates:
        start = c.get("start_timestamp", 0)
        idx = min(int(start / chunk_size), num_chunks - 1) if chunk_size else 0
        buckets[idx].append(c)
    for b in buckets:
        b.sort(key=lambda x: x.get("strength_score", 0.0), reverse=True)

    selected: list[dict] = []

    def _fits(candidate: dict) -> bool:
        start = candidate.get("start_timestamp", 0)
        return not any(
            abs(start - s.get("start_timestamp", 0)) < min_gap for s in selected
        )

    # Round 1: best-of-each-chunk (chronological so we visit early → late).
    for bucket in buckets:
        if len(selected) >= target:
            break
        for cand in bucket:
            if _fits(cand):
                selected.append(cand)
                break

    # Round 2: fill remaining slots by global score.
    if len(selected) < target:
        remaining = [c for c in candidates if c not in selected]
        remaining.sort(key=lambda x: x.get("strength_score", 0.0), reverse=True)
        for cand in remaining:
            if len(selected) >= target:
                break
            if _fits(cand):
                selected.append(cand)

    return selected


def _select_with_relaxation(
    candidates: list[dict],
    total_duration: float,
) -> list[dict]:
    """
    Try bucket-aware selection at the preferred gap; if we can't reach
    TARGET_MOMENT_COUNT, progressively halve the gap down to MIN_GAP_FLOOR_SECS,
    then as a last resort take the top-N by score regardless of gap. This
    guarantees we never under-fill when raw candidates exist.
    """
    if not candidates:
        return []

    gap = MIN_GAP_BETWEEN_MOMENTS_SECS
    best: list[dict] = []
    while gap >= MIN_GAP_FLOOR_SECS:
        picked = _bucket_select(
            candidates, total_duration, NUM_CHUNKS, TARGET_MOMENT_COUNT, gap
        )
        if len(picked) > len(best):
            best = picked
        if len(picked) >= TARGET_MOMENT_COUNT:
            return picked
        gap = gap / 2

    if len(best) < TARGET_MOMENT_COUNT:
        # Last resort: top up purely by strength, ignoring gap.
        remaining = [c for c in candidates if c not in best]
        remaining.sort(key=lambda x: x.get("strength_score", 0.0), reverse=True)
        for cand in remaining:
            if len(best) >= TARGET_MOMENT_COUNT:
                break
            best.append(cand)

    return best


async def extract_moments(
    segments: list[dict],
    memory_reflection: str = "",
    video_intent: dict | None = None,
    persona_styles: list[str] | None = None,
) -> list[dict[str, Any]]:
    """
    Split transcript into 5 equal-duration time chunks, extract 1-2 candidate moments
    from each in parallel, then greedily select up to 7 enforcing MIN_GAP_BETWEEN_MOMENTS_SECS.
    Returns moments sorted chronologically.
    """
    memory_section = (
        f"## Creator context (learned from past sessions)\n{memory_reflection}\n\n"
        if memory_reflection
        else "## Creator context\nNo prior memory \u2014 using universal heuristics.\n\n"
    )

    persona_block = _build_persona_block(persona_styles)

    chunks = _split_transcript_by_time(segments, NUM_CHUNKS)
    # Filter out empty chunks
    non_empty = [(idx, chunk) for idx, chunk in enumerate(chunks) if chunk]
    total_duration = float(segments[-1]["end"]) if segments else 0.0

    tasks = [
        _extract_from_chunk(chunk, idx + 1, NUM_CHUNKS, memory_section, persona_block, video_intent)
        for idx, chunk in non_empty
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_candidates: list[dict] = []
    per_chunk_counts: list[int] = []
    for r in results:
        if isinstance(r, list):
            all_candidates.extend(r)
            per_chunk_counts.append(len(r))
        else:
            per_chunk_counts.append(0)
            logger.warning("Chunk extraction returned exception: %s", r)

    logger.info(
        "Moment extraction: %d total candidates across %d non-empty chunks (per-chunk: %s)",
        len(all_candidates), len(non_empty), per_chunk_counts,
    )

    # Filter by duration window first.
    duration_filtered = _filter_by_duration(all_candidates)
    if len(duration_filtered) < len(all_candidates):
        logger.info(
            "Duration filter dropped %d/%d candidates outside [%ds, %ds]",
            len(all_candidates) - len(duration_filtered),
            len(all_candidates), MIN_MOMENT_SECS, MAX_MOMENT_SECS,
        )

    pool = duration_filtered or all_candidates
    selected = _select_with_relaxation(pool, total_duration)

    logger.info(
        "Moment selection: picked %d (target=%d) from %d candidates",
        len(selected), TARGET_MOMENT_COUNT, len(pool),
    )

    # Sort chronologically before returning
    selected.sort(key=lambda x: x.get("start_timestamp", 0))
    return selected


async def _extract_from_chunk(
    chunk: list[dict],
    chunk_num: int,
    total_chunks: int,
    memory_section: str,
    persona_block: str,
    video_intent: dict | None = None,
) -> list[dict[str, Any]]:
    """Extract 1-2 candidate moments from a single transcript chunk."""
    if not chunk:
        return []

    transcript_text = _format_chunk_with_seconds(chunk, max_chars=55000)
    chunk_start_s = float(chunk[0]["start"])
    chunk_end_s = float(chunk[-1]["end"])
    start_label = _fmt_time(chunk_start_s)
    end_label = _fmt_time(chunk_end_s)

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
            f"## Video brief\n"
            f"Topic: {topic}\n"
            + (f"Goal: {goal_guidance}\n" if goal_guidance else "")
            + "\n"
        )

    user_prompt = (
        f"{memory_section}"
        f"{persona_block}"
        f"{intent_section}"
        f"## Transcript portion {chunk_num}/{total_chunks} "
        f"(absolute video time {start_label}\u2013{end_label}, "
        f"i.e. seconds {chunk_start_s:.1f}\u2013{chunk_end_s:.1f})\n"
        f"Each line is prefixed with `[start_s=NNN end_s=NNN]` giving ABSOLUTE seconds "
        f"from the beginning of the FULL video. Use those numbers verbatim for `start`/`end` "
        f"in your tool call.\n\n"
        f"{transcript_text}\n\n"
        f"Find the STRONGEST 2-3 moments from this portion. "
        f"Hard rules:\n"
        f"- `start` and `end` are ABSOLUTE seconds, both must fall within "
        f"[{chunk_start_s:.1f}, {chunk_end_s:.1f}].\n"
        f"- `end - start` must be between {MIN_MOMENT_SECS} and {MAX_MOMENT_SECS}.\n"
        f"- Copy timestamps directly from the `start_s=` / `end_s=` markers \u2014 do not "
        f"convert MM:SS to a number.\n"
        f"Use the extract_moments tool to return your findings."
    )

    max_retries = 2
    for attempt in range(max_retries + 1):
        try:
            result = await structured_call(
                model=HAIKU_MODEL,
                system=EXTRACTION_SYSTEM,
                user=user_prompt,
                tool_name="extract_moments",
                tool_description="Extract moments from this transcript portion.",
                input_schema=_MOMENT_SCHEMA,
                max_tokens=2048,
                temperature=0.3,
            )
            return _normalise_moments(
                result.get("moments", []),
                chunk_start_s=chunk_start_s,
                chunk_end_s=chunk_end_s,
                chunk_num=chunk_num,
            )
        except Exception as exc:
            if attempt < max_retries:
                wait = 2 ** attempt  # 1s, 2s
                logger.warning(
                    "Chunk %d/%d extraction failed (attempt %d/%d), retrying in %ds: %s",
                    chunk_num, total_chunks, attempt + 1, max_retries + 1, wait, exc,
                )
                await asyncio.sleep(wait)
            else:
                logger.error(
                    "Chunk %d/%d extraction failed after %d attempts — skipping. Error: %s",
                    chunk_num, total_chunks, max_retries + 1, exc,
                )
    return []


def _normalise_moments(
    raw_moments: list[dict],
    chunk_start_s: float | None = None,
    chunk_end_s: float | None = None,
    chunk_num: int | None = None,
) -> list[dict[str, Any]]:
    """Normalise extracted moments into DB-ready dicts, enforcing 30-45s window.

    When chunk bounds are provided, any moment whose start falls outside the
    chunk's actual [start, end] range is dropped. This guards against the model
    misreading `MM:SS` markers as raw integers and emitting bogus timestamps.
    """
    moments = []
    for item in raw_moments:
        segs = item.get("segments", [])
        if not segs:
            continue

        primary = next((s for s in segs if s.get("role") == "primary"), segs[0])
        start_ts = float(primary.get("start", 0))
        end_ts = float(primary.get("end", 0))

        if len(segs) > 1:
            start_ts = min(float(s.get("start", 0)) for s in segs)
            end_ts = max(float(s.get("end", 0)) for s in segs)

        # Reject moments whose start is outside the chunk's real time window
        # (with a small slack to allow extension at the boundary).
        if chunk_start_s is not None and chunk_end_s is not None:
            slack = 2.0
            if start_ts < chunk_start_s - slack or start_ts > chunk_end_s + slack:
                logger.warning(
                    "Chunk %s: dropping moment with start=%.1f outside chunk bounds [%.1f, %.1f]",
                    chunk_num, start_ts, chunk_start_s, chunk_end_s,
                )
                continue
            # Clamp start into the chunk if it's marginally outside.
            start_ts = max(chunk_start_s, min(start_ts, chunk_end_s - MIN_MOMENT_SECS))

        # Enforce 30s minimum
        if end_ts - start_ts < MIN_MOMENT_SECS:
            end_ts = start_ts + MIN_MOMENT_SECS

        # Enforce 45s maximum
        if end_ts - start_ts > MAX_MOMENT_SECS:
            end_ts = start_ts + MAX_MOMENT_SECS

        # Update segment ends to match the clamped moment window.
        # IMPORTANT: YouTube auto-captions have dDurationMs=0, so segment.end == segment.start.
        # We must extend the LAST segment's end to end_ts so yt-dlp downloads the full clip.
        enforced_segs = []
        for i, seg in enumerate(segs):
            s = float(seg.get("start", 0))
            e = float(seg.get("end", 0))
            is_last = (i == len(segs) - 1)
            if is_last:
                # Last (or only) segment always covers up to end_ts
                e = end_ts
            elif e > end_ts:
                # Intermediate segments clamped to window
                e = end_ts
            enforced_segs.append({**seg, "start": s, "end": e})

        moments.append({
            "start_timestamp": start_ts,
            "end_timestamp": end_ts,
            "segments": enforced_segs,
            "transcript_snippet": str(item.get("transcript_snippet", ""))[:500],
            "strength_score": float(item.get("strength_score", 0.5)),
            "selection_rationale": str(item.get("selection_rationale", "")),
            "narrative_summary": str(item.get("narrative_summary", "")),
            "hook_potential": str(item.get("hook_potential", "")),
            "total_duration_seconds": end_ts - start_ts,
        })

    return moments
