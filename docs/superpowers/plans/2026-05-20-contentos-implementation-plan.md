# ContentOS — Implementation Plan

**Date:** 2026-05-20
**Optimized for:** Execution velocity, early magic moment, minimal cognitive overhead

---

## 1. Implementation Phases & Build Order

### Phase 1: Foundation (Day 1-2)

**Goal:** Both apps running, talking to each other, auth working.

- Initialize Next.js app (App Router, Tailwind, shadcn/ui)
- Initialize FastAPI app (Python 3.12, async, pydantic v2)
- Set up Supabase project (database, auth, realtime enabled)
- Run SQL migrations for all MVP tables
- Supabase Auth on frontend (email/password or magic link)
- FastAPI JWT verification middleware
- Basic CORS + environment config
- Monorepo or two-repo structure (recommend two repos: `contentos-web`, `contentos-api`)
- Deploy skeleton: Vercel (frontend) + Railway (backend)
- Verify: frontend can auth → call backend → get 200

**Checkpoint:** Auth works end-to-end. Creator can sign up, sign in, hit an authenticated endpoint.

---

### Phase 2: Upload + Transcription Pipeline (Day 3-5)

**Goal:** Creator can paste a YouTube URL and see a transcript appear.

- `POST /projects` endpoint — accepts YouTube URL, file upload, or pasted transcript
- YouTube ingestion: use `yt-dlp` to extract audio or fetch auto-generated transcript
- If audio: send to Deepgram, receive timestamped transcript with diarization
- If transcript provided: skip transcription, normalize format
- Store project in `content_projects`, source in `source_materials`
- Project status transitions: `uploaded → processing`
- Background worker: process transcription async (use FastAPI BackgroundTasks or a simple task queue)
- Frontend: upload page (one input surface — URL/file/paste)
- Frontend: project list showing status

**Checkpoint:** Paste YouTube URL → project appears as "processing" → transcript shows up in DB. Frontend shows project with status.

---

### Phase 3: Moment Extraction (Day 6-8)

**Goal:** System identifies 3-5 strongest moments from transcript.

- Moment extraction service: takes full transcript, returns ranked moments
- Prompt engineering: encode the 6 scoring dimensions (standalone clarity, emotional intensity, shareability, platform fit, novelty, retention gravity)
- Use cascadeflow to route to appropriate model (likely GPT-4 or Claude for quality here)
- Output: moment objects with start/end timestamps, transcript snippet, strength score, rationale
- Store moments in DB, link to project
- Project status: remains `processing` until generation completes
- Emit progress event: "Found N strong moments"
- Frontend: show moments appearing on project page (even before drafts exist)

**Checkpoint:** Upload → transcription → 3-5 moments extracted and visible in UI with timestamps and rationale.

---

### Phase 4: Content Generation (Day 9-12)

**Goal:** Each moment gets platform-native drafts. This is the magic moment.

- Generation service: takes moment + creator memory (empty initially) + creative direction → produces derivatives
- Per moment, generate:
  - 2-3 hook variations
  - 1 short-form video framing/caption
  - 1-2 tweets
- Prompt construction module: assembles context (moment transcript + memory + direction + platform guidelines)
- Use cascadeflow: fast model (Groq/Fireworks) for hooks/tweets, stronger model for framing
- Store derivatives in DB with `status: 'draft'`
- Run generation per-moment in parallel (asyncio.gather or concurrent tasks)
- Emit progress: "Drafts ready for Moment #1", "Drafts ready for Moment #2"...
- When all moments have drafts → project status: `ready_for_review`
- Frontend: moment-group component showing source clip + all derivatives grouped

**Checkpoint:** Full vertical slice working. Paste URL → transcription → moments → drafts appear grouped by moment. Creator can see everything.

---

### Phase 5: Review & Edit UX (Day 13-16)

**Goal:** Creator can review, edit, approve/reject, and regenerate drafts.

- `PATCH /derivatives/:id` — save inline edits
- `POST /derivatives/:id/approve` — mark approved
- `POST /derivatives/:id/reject` — mark rejected
- `POST /derivatives/:id/regenerate` — regenerate with optional guidance text
- Capture editing events: store before/after content, event type, platform, content_type
- Frontend: draft-editor component with inline editing
- Frontend: approve/reject/regenerate buttons per draft
- Frontend: visual distinction between draft/approved/rejected states
- Frontend: regeneration dialog (optional guidance input)
- Editing events written to `editing_events` table on every meaningful action

**Checkpoint:** Creator can edit drafts inline, approve them, reject them, request regeneration with guidance. All editing behavior captured in DB.

---

### Phase 6: Memory Synthesis (Day 17-19)

**Goal:** System learns from creator behavior and improves next generation.

- After project review is "complete" (all derivatives approved/rejected), trigger memory synthesis
- Synthesis service:
  - Analyze editing events for this project
  - Extract style observations (what was softened, shortened, rejected, accepted)
  - Analyze source transcript for creator communication patterns
  - Write observations to Hindsight (namespaced by creator)
- Prompt construction now queries Hindsight before generating:
  - Pull existing memory for this creator
  - Inject as soft context into generation prompts
- Creative direction endpoint: `POST /directions`, `GET /directions`
- Frontend: direction page (simple text input + list of active directions)
- Generation prompts now include active creative directions

**Checkpoint:** Second upload produces noticeably better outputs if creator edited heavily on first upload. Memory is being read and written.

---

### Phase 7: Progressive Drip + Real-Time (Day 20-22)

**Goal:** Creator sees live progress instead of waiting for batch completion.

- WebSocket endpoint: `GET /projects/:id/progress`
- Backend emits milestone events during processing:
  - `transcription_complete`
  - `moments_extracted` (with count)
  - `moment_drafts_ready` (per moment)
  - `project_ready`
- Frontend: progress-stream component showing live milestones
- Supabase Realtime as alternative: subscribe to `content_projects` and `moments` table changes
- Graceful degradation: if creator opens project after processing, just show final state

**Checkpoint:** Creator pastes URL, stays on page, sees milestones appearing in real-time. Feels alive.

---

### Phase 8: Onboarding + Polish (Day 23-25)

**Goal:** Cold start handled. UX polished. Demo-ready.

- Onboarding flow: 3 questions (platforms, tone, inspiration)
- Store responses in `creators` table
- Seed initial Hindsight memory from onboarding answers
- First generation uses onboarding context in prompts
- UI polish: loading states, error handling, empty states
- Project archival flow
- Mobile responsiveness (basic)
- Error recovery for failed processing stages

**Checkpoint:** New user can sign up, onboard in 30 seconds, paste first URL, and get creator-aware drafts. Full flow works cleanly.

---

## 2. Backend Implementation Plan

### Key Services

| Service | Responsibility |
|---------|----------------|
| `ProjectService` | Create project, manage lifecycle state machine, coordinate pipeline |
| `IngestionService` | YouTube URL resolution, file handling, format normalization |
| `TranscriptionService` | Deepgram integration, transcript normalization |
| `MomentExtractionService` | LLM-based moment scoring and selection |
| `GenerationService` | Prompt construction + cascadeflow execution for derivatives |
| `MemoryService` | Read/write Hindsight, synthesis logic, prompt context assembly |
| `EditingService` | Capture editing events, derive signals |

### Async Workflow Sequencing

```
API receives POST /projects
    → ProjectService creates project (status: uploaded)
    → Dispatches background task: process_project(project_id)

Background task: process_project
    → IngestionService.normalize(project) → transcript
    → TranscriptionService.transcribe(audio) if needed
    → Update status: processing
    → Emit: transcription_complete
    → MomentExtractionService.extract(transcript, creator_memory)
    → Store moments
    → Emit: moments_extracted
    → For each moment (parallel):
        → GenerationService.generate_derivatives(moment, creator_memory, directions)
        → Store derivatives
        → Emit: moment_drafts_ready
    → MemoryService.synthesize_content_observations(transcript, creator_id)
    → Update status: ready_for_review
    → Emit: project_ready
```

### Worker Strategy

For MVP: use FastAPI `BackgroundTasks` for the pipeline. It's simple, runs in-process, and Railway handles the process staying alive.

If latency becomes an issue: migrate to a proper task queue (e.g., `arq` with Redis, or Celery). But don't start there.

### Integration Points

| External System | Where It's Called |
|-----------------|-------------------|
| Deepgram | `TranscriptionService` — send audio, receive transcript |
| cascadeflow | `MomentExtractionService` and `GenerationService` — all LLM calls go through it |
| Hindsight | `MemoryService` — read before generation, write after synthesis |
| Supabase | All services — via repository layer for DB operations |
| Langfuse | Wrapped around all cascadeflow calls — trace every LLM interaction |

---

## 3. Frontend Implementation Plan

### Critical Pages (MVP)

| Page | Priority | Notes |
|------|----------|-------|
| Upload | P0 | Single input: URL field + file drop + paste area |
| Project List | P0 | Cards showing status, title, moment count |
| Project View | P0 | Source → moments → derivatives. The core experience. |
| Onboarding | P1 | 3-question flow, only shown once |
| Creative Direction | P2 | Simple text input + active notes list |

### Critical Components

| Component | What It Does |
|-----------|--------------|
| `MomentGroup` | Shows one moment (timestamp, snippet, rationale) + all its derivatives |
| `DraftEditor` | Inline editable text area. Save/approve/reject/regenerate buttons. |
| `ProgressStream` | Real-time milestone indicators during processing |
| `ProjectCard` | Status badge + title + moment count + last updated |
| `PlatformPreview` | Shows how content will look on Twitter vs short-form (simple formatting) |

### What Can Be Mocked Initially

- Platform preview (just show the text, don't simulate actual platform look)
- Progressive drip (start with polling, add WebSocket later)
- Onboarding (hardcode default memory seed, add onboarding UI in Phase 8)

### What Must Actually Work

- Upload flow (URL input → project created)
- Project status updates (see it move through states)
- Moment display (see extracted moments with timestamps)
- Draft editing (edit text inline, save it)
- Approve/reject/regenerate actions

---

## 4. Data Flow Walkthrough

```
1. UPLOAD
   Creator pastes YouTube URL in frontend
   → Frontend: POST /projects { source_type: "youtube_url", url: "..." }
   → Backend: creates content_project (status: uploaded), dispatches background task
   → Frontend: receives project_id, navigates to project page

2. TRANSCRIPTION
   Background task:
   → yt-dlp extracts audio (or fetches existing transcript)
   → Deepgram transcribes audio → timestamped JSON
   → Stored in source_materials.transcript
   → Emit: { event: "transcription_complete" }

3. MOMENT EXTRACTION
   → MemoryService reads creator memory from Hindsight (empty on first run)
   → MomentExtractionService sends transcript + scoring criteria to LLM (via cascadeflow)
   → LLM returns 3-5 moments with timestamps, scores, rationale
   → Stored in moments table
   → Emit: { event: "moments_extracted", count: 4 }

4. GENERATION
   Per moment (parallel):
   → GenerationService constructs prompt:
     [moment transcript] + [creator memory context] + [creative directions] + [platform guidelines]
   → cascadeflow routes to appropriate model per output type
   → Returns: hooks, short-form caption, tweets
   → Stored in derivatives table (status: draft)
   → Emit per moment: { event: "moment_drafts_ready", moment_id: "..." }
   → When all done: project status → ready_for_review

5. REVIEW/EDIT
   Creator opens project:
   → Frontend: GET /projects/:id (returns moments + derivatives)
   → Creator edits a tweet inline
   → Frontend: PATCH /derivatives/:id { content: "new text" }
   → Backend: saves new content, records editing_event (before/after)
   → Creator approves
   → Frontend: POST /derivatives/:id/approve
   → Backend: updates status, records editing_event (type: approve)

6. MEMORY UPDATE
   After review session (or triggered when creator archives project):
   → MemoryService.synthesize_editing_observations(project_id)
   → Analyzes all editing_events: what was softened, shortened, rejected
   → Writes observations to Hindsight:
     { facet: "editing_behavior", observation: "consistently shortens tweets to <200 chars" }
     { facet: "communication_style", observation: "prefers conversational over authoritative" }
   → Next generation will query these and include in prompt context
```

---

## 5. API Planning

### Endpoints

| Method | Path | Purpose | Request | Response |
|--------|------|---------|---------|----------|
| POST | `/projects` | Create new project | `{ source_type, url?, file?, transcript? }` | `{ id, status }` |
| GET | `/projects` | List creator's projects | Query: `?status=ready_for_review` | `[{ id, title, status, moment_count, created_at }]` |
| GET | `/projects/:id` | Full project detail | — | `{ project, source, moments: [{ moment, derivatives: [...] }] }` |
| PATCH | `/derivatives/:id` | Edit draft content | `{ content }` | `{ id, content, updated_at }` |
| POST | `/derivatives/:id/approve` | Approve | — | `{ id, status: "approved" }` |
| POST | `/derivatives/:id/reject` | Reject | — | `{ id, status: "rejected" }` |
| POST | `/derivatives/:id/regenerate` | Regenerate | `{ guidance? }` | `{ id, content, status: "draft" }` |
| POST | `/directions` | Add creative direction | `{ content }` | `{ id, content, is_active }` |
| GET | `/directions` | List active directions | — | `[{ id, content, created_at }]` |
| DELETE | `/directions/:id` | Deactivate direction | — | `204` |
| POST | `/projects/:id/archive` | Archive project | — | `{ id, status: "archived" }` |
| WS | `/projects/:id/progress` | Real-time updates | — | Stream of `{ event, data, timestamp }` |

### Auth

All endpoints require `Authorization: Bearer <supabase_jwt>`. Middleware extracts `creator_id` from JWT claims. All queries scoped to that creator.

---

## 6. Queue/Event Architecture

### Approach: Simple, Domain-Specific, In-Process

For MVP, avoid external message queues. Use:

- **FastAPI BackgroundTasks** for pipeline processing (in-process async)
- **In-memory event emitter** for progress events (published to WebSocket subscribers)
- **Supabase Realtime** as backup channel for frontend updates (subscribe to row changes)

### Event Types (Internal)

```python
# Progress events (sent to frontend via WebSocket)
"transcription_complete"     → { project_id }
"moments_extracted"          → { project_id, count }
"moment_drafts_ready"        → { project_id, moment_id }
"project_ready"              → { project_id }
"generation_failed"          → { project_id, error }

# Domain events (internal, trigger side effects)
"project_created"            → starts pipeline
"project_review_complete"    → triggers memory synthesis
"editing_event_recorded"     → (batched for later synthesis)
```

### When to Graduate to a Real Queue

Move to `arq` + Redis (or similar) when:
- Processing takes >30 seconds and Railway kills long-running background tasks
- You need retry logic for failed stages
- You need to scale workers independently

Don't pre-build this. Start simple.

---

## 7. Memory Implementation Strategy

### How Observations Are Captured

Two sources:

1. **Content-based** (during processing): After transcription, run a lightweight LLM call to extract communication style signals from the transcript itself ("this creator uses short sentences, speaks conversationally, uses metaphors about building").

2. **Edit-based** (after review): When project is archived or all derivatives reviewed, analyze editing_events. LLM summarizes: "Creator consistently shortened tweets. Softened 3/5 hooks. Rejected all thread suggestions."

### How Synthesis Runs (MVP)

Simple per-project synthesis:
```
After review complete:
  → Gather all editing_events for this project
  → Gather content observations from processing
  → LLM call: "Given these signals, what should we remember about this creator?"
  → Write observations to Hindsight (tagged by facet)
```

No pattern promotion or conviction logic in MVP. Just accumulate observations. The prompt construction step will use ALL available observations as context — more observations = better generation over time.

### How Memory Is Retrieved

Before any generation call:
```
→ Query Hindsight for this creator_id
→ Retrieve all observations/memory across all facets
→ Include as context block in generation prompt
```

Keep it simple: one query, get everything, include it all. Optimize retrieval later when memory grows large.

### How Memory Biases Prompts

Memory is injected as a "creator context" section in the prompt:

```
## Creator Context (learned over time)
- Communication style: conversational, short sentences, metaphor-heavy
- Hook preferences: prefers contrarian openers, dislikes aggressive clickbait
- Editing patterns: consistently shortens tweets, softens confrontational language
- Active direction: "More educational content this month"

## Task
Generate a tweet based on this moment: [moment transcript]
Adapt to this creator's style. Keep it natural.
```

### How Creator Evolution Works

Each new project adds more observations → prompt context becomes richer → outputs become more personalized. That's the MVP mechanism. Simple accumulation.

V2 adds: pattern promotion, conviction formation, decay, and more sophisticated retrieval.

---

## 8. AI Execution Strategy

### Model Routing (via cascadeflow)

| Task | Model Preference | Reasoning |
|------|-----------------|-----------|
| Moment extraction | GPT-4 or Claude | Requires deep understanding, judgment, nuance |
| Hook generation | Groq (Llama) or Fireworks | Fast, creative, low-stakes per individual hook |
| Tweet generation | Groq or GPT-4-mini | Short output, needs punchy quality |
| Short-form framing | GPT-4 or Claude | Longer, needs narrative structure |
| Style observation synthesis | GPT-4-mini | Analytical, not creative |
| Memory-based prompt context assembly | None (deterministic) | Just string construction from stored memory |

### Cost Strategy

- **Expensive models** for judgment tasks (moment extraction, complex framing)
- **Cheap/fast models** for volume tasks (hooks, tweets, observations)
- cascadeflow handles routing — backend just says "generate_hook" and cascadeflow picks the model

### Retries/Fallbacks

cascadeflow handles:
- If Groq is down → fall back to Fireworks or GPT-4-mini
- If rate limited → retry with backoff
- If response is garbage → retry once, then return best available

Backend handles:
- If entire generation for a moment fails → mark that moment's derivatives as failed, continue with others
- If transcription fails → mark project as failed with error message
- Never block the entire pipeline on one failure

### Prompt Construction Responsibilities

**Backend (domain core) owns:**
- Assembling creator memory context
- Including creative direction notes
- Formatting the moment transcript appropriately
- Specifying platform-specific output guidelines
- Defining output structure (JSON schema for derivatives)

**cascadeflow owns:**
- Picking which model to send it to
- Managing tokens/costs
- Retry logic
- Response parsing

---

## 9. MVP Simplifications

### Intentionally Skipped

| What | Why |
|------|-----|
| Video/audio clip rendering | Complexity explosion. Timestamps are sufficient. |
| Publishing to social platforms | API integrations are a product in themselves |
| Scheduling/calendar | SaaS territory. Creators can copy-paste for now. |
| Analytics/performance tracking | Against philosophy. Not needed for magic moment. |
| Platform-specific formatting preview | Nice-to-have, not core |

### Intentionally Mocked/Simplified

| What | MVP Version | Full Version |
|------|-------------|--------------|
| Memory retrieval | Fetch all, include all | Faceted retrieval, relevance scoring |
| Pattern/conviction tiers | Just observations (flat) | Three-tier with promotion/decay |
| Progressive drip | Polling + Supabase Realtime | WebSocket with streaming |
| YouTube ingestion | yt-dlp, may break on some URLs | Robust multi-source ingestion |
| Onboarding → memory | Direct text inclusion in prompts | Proper Hindsight structured storage |
| Error recovery | Show error, allow retry | Automatic retry, partial recovery |

### Deferred to V2

- Periodic memory reflection
- Conviction decay dynamics
- Backlog import (Firecrawl)
- Creator fine-tuning (Unsloth)
- Notes/ideation workflow
- Multi-platform publishing
- Team/org features

---

## 10. Risks & Bottlenecks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **YouTube ingestion breaks** (yt-dlp fragile) | High | Accept "paste transcript" as fallback. Consider YouTube Data API for captions. Test with diverse URLs early. |
| **Generation latency** (5+ LLM calls per moment × 4 moments) | High | Parallelize aggressively. Use fast models for hooks/tweets. Show progressive results. |
| **Prompt bloat** (memory context grows unbounded) | Medium | For MVP: cap memory context at ~1000 tokens. Trim oldest observations when exceeding. |
| **Deepgram costs** (long audio files) | Medium | Set max duration (e.g., 2 hours). Warn on large files. |
| **Editing event explosion** (every keystroke?) | Medium | Debounce edits on frontend. Only capture on save/blur, not per-keystroke. |
| **Memory drift** (observations contradict each other) | Low (MVP) | MVP just accumulates. V2 handles contradictions via conviction decay. |
| **WebSocket complexity** | Medium | Start with Supabase Realtime (subscription to row changes). Add WebSocket only if needed. |
| **Railway background task limits** | Medium | If tasks exceed Railway's timeout, move to worker process. Monitor early. |
| **cascadeflow/Hindsight reliability** | Medium | Build with graceful degradation: if memory fails, generate without it. If cascadeflow fails, fall back to direct OpenAI call. |

---

## 11. Demo Strategy

### What MUST Work (Non-Negotiable)

1. Paste a YouTube URL
2. See progress indicators (transcribing... extracting... generating...)
3. See 3-5 moments appear with timestamps and rationale
4. See hooks + tweets + short-form captions per moment
5. Edit a draft inline
6. Approve/reject drafts
7. Second upload shows slightly better outputs (memory working)

### What Can Be Partially Mocked

- Onboarding (can hardcode initial memory seed for demo)
- Creative direction (can be a simple text field that stores but doesn't deeply affect generation yet)
- Platform preview (just show text, no platform simulation)
- Real-time progress (polling every 2s is fine for demo)

### The Strongest "Magic Moment" for Demo

```
Creator pastes their own YouTube video URL
→ waits ~2 minutes
→ sees their actual content broken into moments
→ reads a generated tweet and thinks: "that actually sounds like me"
→ edits one slightly
→ pastes second video URL a day later
→ notices outputs adapted to their corrections
```

That sequence — especially the "sounds like me" reaction — is the entire product thesis proven.

---

## 12. Phase Checkpoints

### After Phase 1 (Foundation)
- **Works:** Sign up, sign in, hit authenticated endpoint
- **Visible:** Login page, empty project list
- **Mocked:** Everything else
- **Risk check:** Auth flow verified, Supabase connected, Railway deployed

### After Phase 2 (Upload + Transcription)
- **Works:** Paste URL → project created → transcript stored
- **Visible:** Upload page, project list with status, raw transcript viewable
- **Mocked:** Moments, derivatives, memory
- **Risk check:** YouTube ingestion working, Deepgram integration verified

### After Phase 3 (Moment Extraction)
- **Works:** Transcript → 3-5 moments with timestamps and rationale
- **Visible:** Moments displayed on project page
- **Mocked:** Derivatives, memory, real-time progress
- **Risk check:** LLM quality for extraction, cascadeflow routing working

### After Phase 4 (Generation) — THE MILESTONE
- **Works:** Full pipeline end-to-end. URL → moments → drafts.
- **Visible:** Complete project view with all derivatives grouped by moment
- **Mocked:** Memory, editing behavior capture, real-time, onboarding
- **Risk check:** Generation quality, latency acceptable (<3 min total), cost per project reasonable
- **This is the first "magic moment" demo point.**

### After Phase 5 (Review & Edit)
- **Works:** Creator can review, edit, approve, reject, regenerate
- **Visible:** Full editorial experience
- **Mocked:** Memory synthesis, real-time drip
- **Risk check:** Editing events captured correctly, UX feels editorial not operational

### After Phase 6 (Memory)
- **Works:** Editing behavior → memory observations → better next generation
- **Visible:** Second project outputs are noticeably adapted
- **Mocked:** Advanced memory (patterns/convictions), real-time
- **Risk check:** Memory actually improves outputs, doesn't cause drift or caricature

### After Phase 7 (Real-Time)
- **Works:** Live progress updates during processing
- **Visible:** Milestones appearing as system works
- **Mocked:** Nothing critical — system is functionally complete
- **Risk check:** WebSocket/Realtime reliability, graceful degradation if creator leaves

### After Phase 8 (Polish)
- **Works:** Full MVP flow including onboarding
- **Visible:** Polished, demo-ready product
- **Mocked:** Nothing — this is launch-ready MVP
- **Success:** A creator can go from zero to "my week is lighter" in one session

---

## 13. Estimated Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Foundation | 2 days | Day 2 |
| Upload + Transcription | 3 days | Day 5 |
| Moment Extraction | 3 days | Day 8 |
| Generation | 4 days | Day 12 |
| Review & Edit | 4 days | Day 16 |
| Memory | 3 days | Day 19 |
| Real-Time | 3 days | Day 22 |
| Polish | 3 days | Day 25 |

**First magic moment demo:** Day 12 (Phase 4 complete).
**Full MVP:** Day 25.

These assume focused, full-day development. Adjust as needed.

---

## 14. Key Technical Decisions (Locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Task queue | In-process BackgroundTasks | Simple, sufficient for MVP, avoids Redis/Celery setup |
| Real-time | Supabase Realtime first, WebSocket if needed | Free with Supabase, works with row changes |
| YouTube ingestion | yt-dlp | Most reliable for transcript/audio extraction |
| File storage | Supabase Storage | Integrated with auth, simple SDK |
| Memory retrieval | Fetch all, include all | Keeps MVP simple, optimize later |
| Prompt templates | Jinja2 or f-strings in Python | No prompt framework needed, just string construction |
| Frontend state | React Query (TanStack Query) | Handles API caching, refetching, optimistic updates |
| Deployment | Vercel + Railway | Zero-ops, fast deploys, sufficient for MVP scale |
