-- Migration: 008_projects.sql
-- Description: Add projects feature. Projects can have many teams (many-to-many),
-- tasks optionally belong to a project, users have a sticky "active project".

-- =====================================================
-- 1. projects table
-- =====================================================
CREATE TABLE IF NOT EXISTS projects (
    project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_english VARCHAR(200) NOT NULL,
    name_marathi VARCHAR(200),
    description TEXT,
    location VARCHAR(300),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    budget NUMERIC(14, 2),
    project_manager_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    contact_person_name VARCHAR(200),
    contact_person_phone VARCHAR(20),
    contact_person_email VARCHAR(200),
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT projects_status_check CHECK (status IN ('active', 'on_hold', 'completed', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(project_manager_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

COMMENT ON TABLE projects IS 'Top-level projects. Each project can have multiple teams assigned (project_teams). Tasks may optionally belong to a project.';
COMMENT ON COLUMN projects.status IS 'active | on_hold | completed | archived';
COMMENT ON COLUMN projects.project_manager_id IS 'User who manages the project (informational; no extra permissions).';

-- =====================================================
-- 2. project_teams junction (many-to-many)
-- =====================================================
CREATE TABLE IF NOT EXISTS project_teams (
    project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    PRIMARY KEY (project_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_project_teams_team ON project_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_project_teams_project ON project_teams(project_id);

COMMENT ON TABLE project_teams IS 'Many-to-many: a team can work on multiple projects, a project can have multiple teams.';

-- =====================================================
-- 3. task_registry.project_id (nullable)
-- =====================================================
ALTER TABLE task_registry
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(project_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_task_registry_project ON task_registry(project_id);

COMMENT ON COLUMN task_registry.project_id IS 'Optional project the task belongs to. NULL = standalone/unassigned task (existing tasks stay NULL).';

-- =====================================================
-- 4. users.active_project_id (sticky)
-- =====================================================
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS active_project_id UUID REFERENCES projects(project_id) ON DELETE SET NULL;

COMMENT ON COLUMN users.active_project_id IS 'User''s currently active (sticky) project. New tasks auto-tag to this when the user''s team is in 2+ projects.';

-- =====================================================
-- 5. updated_at trigger for projects
-- =====================================================
CREATE OR REPLACE FUNCTION set_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION set_projects_updated_at();
