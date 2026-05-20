// All TypeScript types mirroring the backend Pydantic schemas

export type ProjectStatus = 'uploaded' | 'processing' | 'ready_for_review' | 'archived'
export type DerivativeStatus = 'draft' | 'approved' | 'rejected'
export type Platform = 'short_form_video' | 'twitter'
export type ContentType = 'hook' | 'caption' | 'tweet' | 'framing'

export interface ProcessingLogEntry {
  stage: string
  message: string
  timestamp: string
}

export interface CostLog {
  total_calls: number
  drafter_calls: number
  verifier_calls: number
  drafter_pct: number
  total_cost_usd: number
  estimated_savings_usd: number
}

export interface MemoryContext {
  recall_count: number
  recall_items: string[]
  reflection: string
  biases_applied: number
  available?: boolean
}

export interface Derivative {
  id: string
  moment_id: string
  project_id: string
  platform: Platform
  content_type: ContentType
  content: string
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

// Framing content (stored as JSON string in derivative.content)
export interface FramingContent {
  caption: string
  hook_concept: string
  visual_direction: string
}
