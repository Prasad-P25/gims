-- Migration: 005_create_super_admin.sql
-- Description: Create super admin user and update role constraint

-- Update role constraint to include super_admin and member
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'admin', 'member', 'supervisor'));

-- Create super admin user
-- Phone: 9999999999
-- Password: admin123
INSERT INTO users (name, phone, email, password_hash, role, is_active)
VALUES (
  'Super Admin',
  '9999999999',
  'admin@gims.local',
  '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mrx2wQzBZBjFD.LDzZsRlr7j7tqvMSq',
  'super_admin',
  true
)
ON CONFLICT (phone) DO UPDATE SET
  role = 'super_admin',
  password_hash = '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mrx2wQzBZBjFD.LDzZsRlr7j7tqvMSq',
  is_active = true;
