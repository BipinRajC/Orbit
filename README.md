<img width="1100" height="400" alt="image" src="https://github.com/user-attachments/assets/be6e09f4-0036-44be-af0f-ad14a45b28e3" />



<p align="center">
  <a href="#what-is-orbitos">What is OrbitOS?</a> •
  <a href="#memory-that-compounds">Memory</a> •
  <a href="#what-orbitos-can-quantify-today">Metrics</a> •
  <a href="#processing-flow">Flow</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#api-surface">API</a>
</p>

<p align="center">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16.2.6-000000?logo=nextdotjs" />
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149eca?logo=react" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-State-3ecf8e?logo=supabase&logoColor=white" />
  <img alt="Hindsight" src="https://img.shields.io/badge/Hindsight-Memory-7c5cff" />
  <img alt="Anthropic Claude" src="https://img.shields.io/badge/Claude-Haiku%20%2B%20Sonnet-d97757" />
  <img alt="Groq Whisper" src="https://img.shields.io/badge/Groq-Whisper%20V3%20Turbo-f55036" />
</p>

# OrbitOS

> **One YouTube video → ranked moments, 9:16 clips, platform-ready production briefs — and a memory that gets better every time you use it.**

## The Problem

A fitness creator who deadlifts 200kg gets LinkedIn posts that open with *"In today's fast-paced digital landscape..."* A fintech newsletter writer gets the same generic hooks as a lifestyle vlogger. Every session starts from zero.

The usual fix is a preferences form like check "casual," pick your platforms, list words to avoid. But people are terrible at describing their own style. A creator says "I'm casual and direct" and then rejects every draft that doesn't open with a specific data point. Stated preferences and revealed preferences are two different universes.

OrbitOS solves this by treating every review action as training data. The system observes what creators actually do which hooks they approve, which drafts they shorten, which filler words they always cut and feeds those observations back into the next generation cycle. No fine-tuning, no config pages. Just memory that compounds.

## What Is OrbitOS?

OrbitOS is built for creators who record once and need multiple outputs without rebuilding strategy from scratch every time.

| From one source video | OrbitOS produces | Why it matters |
| --- | --- | --- |
| Timestamped transcript segments | Structured input for selection and generation | The pipeline stays reviewable and deterministic |
| 3-5 strongest moments | Ranked candidate clips with rationale and scores | The best sections rise before editing starts |
| Instagram Reels, YouTube Shorts, and LinkedIn briefs | Hooks, scripts, captions, CTAs, Higgsfield prompts, and editing notes | Output is ready for a creator or editor to work from directly |
| Review signals and retained observations | Better memory context on the next run | The system learns from creator behavior instead of resetting |



## Memory That Compounds

<p align="center">
  <img src="docs/assets/orbit-memory-loop.png" alt="OrbitOS memory loop" width="100%" />
</p>

OrbitOS treats review as structured supervision. The system gets noticeably better with each project:

| Project | What the creator sees | What happens under the hood |
| --- | --- | --- |
| **Project 1** | Generic hooks, safe tone, broad platform defaults | Cold start — `recall()` returns empty, system uses universal heuristics |
| **Project 3** | Hooks that match the creator's preferred length, fewer filler words | 8–12 observations retained from prior reviews, `reflect()` generates a personality summary |
| **Project 5** | Output feels like "it knows me" — right tone, right structure, right platform nuances | 20+ observations compounding, memory reflection shapes every prompt |
| **Project 10+** | Creator edits less than 10% of generated briefs | Dense memory bank, system consistently produces what the creator would have written themselves |

The loop is built on [Hindsight](https://github.com/vectorize-io/hindsight) and works in four stages:

1. **Profile baseline** — `POST /api/profile` stores initial creator observations (niche, platforms, tone, audience, words to avoid) in Hindsight as tagged memories.
2. **Recall before generation** — `run_pipeline()` calls `recall_memories()` and `reflect_on_creator()` before extraction and brief generation. The reflection gets injected into Claude's prompt as a `## Creator Voice & Preferences` section.
3. **Real-time observation** — Editing a derivative triggers `retain_diff_observation()` in the background, classifying whether the creator shortened, expanded, or rewrote the draft.
4. **Post-review synthesis** — `POST /api/projects/{id}/complete-review` passes all editing events to a CascadeFlow synthesis agent, which extracts 6–10 precise observations like *"Creator consistently removes the word 'essentially' and shortens hooks to under 8 words"* and stores them in Hindsight with structured tags.

In code, that loop is explicit:

```python
recall_result = await recall_memories(
    query="How does this creator prefer their content? Hook styles, editing preferences."
)
reflection = await reflect_on_creator(
    query="Summarise this creator's content preferences, voice, and style."
)

background_tasks.add_task(
    retain_diff_observation,
    before=original["content"],
    after=body.content,
    platform=derivative["platform"],
    content_type=derivative["content_type"],
)

count = await synthesize_and_store_observations(str(project_id))
```

## What OrbitOS Can Quantify Today

<p align="center">
  <img src="docs/assets/orbit-memory-kpis.png" alt="OrbitOS memory KPI chart" width="100%" />
</p>

The current branch already stores enough information to measure whether the system is actually adapting. These are code-backed signals, not placeholder product metrics.

| Signal | Source in `v3-mvp` | What it measures |
| --- | --- | --- |
| `memory_context.recall_count` | `run_pipeline()` recall stage | how much prior creator memory was pulled into a project |
| `memory_context.biases_applied` | project `memory_context` | how strongly recalled preferences shaped downstream prompts |
| `observations_saved` | `POST /api/projects/{id}/complete-review` | how much new learning was retained after a review session |
| `editing_events` rows | Supabase `editing_events` table | the raw supervision signal from the creator |
| `approval_rate` | derived from `approve` and `reject` events | whether output fit is improving over time |
| `regeneration_rate` | derived from `regenerate` events | where the system is still missing creator expectations |
| `manual_edit_rate` | derived from `edit` events | how often generated output still needs rewriting |
| `observation_growth` | retained creator observations over time | whether creator memory is compounding across projects |

Useful formulas from the current schema and routes:

```text
approval_rate        = approvals / (approvals + rejects)
regeneration_rate    = regenerations / reviewed_derivatives
manual_edit_rate     = edits / generated_derivatives
memory_utilization   = biases_applied / max(recall_count, 1)
observation_growth   = retained_creator_observations over time
```

## Processing Flow

<p align="center">
  <img src="docs/assets/orbit-processing-flow.png" alt="OrbitOS processing flow" width="100%" />
</p>

| Stage | What happens in `v3-mvp` | Primary implementation |
| --- | --- | --- |
| 1. Ingest | Resolve a YouTube source into captions first, then fall back to downloadable audio when needed | `backend/app/infrastructure/youtube.py` |
| 2. Transcribe | Produce timestamped transcript segments with Groq Whisper when captions are unavailable | `backend/app/infrastructure/transcription.py` |
| 3. Recall | Load creator memory through `recall()` and `reflect()` before downstream generation | `backend/app/infrastructure/hindsight.py` |
| 4. Extract | Select the strongest 3-5 moments with Claude Haiku 4.5 | `backend/app/domain/moments.py` |
| 5. Clip | Cut and crop 9:16 vertical MP4 clips in parallel | `backend/app/infrastructure/clip_extraction.py` |
| 6. Generate | Produce platform-specific production briefs with Claude Sonnet 4.5 | `backend/app/domain/generation.py` |
| 7. Persist | Save projects, moments, derivatives, clips, and review state | `backend/app/infrastructure/supabase.py` |

**Every stage has a fallback.** YouTube throttles downloads → captions are tried first. Audio files >25 MB → auto-chunked before Whisper. Claude returns malformed JSON → regex-parsed as a last resort. Clip extraction fails → YouTube embed with start/end timestamps. No creator memories yet → universal heuristics kick in. The system never shows a blank screen.

### Project Lifecycle

```text
uploaded -> processing -> ready_for_review -> archived
```

### Typical Workflow

1. Save a creator profile so OrbitOS has a baseline memory bank.
2. Create a project from a YouTube URL.
3. Let the background pipeline produce moments, clips, and production briefs.
4. Review the outputs by editing, approving, rejecting, or regenerating derivatives.
5. Complete review so the next project starts with retained creator observations.

## Architecture

<p align="center">
  <img src="docs/assets/orbit-architecture.png" alt="OrbitOS architecture diagram" width="100%" />
</p>

The architecture export above is the repo-owned system diagram. For `v3-mvp`, there is one implementation detail worth reading alongside it: the main extract and generate stages now call Anthropic directly, while CascadeFlow remains in the branch for review synthesis and the existing cost-routing compatibility surface.

OrbitOS is split into four runtime layers:

- a Next.js studio for project creation, review, profile setup, intelligence views, and cost visibility
- a FastAPI backend that runs the seven-stage job in the background
- a creator-memory layer built on Hindsight, with review synthesis flowing back into retained observations
- Supabase plus media tooling for persistence, clip extraction, and status updates

## Keeping It Cheap: CascadeFlow Cost Routing
<img width="997" height="497" alt="image" src="https://github.com/user-attachments/assets/43d750c3-6f52-4cd2-bf72-a4f881fcb958" />


A single project can rack up 15–20 LLM calls. Without cost control, that's roughly **$0.08–0.12 per project** if every call goes to the expensive model. For a creator processing 10 videos a week, that adds up fast and most of those calls don't need premium accuracy.

The key insight: different pipeline stages have different quality requirements. Moment extraction (finding the best 45 seconds in a 30-minute video) needs to be accurate which is getting that wrong means the entire project is useless. But review synthesis (extracting observations like "creator always removes filler words") is simple text classification that a smaller model handles perfectly.

[CascadeFlow](https://github.com/lemony-ai/cascadeflow) routes each call to a drafter model (Groq Llama 3.1 8B — fast, cheap) or a verifier model (Groq Llama 3.3 70B — accurate), based on a quality threshold you set per agent:

```python
def get_extraction_agent() -> CascadeAgent:
    """Higher quality: moment extraction needs accuracy."""
    return build_agent(quality_threshold=0.8)

def get_generation_agent() -> CascadeAgent:
    """Lower threshold: drafter handles most generation cheaply."""
    return build_agent(quality_threshold=0.65)

def get_synthesis_agent() -> CascadeAgent:
    """Synthesis uses drafter only: observations are simple text."""
    return build_agent(quality_threshold=0.5)
```

The cost curve in practice:

| Metric | Without CascadeFlow | With CascadeFlow |
| --- | --- | --- |
| Cost per project | ~$0.10 (all verifier) | ~$0.02–0.03 (70–80% drafter) |
| Synthesis calls on drafter | 0% | ~95% |
| Extraction accuracy | Same | Same (verifier still handles complex extractions) |
| Quality degradation | — | None measurable |

The `CostAccumulator` tracks every call and logs which model handled it, the cost, and what we would have spent if everything went to the expensive model. This surfaces in the UI as a per-project cost breakdown as creators don't need to care about it, but the numbers are there. Three agents, three thresholds, same two underlying models. No routing `if/else` logic. CascadeFlow decides when to escalate based on a single quality number.

## Intelligence Graph: Making Memory Visible

<img width="1004" height="488" alt="image" src="https://github.com/user-attachments/assets/9c83143a-e900-4fbe-ba5e-1c2b4bf809ed" />


If the system is learning from a creator, the creator needs to see what it learned. The intelligence graph queries Hindsight across three memory domains (style/tone, editing behavior, profile preferences), deduplicates by text, and classifies each memory into a node type using the tags Hindsight already stores.

The graph renders with five node types: **root** (creator identity), **traits** (tone, style, voice), **platforms**, **preferences** (editing patterns), and **topics** (niche). Edges encode semantic similarity, temporal proximity, entity overlap (shared keywords), and causal relationships (platform → preference).

The creator can hover over any node and see the full observation text. It's the difference between "the AI is learning" and "here's exactly what the AI thinks it knows about you, and you can see it evolving in real time."

This transparency creates a natural feedback loop that no amount of prompt engineering can match. In testing, creators who spotted observations they disagreed with ("Creator prefers formal tone" when they thought they were casual) immediately edited a few more drafts to correct the signal. The memory system self-corrected because the creator could see the model's assumptions and naturally generated counter-evidence. Users will train the system for free if you just show them what it thinks.

## Quick Start

### 1. Configure environment variables

```bash
cp backend/.env.example backend/.env
```

Fill in:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_API_KEY`
- `GROQ_API_KEY`
- `ANTHROPIC_API_KEY`
- `HINDSIGHT_BASE_URL`
- `HINDSIGHT_API_KEY`

Frontend:

```bash
echo 'NEXT_PUBLIC_API_URL=http://localhost:8000/api' > frontend/.env.local
```

### 2. Apply Supabase migrations

Run these in order in the Supabase SQL editor:

1. [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql)
2. [`supabase/migrations/002_creator_profile.sql`](supabase/migrations/002_creator_profile.sql)
3. [`supabase/migrations/002_v2_claude_engine.sql`](supabase/migrations/002_v2_claude_engine.sql)

### 3. Start the stack

```bash
docker compose up --build
```

The first backend build is slower because the image installs `ffmpeg` and native build tools.

Default endpoints:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Health check: `http://localhost:8000/health`

### 4. Optional local development

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## API Surface

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health |
| `POST` | `/api/projects` | Create a project and kick off the pipeline |
| `GET` | `/api/projects` | List all projects |
| `GET` | `/api/projects/{project_id}` | Fetch one project with moments and derivatives |
| `POST` | `/api/projects/{project_id}/complete-review` | Synthesize creator observations after review |
| `PATCH` | `/api/derivatives/{derivative_id}` | Edit a derivative |
| `POST` | `/api/derivatives/{derivative_id}/approve` | Approve a derivative |
| `POST` | `/api/derivatives/{derivative_id}/reject` | Reject a derivative |
| `POST` | `/api/derivatives/{derivative_id}/regenerate` | Regenerate with optional guidance |
| `POST` | `/api/profile` | Save creator profile and write profile memories |
| `GET` | `/api/profile` | Load saved creator profile |
| `GET` | `/api/profile/status` | Check if profile exists |
| `GET` | `/api/intelligence/graph` | Build the global intelligence graph from Hindsight |
| `GET` | `/api/clips/{project_id}/{moment_id}.mp4` | Serve extracted clip files |

### Example: create a project

```bash
curl -X POST http://localhost:8000/api/projects \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "target_platforms": ["instagram_reels", "youtube_shorts", "linkedin"],
    "video_intent": {
      "topic": "How to build an AI product",
      "goal": "teach_skill"
    }
  }'
```

## Repository Layout

```text
backend/
  app/
    api/             FastAPI routes and schemas
    domain/          Pipeline, generation, memory, moment extraction
    infrastructure/  Supabase, Hindsight, CascadeFlow, Anthropic, Groq, YouTube, clip extraction
  seed/              Demo memory seeding

frontend/
  app/               Landing page plus authenticated studio routes
  components/        Review UI, intelligence graph, onboarding, clip preview, cost panel
  lib/               API client, types, export helpers

supabase/migrations/
  Schema for projects, moments, derivatives, editing events, and creator profile

docs/superpowers/
  Product plans and architecture specs
```

## Key Implementation Files

- [`backend/app/domain/processing.py`](backend/app/domain/processing.py) — seven-stage orchestration and project status updates
- [`backend/app/api/routes.py`](backend/app/api/routes.py) — project, derivative, profile, clip, and intelligence endpoints
- [`backend/app/domain/memory.py`](backend/app/domain/memory.py) — review synthesis, observation storage, and diff-based retention
- [`backend/app/infrastructure/hindsight.py`](backend/app/infrastructure/hindsight.py) — bank initialization, recall, reflect, and retain
- [`backend/app/infrastructure/cascadeflow.py`](backend/app/infrastructure/cascadeflow.py) — synthesis agent and cost telemetry helpers
- [`frontend/components/intelligence-panel.tsx`](frontend/components/intelligence-panel.tsx) — project-level memory visibility
- [`frontend/components/intelligence-graph.tsx`](frontend/components/intelligence-graph.tsx) — creator memory graph
- [`frontend/components/cost-panel.tsx`](frontend/components/cost-panel.tsx) — legacy routing and cost surface in the UI

## Built With

| Layer | Technology | Role |
| --- | --- | --- |
| Frontend | **Next.js 16** + **React 19** | Studio UI with Tailwind CSS v4, Framer Motion, Radix UI |
| Backend | **FastAPI** + **Pydantic** | REST API and background pipeline orchestration |
| Extraction | **Claude Haiku 4.5** (Anthropic SDK) | Moment identification from transcripts — structured JSON via `tool_use` |
| Generation | **Claude Sonnet 4.5** (Anthropic SDK) | Production brief creation with creator memory injection |
| Synthesis | **CascadeFlow** (Groq Llama 3.1 8B / 3.3 70B) | Review observation extraction — drafter handles ~95% of synthesis calls |
| Transcription | **Groq Whisper Large V3 Turbo** | Audio-to-text when YouTube captions unavailable |
| Memory | **Hindsight** | Creator memory recall, reflection, and observation retention |
| State | **Supabase** | Projects, moments, derivatives, editing events, creator profiles |
| Media | **yt-dlp** + **ffmpeg** | Clip extraction, multi-segment stitching, 9:16 vertical crop |
| Deployment | **Docker Compose** | Two-service stack (backend + frontend) |

---

<p align="center">
  <b>OrbitOS</b> — one workflow, one persona, one clear value proposition.<br/>
  Record once. Repurpose everywhere. Let memory do the rest.
</p>
