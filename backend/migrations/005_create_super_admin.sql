-- Migration: 005_create_super_admin.sql
-- Description: Create super admin user and update role constraint

-- Update role constraint to include super_admin and member
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'admin', 'member'));

-- Create super admin user
-- Phone: 9999999999
-- Password: admin123
INSERT INTO users (name, phone, email, password_hash, role, is_active)
VALUES (
  'Super Admin',
  '9999999999',
  'admin@gims.local',
  '$2a$10$pzkwsrWNIYYCMZ0AVUg.E.7NqE1ufV1z22SNOiqoFWcYoMAo/lUl6',
  'super_admin',
  true
)
ON CONFLICT (phone) DO UPDATE SET
  role = 'super_admin',
  password_hash = '$2a$10$pzkwsrWNIYYCMZ0AVUg.E.7NqE1ufV1z22SNOiqoFWcYoMAo/lUl6',
  is_active = true;
