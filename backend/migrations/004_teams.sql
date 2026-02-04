-- Migration: 004_teams.sql
-- Description: Add teams functionality for multi-tenant task management

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
    team_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    admin_id UUID REFERENCES users(user_id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Add team_id to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(team_id);

-- Update role constraint to include 'member'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'admin', 'member'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_teams_admin ON teams(admin_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_team ON users(team_id) WHERE deleted_at IS NULL;

-- Create a default team for existing data migration
DO $$
DECLARE
    default_team_id UUID;
    first_admin_id UUID;
BEGIN
    -- Find first admin user (if any)
    SELECT user_id INTO first_admin_id FROM users WHERE role = 'admin' LIMIT 1;

    -- Create default team if there are existing users
    IF EXISTS (SELECT 1 FROM users WHERE team_id IS NULL AND role != 'super_admin') THEN
        INSERT INTO teams (name, description, admin_id)
        VALUES ('Default Team', 'Auto-created team for existing users', first_admin_id)
        RETURNING team_id INTO default_team_id;

        -- Assign existing non-super_admin users to default team
        UPDATE users SET team_id = default_team_id WHERE team_id IS NULL AND role != 'super_admin';

        -- Update admin of default team if we found one
        IF first_admin_id IS NOT NULL THEN
            UPDATE teams SET admin_id = first_admin_id WHERE team_id = default_team_id;
        END IF;
    END IF;
END $$;
