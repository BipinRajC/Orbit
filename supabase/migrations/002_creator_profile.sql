-- Creator profile — one row per studio installation (id always = 'default')
-- Stores both the processed API fields AND the raw form state so the
-- Profile settings page can pre-populate every chip/field exactly.

CREATE TABLE IF NOT EXISTS creator_profiles (
    id               TEXT PRIMARY KEY DEFAULT 'default',
    -- Processed fields (sent to Hindsight / used by AI)
    creator_name     TEXT,
    niche            TEXT,
    platform         TEXT,
    all_platforms    JSONB  DEFAULT '[]',
    styles           JSONB  DEFAULT '[]',
    audience         TEXT,
    never_use        TEXT,
    hook_length      TEXT   DEFAULT 'medium',
    voice_inspirations TEXT,
    -- Raw form state (used to reconstruct the profile settings UI)
    form_data        JSONB  DEFAULT '{}',
    updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Ensure the updated_at column is refreshed on every update
CREATE OR REPLACE FUNCTION update_creator_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_creator_profiles_updated_at
    BEFORE UPDATE ON creator_profiles
    FOR EACH ROW EXECUTE PROCEDURE update_creator_profiles_updated_at();
