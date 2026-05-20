# ContentOS v2: Claude-Powered Short-Form Content Engine

**Date:** 2026-05-20
**Status:** Approved

## Overview

Complete rewrite of the content generation pipeline to produce production-ready short-form video scripts. Replaces Groq/Llama via cascadeflow with direct Anthropic Claude API calls, adds actual video clip extraction with 9:16 vertical cropping, supports multi-segment narrative clips, and introduces platform selection UI.

## Goals

1. **Quality:** Scripts that are complete, polished, and shippable — not generic filler
2. **Clip coherence:** Every extracted moment tells a complete story from first frame to last
3. **Multi-segment:** AI can stitch non-contiguous segments when it creates a stronger narrative
4. **Platform choice:** Creator selects which platforms to generate for (saves cost, focuses output)
5. **Real clips:** Actual 9:16 vertical MP4 files, not YouTube embeds

## Non-Goals

- Automated posting to platforms (future)
- AI-generated b-roll or custom visuals (Higgsfield prompts are suggestions only)
- Audio separation / music bed overlay (future)

---

## Architecture

### Model Layer

| Task | Model | Rationale |
|------|-------|-----------|
| Moment extraction | Claude Haiku 4.5 | Analytical/structural task. Fast, cheap, accurate at finding timestamps and narrative arcs. |
| Content generation | Claude Sonnet 4.5 | Creative writing. Best quality-to-cost for hooks, scripts, CTAs. |
| Structured output | `output_config.format` (JSON schema) | Guaranteed valid JSON. No regex parsing, no retries. |

**Cost per video (5 moments, 3 platforms):** ~$0.09
**Latency:** Extraction ~5s, Generation ~3s per platform per moment

### Infrastructure Changes

```
backend/
  app/
    infrastructure/
      anthropic.py        # NEW — Anthropic SDK client, structured output helpers
      clip_extraction.py  # NEW — yt-dlp download + ffmpeg stitch + 9:16 crop
      cascadeflow.py      # KEEP for now (memory synthesis still uses it) or migrate too
    domain/
      moments.py          # REWRITE — new extraction prompt with multi-segment support
      generation.py       # REWRITE — per-platform Claude calls with structured output
      processing.py       # UPDATE — new pipeline stages (clip extraction between extract and generate)
    config.py             # ADD anthropic_api_key, default_platforms settings
    api/
      routes.py           # UPDATE — platform selection on project creation
      schemas.py          # UPDATE — new request/response schemas
  clips/                  # NEW — extracted clip files (volume-mounted)

frontend/
  components/
    platform-selector.tsx       # NEW — multi-select dropdown for platform choice
    moment-card.tsx             # NEW (replaces moment-group) — video player + brief + compare
    production-brief-view.tsx   # NEW — single-platform detailed view
    platform-compare-table.tsx  # UPDATE — 3-column comparison (existing, enhanced)
    video-player.tsx            # NEW — HTML5 video player for 9:16 clips
  lib/
    types.ts                    # UPDATE — new schemas
```

---

## Pipeline Flow (Revised)

```
1. INGEST        — fetch audio/transcript (unchanged)
2. TRANSCRIBE    — Groq Whisper → segments (unchanged)
3. RECALL        — Hindsight memory (unchanged)
4. EXTRACT       — Claude Haiku 4.5 → narrative-aware moments with segment timestamps
5. CLIP          — yt-dlp download sections + ffmpeg stitch + 9:16 crop → MP4 files
6. GENERATE      — Claude Sonnet 4.5 → per-platform production briefs (only selected platforms)
7. PERSIST       — moments + clips + derivatives to DB
```

New stage: **CLIP** (between EXTRACT and GENERATE). Clips are downloaded in parallel (no rate limit concerns with yt-dlp).

---

## Detailed Specifications

### 1. Moment Extraction (Claude Haiku 4.5)

**Input:** Full transcript (timestamped segments), creator memory reflection

**System prompt focus:**
- Find 3-5 moments that work as standalone short-form content
- Each moment must have a complete narrative arc (setup → tension → payoff)
- The first words of each clip must work as a scroll-stopping hook
- The last words must land as a strong closer (insight, punchline, emotional beat)
- If a stronger clip can be made by combining 2 non-contiguous segments, return multiple timestamp ranges
- Most clips should be 30-90 seconds total duration

**Output schema (structured output):**
```json
{
  "moments": [
    {
      "segments": [
        {"start": 120.5, "end": 155.2, "role": "primary"},
        {"start": 510.0, "end": 535.8, "role": "payoff"}
      ],
      "total_duration_seconds": 60.5,
      "transcript_snippet": "the opening 2-3 sentences of the clip",
      "narrative_summary": "what makes this a complete story",
      "hook_potential": "why the opening line stops the scroll",
      "strength_score": 0.92,
      "selection_rationale": "why this moment was chosen over alternatives"
    }
  ]
}
```

**Constraints:**
- Max 3 segments per moment (usually 1, occasionally 2, rarely 3)
- Total duration per moment: 20-90 seconds
- Segments within a moment must form a coherent narrative when played sequentially
- Each segment must be at least 8 seconds (minimum useful clip length)

### 2. Clip Extraction Pipeline

**Per moment, run in parallel:**

```python
async def extract_clip(project_id, moment_id, source_url, segments):
    """Download, stitch, and crop clip segments to 9:16 vertical."""
    
    # 1. Download each segment
    for seg in segments:
        yt-dlp --download-sections "*{start}-{end}" \
               --force-keyframes-at-cuts \
               -f "bestvideo[height<=1080]+bestaudio/best[height<=1080]" \
               --merge-output-format mp4 \
               -o segment_{i}.mp4 \
               {source_url}
    
    # 2. If multi-segment, concat with ffmpeg
    if len(segments) > 1:
        ffmpeg -f concat -safe 0 -i segments.txt -c copy stitched.mp4
    
    # 3. Crop to 9:16 vertical (center-crop)
    # From 1920x1080 → 608x1080 center crop, then scale to 1080x1920
    ffmpeg -i input.mp4 \
           -vf "crop=ih*9/16:ih,scale=1080:1920" \
           -c:v libx264 -preset fast -crf 23 \
           -c:a aac -b:a 128k \
           output.mp4
    
    # 4. Save to /clips/{project_id}/{moment_id}.mp4
    # 5. Store clip_url in moments table
```

**Storage:**
- Path: `/app/clips/{project_id}/{moment_id}.mp4`
- Served via: `app.mount("/api/clips", StaticFiles(directory="clips"))`
- DB: `moments.clip_url` column (nullable, set after clip extraction)

**Error handling:**
- If yt-dlp fails (geo-restriction, deleted video): mark clip as unavailable, continue pipeline
- If ffmpeg crop fails: serve original aspect ratio as fallback
- Timeout: 60s per moment clip extraction

### 3. Content Generation (Claude Sonnet 4.5)

**One call per platform per moment.** Only generates for platforms the creator selected.

**Input per call:**
- Transcript snippet for the clip (full text of what's said in the clip)
- Narrative summary from extraction
- Hook potential analysis
- Creator memory/style preferences
- Platform-specific constraints

**Output schema (structured output, per platform):**
```json
{
  "hook": "I had everything and felt nothing.",
  "angle": "Contrast between external success and internal emptiness — relatable to anyone feeling trapped in a 'good' situation",
  "script": {
    "opening": "[TEXT OVERLAY] 'I had everything and felt nothing.'\n[CREATOR TO CAMERA] Pause 2 beats. Let it land.",
    "body": "[CUT to clip 2:00-2:15] 'I was making 300K, corner office...'\n[JUMP CUT] '...every Sunday night I'd sit in my car for 10 minutes...'\n[PAUSE - let it breathe]",
    "closer": "[SLOW PUSH IN] 'The day I quit was the first day I slept through the night in 3 years.'"
  },
  "cta": "Follow if you've ever felt this. Part 2 drops tomorrow.",
  "higgsfield_prompt": "Close-up of a man in a suit sitting alone in a parked car at night, dashboard glow on his face, contemplative expression, shallow DOF, cinematic 9:16, moody blue-orange grade, slow subtle drift",
  "editing_notes": "Use actual podcast clip as base. Text overlay hook for first 2s. Jump cuts at [CUT] markers. Subtle bass drop at the pause."
}
```

**Platform-specific prompt constraints:**

| Platform | Duration | Style | Hook Type |
|----------|----------|-------|-----------|
| Instagram Reels | 30-60s | Fast-paced, visual-first, pattern interrupt | Text overlay + face-to-camera |
| YouTube Shorts | 30-60s | Story-driven, educational, curiosity-driven | Question or bold claim |
| LinkedIn | 30-90s | Professional, insight-driven, value-first | Contrarian take or data point |

### 4. Frontend UX

#### 4a. Project Creation — Platform Selector

Add multi-select dropdown to the project creation form:
```
[Paste YouTube URL here                    ]
[Select platforms: ☑ Instagram Reels ☑ YouTube Shorts ☑ LinkedIn ▾]
[Process →]
```

Default: all 3 selected. Creator can uncheck to reduce cost/noise.

Stored in DB: `content_projects.target_platforms` (text[] array).

#### 4b. Moment Card (replaces MomentGroup)

Layout per moment:
```
┌─────────────────────────────────────────────────────┐
│ [1] 2:30—3:15 · 92% · "Creator explains why..."    │
├─────────────────────────────────────────────────────┤
│ ┌─────────────┐                                     │
│ │             │  9:16 vertical video player          │
│ │   ▶ PLAY   │  (actual extracted clip MP4)         │
│ │             │                                     │
│ └─────────────┘                                     │
├─────────────────────────────────────────────────────┤
│ Platform: [Instagram Reels ▾]                       │
│                                                     │
│ HOOK: "I had everything and felt nothing."          │
│ ANGLE: Contrast between external success and...     │
│                                                     │
│ SCRIPT:                                             │
│   Opening: [TEXT OVERLAY] ...                       │
│   Body: [CUT to clip from 2:00] ...                │
│   Closer: [SLOW PUSH IN] ...                       │
│                                                     │
│ CTA: "Follow if you've ever felt this..."           │
│ HIGGSFIELD: "Close-up of a man in a suit..."        │
│ EDITING NOTES: "Use actual podcast clip..."         │
├─────────────────────────────────────────────────────┤
│ [Compare All Platforms]                             │
│ ┌──────────┬──────────┬──────────┐                  │
│ │ IG Reels │ YT Short │ LinkedIn │  (expandable)    │
│ │  hook    │  hook    │  hook    │                  │
│ │  angle   │  angle   │  angle   │                  │
│ │  script  │  script  │  script  │                  │
│ │  ...     │  ...     │  ...     │                  │
│ └──────────┴──────────┴──────────┘                  │
├─────────────────────────────────────────────────────┤
│ [Approve] [Regenerate with guidance] [Reject]       │
└─────────────────────────────────────────────────────┘
```

#### 4c. Video Player Component

- Native HTML5 `<video>` element
- Displays 9:16 vertical aspect ratio (phone-shaped)
- Source: `/api/clips/{project_id}/{moment_id}.mp4`
- Controls: play/pause, scrub, mute
- Fallback: if clip unavailable, show YouTube embed with start/end params

### 5. Database Changes

```sql
-- Add columns to content_projects
ALTER TABLE content_projects ADD COLUMN target_platforms text[] DEFAULT ARRAY['instagram_reels', 'youtube_shorts', 'linkedin'];

-- Add clip_url to moments
ALTER TABLE moments ADD COLUMN clip_url text;

-- Add segments JSONB to moments (multi-segment support)
ALTER TABLE moments ADD COLUMN segments jsonb;

-- Update derivative schema for richer content
-- (content column already stores JSON string — schema changes are in the JSON itself)

-- Update constraints (already done)
-- platform IN ('instagram_reels', 'youtube_shorts', 'linkedin')
-- content_type IN ('production_brief')
```

### 6. Config Changes

```python
# backend/app/config.py additions
anthropic_api_key: str = ""
clip_storage_path: str = "/app/clips"
default_platforms: list[str] = ["instagram_reels", "youtube_shorts", "linkedin"]
```

### 7. Error Handling

| Failure | Recovery |
|---------|----------|
| Claude API rate limit | Exponential backoff, max 3 retries |
| Claude returns malformed JSON | Impossible with structured outputs — schema enforced |
| yt-dlp download fails | Mark clip as unavailable, continue pipeline, show YT embed fallback |
| ffmpeg crash | Log error, serve uncropped clip |
| Multi-segment stitch fails | Fall back to primary segment only |
| Clip too short (<8s) | Skip moment, log warning |

---

## Implementation Order

1. `backend/app/infrastructure/anthropic.py` — Anthropic SDK client with structured output helpers
2. `backend/app/config.py` — Add `anthropic_api_key`, `clip_storage_path`
3. `backend/app/domain/moments.py` — Rewrite extraction with new prompt + schema (Haiku 4.5)
4. `backend/app/infrastructure/clip_extraction.py` — yt-dlp + ffmpeg pipeline
5. `backend/app/domain/generation.py` — Rewrite with per-platform Claude Sonnet calls
6. `backend/app/domain/processing.py` — Insert CLIP stage, update flow
7. `backend/app/api/routes.py` + `schemas.py` — Platform selection on create, clip serving
8. DB migration — `target_platforms`, `clip_url`, `segments` columns
9. `frontend/components/platform-selector.tsx` — Multi-select dropdown
10. `frontend/components/video-player.tsx` — HTML5 9:16 player
11. `frontend/components/moment-card.tsx` — New layout with dropdown + compare toggle
12. `frontend/components/production-brief-view.tsx` — Rich single-platform view
13. `frontend/components/platform-compare-table.tsx` — Enhanced 3-column table
14. End-to-end testing with a real video

---

## Success Criteria

- [ ] Scripts read as natural, polished, ready-to-film content (not generic filler)
- [ ] Every clip tells a complete story when played from start to end
- [ ] Multi-segment clips (when used) feel like intentional edits, not jarring jumps
- [ ] 9:16 vertical clips display correctly in the frontend player
- [ ] Platform dropdown changes which brief is displayed without page reload
- [ ] "Compare All Platforms" shows meaningful differences between platform scripts
- [ ] Pipeline completes in <3 minutes for a 1-hour video
- [ ] Cost per video stays under $0.15
