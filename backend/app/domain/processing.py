"""
Pipeline orchestration — the full DAG from URL to ready_for_review.

Stages:
  1. INGEST     — detect input type, fetch audio or transcript
  2. TRANSCRIBE — Groq Whisper → timestamped segments
  3. RECALL     — Hindsight recall() + reflect() → memory context
  4. EXTRACT    — Claude Haiku 4.5 → 7 persona-aware moments (5-chunk strategy)
  5. CLIP       — yt-dlp + ffmpeg → source-aspect MP4 files (parallel)
  6. GENERATE   — Claude Sonnet 4.5 → per-platform short-form deliverables
  7. FINALISE   — status = ready_for_review
"""
from __future__ import annotations

import asyncio
import traceback
from datetime import datetime, timezone
from typing import Any

from app.infrastructure.hindsight import recall_memories, reflect_on_creator
from app.infrastructure.supabase import (
    insert_derivatives,
    insert_moments,
    update_moment_clip,
    update_project_status,
)
from app.infrastructure.transcription import compute_duration, transcribe
from app.infrastructure.youtube import fetch_audio, fetch_transcript_from_youtube
from app.infrastructure.clip_extraction import extract_clips_parallel
from app.domain.moments import extract_moments
from app.domain.generation import generate_derivatives_for_moment


def _log(stage: str, message: str) -> dict[str, Any]:
    return {
        "stage": stage,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def run_pipeline(project_id: str, target_platforms: list[str] | None = None, video_intent: dict | None = None) -> None:
    """
    Full processing pipeline. Called as a FastAPI background task.
    Updates project status at each stage so the frontend can poll progress.
    """
    audio_path: str | None = None
    cost_usd: float = 0.0

    try:
        # ------------------------------------------------------------------ #
        # STAGE 1: INGEST
        # ------------------------------------------------------------------ #
        await update_project_status(
            project_id,
            status="processing",
            log_entry=_log("ingest", "Fetching audio from YouTube..."),
        )

        from app.infrastructure.supabase import _db
        proj = _db().table("content_projects").select(
            "source_url, target_platforms"
        ).eq("id", project_id).single().execute()
        source_url: str = proj.data["source_url"]

        # Resolve platforms: argument > DB column > config default
        if target_platforms is None:
            db_platforms = proj.data.get("target_platforms")
            if db_platforms:
                target_platforms = db_platforms
            else:
                from app.config import get_settings
                target_platforms = get_settings().default_platforms

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
            log_entry=_log("recall", "Recalling creator persona from Hindsight..."),
        )

        recall_result = await recall_memories(
            query=(
                "How does this creator prefer their content? Hook styles, editing preferences."
                + (
                    f" The current video is about: {video_intent.get('topic', '')}."
                    f" Creator goal: {video_intent.get('goal', '')}."
                    if video_intent and (video_intent.get('topic') or video_intent.get('goal'))
                    else ""
                )
            )
        )
        reflection = await reflect_on_creator(
            query="Summarise this creator's content preferences, persona, and style."
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
                f"Persona loaded — {recall_result.get('recall_count', 0)} memories recalled"
                if recall_result.get("recall_count", 0)
                else "No prior persona — generating with universal heuristics",
            ),
            memory_context=memory_context,
        )

        # Fetch creator profile to get persona styles for extraction
        persona_styles: list[str] = []
        try:
            from app.infrastructure.supabase import _db as _db_profile
            prof_res = _db_profile().table("creator_profiles").select("styles").eq(
                "id", "default"
            ).execute()
            if prof_res.data:
                persona_styles = prof_res.data[0].get("styles") or []
        except Exception:
            pass

        # ------------------------------------------------------------------ #
        # STAGE 4: EXTRACT moments (Claude Haiku 4.5)
        # ------------------------------------------------------------------ #
        await update_project_status(
            project_id,
            log_entry=_log("extract", "Finding the 7 best moments for your week of shorts..."),
        )

        moments = await extract_moments(
            segments=segments,
            memory_reflection=reflection,
            video_intent=video_intent,
            persona_styles=persona_styles,
        )

        await update_project_status(
            project_id,
            log_entry=_log("extract", f"Found {len(moments)} moments spread across the video"),
        )

        # Persist moments first so we have IDs for clip extraction
        db_moments = await insert_moments(project_id, moments)

        # ------------------------------------------------------------------ #
        # STAGE 5: CLIP — extract source-aspect MP4 files (parallel)
        # ------------------------------------------------------------------ #
        await update_project_status(
            project_id,
            log_entry=_log("clip", f"Extracting {len(db_moments)} clips..."),
        )

        clip_results = await extract_clips_parallel(
            project_id=project_id,
            source_url=source_url,
            moments=db_moments,
        )

        clips_ok = sum(1 for v in clip_results.values() if v is not None)
        clips_fail = len(clip_results) - clips_ok

        # Persist clip_url back to each moment; fall back to YT embed URL for failed clips
        def _yt_embed_url(url: str, start: float, end: float) -> str:
            import re
            vid_match = re.search(r"(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})", url)
            vid_id = vid_match.group(1) if vid_match else None
            if not vid_id:
                return url
            return f"https://www.youtube.com/embed/{vid_id}?start={int(start)}&end={int(end)}&rel=0&autoplay=1"

        moment_times = {m["id"]: (m.get("start_timestamp", 0), m.get("end_timestamp", 0)) for m in db_moments}

        for moment_id, clip_path in clip_results.items():
            start_t, end_t = moment_times.get(moment_id, (0, 0))
            if clip_path:
                clip_url = f"/api/clips/{project_id}/{moment_id}.mp4"
            else:
                # Store YT embed URL so the frontend can show a playable preview
                clip_url = _yt_embed_url(source_url, start_t, end_t)
            await update_moment_clip(moment_id, clip_url)

        await update_project_status(
            project_id,
            log_entry=_log(
                "clip",
                f"Clips extracted: {clips_ok} ok"
                + (f", {clips_fail} failed (YT embed fallback)" if clips_fail else ""),
            ),
        )

        # ------------------------------------------------------------------ #
        # STAGE 6: GENERATE derivatives (Claude Sonnet 4.5, concurrent)
        # ------------------------------------------------------------------ #
        platforms_str = ", ".join(target_platforms)
        await update_project_status(
            project_id,
            log_entry=_log(
                "generate",
                f"Generating short-form deliverables for {len(db_moments)} moments × {platforms_str}...",
            ),
        )

        # Re-fetch moments to get clip_url populated
        from app.infrastructure.supabase import _db as _db2
        refreshed_moments_res = _db2().table("moments").select("*").eq(
            "project_id", project_id
        ).order("sort_order").execute()
        refreshed_moments = refreshed_moments_res.data or db_moments

        gen_tasks = [
            generate_derivatives_for_moment(
                project_id=project_id,
                moment=m,
                memory_reflection=reflection,
                target_platforms=target_platforms,
            )
            for m in refreshed_moments
        ]
        all_derivatives = await asyncio.gather(*gen_tasks)

        for db_moment, derivatives in zip(refreshed_moments, all_derivatives):
            await insert_derivatives(project_id, db_moment["id"], derivatives)

        # ------------------------------------------------------------------ #
        # STAGE 7: FINALISE
        # ------------------------------------------------------------------ #
        await update_project_status(
            project_id,
            status="ready_for_review",
            log_entry=_log(
                "complete",
                f"Pipeline complete — {len(refreshed_moments)} moments, "
                f"{clips_ok} clips, {len(target_platforms)} platforms",
            ),
            cost_log={"total_cost_usd": cost_usd},
        )

    except Exception as exc:
        tb = traceback.format_exc()
        await update_project_status(
            project_id,
            status="failed",
            log_entry=_log("error", f"Pipeline failed: {exc}\n{tb[:500]}"),
            cost_log={"total_cost_usd": cost_usd},
        )
        raise
    finally:
        if audio_path:
            import os
            import shutil
            parent = os.path.dirname(audio_path)
            shutil.rmtree(parent, ignore_errors=True)
