# ContentOS Architecture Design

**Date:** 2026-05-20
**Status:** Draft
**Type:** Full System Architecture (MVP)

---

## 1. Product Definition

**What it is:** An AI-native Creator Operating System that transforms long-form content into platform-native derivatives while learning the creator's voice over time.

**What it is NOT:** A dashboard, chatbot, analytics tool, social media scheduler, or generic SaaS.

**Core promise:** "I open the app and my week feels lighter."

**Target user:** Solo creator producing 1-2 long-form pieces weekly, overwhelmed by repurposing and consistency pressure.

**Magic moment:** Upload one podcast/video/transcript. Get an intelligent, platform-native, creator-voiced content system generated around it — organized by moments, reviewable inline.

**Long-term moat:** Memory that evolves with the creator. Outputs increasingly "sound like me" because the system learns from every interaction.

---

## 2. Product Philosophy

### Design Principles

| Principle | Meaning |
|-----------|---------|
| Quiet competence | Intelligence felt through output quality, not displayed through UI |
| Content Projects | One source becomes many derivatives — the primary object |
| Progressive drip | Unfolds live if creator is present, notifies if absent |
| Behavioral learning | System learns from how creators edit, not from settings pages |
| Momentum over perfection | Creators refine good drafts, not write from scratch |
| Authenticity over virality | Amplify the creator's best, don't push engagement bait |
| Reduce decisions | Creator provides content, system handles complexity |

### Anti-Patterns (Explicitly Avoided)

- Dashboard-heavy interfaces
- Chatbot-as-primary-interaction
- Analytics overload
- Social media management SaaS patterns
- Enterprise CRUD workflows
- Settings/configuration labyrinths
- Moderation-queue UX for reviews

---

## 3. Core Workflow (MVP)

### Input

One unified entry point. Creator provides content via:
- YouTube URL (highest priority — lowest friction)
- Audio/video file upload
- Pasted transcript

System detects input type and routes accordingly.

### Processing Pipeline

```
Input received
    → Normalize (YouTube URL → fetch transcript/audio; file → extract audio)
    → Transcribe if needed (Deepgram — timestamps + speaker diarization)
    → Extract 3-5 strongest moments (LLM via cascadeflow)
    → Per moment (parallel):
        ├→ Generate hooks
        ├→ Generate short-form video drafts (Shorts/Reels/TikTok — unified)
        └→ Generate Twitter/X drafts
    → Synthesize style observations (parallel with generation)
    → Update creator memory in Hindsight
    → Mark project ready for review
```

### Output

Derivatives organized by source moment:

**Per moment:**
- Clip identification (timestamp + transcript snippet + selection rationale)
- Hook variations
- Short-form video caption/framing (unified for Shorts/Reels/TikTok)
- Twitter/X post(s)

**Two creative lanes for MVP:**
- Short-form video (covers YouTube Shorts, Instagram Reels, TikTok)
- Twitter/X (tweets, potential threads)

### Review Experience

- Batch review grouped by moment
- Each moment shows: source clip → all derivatives
- Inline editing as default interaction
- Approve / reject / regenerate per draft
- Deeper editor available progressively when needed
- Feels editorial and creative, not operational or queue-like

### Platform Differentiation

Same core insight per moment, re-expressed natively per platform. Not the same text reformatted. Each platform gets appropriate framing:
- Short-form video: curiosity-driven, visual-first, hook-heavy
- Twitter/X: intellectual, punchy, conversational

---

## 4. Backend Architecture

### Architectural Identity

**Domain-driven core with event-driven internal workflows.**

The backend owns workflow intelligence, memory synthesis, and prompt construction. External systems provide capabilities (model routing, memory storage, transcription) — they are tools, not the brain.

### Principle

Own what differentiates (creator workflow intelligence, prompt construction, editorial judgment). Delegate what doesn't (model routing, memory storage, transcription, auth).

### External Systems

| Layer | System | Responsibility |
|-------|--------|----------------|
| State | Supabase | Operational data, project records, editing events, auth |
| Memory | Hindsight | Creator intelligence (semi-faceted, namespaced per creator) |
| Execution | cascadeflow | Model routing, cost/quality tradeoffs, retries, fallbacks |
| Transcription | Deepgram | Audio/video to timestamped transcript with diarization |
| Observability | Langfuse | Tracing, debugging, latency tracking, cost monitoring |
| Fast Inference | Fireworks AI | Available via cascadeflow routing for fast bulk processing |

### Domain Structure

```
app/
├── domain/
│   ├── projects/          # Content project lifecycle (state machine)
│   ├── processing/        # Pipeline stages (domain-specific DAG)
│   ├── memory/            # Synthesis logic + prompt construction
│   ├── generation/        # Draft generation (calls cascadeflow)
│   └── creators/          # Creator profile, onboarding, preferences
├── infrastructure/
│   ├── supabase/          # Repositories + real-time
│   ├── hindsight/         # Memory read/write client
│   ├── cascadeflow/       # Execution routing client
│   ├── deepgram/          # Transcription client
│   ├── youtube/           # YouTube URL → transcript/audio extraction
│   └── events/            # Internal event bus
├── api/
│   ├── routes/            # Intentional REST endpoints (thin)
│   └── websockets/        # Real-time progress updates
└── workers/
    └── pipeline/          # Async DAG stage processors
```

### Project Lifecycle (State Machine)

What the frontend sees — simple, calm, predictable:

```
uploaded → processing → ready_for_review → archived
```

No `published` state in MVP (publishing is out of scope).

### Processing Internals (Domain-Specific DAG)

Invisible to the frontend. Parallel where possible:

```
transcribe
    → extract_moments
        ├→ generate_hooks (per moment)
        ├→ generate_short_form_drafts (per moment)
        ├→ generate_twitter_drafts (per moment)
        └→ synthesize_style_observations
    → update_memory
    → mark_ready_for_review
```

This is NOT a generic workflow engine. It is a creator-content processing pipeline. Keep it domain-specific and tightly scoped.

### API Surface (MVP)

Intentional, minimal REST endpoints:

| Endpoint | Purpose |
|----------|---------|
| `POST /projects` | Create project (upload file, URL, or transcript) |
| `GET /projects` | List creator's projects with status |
| `GET /projects/:id` | Full project with moments and derivatives |
| `PATCH /derivatives/:id` | Update draft content (inline edit) |
| `POST /derivatives/:id/approve` | Approve a draft |
| `POST /derivatives/:id/reject` | Reject a draft |
| `POST /derivatives/:id/regenerate` | Regenerate with optional guidance |
| `POST /directions` | Add creative direction note |
| `GET /directions` | List creator's active directions |
| `GET /projects/:id/progress` | WebSocket — real-time progress stream |

### Progressive Drip (Real-Time Updates)

High-level creator-meaningful milestones only:

- "Transcription complete"
- "Found N strong moments"
- "Drafts ready for Moment #1"
- "All moments ready for review"

NOT internal DAG stage completions. The creator sees meaningful progress, not pipeline noise.

Implementation: Supabase Realtime subscriptions or WebSocket from FastAPI.

---

## 5. Memory Architecture

### Structure: Semi-Faceted

Multiple evolving memory buckets per creator (namespaced in Hindsight):

| Facet | What It Stores |
|-------|----------------|
| Creator identity | Who they are, what they're about, their niche |
| Communication style | Sentence structure, vocabulary, tone, formality level |
| Hook patterns | What opener structures resonate with this creator |
| Audience signals | (Later) What performs, what resonates |
| Editing behavior | Patterns in how they modify AI outputs |
| Strategic direction | Current creative direction notes, evolving focus |

### Three-Tier Synthesis Model

| Tier | Source | Lifecycle | Generation Influence |
|------|--------|-----------|---------------------|
| Observations | Single upload or edit session | Ephemeral | Light bias |
| Patterns | Repeated across 2-3+ interactions | Persistent when confirmed | Moderate bias |
| Convictions | Consistently confirmed over time | Stable with decay dynamics | Strong bias |

### Synthesis Triggers

- **Per-upload (MVP):** Capture observations from content style and editing behavior. Check if existing patterns are reinforced. Lightweight — runs after each project is reviewed.
- **Periodic reflection (V2):** Promote patterns to convictions. Identify new patterns. Detect style evolution. Decay contradicted convictions. Not in MVP scope.

### Key Principles

- Memory **biases** generation, never **dictates** it
- Convictions have confidence scores and decay over time
- If recent behavior contradicts old convictions, they weaken gradually
- The system avoids producing caricatures — outputs should feel natural, not templated
- Prompt construction (how memory becomes generation context) lives in the domain core — this IS the product intelligence

### Prompt Construction (Domain-Owned)

When generating content for a creator:
1. Query Hindsight for relevant memory facets
2. Construct context-rich prompt with memory as soft guidance (not hard constraints)
3. Include creative direction notes if active
4. Pass to cascadeflow for model selection and execution
5. Return generated content

Example prompt framing (good):
> "This creator tends toward conversational, metaphor-rich language with short punchy sentences. Their hooks typically open with contrarian framing. Adapt to this style while keeping the content natural."

NOT (bad):
> "ALWAYS use short sentences. NEVER use academic language. MUST include metaphors."

---

## 6. Moment Extraction

### Scoring Dimensions (Universal Heuristics — MVP)

| Dimension | What It Measures |
|-----------|-----------------|
| Standalone clarity | Does this segment make sense without surrounding context? |
| Emotional intensity | Spike in conviction, passion, humor, or vulnerability |
| Shareability | Would someone clip this and send to a friend? |
| Platform fit | Works as a 30-60 second standalone piece |
| Novelty | Unique insight vs. common wisdom |
| Retention gravity | Creates curiosity momentum that makes people keep watching |

### Evolution Path

- MVP: Fixed universal heuristics (above dimensions weighted equally)
- Over time: Creator memory biases scoring weights
  - Some creators lean toward contrarian takes
  - Others toward emotional storytelling
  - Others toward tactical frameworks
- Memory adapts the scoring, not replaces it

### Authenticity Guardrail

Optimize for genuine high-signal, creator-authentic moments. NOT pure virality or algorithm bait. The system should amplify what's authentically strong, not manufacture engagement.

---

## 7. Frontend Architecture

### Philosophy

Workspace, not dashboard. Projects, not feeds. Calm, operational, low cognitive load.

### Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui

### Structure

```
app/
├── (workspace)/
│   ├── page.tsx                  # Active projects list
│   ├── [projectId]/
│   │   └── page.tsx              # Single project workspace
│   └── upload/
│       └── page.tsx              # Unified upload (file/URL/transcript)
├── (onboarding)/
│   └── page.tsx                  # 3-question cold start seed
├── (direction)/
│   └── page.tsx                  # Creative direction notes
└── components/
    ├── project-card.tsx          # Project status + preview
    ├── moment-group.tsx          # One moment + all its derivatives
    ├── draft-editor.tsx          # Inline editing with regenerate
    ├── progress-stream.tsx       # Progressive milestone updates
    └── platform-preview.tsx      # Platform-native content preview
```

### Key UX Decisions

- **Project list** is the home view. Shows: projects processing, projects ready for review, archived projects.
- **Single project view** shows source material at top, moments below, each moment expanding into its derivatives.
- **Review** feels editorial — refining good ideas, not managing AI outputs.
- **Progressive drip** shows high-level milestones as the project processes.
- **No analytics pages, no calendars, no scheduling views** in MVP.

### Cold Start Onboarding

Three questions before first upload:
1. What platforms do you post on?
2. How would you describe your tone/style in a few words?
3. Any creators whose style you admire? (optional)

30 seconds. Enough to seed initial memory without creating friction.

---

## 8. Steering Mechanism

### Hierarchy (Most Natural → Most Explicit)

1. **Implicit behavioral learning** (primary) — system learns from editing patterns
   - Softening hooks → learn to be less aggressive
   - Shortening tweets → learn to be more concise
   - Rejecting certain platforms → stop generating for them
   - Adding emojis → learn emoji style

2. **Inline regeneration/correction** — "regenerate this, but more conversational"
   - Per-draft, in-the-moment steering
   - High-signal because it's contextual

3. **Creative direction notes** (occasional) — free-text strategic guidance
   - "More educational this month"
   - "Less controversy"
   - "Leaning into founder content"
   - "More cinematic tone"
   - Timestamped, factored into memory

### What Does NOT Exist

- Profile forms
- Sliders
- Preference dashboards
- Explicit AI settings pages
- Configuration wizards

---

## 9. Supabase Schema (MVP)

### Tables

```sql
-- Creator identity and auth
creators (
    id uuid primary key,
    supabase_auth_id uuid unique,
    name text,
    onboarding_platforms text[],
    onboarding_tone text,
    onboarding_inspiration text,
    created_at timestamptz
)

-- One per upload
content_projects (
    id uuid primary key,
    creator_id uuid references creators(id),
    status text check (status in ('uploaded', 'processing', 'ready_for_review', 'archived')),
    source_type text check (source_type in ('youtube_url', 'audio_upload', 'video_upload', 'transcript')),
    title text,
    created_at timestamptz,
    updated_at timestamptz
)

-- The uploaded/fetched source material
source_materials (
    id uuid primary key,
    project_id uuid references content_projects(id),
    original_url text,
    file_path text,
    transcript jsonb,          -- Deepgram output with timestamps
    duration_seconds integer,
    metadata jsonb,
    created_at timestamptz
)

-- Extracted strong moments
moments (
    id uuid primary key,
    project_id uuid references content_projects(id),
    start_timestamp float,
    end_timestamp float,
    transcript_snippet text,
    strength_score float,
    selection_rationale text,
    sort_order integer,
    created_at timestamptz
)

-- Generated content pieces
derivatives (
    id uuid primary key,
    moment_id uuid references moments(id),
    project_id uuid references content_projects(id),
    platform text check (platform in ('short_form_video', 'twitter')),
    content_type text check (content_type in ('hook', 'caption', 'tweet', 'thread', 'framing')),
    content text,
    status text check (status in ('draft', 'approved', 'rejected')),
    generation_metadata jsonb,
    created_at timestamptz,
    updated_at timestamptz
)

-- Editing behavior signals
editing_events (
    id uuid primary key,
    creator_id uuid references creators(id),
    derivative_id uuid references derivatives(id),
    event_type text check (event_type in ('edit', 'approve', 'reject', 'regenerate')),
    before_content text,
    after_content text,
    regeneration_guidance text,
    platform text,
    content_type text,
    created_at timestamptz
)

-- Strategic direction notes
creative_directions (
    id uuid primary key,
    creator_id uuid references creators(id),
    content text,
    is_active boolean default true,
    created_at timestamptz
)
```

### Row-Level Security

Every table filtered by `creator_id`. Supabase RLS policies ensure complete isolation between creators.

---

## 10. Infrastructure & Deployment

| Component | Platform | Notes |
|-----------|----------|-------|
| Frontend | Vercel | Next.js, auto-deploy from git |
| Backend API | Railway | FastAPI, handles REST + WebSocket |
| Async Workers | Railway | Background DAG stage processors |
| Database | Supabase | Postgres + Auth + Realtime + RLS |
| Memory | Hindsight | Namespaced per creator |
| Transcription | Deepgram | Timestamps + speaker diarization |
| AI Execution | cascadeflow | Routes to Groq / OpenAI / Anthropic |
| Observability | Langfuse | Tracing, debugging, latency, cost |

### Auth Flow

1. Creator authenticates via Supabase Auth (frontend)
2. Frontend receives JWT
3. All API calls include JWT in Authorization header
4. FastAPI middleware verifies JWT and extracts creator_id
5. All queries scoped to creator_id

---

## 11. Multi-Tenancy

- Lightweight from day one
- Every creator has isolated projects, memory, and workspace context
- Isolation via: creator_id on every table, Supabase RLS, Hindsight namespace per creator
- No org/team complexity initially
- Architecture supports scaling to many creators without rewrite

---

## 12. What Is NOT In MVP

| Excluded | Reason |
|----------|--------|
| Video/audio clip cutting | FFmpeg complexity, rendering queues, storage costs |
| Carousel generation | Additional content type, not core |
| Publishing to platforms | Out of scope — no platform API integrations |
| Scheduling/calendar | Avoids social media management SaaS territory |
| Analytics | Explicitly against product philosophy |
| Backlog import/mining | V2 feature (Firecrawl-powered) |
| Creator fine-tuning | V2 feature (Unsloth-powered) |
| Notes/ideation workflow | Different mental model, separate future surface |
| Team/org features | Enterprise complexity, not needed |
| LinkedIn platform | Can add later when short-form is solid |
| Periodic memory reflection | V2 — MVP does per-upload synthesis only |

---

## 13. V2+ Roadmap (Acknowledged, Not Designed)

- Backlog import via Firecrawl (paste channel URL → import catalog)
- Periodic memory reflection/synthesis (pattern promotion, conviction decay)
- Creator-specific fine-tuning via Unsloth
- Video clip cutting and rendering
- Additional platforms (LinkedIn, newsletter excerpts, carousels)
- Cadence/scheduling intelligence
- Notes → ideation workflow (separate surface)
- Engagement feedback loop (audience signals from published content)
- AgentMail integration (email a link → system processes it)

---

## 14. Success Criteria

The MVP succeeds if:

1. A creator uploads one podcast episode and receives platform-native drafts that feel recognizably like their voice (especially after 2-3 uses)
2. The review experience feels like refining good ideas, not managing AI outputs
3. Time from upload to "content week ready" is under 5 minutes
4. Cognitive load is lower than doing it manually — the creator feels relief
5. By the 5th upload, outputs are noticeably better than the 1st (memory working)

---

## 15. Long-Term Challenge (Acknowledged)

The biggest long-term challenge is not orchestration or memory infrastructure. It is **taste and editorial judgment** — whether the system consistently identifies genuinely high-signal, creator-authentic moments instead of generic "viral" clips.

The three-tier memory system and moment extraction heuristics are the mechanisms. But the quality of judgment is what separates a magical product from a competent one. This must be continuously refined through creator feedback, editing behavior analysis, and heuristic evolution.
