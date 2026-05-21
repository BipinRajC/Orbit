"""Transcription via Groq Whisper."""
from __future__ import annotations

import asyncio
import math
import os
from pathlib import Path

from groq import Groq

from app.config import get_settings

# Groq Whisper file size limit (25 MB)
MAX_FILE_BYTES = 24 * 1024 * 1024


def _get_groq() -> Groq:
    return Groq(api_key=get_settings().groq_api_key)


async def transcribe(audio_path: str) -> list[dict]:
    """
    Transcribe an audio file using Groq Whisper.

    Automatically chunks files larger than the 25 MB limit.

    Returns:
        List of segments: [{"start": float, "end": float, "text": str}, ...]
    """
    size = os.path.getsize(audio_path)

    if size <= MAX_FILE_BYTES:
        return await _transcribe_file(audio_path, offset_seconds=0.0)

    # Split into chunks and transcribe each with adjusted timestamps
    return await _transcribe_chunked(audio_path)


async def _transcribe_file(path: str, offset_seconds: float = 0.0) -> list[dict]:
    """Transcribe a single file and apply a timestamp offset."""
    client = _get_groq()

    with open(path, "rb") as f:
        response = client.audio.transcriptions.create(
            model="whisper-large-v3-turbo",
            file=f,
            response_format="verbose_json",
            timestamp_granularities=["segment"],
        )

    segments = []
    for seg in response.segments or []:
        # Groq SDK may return segment as dict or typed object depending on version
        start = seg["start"] if isinstance(seg, dict) else seg.start
        end = seg["end"] if isinstance(seg, dict) else seg.end
        text = seg["text"] if isinstance(seg, dict) else seg.text
        segments.append({
            "start": start + offset_seconds,
            "end": end + offset_seconds,
            "text": text.strip(),
        })
    return segments


async def _transcribe_chunked(audio_path: str) -> list[dict]:
    """Split large audio into ~20 MB chunks and transcribe each."""
    import subprocess

    size = os.path.getsize(audio_path)
    n_chunks = math.ceil(size / MAX_FILE_BYTES)

    # Get total duration via ffprobe
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", audio_path],
        capture_output=True, text=True
    )
    total_duration = float(result.stdout.strip() or "0")
    chunk_duration = total_duration / n_chunks

    all_segments: list[dict] = []
    tmp_dir = Path(audio_path).parent

    for i in range(n_chunks):
        chunk_path = str(tmp_dir / f"chunk_{i}.mp3")
        start = i * chunk_duration
        subprocess.run([
            "ffmpeg", "-y", "-i", audio_path,
            "-ss", str(start),
            "-t", str(chunk_duration),
            "-c", "copy",
            chunk_path,
        ], capture_output=True, check=True)

        segments = await _transcribe_file(chunk_path, offset_seconds=start)
        all_segments.extend(segments)

    return all_segments


def format_transcript_for_prompt(segments: list[dict], max_chars: int = 60000) -> str:
    """Format transcript segments as a readable string for LLM prompts."""
    lines = []
    total = 0
    for seg in segments:
        start = _fmt_time(seg["start"])
        end = _fmt_time(seg["end"])
        line = f"[{start} - {end}] {seg['text']}"
        if total + len(line) > max_chars:
            lines.append("... [transcript truncated]")
            break
        lines.append(line)
        total += len(line)
    return "\n".join(lines)


def _fmt_time(seconds: float) -> str:
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m:02d}:{s:02d}"


def compute_duration(segments: list[dict]) -> int:
    """Return total duration in seconds from the last segment end."""
    if not segments:
        return 0
    return int(segments[-1]["end"])
