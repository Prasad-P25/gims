-- Migration: 003_attachments.sql
-- Description: Add attachments table for file uploads on tasks

CREATE TABLE IF NOT EXISTS attachments (
    attachment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registry_id UUID NOT NULL REFERENCES task_registry(registry_id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size_bytes INT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(user_id),
    upload_source VARCHAR(20) DEFAULT 'web',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Index for fast lookup of attachments by task (excluding deleted)
CREATE INDEX IF NOT EXISTS idx_attachments_registry ON attachments(registry_id) WHERE deleted_at IS NULL;

-- Index for querying by uploader
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON attachments(uploaded_by) WHERE deleted_at IS NULL;
