-- ContentOS MVP schema
-- Run this in Supabase SQL Editor (or via supabase db push)

-- Projects
CREATE TABLE IF NOT EXISTS content_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT CHECK (status IN ('uploaded', 'processing', 'ready_for_review', 'archived')) DEFAULT 'uploaded',
    source_url TEXT NOT NULL,
    title TEXT,
    transcript JSONB,
    duration_seconds INTEGER,
    processing_log JSONB DEFAULT '[]',
    cost_log JSONB DEFAULT '{}',
    memory_context JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Moments extracted from projects
CREATE TABLE IF NOT EXISTS moments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES content_projects(id) ON DELETE CASCADE,
    start_timestamp FLOAT,
    end_timestamp FLOAT,
    transcript_snippet TEXT,
    strength_score FLOAT,
    selection_rationale TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Generated content derivatives
CREATE TABLE IF NOT EXISTS derivatives (
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

-- Editing behaviour signals (the learning source)
CREATE TABLE IF NOT EXISTS editing_events (
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

-- Auto-update updated_at on content_projects
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_content_projects_updated_at
    BEFORE UPDATE ON content_projects
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_derivatives_updated_at
    BEFORE UPDATE ON derivatives
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_moments_project_id ON moments(project_id);
CREATE INDEX IF NOT EXISTS idx_derivatives_moment_id ON derivatives(moment_id);
CREATE INDEX IF NOT EXISTS idx_derivatives_project_id ON derivatives(project_id);
CREATE INDEX IF NOT EXISTS idx_editing_events_derivative_id ON editing_events(derivative_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON content_projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON content_projects(created_at DESC);
