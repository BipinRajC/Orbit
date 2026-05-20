"""Clip extraction — yt-dlp download + ffmpeg stitch + 9:16 vertical crop."""
from __future__ import annotations

import asyncio
import logging
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

from app.config import get_settings

logger = logging.getLogger("contentos.clip_extraction")


async def extract_clip(
    project_id: str,
    moment_id: str,
    source_url: str,
    segments: list[dict[str, Any]],
) -> str | None:
    """
    Download, stitch (if multi-segment), and crop clip to 9:16 vertical MP4.

    Returns the saved clip path on success, None on failure.
    """
    settings = get_settings()
    out_dir = Path(settings.clip_storage_path) / project_id
    out_dir.mkdir(parents=True, exist_ok=True)
    final_path = out_dir / f"{moment_id}.mp4"

    tmp_dir = tempfile.mkdtemp(prefix="contentos_clip_")
    try:
        segment_files = await _download_segments(source_url, segments, tmp_dir)
        if not segment_files:
            logger.warning("No segments downloaded for moment %s", moment_id)
            return None

        if len(segment_files) > 1:
            stitched = await _stitch_segments(segment_files, tmp_dir)
        else:
            stitched = segment_files[0]

        cropped = await _crop_to_vertical(stitched, tmp_dir)
        shutil.move(str(cropped), str(final_path))
        logger.info("Clip saved: %s", final_path)
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
    """Download each segment using yt-dlp --download-sections."""
    files: list[str] = []
    for i, seg in enumerate(segments):
        start = float(seg.get("start", 0))
        end = float(seg.get("end", 0))
        out_path = os.path.join(tmp_dir, f"segment_{i}.mp4")

        cmd = [
            "yt-dlp",
            "--download-sections", f"*{start}-{end}",
            "--force-keyframes-at-cuts",
            "-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
            "--merge-output-format", "mp4",
            "-o", out_path,
            "--no-playlist",
            "--quiet",
            "--no-check-certificate",   # corporate TLS-inspection proxy bypass
            source_url,
        ]

        try:
            await asyncio.wait_for(
                _run_cmd(cmd),
                timeout=60.0,
            )
            if os.path.exists(out_path):
                files.append(out_path)
            else:
                logger.warning("yt-dlp produced no output for segment %d", i)
        except asyncio.TimeoutError:
            logger.warning("yt-dlp timed out on segment %d", i)
        except Exception as exc:
            logger.warning("yt-dlp error on segment %d: %s", i, exc)

    return files


async def _stitch_segments(segment_files: list[str], tmp_dir: str) -> str:
    """Concatenate multiple MP4 segments with ffmpeg concat demuxer."""
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
    From 1920x1080 → 608x1080 center crop → scale to 1080x1920.
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
    try:
        await asyncio.wait_for(_run_cmd(cmd), timeout=120.0)
        if os.path.exists(output_path):
            return output_path
    except Exception as exc:
        logger.warning("ffmpeg crop failed (%s) — serving original aspect", exc)

    # Fallback: serve original if crop failed
    return input_path


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
    Extract clips for all moments in parallel.
    Returns dict mapping moment_id → clip_path (or None on failure).
    """
    tasks = {
        m["id"]: extract_clip(
            project_id=project_id,
            moment_id=m["id"],
            source_url=source_url,
            segments=m.get("segments") or [
                {"start": m["start_timestamp"], "end": m["end_timestamp"], "role": "primary"}
            ],
        )
        for m in moments
    }
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)
    return {
        moment_id: (r if isinstance(r, (str, type(None))) else None)
        for moment_id, r in zip(tasks.keys(), results)
    }
