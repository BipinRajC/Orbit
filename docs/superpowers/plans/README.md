# ClipCraft — Handoff Document

**Hackathon:** Hack With Bangalore — Building AI Agents with Hindsight & cascadeflow
**Date:** 2026-05-20 | **Repo:** `JDeep1234/Hackathon`

---

# PART A — PRODUCT & WORKFLOW PLAN
> What ClipCraft is, why it wins, and what the demo looks like. Read this before touching any code.

---

## A1. What ClipCraft Is

A creator pastes a YouTube URL. ClipCraft downloads it, transcribes it, scores every segment for clip potential using AI, extracts the top 5 clips as 9:16 MP4s, and lets the creator approve or reject each one. Every decision gets stored in Hindsight memory. The next video it processes reflects what the creator taught it.

**One sentence:** YouTube URL in → smart vertical clips out → gets better every session.

**What it is NOT:** A chatbot. A blog generator. A social thread tool. It does **one thing** — clip extraction — and makes memory + cost optimization the visible story.

---

## A2. Why This Wins

### Market Signal
Opus Clip charges $19/month and doesn't learn. Descript charges $24/month and doesn't learn. A tool that visibly improves each session is a different product category. Creators would pay $50/month for that.

### Judging Criteria

| Criteria | Weight | How ClipCraft Scores |
|---|---|---|
| **Innovation** | 30% | No other clipper uses session memory. The before/after of clip quality across two videos IS the innovation. |
| **Use of Hindsight & cascadeflow** | 25% | Both are first-class, visible in the UI. Memory panel shows what Hindsight loaded. Cost panel shows real cascadeflow numbers. Not bolted on — central to the product. |
| **Technical Implementation** | 20% | Clean 7-file pipeline. Each step is a single-purpose function. All edge cases documented. |
| **User Experience** | 15% | Streamlit shows clips inline + reasoning panel + memory count + cost breakdown. Story tells itself in 60 seconds. |
| **Real-world Impact** | 10% | Validated pain point. Solves creator burnout. Direct ROI: more clips = more views = more revenue. |

---

## A3. The Demo Story (60 seconds)

1. Paste a YouTube URL → click **Generate Clips**
2. Progress bar: Downloading → Transcribing → Recalling memory → Scoring → Extracting
3. UI shows 5 clips with scores, hook types, suggested titles
4. Intelligence panel shows: *"No prior memory — scored objectively"*
5. Creator keeps 2, rejects 3, adds note: *"I prefer question hooks under 45 seconds"*
6. Click **Save Feedback to Memory** → Hindsight stores the feedback
7. Paste a second YouTube URL → Generate Clips again
8. Intelligence panel now shows: *"Prioritizing question hooks under 45s based on your past feedback"*
9. Clip selection is visibly different — shorter clips, more question-hook types
10. Cost panel: *"71% handled by cheap model. Total cost: $0.002. Saved: 64%"*

**Pre-demo:** Run on a real video the night before. Give real feedback on the clips. Demo with genuine memory, not seeds. If seeds are needed, label them clearly in the UI as "Demo Mode — 5 baseline memories loaded."

---

## A4. Architecture

```
YouTube URL
  │
  ▼
[1. DOWNLOAD]    yt-dlp → video.mp4 + metadata
  │              ffmpeg → audio.wav (16kHz mono)
  │
  ▼
[2. TRANSCRIBE]  Groq whisper-large-v3-turbo → timestamped segments
  │              (audio chunked into ≤10min pieces to stay under 25MB limit)
  │
  ▼
[3. RECALL]      Hindsight recall()  → raw memory text (shown in UI)
  │              Hindsight reflect() → compact synthesis (fed to scoring prompt)
  │
  ▼
[4. SCORE]       cascadeflow CascadeAgent → 8b drafter, 70b verifier
  │              Transcript chunked into ~4000-token windows
  │              Reflect synthesis injected as creator context
  │              Each chunk returns scored JSON array
  │
  ▼
[5. CLIP]        ffmpeg: fast-seek trim + 9:16 center crop → clip_01.mp4 … clip_05.mp4
  │
  ▼
[6. REVIEW]      Streamlit: play clips + keep/reject/rate/notes
  │
  ▼
[7. RETAIN]      Hindsight retain() → store each feedback decision
                 Next session's recall() returns these memories
```

---

## A5. Tech Stack

| Component | Tool |
|---|---|
| Language | Python 3.11 |
| UI | Streamlit |
| Video download | yt-dlp |
| Video/audio processing | ffmpeg (subprocess) |
| Transcription | Groq Whisper API (`whisper-large-v3-turbo`) — free tier |
| LLM scoring | cascadeflow `CascadeAgent` with Groq models |
| Memory | Hindsight (`hindsight-client`) — vectorize.io cloud |

### Models

| Task | Model | Why |
|---|---|---|
| Transcription | `whisper-large-v3-turbo` | Free, fast, segment timestamps |
| Scoring — drafter | `llama-3.1-8b-instant` | Handles ~70% of chunks cheaply |
| Scoring — verifier | `llama-3.3-70b-versatile` | Escalated only when 8b quality fails |

All on Groq free tier. No paid keys needed for the demo.

---

## A6. MVP Scope

| In | Out |
|---|---|
| YouTube URL input | Instagram / TikTok ingestion |
| Whisper transcription (chunked) | Speaker diarization |
| Segment scoring with cascadeflow | Any format other than clips |
| 5 vertical 9:16 clips as MP4 | Auto-publishing to platforms |
| Center crop (ffmpeg) | Smart face crop (MediaPipe) |
| Approve / reject / rate / notes UI | Blog / thread generation |
| Hindsight memory across sessions | Per-creator auth / multi-user |
| ZIP download | Platform OAuth |
| Cost dashboard (cascadeflow) | Performance analytics import |

---

# PART B — IMPLEMENTATION GUIDE
> Everything an LLM coding agent needs to build ClipCraft from scratch. No gaps, no placeholders.

---

## B1. File Structure

```
clipcraft/
├── app.py           # Streamlit UI — single entry point
├── pipeline.py      # Orchestrator: runs all 5 steps, returns result dict
├── config.py        # All env vars, constants, model names
│
├── steps/
│   ├── download.py  # yt-dlp + ffmpeg audio extraction
│   ├── transcribe.py# Groq Whisper with audio chunking
│   ├── scorer.py    # cascadeflow CascadeAgent + chunk_segments + merge_overlapping
│   ├── clipper.py   # ffmpeg clip extraction + generate_srt
│   └── memory.py    # Hindsight recall / reflect / retain
│
├── seed/
│   └── seed_demo.py # Pre-seed demo memories (run once before demo)
│
├── outputs/         # Generated clips land here — add to .gitignore
├── .env
└── requirements.txt
```

---

## B2. config.py

```python
import os
from dotenv import load_dotenv

load_dotenv()

# --- API keys ---
GROQ_API_KEY       = os.environ["GROQ_API_KEY"]
HINDSIGHT_BASE_URL = os.environ["HINDSIGHT_BASE_URL"].rstrip("/")  # critical: no trailing slash
HINDSIGHT_API_KEY  = os.environ["HINDSIGHT_API_KEY"]

# --- Hindsight ---
# Use f"clipcraft-{creator_name}" for multi-creator support
BANK_ID = os.environ.get("MEMORY_BANK_ID", "clipcraft")

BANK_BACKGROUND = (
    "A video clip intelligence memory system for content creators. "
    "Tracks which clip styles, topics, hooks, durations, and formats a creator prefers. "
    "Learns from approved and rejected clips to improve future scoring."
)
BANK_DISPOSITION = {
    "skepticism": 3,   # balanced — don't over-trust small sample sizes
    "literalism": 4,   # precise about clip attributes (durations, hook types)
    "empathy": 2,      # data-driven, not emotional
}

# --- cascadeflow models ---
DRAFTER_MODEL  = "llama-3.1-8b-instant"
VERIFIER_MODEL = "llama-3.3-70b-versatile"
DRAFTER_COST   = 0.00001
VERIFIER_COST  = 0.0001

# --- Groq Whisper ---
WHISPER_MODEL     = "whisper-large-v3-turbo"
AUDIO_CHUNK_SECS  = 600   # 10 minutes — keeps WAV under Groq's 25MB limit

# --- Pipeline constants ---
TOP_K_CLIPS       = 5
MIN_CLIP_SCORE    = 0.6
MAX_CHUNK_TOKENS  = 4000
SCORE_OVERLAP     = 2     # segments to carry over between scoring chunks

# --- Outputs ---
OUTPUTS_DIR = "outputs"
```

---

## B3. steps/download.py

```python
import subprocess
import json
import os

def download_video(url: str, output_dir: str) -> dict:
    """Download video with yt-dlp and extract audio with ffmpeg.
    Returns metadata dict. Single YouTube request — metadata comes from --print-json.
    """
    os.makedirs(output_dir, exist_ok=True)
    video_path = f"{output_dir}/video.mp4"
    audio_path = f"{output_dir}/audio.wav"

    # Download video + print JSON metadata to stdout in one pass
    result = subprocess.run([
        "yt-dlp",
        "-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
        "--merge-output-format", "mp4",
        "-o", video_path,
        "--no-playlist",
        "--print-json",   # writes JSON to stdout; progress goes to stderr
        url,
    ], capture_output=True, text=True, check=True)

    # yt-dlp prints one JSON object per video to stdout
    metadata = json.loads(result.stdout.strip().splitlines()[-1])

    # Extract audio: 16kHz mono PCM WAV — optimal for Whisper
    subprocess.run([
        "ffmpeg", "-i", video_path,
        "-vn", "-acodec", "pcm_s16le",
        "-ar", "16000", "-ac", "1",
        audio_path, "-y",
    ], check=True, capture_output=True)

    return {
        "video_path": video_path,
        "audio_path": audio_path,
        "title":    metadata.get("title", "Untitled"),
        "duration": metadata.get("duration", 0),
        "chapters": metadata.get("chapters", []),
    }
```

---

## B4. steps/transcribe.py

Audio chunking is **always used** — any video over ~13 minutes exceeds Groq's 25MB WAV limit.

```python
import openai
import subprocess
import json
import os
from config import GROQ_API_KEY, WHISPER_MODEL, AUDIO_CHUNK_SECS


def chunk_audio(audio_path: str) -> list[tuple[str, float]]:
    """Split audio into ≤10-minute WAV chunks. Returns list of (path, offset_seconds)."""
    # Get total duration via ffprobe
    probe = subprocess.run([
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_format", audio_path,
    ], capture_output=True, text=True, check=True)
    total_duration = float(json.loads(probe.stdout)["format"]["duration"])

    chunk_dir = os.path.dirname(audio_path)
    chunks = []
    offset = 0.0

    while offset < total_duration:
        chunk_path = os.path.join(chunk_dir, f"chunk_{int(offset):06d}.wav")
        subprocess.run([
            "ffmpeg",
            "-ss", str(offset),
            "-i", audio_path,
            "-t", str(AUDIO_CHUNK_SECS),
            "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            chunk_path, "-y",
        ], check=True, capture_output=True)
        chunks.append((chunk_path, offset))
        offset += AUDIO_CHUNK_SECS

    return chunks


def transcribe(audio_path: str, groq_api_key: str = GROQ_API_KEY) -> list[dict]:
    """Transcribe audio. Always chunks to handle Groq's 25MB limit.
    Returns list of segment dicts with start, end, text.
    """
    client = openai.OpenAI(
        api_key=groq_api_key,
        base_url="https://api.groq.com/openai/v1",
    )

    all_segments = []

    for chunk_path, offset in chunk_audio(audio_path):
        with open(chunk_path, "rb") as f:
            response = client.audio.transcriptions.create(
                model=WHISPER_MODEL,
                file=f,
                response_format="verbose_json",
                # DO NOT pass timestamp_granularities — Groq doesn't support it
                # and may return a 400 error. Segment-level timestamps are sufficient.
            )

        for seg in response.segments:
            # OpenAI SDK returns Pydantic objects — use attribute access, not dict
            all_segments.append({
                "start": seg.start + offset,
                "end":   seg.end   + offset,
                "text":  seg.text.strip(),
                "words": [],   # Groq whisper does not return word-level timestamps
            })

    if not all_segments:
        raise ValueError("No speech detected in this video.")

    return all_segments
```

---

## B5. steps/scorer.py

Contains `score_highlights` (main), `chunk_segments` (helper), `merge_overlapping` (helper), and the cascadeflow setup.

```python
import json
import asyncio
import nest_asyncio
from cascadeflow import CascadeAgent, ModelConfig
from config import DRAFTER_MODEL, VERIFIER_MODEL, DRAFTER_COST, VERIFIER_COST
from config import MAX_CHUNK_TOKENS, SCORE_OVERLAP, MIN_CLIP_SCORE, TOP_K_CLIPS

# Streamlit may already be running an event loop; nest_asyncio makes asyncio.run() safe inside it
nest_asyncio.apply()


# ---------------------------------------------------------------------------
# CascadeAgent setup
# ---------------------------------------------------------------------------

def create_clip_scorer() -> CascadeAgent:
    return CascadeAgent(models=[
        ModelConfig(name=DRAFTER_MODEL,  provider="groq", cost=DRAFTER_COST),
        ModelConfig(name=VERIFIER_MODEL, provider="groq", cost=VERIFIER_COST),
    ])


async def _run_agent(agent: CascadeAgent, prompt: str):
    """Thin async wrapper — CascadeAgent.run() is always async."""
    return await agent.run(prompt)


# ---------------------------------------------------------------------------
# Scoring prompt
# ---------------------------------------------------------------------------

SCORING_PROMPT = """You are a video clip analyst. Score each transcript segment for short-form clip potential.

## Creator Context (from memory)
{memory_context}

## Transcript Segments
{segments_json}

## Scoring Criteria
For each segment, score 0.0–1.0 on:
- standalone: Does this make sense without surrounding context?
- hook: Does the opening grab attention? (question, bold claim, surprising fact)
- emotional: Does it evoke curiosity, surprise, humor, or pain?
- quotable: Is there a punchy, shareable line?

Return a JSON array only. No explanation, no markdown fences.
[
  {{
    "segment_index": 0,
    "start": 12.4,
    "end": 28.1,
    "overall_score": 0.91,
    "hook_type": "question",
    "tags": ["hook", "quotable"],
    "reason": "Strong contrarian claim with clear setup",
    "suggested_title": "The ONE thing most people get wrong"
  }}
]

Only include segments with overall_score >= {min_score}. Max {top_k} results. Sort by overall_score descending.
"""


# ---------------------------------------------------------------------------
# Helper: chunk transcript segments into ~4000-token windows
# ---------------------------------------------------------------------------

def chunk_segments(
    segments: list[dict],
    max_tokens: int = MAX_CHUNK_TOKENS,
    overlap: int = SCORE_OVERLAP,
) -> list[list[dict]]:
    """Group segments into windows of ~max_tokens with overlap at boundaries.
    Uses word count * 1.3 as a token proxy (no tiktoken dependency needed).
    """
    chunks: list[list[dict]] = []
    current: list[dict] = []
    current_tokens = 0

    for seg in segments:
        seg_tokens = int(len(seg["text"].split()) * 1.3)

        if current_tokens + seg_tokens > max_tokens and current:
            chunks.append(current)
            current = current[-overlap:]   # carry last N segments for context continuity
            current_tokens = sum(int(len(s["text"].split()) * 1.3) for s in current)

        current.append(seg)
        current_tokens += seg_tokens

    if current:
        chunks.append(current)

    return chunks


# ---------------------------------------------------------------------------
# Helper: merge overlapping highlight windows
# ---------------------------------------------------------------------------

def merge_overlapping(highlights: list[dict]) -> list[dict]:
    """Merge highlights whose time windows overlap. Keeps higher-scored segment's metadata."""
    if not highlights:
        return []

    sorted_h = sorted(highlights, key=lambda h: h["start"])
    merged = [dict(sorted_h[0])]

    for current in sorted_h[1:]:
        last = merged[-1]
        if current["start"] < last["end"]:   # overlap detected
            if current["overall_score"] >= last["overall_score"]:
                merged[-1] = {**current, "start": last["start"], "end": max(last["end"], current["end"])}
            else:
                merged[-1]["end"] = max(last["end"], current["end"])
        else:
            merged.append(dict(current))

    return merged


# ---------------------------------------------------------------------------
# Main scoring function
# ---------------------------------------------------------------------------

def score_highlights(
    segments: list[dict],
    memory_context: str,
    cascade_agent: CascadeAgent,
) -> tuple[list[dict], dict]:
    """
    Score transcript segments for clip potential using cascadeflow CascadeAgent.
    Returns (top_highlights, cost_log).
    """
    chunks = chunk_segments(segments)
    all_highlights: list[dict] = []
    cost_log = {"total": 0.0, "by_8b": 0, "by_70b": 0, "calls": 0}

    for chunk in chunks:
        prompt = SCORING_PROMPT.format(
            memory_context=memory_context or "No prior memory. Score objectively.",
            segments_json=json.dumps(chunk, ensure_ascii=False),
            min_score=MIN_CLIP_SCORE,
            top_k=TOP_K_CLIPS * 2,   # ask for 2x, dedup + trim later
        )

        # agent.run() is always async — use asyncio.run() for sync Streamlit context
        result = asyncio.run(_run_agent(cascade_agent, prompt))

        # Track costs
        cost_log["calls"] += 1
        cost_log["total"] += result.total_cost
        if result.model_used == DRAFTER_MODEL:   # exact match is safer than substring
            cost_log["by_8b"] += 1
        else:
            cost_log["by_70b"] += 1

        # Parse JSON — strip markdown fences if LLM wrapped the response
        raw = result.content.strip()
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        start_idx = raw.find("[")
        end_idx   = raw.rfind("]") + 1
        if start_idx == -1:
            continue   # model returned nothing usable for this chunk
        raw = raw[start_idx:end_idx]

        try:
            highlights = json.loads(raw)
            all_highlights.extend(highlights)
        except json.JSONDecodeError:
            continue   # skip malformed chunk, not fatal

    all_highlights = merge_overlapping(all_highlights)
    all_highlights.sort(key=lambda h: h["overall_score"], reverse=True)
    return all_highlights[:TOP_K_CLIPS], cost_log
```

---

## B6. steps/clipper.py

```python
import subprocess
import os


def extract_clip(video_path: str, start: float, end: float, output_path: str) -> str:
    """Trim video and crop to 9:16. Fast-seek with -ss before -i."""
    padding = 0.5
    actual_start = max(0.0, start - padding)
    duration = (end + padding) - actual_start

    # -ss BEFORE -i = fast seek (decode from nearest keyframe, not from t=0)
    # -t = clip duration relative to seek point
    subprocess.run([
        "ffmpeg",
        "-ss", str(actual_start),
        "-i",  video_path,
        "-t",  str(duration),
        "-vf", "crop=ih*9/16:ih",   # center crop to 9:16 aspect ratio
        "-c:a", "aac",
        output_path, "-y",
    ], check=True, capture_output=True)

    return output_path


def generate_srt(segments: list[dict], start_offset: float, srt_path: str) -> None:
    """Generate an SRT caption file from segment-level timestamps.
    Used for caption burn-in (stretch goal — skip if Groq doesn't return timestamps).
    """
    def fmt(seconds: float) -> str:
        h  = int(seconds // 3600)
        m  = int((seconds % 3600) // 60)
        s  = int(seconds % 60)
        ms = int((seconds % 1) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    with open(srt_path, "w", encoding="utf-8") as f:
        for i, seg in enumerate(segments, 1):
            t_start = max(0.0, seg["start"] - start_offset)
            t_end   = max(0.0, seg["end"]   - start_offset)
            text    = seg["text"].strip()
            if text:
                f.write(f"{i}\n{fmt(t_start)} --> {fmt(t_end)}\n{text}\n\n")


def extract_clip_with_captions(
    video_path: str,
    start: float,
    end: float,
    output_path: str,
    segments: list[dict],   # transcript segments that fall within [start, end]
) -> str:
    """Trim + crop + burn segment-level captions. Stretch goal — only call if you have segments."""
    srt_path = output_path.replace(".mp4", ".srt")
    generate_srt(segments, start_offset=start, srt_path=srt_path)

    padding = 0.5
    actual_start = max(0.0, start - padding)
    duration = (end + padding) - actual_start

    subprocess.run([
        "ffmpeg",
        "-ss", str(actual_start),
        "-i",  video_path,
        "-t",  str(duration),
        "-vf", (
            f"crop=ih*9/16:ih,"
            f"subtitles={srt_path}:force_style="
            "'FontSize=22,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Alignment=2'"
        ),
        "-c:a", "aac",
        output_path, "-y",
    ], check=True, capture_output=True)

    return output_path
```

---

## B7. steps/memory.py

All 4 Hindsight call sites. Uses **sync methods directly** — no wrapper needed.

```python
from hindsight_client import Hindsight
from config import BANK_ID, BANK_BACKGROUND, BANK_DISPOSITION


# ---------------------------------------------------------------------------
# Bank initialization (idempotent — call on every startup)
# ---------------------------------------------------------------------------

def init_bank(hindsight: Hindsight, bank_id: str = BANK_ID) -> None:
    """Create or update the memory bank. Safe to call multiple times."""
    hindsight.create_bank(
        bank_id=bank_id,
        name="ClipCraft Memory",
        background=BANK_BACKGROUND,
        disposition=BANK_DISPOSITION,
    )


# ---------------------------------------------------------------------------
# Call 1: RECALL — pull raw memories before scoring
# ---------------------------------------------------------------------------

def recall_clip_preferences(hindsight: Hindsight, bank_id: str = BANK_ID) -> tuple[str, int]:
    """Return (raw_memory_text, memory_count). raw_text shown in UI memory panel."""
    result = hindsight.recall(
        bank_id=bank_id,
        query="clip preferences hook types duration styles approved rejected feedback",
        budget="mid",   # "low" ~512 tokens | "mid" ~2048 | "high" ~4096
    )
    memories = result.results   # list of objects with .text and .type
    raw_text = "\n".join(f"[{m.type}] {m.text}" for m in memories)
    return raw_text, len(memories)


# ---------------------------------------------------------------------------
# Call 2: REFLECT — compact synthesis, inject into scoring prompt
# ---------------------------------------------------------------------------

def reflect_on_patterns(hindsight: Hindsight, bank_id: str = BANK_ID) -> str:
    """Return a compact narrative (~200-400 tokens). This goes into the scoring prompt,
    NOT the raw recall output — keeps the 8b model prompt lean for better cascade savings.
    """
    response = hindsight.reflect(
        bank_id=bank_id,
        query="What clip patterns work best for this creator? What should I prioritize and avoid?",
        budget="low",   # compact — enough for scoring context
    )
    return response.text or ""


# ---------------------------------------------------------------------------
# Call 3: RETAIN — after creator approves or rejects a clip
# ---------------------------------------------------------------------------

def retain_clip_feedback(
    hindsight: Hindsight,
    bank_id: str,
    clip: dict,         # clip dict from pipeline result — has start, end, overall_score, hook_type, etc.
    feedback: dict,     # {"kept": bool, "rating": int, "notes": str}
) -> None:
    """Store one clip feedback decision. Hindsight auto-consolidates patterns over time."""
    duration = round(clip["end"] - clip["start"], 1)
    verdict  = "approved" if feedback.get("kept", True) else "rejected"

    content = (
        f"Creator {verdict} a clip. "
        f"Suggested title: {clip.get('suggested_title', 'N/A')}. "
        f"Duration: {duration}s. "
        f"Hook type: {clip.get('hook_type', 'none')}. "
        f"Score: {clip.get('overall_score', 0):.2f}. "
        f"Tags: {', '.join(clip.get('tags', []))}. "
        f"Reason: {clip.get('reason', 'N/A')}. "
    )
    if feedback.get("notes"):
        content += f"Creator notes: {feedback['notes']}. "
    if feedback.get("rating"):
        content += f"Creator rating: {feedback['rating']}/5. "

    hindsight.retain(
        bank_id=bank_id,
        content=content,
        metadata={"type": "clip_feedback"},   # "tags" is NOT a valid param — use metadata
    )


# ---------------------------------------------------------------------------
# Call 4: RETAIN — store creator profile at onboarding
# ---------------------------------------------------------------------------

def retain_creator_profile(hindsight: Hindsight, bank_id: str, profile: dict) -> None:
    """One-time onboarding. Gives Hindsight baseline context before any clips are reviewed."""
    content = (
        f"Creator profile: {profile.get('name', 'Unknown')}. "
        f"Niche: {profile.get('niche', 'general')}. "
        f"Audience: {profile.get('audience', 'not specified')}. "
        f"Preferred clip style: {profile.get('clip_style', 'not specified')}. "
        f"Platforms: {', '.join(profile.get('platforms', ['YouTube Shorts']))}. "
        f"Avoid: {profile.get('avoid', 'not specified')}."
    )
    hindsight.retain(
        bank_id=bank_id,
        content=content,
        metadata={"type": "creator_profile"},
    )
```

---

## B8. pipeline.py

Orchestrates all 5 steps. This is what `app.py` calls on Generate click.

```python
import os
from datetime import datetime

from steps.download   import download_video
from steps.transcribe import transcribe
from steps.scorer     import score_highlights
from steps.clipper    import extract_clip
from steps.memory     import recall_clip_preferences, reflect_on_patterns
from config           import OUTPUTS_DIR, BANK_ID


def run_pipeline(url: str, hindsight, cascade_agent) -> dict:
    """
    Full pipeline: download → transcribe → recall → score → clip.
    Returns a result dict consumed by app.py.
    """
    job_id     = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = os.path.join(OUTPUTS_DIR, job_id)
    os.makedirs(output_dir, exist_ok=True)

    # Step 1: Download
    meta = download_video(url, output_dir)

    # Step 2: Transcribe (always chunked)
    segments = transcribe(meta["audio_path"])

    # Step 3: Recall memory context
    memory_text, memory_count = recall_clip_preferences(hindsight, BANK_ID)
    reflection = reflect_on_patterns(hindsight, BANK_ID)

    # Step 4: Score highlights (memory injected as compact reflection)
    highlights, cost_log = score_highlights(segments, reflection, cascade_agent)

    # Step 5: Extract clips
    clips = []
    for i, h in enumerate(highlights):
        output_path = os.path.join(output_dir, f"clip_{i+1:02d}.mp4")
        extract_clip(meta["video_path"], h["start"], h["end"], output_path)
        clips.append({
            **h,
            "path":     output_path,
            "duration": round(h["end"] - h["start"], 1),
        })

    return {
        "clips":        clips,
        "cost_log":     cost_log,
        "reflection":   reflection,
        "memory_text":  memory_text,
        "memory_count": memory_count,
        "meta":         meta,
        "job_id":       job_id,
        "output_dir":   output_dir,
    }
```

---

## B9. app.py — Full Skeleton

```python
import os
import io
import zipfile

import streamlit as st
import cascadeflow
from dotenv import load_dotenv
from hindsight_client import Hindsight

from pipeline      import run_pipeline
from steps.memory  import retain_clip_feedback, init_bank
from steps.scorer  import create_clip_scorer
from config        import HINDSIGHT_BASE_URL, HINDSIGHT_API_KEY, BANK_ID, OUTPUTS_DIR

load_dotenv()
os.makedirs(OUTPUTS_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# One-time resource initialization — @st.cache_resource runs ONCE per process,
# not on every Streamlit rerender. This is the correct place for cascadeflow.init()
# and Hindsight client creation.
# ---------------------------------------------------------------------------

@st.cache_resource
def get_hindsight() -> Hindsight:
    h = Hindsight(base_url=HINDSIGHT_BASE_URL, api_key=HINDSIGHT_API_KEY)
    init_bank(h, BANK_ID)
    return h

@st.cache_resource
def get_cascade_agent():
    cascadeflow.init(mode="observe")   # passive harness — tracks all model calls
    return create_clip_scorer()


hindsight    = get_hindsight()
cascade_agent = get_cascade_agent()


# ---------------------------------------------------------------------------
# Page layout
# ---------------------------------------------------------------------------

st.set_page_config(page_title="ClipCraft 🎬", layout="wide")
st.title("ClipCraft 🎬")
st.caption("YouTube URL → AI-powered vertical clips · learns your style with every session")


# ---------------------------------------------------------------------------
# Input
# ---------------------------------------------------------------------------

url = st.text_input("YouTube URL", placeholder="https://www.youtube.com/watch?v=...")


# ---------------------------------------------------------------------------
# Session state
# ---------------------------------------------------------------------------

if "result" not in st.session_state:
    st.session_state.result = None


# ---------------------------------------------------------------------------
# Generate button
# ---------------------------------------------------------------------------

if st.button("Generate Clips ▶", disabled=not url.strip(), type="primary"):
    with st.status("Processing video...", expanded=True) as status:
        try:
            status.update(label="⬇ Downloading video...")
            # (progress shown by st.status — no separate progress bar needed)

            result = run_pipeline(url.strip(), hindsight, cascade_agent)
            st.session_state.result = result
            status.update(label=f"✅ Done — {len(result['clips'])} clips extracted", state="complete")
        except ValueError as e:
            status.update(label=f"❌ {e}", state="error")
            st.stop()
        except Exception as e:
            status.update(label=f"❌ Error: {e}", state="error")
            st.stop()


# ---------------------------------------------------------------------------
# Results
# ---------------------------------------------------------------------------

if st.session_state.result:
    result      = st.session_state.result
    clips       = result["clips"]
    cost_log    = result["cost_log"]
    reflection  = result["reflection"]
    memory_text = result["memory_text"]

    col_clips, col_intel = st.columns([3, 2])

    # --- Left column: clips ---
    with col_clips:
        st.subheader(f"Clips ({len(clips)})")

        for i, clip in enumerate(clips):
            label = (
                f"Clip {i+1} · {clip['start']:.0f}s–{clip['end']:.0f}s · "
                f"Score: {clip['overall_score']:.2f} · {clip['hook_type']}"
            )
            with st.expander(label, expanded=(i == 0)):
                if os.path.exists(clip["path"]):
                    st.video(clip["path"])
                else:
                    st.warning("Clip file not found.")

                st.caption(
                    f"⏱ {clip['duration']}s · 🎣 {clip['hook_type']} · "
                    f"💬 {clip.get('reason', '')}"
                )
                st.caption(f"Suggested title: *{clip.get('suggested_title', '')}*")

                # Feedback widgets — values written back into the clips list in session state
                clips[i]["user_kept"]   = st.toggle("Keep this clip", value=True, key=f"keep_{i}")
                clips[i]["user_rating"] = st.select_slider(
                    "Rating", options=[1, 2, 3, 4, 5], value=3, key=f"rating_{i}"
                )
                clips[i]["user_notes"]  = st.text_input(
                    "Notes (optional)", key=f"notes_{i}",
                    placeholder="e.g. love the hook, too long, wrong topic..."
                )

    # --- Right column: intelligence panel ---
    with col_intel:
        st.subheader("Intelligence Panel")

        with st.container(border=True):
            st.markdown("📝 **AI Reasoning**")
            st.write(reflection or "No prior memory — clips scored objectively on first run.")

        with st.container(border=True):
            st.markdown("🧠 **Memory (Hindsight)**")
            st.metric("Memories loaded", result["memory_count"])
            if memory_text:
                with st.expander("See raw memories"):
                    st.text(memory_text[:1000] + ("..." if len(memory_text) > 1000 else ""))

        with st.container(border=True):
            st.markdown("💰 **Cost (cascadeflow)**")
            total  = cost_log["calls"]
            by_8b  = cost_log["by_8b"]
            by_70b = cost_log["by_70b"]
            pct    = f"{(by_8b / total * 100):.0f}%" if total else "0%"
            st.markdown(f"- Chunks analyzed: {total}")
            st.markdown(f"- Cheap model (8b): {by_8b} ({pct})")
            st.markdown(f"- Expensive model (70b): {by_70b}")
            st.markdown(f"- **Total cost: ${cost_log['total']:.4f}**")

    # --- Bottom bar ---
    st.divider()
    bcol1, bcol2 = st.columns(2)

    with bcol1:
        # ZIP all clip files into a BytesIO buffer for st.download_button
        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for clip in clips:
                if os.path.exists(clip["path"]):
                    zf.write(clip["path"], os.path.basename(clip["path"]))
        zip_buf.seek(0)

        st.download_button(
            label="📥 Download All Clips (ZIP)",
            data=zip_buf,
            file_name=f"clipcraft_{result['job_id']}.zip",
            mime="application/zip",
        )

    with bcol2:
        if st.button("💾 Save Feedback to Memory", type="secondary"):
            saved = 0
            for clip in clips:
                feedback = {
                    "kept":   clip.get("user_kept", True),
                    "rating": clip.get("user_rating", 3),
                    "notes":  clip.get("user_notes", ""),
                }
                retain_clip_feedback(hindsight, BANK_ID, clip, feedback)
                saved += 1
            st.success(f"✅ Saved {saved} clip feedbacks. Next video will reflect your preferences.")
```

---

## B10. Hindsight — Key Notes

### Budget parameter
Valid string values for `recall()` and `reflect()`: `"low"` (~512 tokens), `"mid"` (~2048), `"high"` (~4096).

### `create_bank` idempotency
Calling `create_bank` with an existing `bank_id` updates the bank config silently — it does not raise an error. Safe to call every startup.

### When to use `recall` vs `reflect`
- **`recall`** → returns a list of raw memories. Use to show the user what the AI knows ("X memories loaded"). **Do not inject the raw recall output into the scoring prompt** — at ~2048 tokens it's too long for the 8b model to process cleanly.
- **`reflect`** → returns one short synthesized narrative (~200-400 tokens). **This is what you inject into the scoring prompt.** Compact enough for the 8b drafter to use well.

### `tags` vs `metadata`
`tags` is **not a valid parameter** for `hindsight.retain()`. Use `metadata={"type": "clip_feedback"}` instead. The metadata dict is free-form key-value.

### Creator namespacing
The current `BANK_ID = "clipcraft"` is a single shared bank. If two people use the app, their memories mix. For the demo this is fine. To support multiple creators, pass `bank_id = f"clipcraft-{creator_name.lower().replace(' ', '-')}"` to all calls.

---

## B11. cascadeflow — Key Notes

### `agent.run()` is always async
`CascadeAgent.run()` returns a coroutine. Use `asyncio.run()` from sync Streamlit code.

Streamlit may already own an event loop in some configurations, causing `RuntimeError: This event loop is already running`. Fix: add `nest_asyncio.apply()` at module level in `scorer.py` (already included in the code above). Add `nest_asyncio` to requirements.

```python
# scorer.py — top of file
import nest_asyncio
nest_asyncio.apply()
```

### `init()` vs `CascadeAgent`
These are complementary:
- `cascadeflow.init(mode="observe")` → passive session-level harness, tracks all model calls
- `CascadeAgent` → active per-query router (cheap model first, escalate on quality fail)

Put `cascadeflow.init()` inside `@st.cache_resource` so it only runs once per process, not on every Streamlit rerender.

### Result object attributes (confirmed from official docs)
```python
result.content       # str — LLM response text
result.model_used    # str — e.g. "llama-3.1-8b-instant"
result.total_cost    # float — cost of this call in USD
```
`savings_percentage` exists on the TypeScript SDK (`result.savingsPercentage`). For the Python cost dashboard, compute savings manually from cost_log:
```python
all_70b_cost = cost_log["calls"] * VERIFIER_COST
savings_pct  = (1 - cost_log["total"] / all_70b_cost) * 100 if all_70b_cost else 0
```

---

## B12. seed/seed_demo.py

Run once before the demo: `python -m seed.seed_demo`

```python
from hindsight_client import Hindsight
from steps.memory import init_bank
from config import HINDSIGHT_BASE_URL, HINDSIGHT_API_KEY, BANK_ID
from dotenv import load_dotenv

load_dotenv()

DEMO_MEMORIES = [
    {
        "content": (
            "Creator approved a clip. Suggested title: 'Are you making this mistake every morning?'. "
            "Duration: 38s. Hook type: question. Score: 0.92. Tags: hook, quotable. "
            "Creator notes: love the question opening. Creator rating: 5/5."
        ),
        "type": "clip_feedback",
    },
    {
        "content": (
            "Creator approved a clip. Suggested title: 'The #1 mistake beginners make'. "
            "Duration: 44s. Hook type: bold_claim. Score: 0.88. Tags: hook, contrarian. Creator rating: 4/5."
        ),
        "type": "clip_feedback",
    },
    {
        "content": (
            "Creator rejected a clip. Suggested title: 'My full equipment setup'. "
            "Duration: 72s. Hook type: none. Score: 0.71. "
            "Creator notes: too long, no clear hook, feels like an ad."
        ),
        "type": "clip_feedback",
    },
    {
        "content": (
            "Creator rejected a clip. Suggested title: '1000 subscribers — thank you!'. "
            "Duration: 55s. Hook type: story. "
            "Creator notes: too self-promotional, doesn't provide value to the viewer."
        ),
        "type": "clip_feedback",
    },
    {
        "content": (
            "Creator approved a clip. Suggested title: 'This popular advice is completely wrong'. "
            "Duration: 41s. Hook type: question. Score: 0.95. Tags: hook, educational. "
            "Creator notes: this is exactly what my audience loves. Creator rating: 5/5."
        ),
        "type": "clip_feedback",
    },
    {
        "content": (
            "Creator profile: fitness content creator. Niche: home workouts, no equipment needed. "
            "Audience: busy professionals 25-40. Preferred clip style: question hooks, under 50 seconds, educational. "
            "Platforms: YouTube Shorts, Instagram Reels. "
            "Avoid: sponsorship pitches, self-promotional content, anything over 60 seconds."
        ),
        "type": "creator_profile",
    },
]


def seed_demo(hindsight: Hindsight, bank_id: str = BANK_ID) -> None:
    """Pre-populate Hindsight for demo purposes.
    All memories are labeled source='demo_seed' — transparent to judges.
    The UI shows 'Demo Mode' when these are the only memories present.
    Ideally: replace this with real feedback from a test session the night before.
    """
    init_bank(hindsight, bank_id)
    for mem in DEMO_MEMORIES:
        hindsight.retain(
            bank_id=bank_id,
            content=mem["content"],
            metadata={"type": mem["type"], "source": "demo_seed"},
        )
    print(f"Seeded {len(DEMO_MEMORIES)} demo memories into bank '{bank_id}'")


if __name__ == "__main__":
    h = Hindsight(base_url=HINDSIGHT_BASE_URL, api_key=HINDSIGHT_API_KEY)
    seed_demo(h)
```

---

## B13. Environment Setup

### .env
```
GROQ_API_KEY=<groq key — free tier at groq.com>
HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io
HINDSIGHT_API_KEY=<key from Hindsight Cloud — use promo MEMHACK515 for $50 free>
MEMORY_BANK_ID=clipcraft
```

### Hindsight Cloud setup
1. Sign up at https://ui.hindsight.vectorize.io
2. Add promo code `MEMHACK515` in billing → $50 free credits
3. Copy your base URL and API key from the dashboard

### Self-hosted Docker (if no cloud access)
```bash
docker run --rm -it --pull always -p 8888:8888 \
  -e HINDSIGHT_API_LLM_API_KEY=$GROQ_API_KEY \
  -e HINDSIGHT_API_LLM_PROVIDER=groq \
  -v $HOME/.hindsight-docker:/home/hindsight/.pg0 \
  ghcr.io/vectorize-io/hindsight:latest
# Then set HINDSIGHT_BASE_URL=http://localhost:8888 (no API key needed)
```

### Install
```bash
pip install streamlit openai hindsight-client cascadeflow \
            python-dotenv mediapipe opencv-python nest_asyncio

# macOS
brew install ffmpeg yt-dlp

# Ubuntu
sudo apt install ffmpeg && pip install yt-dlp
```

### Run
```bash
cd clipcraft
streamlit run app.py
```

### Seed demo data (run once before demo)
```bash
python -m seed.seed_demo
```

---

## B14. Edge Cases

| Edge Case | How to Handle |
|---|---|
| Audio >25MB | Always chunk into ≤10 min segments — default path in `transcribe.py` |
| No speech detected | `transcribe()` raises `ValueError("No speech detected")` — caught in `app.py` |
| LLM returns malformed JSON | `try/except json.JSONDecodeError` in scorer — skip chunk, don't crash |
| Overlapping highlight timestamps | `merge_overlapping()` handles this |
| Hindsight unavailable | `recall`/`reflect` fail → pass empty string as memory_context → scoring continues without memory |
| cascadeflow not installed | `pip install cascadeflow` — it's a required dependency, not optional |
| Second video overwrites first | `job_id` timestamp namespacing in `pipeline.py` — each run gets its own subdirectory |
| Sponsor segment selected as clip | Keyword filter in post-processing: skip clips whose `reason` or text contains "use code", "link in bio", "sponsored" |
| Already-vertical video | Detect aspect ratio before crop — if height > width, skip `crop=ih*9/16:ih` |
| Video private or deleted | `subprocess.run(..., check=True)` raises `CalledProcessError` — caught in app.py with user-facing message |

---

## B15. Prior Work Reference

The `JDeep1234/Hackathon` repo branch `main` has a prior ContentPilot backend (content strategy chatbot).

**Reuse:**
- `.rstrip("/")` pattern on `HINDSIGHT_BASE_URL` from `backend/config.py` — already in `config.py` above
- `create_bank` idempotent startup pattern — already in `steps/memory.py` above

**Do NOT reuse:**
- `HindsightWrapper` class — current `hindsight-client` has sync methods; no async wrapper needed
- The 5-stage chat pipeline (classify → recall → synthesize → generate → retain) — ClipCraft is not a chatbot
- `MODEL_TIERS` dict and `select_model()` — replaced by cascadeflow CascadeAgent

---

## B17. Risk Factors

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **`asyncio.run()` fails inside Streamlit** — Streamlit may already own an event loop | Medium | App crashes on first Generate click | `nest_asyncio.apply()` at module level in `scorer.py` — already in the code above |
| 2 | **Groq 25MB audio limit** — any video >~13 min at 16kHz mono WAV exceeds it | High (common) | Transcription 400 error | Always chunk audio — `chunk_audio()` is the default path, not an edge case |
| 3 | **Groq rate limits** — free tier is generous but not infinite | Low-Medium | Scoring fails mid-run for long videos | `chunk_segments()` already limits each Groq call to ~4000 tokens; for demos use <30 min videos |
| 4 | **LLM returns malformed JSON** — 8b model may wrap output in markdown or truncate | Medium | `json.JSONDecodeError` kills scoring for that chunk | Already handled: JSON fence stripping + `try/except` per chunk — one bad chunk is skipped, not fatal |
| 5 | **Hindsight `recall()` / `reflect()` fail** — cloud outage or wrong API key | Low | Scoring runs without memory context | Pass `memory_context=""` on failure — scoring continues objectively, app doesn't crash |
| 6 | **`cascadeflow.init()` called twice** — if `@st.cache_resource` cache is invalidated mid-session | Low | May raise or silently double-init | `@st.cache_resource` prevents this — the guard is in place |
| 7 | **`result.model_used` attribute name changes** — SDK is young | Low | Cost tracking breaks (non-fatal) | Use `getattr(result, 'model_used', DRAFTER_MODEL)` if you want extra safety |
| 8 | **ffmpeg `crop=ih*9/16:ih` on already-vertical video** — over-crops a 9:16 source | Low-Medium | Clip is too narrow | Check aspect ratio before cropping: skip crop if `width < height` |
| 9 | **yt-dlp `--print-json` output has multiple lines** — some formats print extras | Low | `json.loads` fails on non-JSON line | Already handled: `.splitlines()[-1]` takes only the last line, which is always the JSON |
| 10 | **Demo video is too short** — no strong 30+ second hook segments | Low | Clips scored below threshold, 0 results | Set `MIN_CLIP_SCORE = 0.4` and `TOP_K_CLIPS = 3` for demo as fallback; test the video beforehand |

### Failure mode priority

Risks 1, 2, and 4 are the ones most likely to hit during a live demo. All three already have mitigations in the code. Test each explicitly before presenting:

```bash
# Test 1: asyncio + Streamlit event loop — run the app and click Generate
streamlit run app.py

# Test 2: audio chunking — use a 20+ minute video explicitly
# Test 3: bad JSON from LLM — temporarily inject a bad chunk in score_highlights() to confirm try/except catches it
```

---

## B16. Demo Success Checklist

- [ ] Paste YouTube URL → 3-5 clips appear in under 2 minutes
- [ ] Video plays inline in the Streamlit UI (st.video)
- [ ] Intelligence panel shows Hindsight reflection (not just "No prior memory")
- [ ] Memory count > 0 after seeding or real feedback
- [ ] Cost panel shows real numbers: chunks / 8b count / 70b count / total $
- [ ] After clicking "Save Feedback", second video shows different clip selection
- [ ] ZIP download button works and produces valid MP4 files
- [ ] Code is in 7 files with no dead imports, no placeholder `...`, no unused functions
