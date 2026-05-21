# OrbitOS — Refine Plan (3-Hour Demo Sprint)

> **Handoff doc for execution session.** Read `docs/CONTEXT_BACKEND.md` and `docs/CONTEXT_FRONTEND.md` first for codebase shape. This doc tells you WHAT to change.
>
> **Hard deadline:** Demo at 10pm. Start at 7pm. Commit at end of each hour-block.
> **Branch:** `implement-mvp`
> **Stack reminders:** Backend = FastAPI + Anthropic Claude (Haiku for extraction, Sonnet for generation) + Supabase + Hindsight. Frontend = Next.js 16.2.6 + React 19 + Tailwind v4.

---

## Product Vision (north star, don't drift)

OrbitOS is a **self-improving AI agent for YouTube long-form creators** who want to repurpose long videos into short-form content (Reels / Shorts / TikTok / LinkedIn) **without effort or content fatigue**. Powered by Hindsight, it learns from every edit, approval, rejection, and preference the creator makes — and over time starts producing shorts that feel like the creator *wrote them themselves*.

**Three principles that govern every UI/UX/copy decision:**
1. **Persona, not voice.** We model the creator's whole personality, not just tone.
2. **Abstraction over assembly.** Give the creator one polished, copy-pasteable deliverable per platform — never a table of disconnected fields.
3. **YouTube-long-form-to-shorts is the only flow.** Source is always YouTube. Targets are always short-form platforms. Don't ask questions whose answers we already know.

---

## Confirmed decisions (locked, don't re-litigate)

| # | Decision |
|---|---|
| Q1 | Clip display = **original aspect** in dashboard. 9:16 only generated **on export** via a per-moment button. |
| Q2 | Chunking = **fixed 5 chunks** across full video length regardless of duration. Extract **top 7 moments total** (one per day of the week). Some chunks may yield 1, some 2, total = 7. Each moment 30–45s, spread chronologically, min 30s gap between picks. |
| Q3 | Tags = **controlled vocabulary** (canonical enum). Filterable, deterministic. |
| Q4 | Deliverable = **6 unified fields**, content shape per field varies per platform via `PLATFORM_SPECS`. `description` and `spoken_script` are SEPARATE fields. |
| Q5 | Memory filter on upload = **tagging infra ships now, UI ships later**. |

---

## What's IN scope (must ship by 10pm)

✅ Backend foundation (tag module, deliverable schema, 5-chunk/7-moment chunking, persona-aware extraction, structured Hindsight tags)
✅ TikTok platform support end-to-end
✅ New `DeliverableCard` frontend replacing `ProductionBriefTable`
✅ Persona-first onboarding rewrite (6 questions)
✅ Clip display in original aspect + "Export as 9:16" button
✅ Global rebrand contentOS → OrbitOS
✅ "voice" → "persona" relabel (UI only, NOT DB columns)
✅ Off-theme copy sweep

## What's OUT of scope (defer post-demo)

❌ Memory filter UI on upload page (tagging infra only ships)
❌ DB column renames (`voice_inspirations`, `creator_profiles` table stay)
❌ Per-platform export resolutions beyond 9:16 (LinkedIn 1:1 deferred)
❌ Retiring legacy components (`MomentCard`, `DraftEditor`, `CreatorProfileModal`, root `/projects/[id]`) — leave alone
❌ Cost panel rework, intelligence graph re-scoping
❌ Multi-creator support (single-creator demo)

---

# PHASE 1 — Backend Foundation (Hour 1, 7-8pm)

**Commit at end of Phase 1:** `feat(backend): persona-aware extraction, 5-chunk/7-moment selection, unified deliverable schema, tag taxonomy`

## 1.1 Tag taxonomy module — NEW FILE

**Create:** `backend/app/domain/tags.py`

```python
"""Canonical tag taxonomy for Hindsight memory.

Every retain_observation MUST use tags from these enums for filtering
to work. Use build_tags() to compose tag lists.
"""

# Persona / content style
STYLES = [
    "humour", "wit", "storytelling", "informational", "educational",
    "personal", "hot-take", "tutorial", "inspirational", "commentary",
    "deadpan", "hype-energy",
]

# Creator intent for a given video / clip
INTENTS = ["grow", "inspire", "teach", "trust", "entertain"]

# Output platforms (must match Platform enum in frontend)
PLATFORMS = ["instagram_reels", "youtube_shorts", "tiktok", "linkedin"]

# Deliverable section types (for per-section regenerate observations)
CONTENT_TYPES = [
    "title", "description", "caption", "spoken_script",
    "why_this_clip", "visual_direction", "editor_notes",
]

# Event categories
EVENTS = ["edit", "approve", "reject", "regenerate", "profile", "seed", "complete-review"]


def style_tag(style: str) -> str:    return f"style:{style}"
def intent_tag(intent: str) -> str:  return f"intent:{intent}"
def platform_tag(platform: str) -> str: return f"platform:{platform}"
def content_type_tag(ct: str) -> str: return f"content_type:{ct}"
def event_tag(ev: str) -> str:       return f"event:{ev}"
def creator_tag(name: str) -> str:
    slug = "".join(c.lower() if c.isalnum() else "-" for c in (name or "default")).strip("-")
    return f"creator:{slug or 'default'}"


def build_tags(
    *,
    creator_name: str | None = None,
    styles: list[str] | None = None,
    intents: list[str] | None = None,
    platforms: list[str] | None = None,
    content_type: str | None = None,
    event: str | None = None,
    extra: list[str] | None = None,
) -> list[str]:
    """Compose a structured tag list. Filters out None/empty."""
    tags: list[str] = []
    if creator_name: tags.append(creator_tag(creator_name))
    for s in (styles or []):    tags.append(style_tag(s))
    for i in (intents or []):   tags.append(intent_tag(i))
    for p in (platforms or []): tags.append(platform_tag(p))
    if content_type: tags.append(content_type_tag(content_type))
    if event:        tags.append(event_tag(event))
    tags.extend(extra or [])
    return tags
```

## 1.2 Add TikTok platform support

**File:** `backend/app/config.py`
- Change `DEFAULT_PLATFORMS` default to `["instagram_reels", "youtube_shorts", "tiktok", "linkedin"]`

**File:** `backend/app/domain/generation.py`
- Add a `tiktok` entry to `PLATFORM_SPECS` (see §1.3 for the new spec format).

**Migration note:** existing `content_projects.target_platforms` rows still work — Postgres array column accepts new values automatically.

## 1.3 Unified `ShortFormDeliverable` schema

**File:** `backend/app/domain/generation.py`

**Replace** the existing `BRIEF_SCHEMA` and prompt with this:

```python
SONNET_MODEL = "claude-sonnet-4-5"

DELIVERABLE_SCHEMA = {
    "type": "object",
    "required": ["title", "description", "caption", "spoken_script",
                 "why_this_clip", "visual_direction", "editor_notes"],
    "properties": {
        "title": {
            "type": "string",
            "description": "Platform-native short title / headline for the clip. Catchy, not the long-form video title.",
        },
        "description": {
            "type": "string",
            "description": (
                "The post description text the creator pastes into the platform's "
                "'description' field. Length and tone per PLATFORM rules. NOT the spoken script."
            ),
        },
        "caption": {
            "type": "string",
            "description": (
                "Social caption (the text people read on the post itself). Includes hashtags / "
                "mentions / line breaks per PLATFORM rules."
            ),
        },
        "spoken_script": {
            "type": "string",
            "description": (
                "What the creator says on camera, in their voice, with stage directions "
                "in brackets: [CUT], [PAUSE 0.5s], [EMPHASIS], [TEXT OVERLAY: ...]. "
                "Should be performable as-is."
            ),
        },
        "why_this_clip": {
            "type": "string",
            "description": (
                "2-3 sentences explaining to the creator WHY this moment was chosen — "
                "specific narrative arc, hook quality, emotional beat, or persona fit. "
                "Convinces the creator to trust the pick."
            ),
        },
        "visual_direction": {
            "type": "string",
            "description": (
                "Tool-agnostic visual prompt for AI generators (Higgsfield / Veo 3 / Kling / "
                "Seedance / Google Omni / GPT Image). 9:16 aspect, describe scene, lighting, "
                "subject, mood, b-roll cuts, thumbnail style. No tool-specific syntax."
            ),
        },
        "editor_notes": {
            "type": "string",
            "description": (
                "Instructions for an AI video editor: cut points, transitions, on-screen "
                "caption styling, zoom moments, sound design / music vibe, pacing. "
                "Specific and actionable."
            ),
        },
    },
}

# Per-platform shaping rules injected into the prompt
PLATFORM_SPECS: dict[str, dict] = {
    "instagram_reels": {
        "name": "Instagram Reels",
        "duration": "15-60s sweet spot",
        "title_rule": "8-12 words, hooky, no clickbait emoji",
        "description_rule": "Reels has no separate description — set to same as caption",
        "caption_rule": "2200 char max but FRONT-LOAD the hook in first 125 chars. End with 5-8 niche hashtags. Use line breaks for scannability.",
        "spoken_script_rule": "Hook in first 1.5s. Punchy delivery. Pattern interrupts every 3-5s.",
        "editor_notes_rule": "Jump cuts, dynamic captions (Instagram-style yellow/white), trending audio mention, vertical 9:16.",
    },
    "youtube_shorts": {
        "name": "YouTube Shorts",
        "duration": "30-60s",
        "title_rule": "Max 100 chars. Question-led or curiosity-gap.",
        "description_rule": "200-500 chars. First 2 lines are the hook (appears above 'more'). Include 2-3 relevant hashtags at end. Can include channel link / playlist link.",
        "caption_rule": "Same as description for Shorts (no separate caption field on YT). Set equal to description.",
        "spoken_script_rule": "Hook in first 3s. Closes with subscribe CTA or rhetorical question.",
        "editor_notes_rule": "Captions burned-in (YouTube auto-captions are unreliable for Shorts). Vertical 9:16. No black bars.",
    },
    "tiktok": {
        "name": "TikTok",
        "duration": "21-34s sweet spot (TikTok algorithm preference)",
        "title_rule": "Not used by TikTok — set to a 6-10 word internal label for the creator.",
        "description_rule": "Same as caption for TikTok (TikTok has only the caption field).",
        "caption_rule": "150 char max. First sentence is the hook. End with 3-5 hashtags MIXING one big trend hashtag + niche tags. Mention trending sound if applicable.",
        "spoken_script_rule": "Hook in first 1s. TikTok scroll is brutal. Pattern interrupt at 3s, 8s, 15s.",
        "editor_notes_rule": "Suggest trending sound category (e.g., 'use a chill lo-fi beat trending in [niche]'). Auto-captions ON. Vertical 9:16. Quick cuts.",
    },
    "linkedin": {
        "name": "LinkedIn",
        "duration": "30-90s (LinkedIn tolerates longer)",
        "title_rule": "Professional headline, 6-12 words. No clickbait. Curiosity + value framing.",
        "description_rule": "Not used separately on LinkedIn — set equal to caption.",
        "caption_rule": "1500-3000 chars. Open with a contrarian or insightful one-liner. Use line breaks every 1-2 sentences. End with a question to drive comments. Hashtags: 3-5 professional tags at end.",
        "spoken_script_rule": "Polished but conversational. Front-load the insight. No 'guys', no 'what's up'.",
        "editor_notes_rule": "Captions burned-in (LinkedIn autoplay is muted). 9:16 or 1:1 both work. Clean transitions, no jump-cut chaos.",
    },
}


def _build_generation_prompt(platform: str, moment: dict, persona_reflection: str | None) -> str:
    spec = PLATFORM_SPECS.get(platform, {})
    persona_block = (
        f"\n## Creator persona (from long-term memory)\n{persona_reflection}\n"
        if persona_reflection else ""
    )
    return f"""You are producing ONE polished, copy-pasteable short-form deliverable for {spec.get('name', platform)}.

The creator is a YouTube long-form creator turning a moment from their long video into a short.
Your output must be SO COMPLETE that the creator can use it without further editing.
{persona_block}
## Platform rules for {spec.get('name', platform)}
- Duration: {spec.get('duration')}
- Title: {spec.get('title_rule')}
- Description: {spec.get('description_rule')}
- Caption: {spec.get('caption_rule')}
- Spoken script: {spec.get('spoken_script_rule')}
- Editor notes: {spec.get('editor_notes_rule')}

## The clip
- Time range: {moment.get('start_timestamp'):.1f}s – {moment.get('end_timestamp'):.1f}s
- Transcript excerpt: {moment.get('transcript_snippet', '')[:500]}
- Why this moment (extractor's note): {moment.get('selection_rationale', '')}
- Narrative summary: {moment.get('narrative_summary', '')}
- Hook potential: {moment.get('hook_potential', '')}

## Output instructions
Call the `generate_deliverable` tool with all 7 fields. Be specific. No placeholders.
The creator's persona MUST come through in every field — match their style and energy.
"""
```

Update `generate_brief_for_platform()` → rename to `generate_deliverable_for_platform()`:
- Call `structured_call` with `tool_name="generate_deliverable"` and schema `DELIVERABLE_SCHEMA`.
- `max_tokens=6000`, `temperature=0.8`.
- Return `{platform, content_type:"short_form_deliverable", content: JSON-stringified deliverable, model: SONNET_MODEL}`.

Update `regenerate_single_derivative()` to use the new schema. Keep the regen-section feature by accepting an optional `section: str | None` param — if provided, prompt instructs Claude to regenerate ONLY that field and return the same JSON shape with other fields preserved.

**`content_type` change:** existing DB rows have `content_type='production_brief'`. New rows use `'short_form_deliverable'`. Frontend `normalizeBrief` will detect both and adapt (see §2.6).

## 1.4 Chunking rewrite — 5 chunks × 7 moments

**File:** `backend/app/domain/moments.py`

Replace the current char-budget chunker with **time-based chunking**:

```python
NUM_CHUNKS = 5
TARGET_MOMENT_COUNT = 7
MIN_MOMENT_SECS = 30
MAX_MOMENT_SECS = 45
MIN_GAP_BETWEEN_MOMENTS_SECS = 30


def _split_transcript_by_time(segments: list[dict], num_chunks: int) -> list[list[dict]]:
    """Split transcript segments into N equal-duration chunks based on segment timestamps."""
    if not segments:
        return [[] for _ in range(num_chunks)]
    total_duration = segments[-1]["end"]
    chunk_size = total_duration / num_chunks
    chunks: list[list[dict]] = [[] for _ in range(num_chunks)]
    for seg in segments:
        idx = min(int(seg["start"] / chunk_size), num_chunks - 1)
        chunks[idx].append(seg)
    return chunks
```

New `extract_moments()` flow:
1. Split transcript into 5 time-based chunks.
2. For each chunk, run Haiku `structured_call` asking for **top 1-2 candidates** with strict 30-45s duration.
3. Inject persona reflection into the system prompt (see §1.5).
4. Collect all candidates → sort by `strength_score` desc → greedy pick 7 enforcing `MIN_GAP_BETWEEN_MOMENTS_SECS` between selected moments.
5. If fewer than 7 unique-gap moments available, ship what we have (no padding).
6. Final list **sorted chronologically by `start_timestamp`** before return.

Update `MOMENT_EXTRACTION_SCHEMA`:
- Enforce `30 ≤ end_timestamp - start_timestamp ≤ 45` in the prompt (Claude can't enforce numeric ranges in JSON schema, so reinforce in system prompt and validate post-hoc).
- Keep `segments` constraint as-is (single segment, `minItems=1, maxItems=1`).

Add post-hoc validation `_filter_by_duration()`: drop moments outside 30-45s; if a chunk's only candidate violates, drop that chunk's contribution.

## 1.5 Persona-aware extraction

**File:** `backend/app/domain/moments.py`

Modify `EXTRACTION_SYSTEM` prompt to inject persona context. Signature change:

```python
async def extract_moments(
    segments: list[dict],
    memory_reflection: str | None = None,
    video_intent: dict | None = None,
    persona_styles: list[str] | None = None,  # NEW
) -> list[dict]:
    ...
```

Add to the system prompt:
```
## Creator persona signals
This creator's dominant styles are: {', '.join(persona_styles or ['general'])}.
When picking moments, weight these heavily:
- If styles include 'humour'/'wit'/'hype-energy' → prioritize punchlines, comedic beats, big reactions.
- If styles include 'storytelling'/'personal' → prioritize narrative arcs with setup-conflict-payoff.
- If styles include 'informational'/'educational'/'tutorial' → prioritize self-contained insights or step-by-step demos.
- If styles include 'hot-take'/'commentary' → prioritize strong opinions and contrarian framings.
- If styles include 'inspirational' → prioritize emotional peaks and motivational closers.
```

**File:** `backend/app/domain/processing.py`

In `run_pipeline`, fetch persona styles from creator profile + recent Hindsight memories tagged `style:*` before calling `extract_moments`. Pass styles through. Also pass through to `generate_deliverable_for_platform` (the persona_reflection text already covers most of this).

```python
# Stage 3 enhancement
profile = await get_profile_async()  # or sync wrapper
persona_styles = (profile or {}).get("styles", [])
```

## 1.6 Structured Hindsight tags everywhere

**File:** `backend/app/api/routes.py`

Every `retain_observation` call site must use `build_tags()` from `app/domain/tags.py`.

- **POST /api/profile** — tags: `creator_name`, `styles`, `platforms`, `event="profile"`.
- **PATCH /api/derivatives/{id}** background diff observation — tags: `creator_name`, `platforms=[derivative.platform]`, `content_type=<section>`, `event="edit"`.
- **POST approve/reject/regenerate** — tags: `creator_name`, `platforms=[derivative.platform]`, `event=<action>`.
- **POST /api/projects/{id}/complete-review** synthesis observations — tags: `creator_name`, `styles=<inferred from project>`, `event="complete-review"`, plus per-observation `content_type` if discernible from the synthesized text.

**File:** `backend/app/domain/memory.py`

`synthesize_and_store_observations` and `retain_diff_observation` accept and propagate the creator's name + styles. Get from `get_profile()` (cached at top of function call).

**File:** `backend/seed/seed_demo.py`

Update seed observations to use new tagged format with `style:*` and `event:seed` tags so they're filterable from the start.

## 1.7 Rebrand backend strings

- `HINDSIGHT_BANK_ID` default in `config.py`: `"contentos-demo"` → `"orbitos-demo"` (safe — bank was wiped)
- Backend log messages, FastAPI app title, `/health` response: contentOS → OrbitOS
- `docker-compose.yml`: container_name `contentos-backend` → `orbitos-backend`, `contentos-frontend` → `orbitos-frontend`. Network name auto-derives.
- `backend/Dockerfile` LABEL if present
- `seed_demo.py` print statements

**DO NOT rename:** Supabase tables, DB columns, env var names, Python module paths. Display only.

---

# PHASE 2 — Frontend Deliverable + Onboarding (Hour 2, 8-9pm)

**Commit at end of Phase 2:** `feat(frontend): DeliverableCard, persona onboarding, original-aspect clip display, TikTok support`

## 2.1 New `DeliverableCard` component — REPLACES `ProductionBriefTable`

**Create:** `frontend/components/deliverable-card.tsx`

Card layout (one per platform):
```
┌─────────────────────────────────────────────────┐
│  [Platform icon] Platform name      [status badge]│
├─────────────────────────────────────────────────┤
│                                                 │
│  TITLE                                  [↻ regen]│
│  ─────────                                       │
│  <title text>                                    │
│                                                 │
│  CAPTION                                [↻ regen]│
│  ─────────                                       │
│  <caption text>                                  │
│                                                 │
│  DESCRIPTION                            [↻ regen]│
│  ─────────                                       │
│  <description text>                              │
│                                                 │
│  SPOKEN SCRIPT                          [↻ regen]│
│  ─────────                                       │
│  <script with [CUT] [PAUSE] markers>             │
│                                                 │
│  ▸ WHY THIS CLIP   (collapsed by default)        │
│  ▸ VISUAL DIRECTION (collapsed)                  │
│  ▸ EDITOR NOTES     (collapsed)                  │
│                                                 │
├─────────────────────────────────────────────────┤
│  [Copy as Markdown]  [Reject]  [Approve]         │
└─────────────────────────────────────────────────┘
```

Behavior:
- Each section: click to edit inline (contentEditable or textarea on hover), saves to `api.derivatives.update`.
- Each section has a per-section regenerate button → `api.derivatives.regenerate(id, { section: "title", guidance?: string })`.
- Word-level LCS diff overlay on regen (reuse logic from `production-brief-table.tsx`).
- `why_this_clip`, `visual_direction`, `editor_notes` collapsed by default (radix Collapsible) — the demo-shiny stuff (title/caption/description/script) is up top.
- Copy as Markdown → uses new `formatDeliverableAsMarkdown(deliverable, platform)` in `lib/export.ts`.
- Status badge: draft (yellow), approved (green border), rejected (faded).

**File:** `frontend/components/moment-group.tsx`
- Replace `<ProductionBriefTable ... />` with `<DeliverableCard ... />`.
- Tab layout per platform if multiple deliverables exist for one moment.

**Don't delete `production-brief-table.tsx`** — leave in place, just unimported. Faster + safer.

## 2.2 Update types

**File:** `frontend/lib/types.ts`

```ts
export type Platform = 'instagram_reels' | 'youtube_shorts' | 'tiktok' | 'linkedin';

export interface ShortFormDeliverable {
  title: string;
  description: string;
  caption: string;
  spoken_script: string;
  why_this_clip: string;
  visual_direction: string;
  editor_notes: string;
}

export interface Derivative {
  id: string;
  moment_id: string;
  project_id: string;
  platform: Platform;
  content_type: 'production_brief' | 'short_form_deliverable';  // both supported
  content: string;  // JSON-stringified ShortFormDeliverable or legacy ProductionBrief
  status: 'draft' | 'approved' | 'rejected';
  generation_model?: string;
  // ...
}

// Normalizer
export function normalizeDeliverable(raw: Derivative): ShortFormDeliverable {
  const parsed = JSON.parse(raw.content || '{}');
  if (raw.content_type === 'short_form_deliverable') {
    return {
      title: parsed.title || '',
      description: parsed.description || '',
      caption: parsed.caption || '',
      spoken_script: parsed.spoken_script || '',
      why_this_clip: parsed.why_this_clip || '',
      visual_direction: parsed.visual_direction || '',
      editor_notes: parsed.editor_notes || '',
    };
  }
  // legacy ProductionBrief mapping
  return {
    title: parsed.hook || '',
    description: parsed.angle || '',
    caption: parsed.caption || '',
    spoken_script: [parsed?.script?.opening, parsed?.script?.body, parsed?.script?.closer].filter(Boolean).join('\n\n'),
    why_this_clip: '',
    visual_direction: parsed.higgsfield_prompt || '',
    editor_notes: parsed.editor_notes || '',
  };
}
```

## 2.3 Persona-first `OnboardingDialog`

**File:** `frontend/components/onboarding-dialog.tsx`

Rewrite as 6-step flow. Each step minimal copy, big inputs.

| Step | Question | Input |
|---|---|---|
| 1 | "What should we call you, and what's your YouTube channel about?" | Two text fields: `creator_name`, `niche` |
| 2 | "Where do you want to publish your shorts?" *(YouTube is your source — pick the destinations)* | Multi-select chips: Instagram Reels, YouTube Shorts, TikTok, LinkedIn. Default: all 4. Min 1. |
| 3 | "Pick 2-3 vibes that describe your content best" | Grid of style chips from `STYLES` taxonomy. Min 2, max 3. |
| 4 | "Who watches you?" | One textarea — `audience` |
| 5 | "How do you like to hook viewers?" | Radio: `short-punchy` / `setup-payoff` / `question-led` |
| 6 | "Anyone whose short-form style you admire? Drop 1-3 names. Anything you'd NEVER do?" | Two textareas: `persona_inspirations` (UI label only), `never_use` |

UI:
- Step indicator dots at top.
- Back / Next buttons. Last step says "Let's go ✨".
- Persist progress to localStorage between steps in case of reload.
- On submit → `api.profile.save({ creator_name, niche, all_platforms, styles, audience, hook_style, voice_inspirations, never_use, form_data: {...everything} })`.
  - Backend column stays `voice_inspirations` — UI labels it as "Persona inspirations". Don't rename the field in API payload.
  - `hook_length` column gets repurposed to store `hook_style` value — same DB column, different semantics. No migration needed.

Drop "where do you post" entirely. Drop platform-first question. Drop generic "what's your style" multi-text.

## 2.4 Clip display = original aspect

**File:** `backend/app/infrastructure/clip_extraction.py`
- Remove the `_crop_to_vertical` step from the default pipeline.
- New function `_crop_to_vertical_on_demand(input_path, output_path)` — same ffmpeg command, called only by the export endpoint.
- `extract_clips_parallel` produces source-aspect MP4 at `{project_id}/{moment_id}.mp4`.

**File:** `backend/app/api/routes.py`

Add new endpoint:
```python
@router.post("/clips/{project_id}/{moment_id}/export")
async def export_clip_vertical(project_id: str, moment_id: str):
    """Generate a 9:16 vertical version on demand. Returns the URL."""
    src = f"{settings.clip_storage_path}/{project_id}/{moment_id}.mp4"
    dst = f"{settings.clip_storage_path}/{project_id}/{moment_id}_9x16.mp4"
    if not os.path.exists(src):
        raise HTTPException(404, "Source clip missing")
    if not os.path.exists(dst):
        await asyncio.to_thread(_crop_to_vertical_on_demand, src, dst)
    return {"url": f"/api/clips/{project_id}/{moment_id}_9x16.mp4"}
```

**File:** `frontend/components/video-clip-preview.tsx`
- Remove fixed `180px` width.
- Container: `w-full max-w-2xl aspect-video` (16:9) when source is YouTube long-form. Falls back gracefully if MP4 is unexpectedly vertical.
- Add **"Export as 9:16"** button under the player → calls new export endpoint → triggers `<a>` download of the returned URL.
- Keep YouTube embed fallback path unchanged.

**File:** `frontend/lib/api.ts`

```ts
api.clips.exportVertical(projectId: string, momentId: string) // POST /clips/:pid/:mid/export
```

## 2.5 TikTok in PlatformSelector

**File:** `frontend/components/platform-selector.tsx`
- Add `tiktok` option with TikTok logo from `lucide-react` (use `Music2` or import a custom icon).
- Default selected list = all 4 platforms.

**File:** `frontend/lib/types.ts` — already updated in §2.2.

## 2.6 Update `formatBriefAsMarkdown` → `formatDeliverableAsMarkdown`

**File:** `frontend/lib/export.ts`

New function that takes a `ShortFormDeliverable` + `Platform` and outputs:
```markdown
# {title}
*{platform name} · clip from {projectTitle}*

## Caption
{caption}

## Description
{description}

## Spoken Script
{spoken_script}

## Why this clip
{why_this_clip}

## Visual direction (for AI generators)
{visual_direction}

## Editor notes (for AI editor)
{editor_notes}
```

Keep `formatBriefAsMarkdown` exported for any legacy code paths but don't use it.

---

# PHASE 3 — Rebrand + Polish + Smoke Test (Hour 3, 9-10pm)

**Commit at end of Phase 3:** `feat: rebrand to OrbitOS, persona terminology, copy sweep`

## 3.1 Global text rebrand

Use grep + manual review (NEVER blind replace). Search patterns:
- `contentOS`, `ContentOS`, `content-os`, `content_os` → `OrbitOS` (preserve casing context)
- "creator's voice", "creator voice", "your voice" → "creator's persona", "your persona"
- "voice inspirations" (UI label) → "persona inspirations"
- "Generate drafts" → "Generate shorts"
- "Production brief" → "Deliverable" or "Short" depending on context

Files to sweep:
- `frontend/app/layout.tsx` metadata (page title, description)
- `frontend/app/page.tsx` (landing hero)
- `frontend/app/(app)/**/page.tsx` (all in-app pages)
- `frontend/components/**/*.tsx` (especially `app-shell.tsx`, `mascot.tsx`, `onboarding-dialog.tsx`, `upload-input.tsx`)
- `frontend/README.md`
- `backend/app/main.py` — `FastAPI(title=...)`
- `backend/app/api/routes.py` — log messages
- `README.md` at repo root
- `docker-compose.yml` — container names
- `package.json` files — `name` field

**DO NOT change:**
- Git remote name (`Orbit` already)
- Database table names
- Python module paths
- Env var names

## 3.2 Off-theme copy sweep

Find and rewrite anything implying a general content creator rather than a YouTube long-form creator turning long videos into shorts.

Specific targets:
- Landing hero subhead — should mention "turn your long-form YouTube videos into a week of shorts"
- Dashboard empty state — "Paste a YouTube URL to start"
- Upload input placeholder examples — only YouTube URLs
- Mascot thought bubbles — playful about YouTube → shorts journey, persona learning
- Processing log copy — "Finding the 7 best moments for your week of shorts" etc.
- Mention "7 moments / 1 per day of the week" prominently somewhere in the project detail page header to reinforce the product story

## 3.3 Smoke test checklist

Run from clean state:
1. `docker compose down -v && docker compose up --build`
2. Open http://localhost:3000 → OnboardingDialog appears → complete 6 steps → profile saves (verify in Supabase + Hindsight).
3. Dashboard → paste a 5-10 min YouTube URL → all 4 platforms selected → submit.
4. Project page polls → status reaches `ready_for_review`.
5. Expect: 7 moments displayed, spread chronologically across the video, each 30-45s.
6. Each moment renders source-aspect clip in card. "Export as 9:16" button works → MP4 downloads.
7. Each moment shows 4 `DeliverableCard`s (one per platform), tabbed or stacked.
8. Each deliverable has all 7 fields populated. Title/Caption/Description/Script visible. Why/Visual/Editor collapsed.
9. Edit a caption → diff appears on regenerate. Approve → status badge updates.
10. Click "Complete Review" → synthesis runs → project archives → Hindsight has new tagged observations (verify in /memory page graph).

If any step fails → fix in place, do not rollback unless catastrophic.

## 3.4 Pre-demo last-mile

- `docker compose logs -f` open in a terminal so you can spot errors during demo.
- Have ONE rehearsed YouTube URL ready that you've already processed once (so the demo run is hot-cached if possible — but a fresh run is also fine).
- Browser zoom at 100%, sidebar collapsed for clean screenshots.

---

## Risk register (mitigations baked in)

| Risk | Mitigation |
|---|---|
| Claude misformats new schema | `tool_use` enforces JSON. Test with 1 moment first. Fall back to old `BRIEF_SCHEMA` if catastrophic — keep code branch behind `USE_LEGACY_BRIEF` env flag. |
| Chunking math gets ugly | If can't hit 7, ship whatever count came out. Don't pad with low-quality picks. |
| Clip extraction takes too long on a long video | Pick a 10-min video for the demo. Pipeline times out parallel work at 60s per clip anyway. |
| Onboarding rewrite breaks profile save | Keep existing API contract — only `form_data` shape changes. Backend doesn't care about form_data content. |
| Anthropic SDK / Hindsight TLS issues | Already patched. If new failure → check `ssl_patch.py` is imported first in `main.py`. |
| Frontend Next 16 surprises | Reference `frontend/node_modules/next/dist/docs/` before writing new Next features. |

---

## Files touched (quick reference)

**Backend (new):** `app/domain/tags.py`
**Backend (modified):** `app/domain/moments.py`, `app/domain/generation.py`, `app/domain/processing.py`, `app/domain/memory.py`, `app/api/routes.py`, `app/api/schemas.py`, `app/infrastructure/clip_extraction.py`, `app/config.py`, `app/main.py`, `seed/seed_demo.py`
**Backend (unchanged):** Supabase schema, all infra files except clip_extraction

**Frontend (new):** `components/deliverable-card.tsx`
**Frontend (modified):** `lib/types.ts`, `lib/export.ts`, `lib/api.ts`, `components/onboarding-dialog.tsx`, `components/platform-selector.tsx`, `components/moment-group.tsx`, `components/video-clip-preview.tsx`, `components/video-player.tsx`, `components/mascot.tsx`, `components/app-shell.tsx`, `components/upload-input.tsx`, `app/layout.tsx`, `app/page.tsx`, `app/(app)/**/page.tsx`
**Frontend (untouched):** `production-brief-table.tsx`, `creator-profile-modal.tsx`, `moment-card.tsx`, `draft-editor.tsx`, root `app/projects/[id]/page.tsx` (all legacy, leave alone)

**Root:** `docker-compose.yml`, `README.md`

---

## Execution order summary

```
PHASE 1 (7-8pm)
  1.1 tags.py
  1.2 TikTok in config + spec
  1.3 ShortFormDeliverable schema + prompts
  1.4 5-chunk / 7-moment chunker
  1.5 Persona-aware extraction
  1.6 Structured tags everywhere
  1.7 Backend rebrand strings
  → commit

PHASE 2 (8-9pm)
  2.1 DeliverableCard component
  2.2 types.ts update + normalizer
  2.3 Onboarding rewrite
  2.4 Original-aspect clip + export endpoint + button
  2.5 TikTok in PlatformSelector
  2.6 formatDeliverableAsMarkdown
  → commit

PHASE 3 (9-10pm)
  3.1 Global rebrand sweep
  3.2 Off-theme copy sweep
  3.3 Smoke test end-to-end
  3.4 Pre-demo polish
  → commit
  → demo at 10pm
```

**If running over time:** Cut §3.2 copy sweep first, then §2.6 markdown export, then §1.6 advanced tag propagation (do minimum: just creator + style tags). Never cut Phase 1.3-1.4 or Phase 2.1 — those are the demo's centerpiece.
