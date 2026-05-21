// All TypeScript types mirroring the backend Pydantic schemas

export interface VideoIntent {
  topic: string
  goal: string
}

export interface CreatorProfile {
  niche: string
  platform: string
  styles: string[]
  audience: string
  never_use: string
  hook_length?: string
  all_platforms?: string[]
  voice_inspirations?: string
  creator_name?: string
  /** Raw form state stored in Supabase — mirrors localStorage creator_profile_data */
  form_data?: Record<string, unknown>
}

export type ProjectStatus = 'uploaded' | 'processing' | 'ready_for_review' | 'archived'
export type DerivativeStatus = 'draft' | 'approved' | 'rejected'
export type Platform = 'instagram_reels' | 'youtube_shorts' | 'tiktok' | 'linkedin'
export type ContentType = 'production_brief' | 'short_form_deliverable'

export interface ProcessingLogEntry {
  stage: string
  message: string
  timestamp: string
}

export interface CostLog {
  total_cost_usd: number
  total_calls?: number
  drafter_calls?: number
  verifier_calls?: number
  drafter_pct?: number
  estimated_savings_usd?: number
}

export interface MemoryContext {
  recall_count: number
  recall_items: string[]
  reflection: string
  biases_applied: number
  available?: boolean
}

export interface Segment {
  start: number
  end: number
  role: 'primary' | 'payoff' | 'bridge'
}

// ---------------------------------------------------------------------------
// Legacy ProductionBrief (kept for backward-compat with existing DB rows)
// ---------------------------------------------------------------------------

export interface ProductionScript {
  opening: string
  body: string
  closer: string
}

export interface ProductionBrief {
  hook: string
  angle: string
  script: ProductionScript
  cta: string
  caption?: string
  higgsfield_prompt: string
  editing_notes: string
}

// ---------------------------------------------------------------------------
// New ShortFormDeliverable — 7 unified fields, all platforms
// ---------------------------------------------------------------------------

export interface ShortFormDeliverable {
  title: string
  description: string
  caption: string
  spoken_script: string
  why_this_clip: string
  visual_direction: string
  editor_notes: string
}

export interface Derivative {
  id: string
  moment_id: string
  project_id: string
  platform: Platform
  content_type: ContentType  // both 'production_brief' and 'short_form_deliverable' supported
  content: string            // JSON-stringified ShortFormDeliverable or legacy ProductionBrief
  status: DerivativeStatus
  generation_model: string | null
  created_at: string
  updated_at: string
}

export interface Moment {
  id: string
  project_id: string
  start_timestamp: number
  end_timestamp: number
  transcript_snippet: string
  strength_score: number
  selection_rationale: string
  narrative_summary: string | null
  hook_potential: string | null
  segments: Segment[] | null
  clip_url: string | null
  sort_order: number
  created_at: string
  derivatives: Derivative[]
}

export interface Project {
  id: string
  status: ProjectStatus
  source_url: string
  title: string | null
  duration_seconds: number | null
  processing_log: ProcessingLogEntry[]
  cost_log: CostLog | Record<string, never>
  memory_context: MemoryContext | Record<string, never>
  target_platforms: Platform[]
  created_at: string
  updated_at: string
  moments: Moment[]
}

/**
 * Normalize any derivative (new or legacy) into a ShortFormDeliverable.
 * New rows (content_type='short_form_deliverable') are passed through directly.
 * Legacy rows (content_type='production_brief') are mapped from ProductionBrief shape.
 */
export function normalizeDeliverable(raw: Derivative): ShortFormDeliverable {
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(raw.content || '{}')
  } catch {
    // ignore
  }

  if (raw.content_type === 'short_form_deliverable') {
    return {
      title:           (parsed.title           as string) || '',
      description:     (parsed.description     as string) || '',
      caption:         (parsed.caption         as string) || '',
      spoken_script:   (parsed.spoken_script   as string) || '',
      why_this_clip:   (parsed.why_this_clip   as string) || '',
      visual_direction:(parsed.visual_direction as string) || '',
      editor_notes:    (parsed.editor_notes    as string) || '',
    }
  }

  // Legacy ProductionBrief mapping
  const script = parsed.script as Record<string, string> | null | undefined
  const scriptParts = [
    script?.opening || '',
    script?.body    || (parsed.body as string) || '',
    script?.closer  || '',
  ].filter(Boolean)

  return {
    title:           (parsed.hook            as string) || '',
    description:     (parsed.angle           as string) || '',
    caption:         (parsed.caption         as string) || '',
    spoken_script:   scriptParts.join('\n\n'),
    why_this_clip:   '',
    visual_direction:(parsed.higgsfield_prompt as string) || '',
    editor_notes:    (parsed.editing_notes   as string) || '',
  }
}

/** Legacy normalizeBrief — kept so existing components don't break */
export function normalizeBrief(raw: Record<string, unknown>): ProductionBrief {
  const script = raw.script as Record<string, string> | null | undefined
  return {
    hook:             (raw.hook             as string) ?? '',
    angle:            (raw.angle            as string) ?? '',
    script: {
      opening:        script?.opening                  ?? '',
      body:           script?.body ?? (raw.body        as string) ?? '',
      closer:         script?.closer                   ?? '',
    },
    cta:              (raw.cta              as string) ?? '',
    caption:          (raw.caption          as string) ?? undefined,
    higgsfield_prompt:(raw.higgsfield_prompt as string) ?? '',
    editing_notes:    (raw.editing_notes    as string) ?? '',
  }
}

export interface ProjectListItem {
  id: string
  status: ProjectStatus
  source_url: string
  title: string | null
  created_at: string
  updated_at: string
  moment_count: number
}

// ---------------------------------------------------------------------------
// Intelligence Graph
// ---------------------------------------------------------------------------

export type GraphNodeKind = 'root' | 'trait' | 'platform' | 'preference' | 'topic'

export interface GraphNode {
  id: string
  label: string
  full_text?: string
  kind: GraphNodeKind
  weight: number
  tags?: string[]
  mentioned_at?: string
}

export interface GraphEdge {
  source: string
  target: string
  kind: string
}

export interface IntelligenceGraph {
  project_id: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: {
    memories: number
    biases: number
    edits: number
  }
}
