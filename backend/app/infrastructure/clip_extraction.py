"""Clip extraction — yt-dlp download + ffmpeg stitch. Source aspect preserved.
9:16 vertical crop is generated on-demand via the /export endpoint.
"""
from __future__ import annotations

import asyncio
import logging
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

from app.config import get_settings

logger = logging.getLogger("orbitos.clip_extraction")

# yt-dlp + ffmpeg sync strategy:
# yt-dlp with --download-sections does a stream copy that snaps the VIDEO to the
# nearest keyframe BEFORE the requested start, while AUDIO is cut near the exact
# start. This makes video play ahead of audio (audible drift of up to one GOP).
# To fix this we pull a padded window via yt-dlp (fast stream copy) and then
# ffmpeg-re-trim it to the exact start/end with re-encoding so A/V are locked.
KEYFRAME_LEAD_IN_SECS = 6.0   # safety pad before requested start (covers any reasonable GOP)
KEYFRAME_TAIL_PAD_SECS = 1.0  # safety pad after requested end


async def extract_clip(
    project_id: str,
    moment_id: str,
    source_url: str,
    segments: list[dict[str, Any]],
) -> str | None:
    """
    Download and stitch (if multi-segment) clip in SOURCE aspect ratio.
    No 9:16 crop — that happens on-demand via export endpoint.

    Returns the saved clip path on success, None on failure.
    """
    settings = get_settings()
    out_dir = Path(settings.clip_storage_path) / project_id
    out_dir.mkdir(parents=True, exist_ok=True)
    final_path = out_dir / f"{moment_id}.mp4"

    tmp_dir = tempfile.mkdtemp(prefix="orbitos_clip_")
    try:
        segment_files = await _download_segments(source_url, segments, tmp_dir)
        if not segment_files:
            logger.warning("No segments downloaded for moment %s", moment_id)
            return None

        if len(segment_files) > 1:
            stitched = await _stitch_segments(segment_files, tmp_dir)
        else:
            stitched = segment_files[0]

        shutil.move(str(stitched), str(final_path))
        logger.info("Clip saved (source aspect): %s", final_path)

        # Upload to Supabase Storage and return the public CDN URL.
        # Fall back to the local path if Supabase is unavailable so the
        # pipeline doesn't fail entirely on a transient upload error.
        try:
            from app.infrastructure.supabase import upload_clip
            object_path = f"{project_id}/{moment_id}.mp4"
            public_url = await asyncio.to_thread(upload_clip, str(final_path), object_path)
            logger.info("Clip uploaded to Supabase Storage: %s", public_url)
            return public_url
        except Exception as upload_exc:
            logger.warning(
                "Supabase Storage upload failed for moment %s — storing local path: %s",
                moment_id, upload_exc,
            )
            return str(final_path)

    except asyncio.TimeoutError:
        logger.error("Clip extraction timed out for moment %s", moment_id)
        return None
    except Exception as exc:
        logger.error("Clip extraction failed for moment %s: %s", moment_id, exc)
        return None
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


async def _download_segments(
    source_url: str,
    segments: list[dict[str, Any]],
    tmp_dir: str,
) -> list[str]:
    """Download each segment with yt-dlp (padded), then ffmpeg-re-trim to the
    exact window so audio and video stay in sync.

    yt-dlp's --download-sections uses stream copy without keyframe-aligned cuts
    (we deliberately don't pass --force-keyframes-at-cuts because that requires
    downloading the full source video, which is too slow). The padded download
    gives us a clip that starts at the closest keyframe BEFORE our real start;
    the ffmpeg re-encode then trims to the exact start/end frame and forces
    audio + video to share PTS 0.
    """
    files: list[str] = []
    for i, seg in enumerate(segments):
        start = float(seg.get("start", 0))
        end = float(seg.get("end", 0))

        yt_start = max(0.0, start - KEYFRAME_LEAD_IN_SECS)
        yt_end = end + KEYFRAME_TAIL_PAD_SECS
        raw_path = os.path.join(tmp_dir, f"raw_segment_{i}.mp4")
        trimmed_path = os.path.join(tmp_dir, f"segment_{i}.mp4")

        cmd = [
            "yt-dlp",
            "--download-sections", f"*{yt_start}-{yt_end}",
            "-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
            "--merge-output-format", "mp4",
            "-o", raw_path,
            "--no-playlist",
            "--quiet",
            "--no-check-certificate",   # corporate TLS-inspection proxy bypass
            source_url,
        ]

        try:
            await asyncio.wait_for(_run_cmd(cmd), timeout=60.0)
        except asyncio.TimeoutError:
            logger.warning("yt-dlp timed out on segment %d", i)
            continue
        except Exception as exc:
            logger.warning("yt-dlp error on segment %d: %s", i, exc)
            continue

        if not os.path.exists(raw_path):
            logger.warning("yt-dlp produced no output for segment %d", i)
            continue

        # Frame-accurate trim with re-encode so audio and video share PTS 0.
        offset = max(0.0, start - yt_start)
        duration = max(0.1, end - start)
        trim_cmd = [
            "ffmpeg", "-y",
            "-ss", f"{offset:.3f}",
            "-i", raw_path,
            "-t", f"{duration:.3f}",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
            "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
            "-movflags", "+faststart",
            "-avoid_negative_ts", "make_zero",
            "-fflags", "+genpts",
            trimmed_path,
        ]

        try:
            await asyncio.wait_for(_run_cmd(trim_cmd), timeout=60.0)
        except Exception as exc:
            logger.warning(
                "ffmpeg re-trim failed for segment %d (%s) — falling back to raw padded clip; "
                "A/V drift may be audible",
                i, exc,
            )
            # Fall back so the user at least gets a clip
            files.append(raw_path)
            continue

        if os.path.exists(trimmed_path):
            files.append(trimmed_path)
        else:
            logger.warning(
                "ffmpeg produced no trimmed output for segment %d — falling back to raw", i
            )
            files.append(raw_path)

    return files


async def _stitch_segments(segment_files: list[str], tmp_dir: str) -> str:
    """Concatenate multiple MP4 segments with ffmpeg concat demuxer.

    NOTE: uses -c copy. Today moments are single-segment so this path isn't hit;
    if multi-segment moments come back, switch this to a re-encode (libx264 + aac)
    to avoid join-point A/V drift, same as `_download_segments`.
    """
    concat_list = os.path.join(tmp_dir, "segments.txt")
    with open(concat_list, "w") as f:
        for path in segment_files:
            f.write(f"file '{path}'\n")

    stitched = os.path.join(tmp_dir, "stitched.mp4")
    cmd = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", concat_list,
        "-c", "copy",
        stitched,
    ]
    await asyncio.wait_for(_run_cmd(cmd), timeout=60.0)

    if os.path.exists(stitched):
        return stitched

    # Fallback: return first segment if stitch failed
    logger.warning("Stitch failed — falling back to primary segment only")
    return segment_files[0]


async def _crop_to_vertical(input_path: str, tmp_dir: str) -> str:
    """
    Center-crop to 9:16 vertical then scale to 1080x1920.
    Internal helper for _crop_to_vertical_on_demand.
    """
    output_path = os.path.join(tmp_dir, "vertical.mp4")
    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-vf", "crop=ih*9/16:ih,scale=1080:1920",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        output_path,
    ]
    await asyncio.wait_for(_run_cmd(cmd), timeout=120.0)
    if os.path.exists(output_path):
        return output_path
    return input_path


def _crop_to_vertical_on_demand(src: str, dst: str) -> None:
    """
    Synchronous blocking crop for use with asyncio.to_thread().
    Called by the /export endpoint to generate a 9:16 version on demand.
    """
    import subprocess
    cmd = [
        "ffmpeg", "-y",
        "-i", src,
        "-vf", "crop=ih*9/16:ih,scale=1080:1920",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        dst,
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg crop failed (exit {result.returncode}): "
            f"{result.stderr.decode()[-400:]}"
        )


async def _run_cmd(cmd: list[str]) -> None:
    """Run a subprocess command asynchronously, raising on non-zero exit."""
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(
            f"Command failed (exit {proc.returncode}): {' '.join(cmd[:3])}\n"
            f"{stderr.decode()[-500:]}"
        )


async def extract_clips_parallel(
    project_id: str,
    source_url: str,
    moments: list[dict[str, Any]],
) -> dict[str, str | None]:
    """
    Extract clips for all moments with bounded concurrency.
    Max 3 simultaneous extractions to stay within Render's memory limit.
    Returns dict mapping moment_id → clip URL (or None on failure).
    """
    semaphore = asyncio.Semaphore(3)

    async def _bounded(moment_id: str, coro: Any) -> str | None:
        async with semaphore:
            result = await coro
            return result if isinstance(result, (str, type(None))) else None

    tasks = {
        m["id"]: _bounded(
            m["id"],
            extract_clip(
                project_id=project_id,
                moment_id=m["id"],
                source_url=source_url,
                segments=m.get("segments") or [
                    {"start": m["start_timestamp"], "end": m["end_timestamp"], "role": "primary"}
                ],
            ),
        )
        for m in moments
    }
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)
    return {
        moment_id: (r if isinstance(r, (str, type(None))) else None)
        for moment_id, r in zip(tasks.keys(), results)
    }
