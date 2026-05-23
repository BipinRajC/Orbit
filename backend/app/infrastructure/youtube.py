"""YouTube audio extraction via yt-dlp."""
from __future__ import annotations

import asyncio
import os
import tempfile
from pathlib import Path


async def fetch_audio(url: str) -> tuple[str, str | None]:
    """
    Download audio from a YouTube URL using yt-dlp.

    Returns:
        (audio_file_path, video_title)
        audio_file_path is a temp file — caller is responsible for cleanup.
    """
    import logging
    logger = logging.getLogger("orbitos.youtube")

    tmp_dir = tempfile.mkdtemp(prefix="contentos_")
    output_template = os.path.join(tmp_dir, "%(id)s.%(ext)s")

    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--extract-audio",
        "--audio-format", "mp3",
        "--audio-quality", "5",          # 128kbps — enough for Whisper
        "--output", output_template,
        "--print", "title",              # print title to stdout
        "--no-simulate",                 # --print implies --simulate in newer yt-dlp; override it
        "--no-check-certificate",        # corp proxy (CrowdStrike) intercepts TLS
        url,
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300.0)
    except asyncio.TimeoutError:
        proc.kill()
        raise RuntimeError("yt-dlp audio download timed out after 5 minutes")

    if proc.returncode != 0:
        error = stderr.decode("utf-8", errors="replace")
        logger.warning("yt-dlp audio download failed (exit %d): %s", proc.returncode, error[:500])
        raise RuntimeError(f"yt-dlp failed: {error[:500]}")

    title = stdout.decode("utf-8", errors="replace").strip().splitlines()[-1] if stdout else None

    # Find the downloaded file
    files = list(Path(tmp_dir).glob("*.mp3"))
    if not files:
        raise RuntimeError(f"yt-dlp produced no audio file in {tmp_dir}")

    return str(files[0]), title


async def fetch_transcript_from_youtube(url: str) -> tuple[list[dict], str | None]:
    """
    Try to fetch an auto-generated transcript from YouTube (faster than Whisper).
    Falls back to returning empty list (caller should then transcribe via Whisper).

    Returns:
        (segments, title)  — segments is [] if no auto-captions available.
    """
    import logging
    logger = logging.getLogger("orbitos.youtube")

    tmp_dir = tempfile.mkdtemp(prefix="contentos_captions_")
    output_template = os.path.join(tmp_dir, "%(id)s")

    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--write-auto-subs",
        "--sub-lang", "en",
        "--sub-format", "json3",
        "--skip-download",
        "--output", output_template,
        "--print", "title",
        "--no-simulate",                 # --print implies --simulate in newer yt-dlp; override it
        "--no-check-certificate",        # corp proxy (CrowdStrike) intercepts TLS
        url,
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60.0)
    except asyncio.TimeoutError:
        proc.kill()
        logger.warning("yt-dlp caption fetch timed out for %s — falling back to Whisper", url)
        return [], None

    title = stdout.decode("utf-8", errors="replace").strip().splitlines()[-1] if stdout else None

    # Parse json3 subtitle file if present
    json3_files = list(Path(tmp_dir).glob("*.json3"))
    if not json3_files:
        stderr_text = stderr.decode("utf-8", errors="replace") if stderr else ""
        logger.info(
            "No auto-captions found for %s (exit %d). yt-dlp stderr: %s",
            url, proc.returncode, stderr_text[:300],
        )
        return [], title

    import json
    raw = json.loads(json3_files[0].read_text())
    segments = _parse_json3(raw)
    return segments, title


def _parse_json3(raw: dict) -> list[dict]:
    """Convert YouTube json3 caption format to our segment format.

    YouTube auto-captions frequently set dDurationMs=0 on text events.
    When that happens we infer the duration from the next event's tStartMs
    so the transcript has meaningful end timestamps for the chunker and LLM.
    """
    raw_events = raw.get("events", [])
    segments = []
    for i, event in enumerate(raw_events):
        start_ms = event.get("tStartMs", 0)
        dur_ms = event.get("dDurationMs", 0)
        segs = event.get("segs")
        if not segs:
            continue
        text = "".join(s.get("utf8", "") for s in segs).strip()
        if not text or text == "\n":
            continue

        # When dDurationMs=0, look ahead to the next event with a later tStartMs
        if dur_ms == 0:
            for j in range(i + 1, min(i + 10, len(raw_events))):
                next_start = raw_events[j].get("tStartMs")
                if next_start and next_start > start_ms:
                    dur_ms = next_start - start_ms
                    break
            # Absolute fallback: assume 2-second caption display
            if dur_ms == 0:
                dur_ms = 2000

        segments.append({
            "start": start_ms / 1000.0,
            "end": (start_ms + dur_ms) / 1000.0,
            "text": text,
        })
    return segments
