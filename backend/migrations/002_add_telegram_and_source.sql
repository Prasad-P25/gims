-- GIMS Task Registry System - Telegram Integration & Source Tracking
-- Migration: 002_add_telegram_and_source.sql
-- Description: Add telegram_id to users and input_source to task_registry

-- ============================================
-- DROP EXISTING VIEW FIRST
-- ============================================
DROP VIEW IF EXISTS active_tasks_view;

-- ============================================
-- ADD TELEGRAM ID TO USERS TABLE
-- ============================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE;

COMMENT ON COLUMN users.telegram_id IS 'Telegram user ID for bot integration';

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id) WHERE telegram_id IS NOT NULL;

-- ============================================
-- ADD INPUT SOURCE TO TASK REGISTRY TABLE
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'task_registry' AND column_name = 'input_source'
    ) THEN
        ALTER TABLE task_registry ADD COLUMN input_source VARCHAR(20) DEFAULT 'web';
        ALTER TABLE task_registry ADD CONSTRAINT chk_input_source CHECK (input_source IN ('web', 'telegram', 'whatsapp'));
    END IF;
END $$;

COMMENT ON COLUMN task_registry.input_source IS 'Source channel: web dashboard, telegram bot, or whatsapp bot';

-- Create index for filtering by source
CREATE INDEX IF NOT EXISTS idx_task_registry_source ON task_registry(input_source) WHERE deleted_at IS NULL;

-- ============================================
-- RECREATE VIEW WITH NEW COLUMNS
-- ============================================
CREATE OR REPLACE VIEW active_tasks_view AS
SELECT
    tr.registry_id,
    tr.registration_date,
    tr.registration_time,
    tr.task_data,
    tr.status,
    tr.priority,
    tr.input_mode,
    tr.input_source,
    tr.created_at,
    c.name_english AS category_english,
    c.name_marathi AS category_marathi,
    u.name AS registered_by_name,
    u.phone AS registered_by_phone,
    u.telegram_id AS registered_by_telegram
FROM task_registry tr
JOIN categories c ON tr.category_id = c.category_id
JOIN users u ON tr.registered_by = u.user_id
WHERE tr.deleted_at IS NULL
ORDER BY tr.registration_date DESC, tr.registration_time DESC;

COMMIT;
