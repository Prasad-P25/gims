-- GIMS Task Registry System - Initial Schema
-- Migration: 001_initial_schema.sql
-- Description: 
tables for the GIMS application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255),
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'supervisor')),
    preferred_language VARCHAR(10) DEFAULT 'marathi' CHECK (preferred_language IN ('marathi', 'english', 'hindi')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE users IS 'User accounts for admin and supervisor roles';
COMMENT ON COLUMN users.role IS 'User role: admin has full access, supervisor has limited access';
COMMENT ON COLUMN users.preferred_language IS 'Language preference for WhatsApp communication';

-- ============================================
-- CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    category_id SERIAL PRIMARY KEY,
    name_english VARCHAR(100) NOT NULL,
    name_marathi VARCHAR(100) NOT NULL,
    description TEXT,
    field_template JSONB,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE categories IS 'Task categories with bilingual names (11 government work categories)';
COMMENT ON COLUMN categories.field_template IS 'JSON schema defining category-specific fields';
COMMENT ON COLUMN categories.display_order IS 'Order for displaying categories in UI';

-- ============================================
-- TASK REGISTRY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS task_registry (
    registry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id INT NOT NULL REFERENCES categories(category_id),
    registered_by UUID NOT NULL REFERENCES users(user_id),
    registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
    registration_time TIME NOT NULL DEFAULT CURRENT_TIME,
    task_data JSONB NOT NULL,
    input_mode VARCHAR(10) NOT NULL CHECK (input_mode IN ('voice', 'text')),
    input_language VARCHAR(20),
    original_input TEXT,
    transcription TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE task_registry IS 'Main task registry storing all government work records';
COMMENT ON COLUMN task_registry.task_data IS 'JSONB field storing category-specific task details';
COMMENT ON COLUMN task_registry.input_mode IS 'How the task was entered: voice or text message';
COMMENT ON COLUMN task_registry.original_input IS 'Original message content before processing';
COMMENT ON COLUMN task_registry.transcription IS 'Transcribed text from voice message';

-- ============================================
-- VOICE MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS voice_messages (
    voice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registry_id UUID REFERENCES task_registry(registry_id) ON DELETE CASCADE,
    audio_file_path VARCHAR(500) NOT NULL,
    duration_seconds INT,
    file_size_bytes INT,
    detected_language VARCHAR(20),
    transcription TEXT,
    confidence_score DECIMAL(3,2),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE voice_messages IS 'Voice message metadata and transcription results';
COMMENT ON COLUMN voice_messages.confidence_score IS 'AI transcription confidence score (0.00 to 1.00)';

-- ============================================
-- REMINDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reminders (
    reminder_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id),
    registry_id UUID REFERENCES task_registry(registry_id) ON DELETE CASCADE,
    reminder_type VARCHAR(20) NOT NULL CHECK (reminder_type IN ('morning', 'evening', 'overdue', 'custom')),
    scheduled_time TIMESTAMPTZ NOT NULL,
    message_template TEXT,
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE reminders IS 'Scheduled WhatsApp reminders for users';
COMMENT ON COLUMN reminders.reminder_type IS 'Type: morning/evening summary, overdue alert, or custom';

-- ============================================
-- AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'restore')),
    old_data JSONB,
    new_data JSONB,
    performed_by UUID REFERENCES users(user_id),
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT
);

COMMENT ON TABLE audit_log IS 'Audit trail for compliance and change tracking';

-- ============================================
-- WHATSAPP SESSIONS TABLE (for conversation state)
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(15) NOT NULL,
    user_id UUID REFERENCES users(user_id),
    current_state VARCHAR(50) DEFAULT 'idle',
    context_data JSONB DEFAULT '{}',
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE whatsapp_sessions IS 'Tracks WhatsApp conversation state for multi-step interactions';

-- ============================================
-- INDEXES
-- ============================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE deleted_at IS NULL;

-- Task registry indexes
CREATE INDEX IF NOT EXISTS idx_task_registry_date ON task_registry(registration_date);
CREATE INDEX IF NOT EXISTS idx_task_registry_category ON task_registry(category_id);
CREATE INDEX IF NOT EXISTS idx_task_registry_user ON task_registry(registered_by);
CREATE INDEX IF NOT EXISTS idx_task_registry_status ON task_registry(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_registry_priority ON task_registry(priority) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_registry_date_range ON task_registry(registration_date, category_id) WHERE deleted_at IS NULL;

-- JSONB index for task_data search
CREATE INDEX IF NOT EXISTS idx_task_registry_data ON task_registry USING GIN (task_data);

-- Reminders indexes
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON reminders(scheduled_time) WHERE is_sent = false;
CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_type ON reminders(reminder_type) WHERE is_sent = false;

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_performer ON audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_date ON audit_log(performed_at);

-- WhatsApp sessions indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone ON whatsapp_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_expires ON whatsapp_sessions(expires_at) WHERE current_state != 'idle';

-- ============================================
-- TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to tables
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_registry_updated_at
    BEFORE UPDATE ON task_registry
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to log audit trail
CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, record_id, action, new_data)
        VALUES (TG_TABLE_NAME, NEW.registry_id, 'create', to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_data, new_data)
        VALUES (TG_TABLE_NAME, NEW.registry_id, 'update', to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_data)
        VALUES (TG_TABLE_NAME, OLD.registry_id, 'delete', to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Apply audit trigger to task_registry
CREATE TRIGGER audit_task_registry
    AFTER INSERT OR UPDATE OR DELETE ON task_registry
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

-- ============================================
-- VIEWS
-- ============================================

-- View for active tasks with category names
CREATE OR REPLACE VIEW active_tasks_view AS
SELECT
    tr.registry_id,
    tr.registration_date,
    tr.registration_time,
    tr.task_data,
    tr.status,
    tr.priority,
    tr.input_mode,
    tr.created_at,
    c.name_english AS category_english,
    c.name_marathi AS category_marathi,
    u.name AS registered_by_name,
    u.phone AS registered_by_phone
FROM task_registry tr
JOIN categories c ON tr.category_id = c.category_id
JOIN users u ON tr.registered_by = u.user_id
WHERE tr.deleted_at IS NULL
ORDER BY tr.registration_date DESC, tr.registration_time DESC;

-- View for daily task summary
CREATE OR REPLACE VIEW daily_task_summary AS
SELECT
    registration_date,
    category_id,
    COUNT(*) AS total_tasks,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
    COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_count,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_count
FROM task_registry
WHERE deleted_at IS NULL
GROUP BY registration_date, category_id
ORDER BY registration_date DESC;

-- ============================================
-- GRANTS (adjust based on your database users)
-- ============================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gims_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gims_app;

COMMIT;
