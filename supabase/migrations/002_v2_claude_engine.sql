-- Migration: v2 Claude short-form engine schema additions
-- Adds: target_platforms, clip_url, segments, narrative_summary, hook_potential

-- content_projects: store which platforms the creator selected
ALTER TABLE content_projects
  ADD COLUMN IF NOT EXISTS target_platforms text[]
    DEFAULT ARRAY['instagram_reels', 'youtube_shorts', 'linkedin'];

-- moments: multi-segment support and clip storage
ALTER TABLE moments
  ADD COLUMN IF NOT EXISTS segments       jsonb,
  ADD COLUMN IF NOT EXISTS clip_url       text,
  ADD COLUMN IF NOT EXISTS narrative_summary  text,
  ADD COLUMN IF NOT EXISTS hook_potential     text,
  ADD COLUMN IF NOT EXISTS updated_at     timestamptz DEFAULT now();

-- Backfill updated_at for existing rows
UPDATE moments SET updated_at = created_at WHERE updated_at IS NULL;
