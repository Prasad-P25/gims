-- Migration: Add task assignment feature
-- Allows admins to assign tasks to specific team members

-- Add assigned_to column to task_registry
ALTER TABLE task_registry
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(user_id) ON DELETE SET NULL;

-- Create index for faster queries on assigned tasks
CREATE INDEX IF NOT EXISTS idx_task_registry_assigned_to ON task_registry(assigned_to);

-- Add comment for documentation
COMMENT ON COLUMN task_registry.assigned_to IS 'User ID of the member this task is assigned to. NULL means unassigned or self-assigned.';
