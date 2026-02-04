-- Migration: Add notifications table for in-app notifications
-- Supports both in-app and Telegram notifications

CREATE TABLE IF NOT EXISTS notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'task_assigned', 'status_changed', 'task_completed', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,

  -- Related entities
  registry_id UUID REFERENCES task_registry(registry_id) ON DELETE SET NULL,
  triggered_by UUID REFERENCES users(user_id) ON DELETE SET NULL,

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- Delivery tracking
  telegram_sent BOOLEAN DEFAULT FALSE,
  telegram_sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

COMMENT ON TABLE notifications IS 'Stores in-app and Telegram notifications for users';
