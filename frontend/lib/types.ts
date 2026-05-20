// All TypeScript types mirroring the backend Pydantic schemas

export type ProjectStatus = 'uploaded' | 'processing' | 'ready_for_review' | 'archived'
export type DerivativeStatus = 'draft' | 'approved' | 'rejected'
export type Platform = 'instagram_reels' | 'youtube_shorts' | 'linkedin'
export type ContentType = 'production_brief'

export interface ProcessingLogEntry {
  stage: string
  message: string
  timestamp: string
}

export interface CostLog {
  total_cost_usd: number
  // Legacy cascadeflow fields
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

/** Structured production brief — stored as JSON string in derivative.content */
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
  higgsfield_prompt: string
  editing_notes: string
}

export interface Derivative {
  id: string
  moment_id: string
  project_id: string
  platform: Platform
  content_type: ContentType
  content: string  // JSON string of ProductionBrief
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

export interface ProjectListItem {
  id: string
  status: ProjectStatus
  source_url: string
  title: string | null
  created_at: string
  updated_at: string
  moment_count: number
}
