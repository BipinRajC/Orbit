"""YouTube audio extraction via yt-dlp."""
from __future__ import annotations

import asyncio
import os
import re
import tempfile
from pathlib import Path


_YT_ID_RE = re.compile(r"(?:v=|youtu\.be/|/shorts/|/embed/)([a-zA-Z0-9_-]{11})")


def _extract_video_id(url: str) -> str | None:
    m = _YT_ID_RE.search(url)
    return m.group(1) if m else None


def _ytdlp_auth_args() -> list[str]:
    """Extra yt-dlp args for cookies / proxy.

    YT_COOKIES_FILE: path to a Netscape-format cookies.txt exported from a
      logged-in browser. Authenticates the request and bypasses most
      datacenter-IP bot challenges.
    HTTPS_PROXY / HTTP_PROXY: standard proxy env vars; yt-dlp respects
      these automatically, but we also forward via --proxy for clarity.
    """
    args: list[str] = []
    cookies_file = os.getenv("YT_COOKIES_FILE")
    if cookies_file and os.path.exists(cookies_file):
        args.extend(["--cookies", cookies_file])
    proxy = os.getenv("HTTPS_PROXY") or os.getenv("HTTP_PROXY")
    if proxy:
        args.extend(["--proxy", proxy])
    return args


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
        *_ytdlp_auth_args(),
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

    Strategy:
      1. youtube-transcript-api (direct TimedText API call, no yt-dlp,
         not affected by player_client breakage / bot-detection on
         cloud IPs). Primary path.
      2. yt-dlp with broad sub-langs + player-client overrides. Fallback
         for the rare case where (1) fails (e.g. age-restricted videos).
      3. Return [] so the caller falls back to Whisper.

    Returns:
        (segments, title)  — segments is [] if no captions available.
    """
    import logging
    logger = logging.getLogger("orbitos.youtube")

    # ---------- Strategy 1: youtube-transcript-api ---------- #
    video_id = _extract_video_id(url)
    if video_id:
        try:
            segments = await asyncio.wait_for(
                asyncio.to_thread(_fetch_via_youtube_transcript_api, video_id),
                timeout=30.0,
            )
            if segments:
                logger.info(
                    "Fetched %d caption segments via youtube-transcript-api for %s",
                    len(segments), video_id,
                )
                # title not available from this API — caller will fill in
                # later via the yt-dlp audio download, or we fetch it now.
                title = await _fetch_title_only(url)
                return segments, title
        except asyncio.TimeoutError:
            logger.warning(
                "youtube-transcript-api timed out for %s — trying yt-dlp", video_id,
            )
        except Exception as exc:
            logger.warning(
                "youtube-transcript-api failed for %s (%s) — trying yt-dlp",
                video_id, exc,
            )

    # ---------- Strategy 2: yt-dlp ---------- #
    segments, title = await _fetch_captions_via_ytdlp(url)
    if segments:
        return segments, title

    return [], title


def _fetch_via_youtube_transcript_api(video_id: str) -> list[dict]:
    """Synchronous helper — runs in a thread.

    Uses youtube-transcript-api to fetch captions directly from YouTube's
    TimedText endpoint. Tries manual English first, then auto-generated,
    then any translatable language translated to English.

    Proxy support (REQUIRED in production — YouTube blocks datacenter IPs):
      - WEBSHARE_PROXY_USERNAME + WEBSHARE_PROXY_PASSWORD: routes through
        Webshare residential proxies via youtube-transcript-api's built-in
        WebshareProxyConfig (preferred — recommended by upstream).
      - HTTPS_PROXY / HTTP_PROXY: generic proxy URL fallback.
    """
    from youtube_transcript_api import YouTubeTranscriptApi  # type: ignore
    from youtube_transcript_api._errors import (  # type: ignore
        TranscriptsDisabled,
        NoTranscriptFound,
    )

    proxies = _build_proxies_dict()
    proxy_config = _build_webshare_proxy_config()

    # Support both youtube-transcript-api 0.6.x (static methods, proxies dict)
    # and 1.x (instance methods, proxy_config object). Try the modern API
    # first, fall back to the legacy one.
    transcript_list = None
    try:
        if proxy_config is not None:
            ytt_api = YouTubeTranscriptApi(proxy_config=proxy_config)
        else:
            ytt_api = YouTubeTranscriptApi()
        # 1.x API
        try:
            transcript_list = ytt_api.list(video_id)
        except AttributeError:
            # 0.6.x style on the instance — unlikely but safe
            transcript_list = YouTubeTranscriptApi.list_transcripts(
                video_id, proxies=proxies or None,
            )
    except TypeError:
        # 0.6.x: YouTubeTranscriptApi() takes no args, use static method.
        try:
            transcript_list = YouTubeTranscriptApi.list_transcripts(
                video_id, proxies=proxies or None,
            )
        except TranscriptsDisabled:
            return []
    except TranscriptsDisabled:
        return []

    if transcript_list is None:
        return []

    # Order of preference:
    en_codes = ["en", "en-US", "en-GB", "en-CA", "en-AU", "en-IN"]

    transcript = None
    # 1. Manually uploaded English
    try:
        transcript = transcript_list.find_manually_created_transcript(en_codes)
    except NoTranscriptFound:
        pass

    # 2. Auto-generated English
    if transcript is None:
        try:
            transcript = transcript_list.find_generated_transcript(en_codes)
        except NoTranscriptFound:
            pass

    # 3. Anything that's translatable to English
    if transcript is None:
        for t in transcript_list:
            if t.is_translatable:
                try:
                    transcript = t.translate("en")
                    break
                except Exception:
                    continue

    if transcript is None:
        return []

    raw = transcript.fetch()
    # Library returns objects in newer versions, dicts in older — handle both.
    segments: list[dict] = []
    for item in raw:
        start = item["start"] if isinstance(item, dict) else item.start
        duration = item["duration"] if isinstance(item, dict) else item.duration
        text = item["text"] if isinstance(item, dict) else item.text
        text = (text or "").strip()
        if not text:
            continue
        segments.append({
            "start": float(start),
            "end": float(start) + float(duration),
            "text": text,
        })
    return segments


def _build_proxies_dict() -> dict[str, str]:
    """Build a requests-style proxies dict from env vars."""
    proxies: dict[str, str] = {}
    https_proxy = os.getenv("HTTPS_PROXY") or os.getenv("https_proxy")
    http_proxy = os.getenv("HTTP_PROXY") or os.getenv("http_proxy")
    if https_proxy:
        proxies["https"] = https_proxy
    if http_proxy:
        proxies["http"] = http_proxy
    return proxies


def _build_webshare_proxy_config():
    """Return a WebshareProxyConfig if env vars are set, else None.

    Webshare residential proxies are the recommended way to bypass
    YouTube's datacenter-IP blocks. ~$1/mo for 10 rotating IPs.
    See https://github.com/jdepoix/youtube-transcript-api#working-around-ip-bans
    """
    user = os.getenv("WEBSHARE_PROXY_USERNAME")
    pw = os.getenv("WEBSHARE_PROXY_PASSWORD")
    if not (user and pw):
        return None
    try:
        from youtube_transcript_api.proxies import WebshareProxyConfig  # type: ignore
        return WebshareProxyConfig(proxy_username=user, proxy_password=pw)
    except ImportError:
        # youtube-transcript-api < 1.0 — fall back to setting HTTPS_PROXY env
        # to the Webshare endpoint URL ourselves.
        os.environ.setdefault(
            "HTTPS_PROXY",
            f"http://{user}:{pw}@p.webshare.io:80",
        )
        return None


async def _fetch_title_only(url: str) -> str | None:
    """Fetch just the video title via yt-dlp (fast, no download)."""
    import logging
    logger = logging.getLogger("orbitos.youtube")

    try:
        proc = await asyncio.create_subprocess_exec(
            "yt-dlp",
            "--no-playlist",
            "--skip-download",
            "--print", "title",
            "--no-warnings",
            "--no-check-certificate",
            *_ytdlp_auth_args(),
            url,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30.0)
        title = stdout.decode("utf-8", errors="replace").strip().splitlines()
        return title[-1] if title else None
    except Exception as exc:
        logger.info("Title fetch failed for %s: %s", url, exc)
        return None


async def _fetch_captions_via_ytdlp(url: str) -> tuple[list[dict], str | None]:
    """Fallback caption fetch via yt-dlp.

    Tries the default player clients first, then retries with explicit
    player_client overrides if no captions are produced. NOTE: the
    `android` client was broken by YouTube in late 2024 and now returns
    empty caption manifests — we use `mweb`/`tv`/`web` instead.
    """
    import logging
    logger = logging.getLogger("orbitos.youtube")

    # First attempt: yt-dlp defaults (works for most videos).
    segments, title = await _ytdlp_caption_attempt(url, player_client=None)
    if segments:
        return segments, title

    # Second attempt: explicit player_client override for the rare case
    # where the default web client gets bot-challenged.
    logger.info("yt-dlp default client returned no captions — retrying with mweb,tv")
    segments2, title2 = await _ytdlp_caption_attempt(url, player_client="mweb,tv,web")
    return segments2, title2 or title


async def _ytdlp_caption_attempt(
    url: str, player_client: str | None
) -> tuple[list[dict], str | None]:
    import logging
    logger = logging.getLogger("orbitos.youtube")

    tmp_dir = tempfile.mkdtemp(prefix="contentos_captions_")
    output_template = os.path.join(tmp_dir, "%(id)s.%(ext)s")

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
        *_ytdlp_auth_args(),
        url,
    ]
    if player_client:
        cmd.extend(["--extractor-args", f"youtube:player_client={player_client}"])

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=180.0)
    except asyncio.TimeoutError:
        proc.kill()
        logger.warning("yt-dlp caption fetch timed out for %s", url)
        return [], None

    title = stdout.decode("utf-8", errors="replace").strip().splitlines()[-1] if stdout else None
    stderr_text = stderr.decode("utf-8", errors="replace") if stderr else ""

    json3_files = sorted(Path(tmp_dir).glob("*.json3"))
    vtt_files = sorted(Path(tmp_dir).glob("*.vtt"))

    if not json3_files and not vtt_files:
        logger.warning(
            "yt-dlp produced no caption file for %s (exit %d, client=%s). stderr: %s",
            url, proc.returncode, player_client or "default", stderr_text[:600],
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
        logger.warning("Failed to parse caption file %s: %s", chosen, exc)
        return [], title

    if not segments:
        logger.warning("Caption file %s produced 0 segments", chosen.name)
        return [], title

    logger.info(
        "Fetched %d caption segments via yt-dlp (%s, client=%s)",
        len(segments), chosen.name, player_client or "default",
    )
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
