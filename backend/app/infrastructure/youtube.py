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
    Try to fetch a YouTube transcript (manual or auto-generated) — much
    faster + cheaper than running Whisper on the audio.

    Falls back to returning empty list (caller should then transcribe via Whisper).

    Returns:
        (segments, title)  — segments is [] if no captions available.
    """
    import logging
    logger = logging.getLogger("orbitos.youtube")

    tmp_dir = tempfile.mkdtemp(prefix="contentos_captions_")
    output_template = os.path.join(tmp_dir, "%(id)s.%(ext)s")

    # Fetch BOTH manual and auto-generated subs, and accept any English
    # variant (en, en-US, en-GB, en-orig, a.en auto-translated, etc.).
    # yt-dlp will prefer manual when both exist.
    #
    # `--extractor-args youtube:player_client=android` is the standard
    # workaround for YouTube's bot-detection on cloud IPs — the android
    # player endpoint returns caption tracks reliably where the default
    # `web` client increasingly fails with "Sign in to confirm you're not
    # a bot" since 2024.
    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--write-subs",                  # manual / uploaded captions
        "--write-auto-subs",             # auto-generated fallback
        "--sub-langs", "en.*,en",        # any English variant
        "--sub-format", "json3/vtt/best",
        "--skip-download",
        "--output", output_template,
        "--print", "title",
        "--no-simulate",                 # --print implies --simulate; override it
        "--no-check-certificate",        # corp proxy (CrowdStrike) intercepts TLS
        "--no-warnings",
        "--extractor-args", "youtube:player_client=android,web",
        url,
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        # 180s — yt-dlp can be slow on cold-start containers / when YT
        # challenges the request. Captions are still cheaper than Whisper
        # so it's worth waiting.
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=180.0)
    except asyncio.TimeoutError:
        proc.kill()
        logger.warning("yt-dlp caption fetch timed out for %s — falling back to Whisper", url)
        return [], None

    title = stdout.decode("utf-8", errors="replace").strip().splitlines()[-1] if stdout else None
    stderr_text = stderr.decode("utf-8", errors="replace") if stderr else ""

    # Prefer json3 (richer timing info) but accept vtt as a fallback.
    json3_files = sorted(Path(tmp_dir).glob("*.json3"))
    vtt_files = sorted(Path(tmp_dir).glob("*.vtt"))

    if not json3_files and not vtt_files:
        logger.warning(
            "No captions found for %s (yt-dlp exit %d). stderr: %s",
            url, proc.returncode, stderr_text[:500],
        )
        return [], title

    # Prefer a non-auto manual track if present (filename has `.en.` not `.a.en.`)
    def _rank(p: Path) -> tuple[int, str]:
        name = p.name
        is_auto = ".a.en" in name or ".en-orig" in name
        return (1 if is_auto else 0, name)

    try:
        if json3_files:
            chosen = sorted(json3_files, key=_rank)[0]
            import json
            raw = json.loads(chosen.read_text(encoding="utf-8"))
            segments = _parse_json3(raw)
        else:
            chosen = sorted(vtt_files, key=_rank)[0]
            segments = _parse_vtt(chosen.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("Failed to parse caption file %s: %s — falling back to Whisper", chosen, exc)
        return [], title

    if not segments:
        logger.warning("Caption file %s produced 0 segments — falling back to Whisper", chosen.name)
        return [], title

    logger.info("Fetched %d caption segments from %s (%s)", len(segments), url, chosen.name)
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


def _parse_vtt(content: str) -> list[dict]:
    """Minimal WebVTT parser → our segment format.

    Used as a fallback when YouTube returns VTT instead of json3 (rare but
    happens for some uploaded subtitle tracks).
    """
    import re

    segments: list[dict] = []
    # Strip WEBVTT header + NOTE / STYLE blocks
    blocks = re.split(r"\n\n+", content.strip())
    ts_re = re.compile(
        r"(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})"
    )

    def _to_sec(h: str, m: str, s: str, ms: str) -> float:
        return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000.0

    for block in blocks:
        lines = [ln for ln in block.splitlines() if ln.strip()]
        if not lines:
            continue
        # Find the cue-timing line
        ts_line = next((ln for ln in lines if ts_re.search(ln)), None)
        if not ts_line:
            continue
        m = ts_re.search(ts_line)
        if not m:
            continue
        start = _to_sec(*m.group(1, 2, 3, 4))
        end = _to_sec(*m.group(5, 6, 7, 8))
        # Text lines after the cue-timing line; strip inline tags like <c>
        idx = lines.index(ts_line)
        text_lines = lines[idx + 1 :]
        text = " ".join(re.sub(r"<[^>]+>", "", ln) for ln in text_lines).strip()
        if not text:
            continue
        segments.append({"start": start, "end": end, "text": text})
    return segments
