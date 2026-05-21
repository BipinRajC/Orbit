-- =====================================================================
-- OrbitOS — consolidated schema
-- Run this ONCE in Supabase SQL Editor on a fresh project.
-- Fully idempotent: safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Shared trigger function: bump updated_at on UPDATE
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- content_projects
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_projects (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status            TEXT CHECK (status IN ('uploaded', 'processing', 'ready_for_review', 'archived'))
                          DEFAULT 'uploaded',
    source_url        TEXT NOT NULL,
    title             TEXT,
    transcript        JSONB,
    duration_seconds  INTEGER,
    processing_log    JSONB DEFAULT '[]',
    cost_log          JSONB DEFAULT '{}',
    memory_context    JSONB DEFAULT '{}',
    target_platforms  TEXT[] DEFAULT ARRAY['instagram_reels', 'youtube_shorts', 'tiktok', 'linkedin'],
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS update_content_projects_updated_at ON content_projects;
CREATE TRIGGER update_content_projects_updated_at
    BEFORE UPDATE ON content_projects
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ---------------------------------------------------------------------
-- moments
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS moments (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id           UUID REFERENCES content_projects(id) ON DELETE CASCADE,
    start_timestamp      FLOAT,
    end_timestamp        FLOAT,
    transcript_snippet   TEXT,
    strength_score       FLOAT,
    selection_rationale  TEXT,
    sort_order           INTEGER DEFAULT 0,
    segments             JSONB,
    clip_url             TEXT,
    narrative_summary    TEXT,
    hook_potential       TEXT,
    created_at           TIMESTAMPTZ DEFAULT now(),
    updated_at           TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS update_moments_updated_at ON moments;
CREATE TRIGGER update_moments_updated_at
    BEFORE UPDATE ON moments
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ---------------------------------------------------------------------
-- derivatives
-- NOTE: platform and content_type use unconstrained TEXT so that
-- new platforms (tiktok) and content types (short_form_deliverable)
-- can be added without migrations. Validation is enforced in the API.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS derivatives (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moment_id         UUID REFERENCES moments(id) ON DELETE CASCADE,
    project_id        UUID REFERENCES content_projects(id) ON DELETE CASCADE,
    platform          TEXT NOT NULL,
    content_type      TEXT NOT NULL DEFAULT 'short_form_deliverable',
    content           TEXT,
    status            TEXT CHECK (status IN ('draft', 'approved', 'rejected')) DEFAULT 'draft',
    generation_model  TEXT,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS update_derivatives_updated_at ON derivatives;
CREATE TRIGGER update_derivatives_updated_at
    BEFORE UPDATE ON derivatives
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ---------------------------------------------------------------------
-- editing_events  (the learning signal)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS editing_events (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    derivative_id          UUID REFERENCES derivatives(id) ON DELETE CASCADE,
    event_type             TEXT CHECK (event_type IN ('edit', 'approve', 'reject', 'regenerate')),
    before_content         TEXT,
    after_content          TEXT,
    regeneration_guidance  TEXT,
    platform               TEXT,
    content_type           TEXT,
    created_at             TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------
-- creator_profiles  (single-row table, id always = 'default')
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS creator_profiles (
    id                  TEXT PRIMARY KEY DEFAULT 'default',
    creator_name        TEXT,
    niche               TEXT,
    platform            TEXT,
    all_platforms       JSONB DEFAULT '[]',
    styles              JSONB DEFAULT '[]',
    audience            TEXT,
    never_use           TEXT,
    hook_length         TEXT  DEFAULT 'medium',
    voice_inspirations  TEXT,
    form_data           JSONB DEFAULT '{}',
    updated_at          TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_creator_profiles_updated_at ON creator_profiles;
CREATE TRIGGER trg_creator_profiles_updated_at
    BEFORE UPDATE ON creator_profiles
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_moments_project_id           ON moments(project_id);
CREATE INDEX IF NOT EXISTS idx_derivatives_moment_id        ON derivatives(moment_id);
CREATE INDEX IF NOT EXISTS idx_derivatives_project_id       ON derivatives(project_id);
CREATE INDEX IF NOT EXISTS idx_editing_events_derivative_id ON editing_events(derivative_id);
CREATE INDEX IF NOT EXISTS idx_projects_status              ON content_projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at          ON content_projects(created_at DESC);
