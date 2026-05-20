"""
Pipeline orchestration — the full DAG from URL to ready_for_review.

Stages:
  1. INGEST    — detect input type, fetch audio or transcript
  2. TRANSCRIBE — Groq Whisper → timestamped segments
  3. RECALL    — Hindsight recall() + reflect() → memory context
  4. EXTRACT   — cascadeflow → 3-5 strongest moments
  5. GENERATE  — per-moment: hooks + tweets + framing (parallel)
  6. PERSIST   — write moments + derivatives to Supabase
"""
from __future__ import annotations

import asyncio
import traceback
from datetime import datetime, timezone
from typing import Any

from app.infrastructure.cascadeflow import CostAccumulator
from app.infrastructure.hindsight import recall_memories, reflect_on_creator
from app.infrastructure.supabase import (
    insert_derivatives,
    insert_moments,
    update_project_status,
)
from app.infrastructure.transcription import compute_duration, transcribe
from app.infrastructure.youtube import fetch_audio, fetch_transcript_from_youtube
from app.domain.moments import extract_moments
from app.domain.generation import generate_derivatives_for_moment


def _log(stage: str, message: str) -> dict[str, Any]:
    return {
        "stage": stage,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def run_pipeline(project_id: str) -> None:
    """
    Full processing pipeline. Called as a FastAPI background task.
    Updates project status at each stage so the frontend can poll progress.
    """
    cost_acc = CostAccumulator()
    audio_path: str | None = None

    try:
        # ------------------------------------------------------------------ #
        # STAGE 1: INGEST
        # ------------------------------------------------------------------ #
        await update_project_status(
            project_id,
            status="processing",
            log_entry=_log("ingest", "Fetching audio from YouTube..."),
        )

        # Try captions first (faster) — fall back to Whisper
        from app.infrastructure.supabase import _db
        proj = _db().table("content_projects").select("source_url").eq(
            "id", project_id
        ).single().execute()
        source_url: str = proj.data["source_url"]

        segments, title = await fetch_transcript_from_youtube(source_url)

        if segments:
            await update_project_status(
                project_id,
                log_entry=_log("ingest", f"Using YouTube auto-captions ({len(segments)} segments)"),
                title=title,
            )
        else:
            # ---------------------------------------------------------------- #
            # STAGE 2: TRANSCRIBE via Whisper
            # ---------------------------------------------------------------- #
            await update_project_status(
                project_id,
                log_entry=_log("transcribe", "No captions found — transcribing with Whisper..."),
                title=title,
            )
            audio_path, title = await fetch_audio(source_url)
            await update_project_status(
                project_id,
                log_entry=_log("transcribe", "Audio downloaded. Running Whisper transcription..."),
                title=title,
            )
            segments = await transcribe(audio_path)

        duration = compute_duration(segments)

        await update_project_status(
            project_id,
            status="processing",
            log_entry=_log("transcribe", f"Transcription complete — {len(segments)} segments, {duration}s"),
            title=title,
            transcript=segments,
            duration_seconds=duration,
        )

        # ------------------------------------------------------------------ #
        # STAGE 3: RECALL — pull creator memory
        # ------------------------------------------------------------------ #
        await update_project_status(
            project_id,
            log_entry=_log("recall", "Recalling creator memory from Hindsight..."),
        )

        recall_result = await recall_memories(
            query="How does this creator prefer their content? Hook styles, tweet style, editing preferences."
        )
        reflection = await reflect_on_creator(
            query="Summarise this creator's content preferences, voice, and style for generating hooks and tweets."
        )

        memory_context = {
            **recall_result,
            "reflection": reflection,
            "biases_applied": recall_result.get("recall_count", 0),
        }

        await update_project_status(
            project_id,
            log_entry=_log(
                "recall",
                f"Memory loaded — {recall_result.get('recall_count', 0)} memories recalled"
                if recall_result.get("recall_count", 0)
                else "No prior memory — generating with universal heuristics",
            ),
            memory_context=memory_context,
        )

        # ------------------------------------------------------------------ #
        # STAGE 4: EXTRACT moments
        # ------------------------------------------------------------------ #
        await update_project_status(
            project_id,
            log_entry=_log("extract", "Identifying strongest moments with cascadeflow..."),
        )

        moments = await extract_moments(
            segments=segments,
            memory_reflection=reflection,
            cost_acc=cost_acc,
        )

        await update_project_status(
            project_id,
            log_entry=_log("extract", f"Found {len(moments)} strong moments"),
        )

        # ------------------------------------------------------------------ #
        # STAGE 5: GENERATE derivatives (parallel per moment)
        # ------------------------------------------------------------------ #
        await update_project_status(
            project_id,
            log_entry=_log("generate", f"Generating production briefs (3 platforms) for {len(moments)} moments..."),
        )

        db_moments = await insert_moments(project_id, moments)

        # Process moments sequentially to avoid Groq rate limits
        # (each moment still runs its 3 derivative calls in parallel)
        for db_moment in db_moments:
            derivatives = await generate_derivatives_for_moment(
                project_id=project_id,
                moment=db_moment,
                memory_reflection=reflection,
                cost_acc=cost_acc,
            )
            await insert_derivatives(project_id, db_moment["id"], derivatives)

        # ------------------------------------------------------------------ #
        # STAGE 6: FINALISE
        # ------------------------------------------------------------------ #
        cost_dict = cost_acc.to_dict()
        await update_project_status(
            project_id,
            status="ready_for_review",
            log_entry=_log(
                "complete",
                f"Pipeline complete — {cost_dict['total_calls']} LLM calls, "
                f"{cost_dict['drafter_pct']}% handled by fast model, "
                f"cost: ${cost_dict['total_cost_usd']:.4f}",
            ),
            cost_log=cost_dict,
        )

    except Exception as exc:
        tb = traceback.format_exc()
        await update_project_status(
            project_id,
            status="processing",   # keep as processing so UI shows error in log
            log_entry=_log("error", f"Pipeline failed: {exc}\n{tb[:500]}"),
            cost_log=cost_acc.to_dict(),
        )
        raise
    finally:
        # Clean up downloaded audio temp file
        if audio_path:
            import os
            import shutil
            parent = os.path.dirname(audio_path)
            shutil.rmtree(parent, ignore_errors=True)
