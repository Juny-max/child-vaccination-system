-- ============================================================================
-- Update Demo User Passwords for Backend Authentication
-- Password for all demo users: password1234
-- SHA-256 hash: b9c950640e1b3740e98acb93e669c65766f6670dd1609ba91ff41052ba48c6f3
-- ============================================================================

-- Update parent user password
UPDATE users 
SET password_hash = 'b9c950640e1b3740e98acb93e669c65766f6670dd1609ba91ff41052ba48c6f3'
WHERE email = 'akosua.asante@example.com';

-- Update other demo users
UPDATE users 
SET password_hash = 'b9c950640e1b3740e98acb93e669c65766f6670dd1609ba91ff41052ba48c6f3'
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
