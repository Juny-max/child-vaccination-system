-- ============================================================================
-- Update Demo User Passwords for Backend Authentication
-- Password for all demo users: password123
-- SHA-256 hash: ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f
-- ============================================================================

-- Update parent user password
UPDATE users 
SET password_hash = 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f'
WHERE email = 'akosua.asante@example.com';

-- Update other demo users
UPDATE users 
SET password_hash = 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f'
WHERE email IN (
  'parent@example.com',
  'admin@health.gov.gh',
  'branch.manager@health.gov.gh',
  'nurse@health.gov.gh',
  'chw@health.gov.gh',
  'data.officer@health.gov.gh',
  'pha@health.gov.gh'
);

-- Verify the update
SELECT email, role, 
       CASE WHEN password_hash IS NOT NULL THEN 'Set' ELSE 'Not Set' END as password_status
FROM users 
WHERE role = 'parent' OR email LIKE '%@health.gov.gh';
