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
        "--no-progress",
        url,
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        error = stderr.decode("utf-8", errors="replace")
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
        "--no-progress",
        url,
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    title = stdout.decode("utf-8", errors="replace").strip().splitlines()[-1] if stdout else None

    # Parse json3 subtitle file if present
    json3_files = list(Path(tmp_dir).glob("*.json3"))
    if not json3_files:
        return [], title

    import json
    raw = json.loads(json3_files[0].read_text())
    segments = _parse_json3(raw)
    return segments, title


def _parse_json3(raw: dict) -> list[dict]:
    """Convert YouTube json3 caption format to our segment format."""
    segments = []
    for event in raw.get("events", []):
        start_ms = event.get("tStartMs", 0)
        dur_ms = event.get("dDurationMs", 0)
        segs = event.get("segs")
        if not segs:
            continue
        text = "".join(s.get("utf8", "") for s in segs).strip()
        if not text or text == "\n":
            continue
        segments.append({
            "start": start_ms / 1000.0,
            "end": (start_ms + dur_ms) / 1000.0,
            "text": text,
        })
    return segments
