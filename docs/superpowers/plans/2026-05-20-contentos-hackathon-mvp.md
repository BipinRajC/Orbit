# ContentOS — Hackathon MVP Plan

**Hackathon:** Hack With Bangalore — Building AI Agents with Hindsight & cascadeflow
**Date:** 2026-05-20
**Philosophy:** ContentOS architecture (80%) + ClipCraft hackathon visibility optimizations (20%)

---

## 1. What We're Building

An AI-native Creator Operating System that transforms long-form content into platform-native derivatives (short-form video framing + Twitter posts), learns creator voice through behavioral observation, and makes that intelligence VISIBLE to hackathon judges.

**One sentence:** Upload a podcast → get creator-voiced hooks, tweets, and clip framing → system gets better every session because it watches how you edit.

**What it is NOT:** A clip extraction tool, a chatbot, a dashboard, or a scheduler.

**Core differentiator vs ClipCraft:** ContentOS doesn't just find clips — it generates *platform-native creative outputs* (hooks, tweets, framings) that sound like the creator. Multiple creative lanes, not just one.

---

## 2. Hackathon Strategy

### Judging Criteria Alignment

| Criteria | Weight | How ContentOS Scores |
|---|---|---|
| **Innovation** | 30% | AI that learns voice from editing behavior — no other tool does this. Memory evolves PER CREATOR across sessions. Multi-platform derivatives, not just clips. |
| **Use of Hindsight & cascadeflow** | 25% | Both are first-class and VISIBLE. Intelligence Panel shows memory recall + synthesis. Cost Panel shows cascadeflow routing. Not infrastructure — visible product features. |
| **Technical Implementation** | 20% | Clean domain-driven architecture. Next.js + FastAPI + Supabase. Proper state machine. Event-driven pipeline. |
| **User Experience** | 15% | Editorial workspace, not dashboard. Review by moment. Inline editing. Progressive drip. Feels like a creator tool, not a dev tool. |
| **Presentation** | 10% | Clear 2-upload demo story. Before/after memory adaptation. Visible intelligence. |

### The "Quiet Competence + Visible Intelligence" Resolution

ContentOS philosophy says intelligence should be felt, not displayed. But judges need to SEE it working.

**Resolution:** The workspace is calm and editorial (ContentOS philosophy). But an **Intelligence Panel** slides open to show the reasoning — what memory was recalled, how it influenced generation, what cascadeflow saved. For real creators, this is optional/collapsible. For the demo, we expand it.

---

## 3. Demo Story (90 seconds)

1. Paste a YouTube URL → click **Process**
2. Progress milestones: "Transcribing..." → "Found 4 strong moments" → "Generating derivatives..."
3. Project page shows 4 moments, each with: hook variations, tweet drafts, short-form video framing
4. Intelligence Panel shows: *"No prior memory — generated with universal heuristics"*
5. Creator edits a tweet (shorter, punchier), rejects an aggressive hook, approves a question hook
6. Click **Complete Review** → system synthesizes: "Creator prefers concise tweets, question-style hooks, rejects aggressive clickbait"
7. Paste a SECOND YouTube URL → Process
8. Intelligence Panel now shows: *"Recalled 3 observations: concise tweets preferred, question hooks favored, aggressive openers rejected"*
9. Generated tweets are shorter. Hooks are questions. No aggressive clickbait.
10. Cost Panel: *"12 LLM calls. 9 handled by fast model. Total: $0.003. Saved: 58% vs always using expensive model."*

**The magic:** Output quality visibly improves between Video 1 and Video 2.

---

## 4. Architecture

```
Input (YouTube URL / file / transcript)
  │
  ▼
[1. INGEST]      Detect type → fetch/extract audio or transcript
  │
  ▼
[2. TRANSCRIBE]  Deepgram or Groq Whisper → timestamped segments
  │
  ▼
[3. RECALL]      Hindsight recall() → raw memories (shown in Intelligence Panel)
  │              Hindsight reflect() → compact synthesis (injected into prompts)
  │
  ▼
[4. EXTRACT]     cascadeflow → identify 3-5 strongest moments from transcript
  │              (Moment scoring: standalone, emotional, shareable, novel, retainable)
  │
  ▼
[5. GENERATE]    Per moment (parallel via cascadeflow):
  │              ├→ 2-3 hook variations
  │              ├→ 1-2 tweet drafts
  │              └→ 1 short-form video framing/caption
  │
  ▼
[6. REVIEW]      Next.js workspace: grouped by moment, inline edit, approve/reject
  │
  ▼
[7. SYNTHESIZE]  Analyze editing events → extract style observations
  │              → Hindsight retain() → stored for next session
```

---

## 5. Tech Stack

| Component | Tool | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui | Workspace UX |
| Backend | Python 3.12 + FastAPI | Domain logic, pipeline orchestration |
| Database | Supabase (Postgres) | Projects, moments, derivatives, editing events |
| Auth | Skipped for hackathon | Hardcoded single creator. Architecture supports multi-tenant. |
| Memory | Hindsight (`hindsight-client`) | Per-creator memory bank |
| AI Routing | cascadeflow (`CascadeAgent`) | Model selection, cost optimization |
| Transcription | Deepgram (primary) or Groq Whisper (fallback) | Timestamped segments |
| Observability | Langfuse (if time permits) | LLM tracing |
| YouTube | yt-dlp | Audio/transcript extraction |

### Models (via cascadeflow)

| Task | Drafter (cheap/fast) | Verifier (expensive/quality) |
|---|---|---|
| Moment extraction | `llama-3.1-8b-instant` | `llama-3.3-70b-versatile` or GPT-4 |
| Hook generation | `llama-3.1-8b-instant` | `llama-3.3-70b-versatile` |
| Tweet generation | `llama-3.1-8b-instant` | `llama-3.3-70b-versatile` |
| Short-form framing | `llama-3.3-70b-versatile` | GPT-4 |
| Style synthesis | `llama-3.1-8b-instant` | — (cheap is sufficient) |

All Groq models on free tier. No paid keys needed for demo.

---

## 6. Scope

### In (Hackathon MVP)

| Feature | Priority |
|---|---|
| YouTube URL input → processing pipeline | P0 |
| Transcription (Deepgram or Groq Whisper) | P0 |
| Moment extraction (3-5 moments with timestamps + rationale) | P0 |
| Per-moment generation: hooks + tweets + short-form framing | P0 |
| Review workspace: grouped by moment, inline editing | P0 |
| Approve / reject / regenerate per derivative | P0 |
| Editing event capture (before/after on save) | P0 |
| Memory synthesis after review (observations → Hindsight) | P0 |
| Memory recall before generation (biases prompts) | P0 |
| Intelligence Panel (memory + reasoning visibility) | P0 |
| Cost Panel (cascadeflow routing visibility) | P0 |
| Progressive milestones (polling-based) | P1 |
| Demo seed script (pre-populate memory for presentation) | P1 |

### Out (Deferred)

| Feature | Why |
|---|---|
| Auth / multi-user | Demo is single-creator |
| Video clip cutting (ffmpeg) | Complexity. Timestamps + framing text is sufficient. |
| Publishing to platforms | Out of scope |
| Scheduling / calendar | SaaS territory |
| File upload / paste transcript input | YouTube URL only for demo |
| Creative direction notes | Deferred |
| Onboarding flow | Seeded for demo |
| Deployment (Vercel/Railway) | Local demo |

---

## 7. Backend Structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI app, CORS, routes
│   ├── config.py                # Environment + constants
│   │
│   ├── domain/
│   │   ├── projects.py          # Project lifecycle state machine
│   │   ├── processing.py        # Pipeline orchestration (the DAG)
│   │   ├── moments.py           # Moment extraction logic + prompts
│   │   ├── generation.py        # Derivative generation + prompt construction
│   │   └── memory.py            # Synthesis + observation extraction
│   │
│   ├── infrastructure/
│   │   ├── hindsight.py         # Hindsight client (recall/reflect/retain)
│   │   ├── cascadeflow.py       # CascadeAgent setup + helpers
│   │   ├── transcription.py     # Deepgram/Groq Whisper client
│   │   ├── youtube.py           # yt-dlp integration
│   │   └── supabase.py          # Supabase client + repositories
│   │
│   └── api/
│       ├── routes.py            # All REST endpoints
│       └── schemas.py           # Pydantic request/response models
│
├── seed/
│   └── seed_demo.py             # Pre-populate Hindsight for demo
│
├── .env
└── requirements.txt
```

---

## 8. Frontend Structure

```
frontend/
├── app/
│   ├── page.tsx                         # Project list (home)
│   ├── projects/[id]/page.tsx           # Single project workspace
│   └── layout.tsx                       # App shell
│
├── components/
│   ├── upload-input.tsx                 # YouTube URL input + process button
│   ├── project-card.tsx                 # Status card in list
│   ├── moment-group.tsx                 # One moment + all derivatives
│   ├── draft-editor.tsx                 # Inline editor + approve/reject/regen
│   ├── intelligence-panel.tsx           # Memory + reasoning display
│   ├── cost-panel.tsx                   # cascadeflow routing visibility
│   └── progress-stream.tsx              # Milestone indicators
│
├── lib/
│   ├── api.ts                           # Backend API client
│   └── types.ts                         # TypeScript types
│
└── package.json
```

---

## 9. Database Schema (Supabase)

```sql
-- Single creator for hackathon (no auth table needed)
CREATE TABLE content_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT CHECK (status IN ('uploaded', 'processing', 'ready_for_review', 'archived')) DEFAULT 'uploaded',
    source_url TEXT,
    title TEXT,
    transcript JSONB,
    duration_seconds INTEGER,
    processing_log JSONB DEFAULT '[]',
    cost_log JSONB DEFAULT '{}',
    memory_context JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Extracted moments
CREATE TABLE moments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES content_projects(id) ON DELETE CASCADE,
    start_timestamp FLOAT,
    end_timestamp FLOAT,
    transcript_snippet TEXT,
    strength_score FLOAT,
    selection_rationale TEXT,
    sort_order INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Generated content pieces
CREATE TABLE derivatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moment_id UUID REFERENCES moments(id) ON DELETE CASCADE,
    project_id UUID REFERENCES content_projects(id) ON DELETE CASCADE,
    platform TEXT CHECK (platform IN ('short_form_video', 'twitter')),
    content_type TEXT CHECK (content_type IN ('hook', 'caption', 'tweet', 'framing')),
    content TEXT,
    status TEXT CHECK (status IN ('draft', 'approved', 'rejected')) DEFAULT 'draft',
    generation_model TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Editing behavior signals (the learning source)
CREATE TABLE editing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    derivative_id UUID REFERENCES derivatives(id) ON DELETE CASCADE,
    event_type TEXT CHECK (event_type IN ('edit', 'approve', 'reject', 'regenerate')),
    before_content TEXT,
    after_content TEXT,
    regeneration_guidance TEXT,
    platform TEXT,
    content_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 10. Hindsight Integration

### Memory Bank

```python
BANK_ID = "contentos-demo"
BANK_BACKGROUND = (
    "A creator intelligence memory system. Tracks how a content creator "
    "communicates, what hook styles they prefer, how they edit AI outputs, "
    "and what content patterns resonate with their voice. Used to personalize "
    "future content generation to sound authentically like the creator."
)
BANK_DISPOSITION = {
    "skepticism": 3,    # balanced
    "literalism": 4,    # precise about style attributes
    "empathy": 3,       # balanced
}
```

### Four Hindsight Touchpoints

1. **init_bank()** — on startup, idempotent
2. **recall()** — before generation, pull raw memories → shown in Intelligence Panel
3. **reflect()** — before generation, get compact synthesis → injected into prompts
4. **retain()** — after review, store each editing observation

### What Gets Retained (After Review)

```python
# Per-project synthesis, stored as observations
"Creator shortened 3/5 generated tweets. Average reduction: 40 chars."
"Creator rejected 2 hooks with aggressive/clickbait framing."
"Creator approved all question-style hooks without editing."
"Creator's editing style: removes filler words, prefers direct statements."
```

### Memory Panel Display (Intelligence Panel)

Shows judges exactly what Hindsight provides:
- **Raw recall:** "Loaded N memories" + expandable list
- **Reflection synthesis:** "Based on past sessions, this creator prefers..."
- **Generation influence:** "Applied 3 memory-based biases to prompt construction"

---

## 11. cascadeflow Integration

### CascadeAgent Pattern

```python
# Drafter handles ~70% of calls cheaply
# Verifier escalates only when quality is uncertain
cascade_agent = CascadeAgent(models=[
    ModelConfig(name="llama-3.1-8b-instant", provider="groq", cost=0.00001),
    ModelConfig(name="llama-3.3-70b-versatile", provider="groq", cost=0.0001),
])
```

### Cost Panel Display

Shows judges cascadeflow's value:
- Total LLM calls made
- How many handled by cheap model vs expensive
- Percentage routed cheaply
- Total cost in USD
- Estimated savings vs always-expensive

### Per-Task Routing

Different CascadeAgents for different quality requirements:
- **Moment extraction:** Higher quality threshold (verifier more likely)
- **Hook/tweet generation:** Lower threshold (drafter handles most)
- **Style synthesis:** Cheapest model always sufficient

---

## 12. Implementation Phases (Hackathon-Optimized)

### Phase 1: Skeleton (3-4 hours)

**Goal:** Both apps running, connected, database ready.

- `npx create-next-app` with TypeScript + Tailwind + App Router
- FastAPI skeleton with CORS
- Supabase project + run migrations
- Verify: frontend can call backend → get 200
- Install all Python deps (hindsight-client, cascadeflow, openai, yt-dlp)
- Install all JS deps (shadcn/ui components needed)

**Done when:** Frontend renders, backend responds, Supabase tables exist.

---

### Phase 2: Pipeline Core (6-8 hours)

**Goal:** YouTube URL → transcript → moments → derivatives in database.

- YouTube ingestion (yt-dlp → audio)
- Transcription (Deepgram or Groq Whisper with chunking)
- Moment extraction prompt + cascadeflow call
- Generation prompts (hooks, tweets, framing) + cascadeflow calls
- Store all results in Supabase
- Project status transitions working
- `POST /projects` and `GET /projects/:id` endpoints

**Done when:** Paste URL in Postman → moments + derivatives appear in Supabase tables.

---

### Phase 3: Workspace UI (4-6 hours)

**Goal:** Creator can see and interact with generated content.

- Project list page (cards with status)
- Project detail page (moments grouped, derivatives nested)
- Moment group component (source snippet → derivatives)
- Draft editor (inline text editing)
- Approve/reject/regenerate buttons
- Upload input on home page

**Done when:** Full visual flow works. Creator can see moments, read derivatives, edit them.

---

### Phase 4: Memory Loop (4-6 hours)

**Goal:** Editing → observations → Hindsight → better next generation.

- Editing event capture (before/after on save, approve, reject)
- Synthesis service: analyze editing events → extract observations
- `retain()` observations to Hindsight
- `recall()` + `reflect()` before generation
- Inject memory context into generation prompts
- Verify: second project generates noticeably different outputs

**Done when:** Edit → save feedback → process second video → outputs are adapted.

---

### Phase 5: Intelligence Visibility (3-4 hours)

**Goal:** Judges can SEE the intelligence working.

- Intelligence Panel component (collapsible sidebar or drawer)
  - Memory section: count loaded, expandable raw memories, reflection text
  - Reasoning section: "Applied N memory-based biases"
  - Before/after: "First run: no memory" vs "Second run: adapted based on..."
- Cost Panel component
  - Total calls, drafter %, verifier %, cost, savings
- Progress milestones during processing (polling /projects/:id)

**Done when:** The demo story from Section 3 is visually executable.

---

### Phase 6: Polish + Demo Prep (2-3 hours)

**Goal:** Demo-ready. No rough edges in the happy path.

- Demo seed script (pre-populate Hindsight with realistic observations)
- Loading states, empty states, error messages
- Test with 2 real YouTube videos end-to-end
- Prepare fallback: if live pipeline fails, have pre-computed results to show
- Clean up any console errors, styling issues

**Done when:** Can run the 90-second demo story smoothly without errors.

---

## 13. API Endpoints (MVP)

| Method | Path | Purpose |
|---|---|---|
| POST | `/projects` | Create project (accepts `{ url }`) |
| GET | `/projects` | List all projects with status |
| GET | `/projects/:id` | Full project: moments + derivatives + memory context + cost log |
| PATCH | `/derivatives/:id` | Save inline edit |
| POST | `/derivatives/:id/approve` | Mark approved |
| POST | `/derivatives/:id/reject` | Mark rejected |
| POST | `/derivatives/:id/regenerate` | Regenerate with optional guidance |
| POST | `/projects/:id/complete-review` | Trigger memory synthesis |

---

## 14. Key Prompts (Domain IP)

### Moment Extraction Prompt (Skeleton)

```
You are a content analyst identifying the strongest standalone moments from a creator's long-form content.

## Creator Context (from memory)
{memory_reflection}

## Transcript
{transcript_segments}

## Scoring Criteria
For each potential moment, evaluate:
- Standalone clarity: makes sense without surrounding context
- Emotional intensity: conviction, humor, vulnerability, passion
- Shareability: someone would clip this and send to a friend
- Platform fit: works as 30-60 second standalone piece
- Novelty: unique insight vs common wisdom
- Retention gravity: creates curiosity that keeps people watching

Return 3-5 moments as JSON. Include start/end timestamps, transcript snippet, strength score, and rationale.
```

### Generation Prompt Pattern (Skeleton)

```
You are generating {content_type} for a creator's {platform} audience.

## Creator Context (learned over time)
{memory_reflection}

## Source Moment
Timestamp: {start}s - {end}s
"{transcript_snippet}"
Selection rationale: {rationale}

## Guidelines
- Adapt to this creator's voice and style
- {platform_specific_guidelines}
- Keep it natural — don't over-template

Generate {count} variations. Return as JSON array.
```

### Synthesis Prompt (After Review)

```
Analyze this creator's editing behavior from their review session:

## Editing Events
{editing_events_summary}

## Extract Observations
What patterns do you see? Focus on:
- How they modified language (shortened? softened? made punchier?)
- What they rejected vs approved (hook styles? platforms? lengths?)
- Any explicit notes they left

Return 2-4 concise observations about this creator's preferences.
Each observation should be a single sentence that can inform future generation.
```

---

## 15. What Makes This Win vs Pure ClipCraft

| Dimension | ClipCraft | ContentOS (Hackathon MVP) |
|---|---|---|
| Output | Video clips (MP4s) | Creative text: hooks, tweets, framings |
| Intelligence | Scores clips better over time | Generates in creator's VOICE over time |
| Platforms | Just clips | Short-form video + Twitter (two creative lanes) |
| Learning signal | Keep/reject binary | Rich editing behavior (how they change text) |
| Memory sophistication | Flat feedback storage | Synthesized observations about style/preferences |
| Architecture | Single Python script + Streamlit | Domain-driven FastAPI + Next.js workspace |
| UX | Tool UI | Creator workspace (editorial, not operational) |
| Sponsor visibility | Same (Intelligence Panel + Cost Panel) | Same but richer (more generation = more routing decisions) |

---

## 16. Risk Mitigation

| Risk | Mitigation |
|---|---|
| YouTube ingestion fails live | Have 2 pre-tested URLs. Also: paste transcript fallback endpoint. |
| Pipeline too slow (>3 min) | Parallelize generation per-moment. Use fast models. Show progressive milestones so judges don't see a blank screen. |
| Memory doesn't visibly improve outputs | Demo seed script ensures second video has memory to work with. Test the specific improvement beforehand. |
| Hindsight API down | Graceful degradation: generate without memory, show "No memory available" in panel. |
| cascadeflow routing all to expensive model | Verify routing works beforehand. Worst case: cost panel shows 100% expensive but still shows the cost tracking feature works. |
| Frontend looks unfinished | shadcn/ui gives polished components out of the box. Focus on the happy path, not edge cases. |

---

## 17. Demo Preparation Checklist

- [ ] Run pipeline on 2 real YouTube videos (different creators/topics)
- [ ] Verify memory is written and read correctly (check Hindsight dashboard)
- [ ] Verify cascadeflow routing shows meaningful drafter/verifier split
- [ ] Run demo seed script OR use real feedback from test videos
- [ ] Time the full flow: URL → ready_for_review should be <3 minutes
- [ ] Confirm Intelligence Panel shows clear before/after on second video
- [ ] Confirm Cost Panel shows real numbers
- [ ] Have pre-computed backup results if live demo fails
- [ ] Practice the 90-second narration

---

## 18. Total Estimated Build Time

| Phase | Hours | Cumulative |
|---|---|---|
| Skeleton | 3-4h | 4h |
| Pipeline Core | 6-8h | 12h |
| Workspace UI | 4-6h | 18h |
| Memory Loop | 4-6h | 24h |
| Intelligence Visibility | 3-4h | 28h |
| Polish + Demo Prep | 2-3h | 31h |

**First end-to-end demo possible:** After Phase 3 (~18h) with mocked memory.
**Full memory demo:** After Phase 4 (~24h).
**Polished hackathon demo:** After Phase 6 (~31h).

Aggressive but achievable in a hackathon weekend with focused execution.
