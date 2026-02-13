-- ============================================
-- Test RLS Policies - Run this to verify permissions
-- ============================================

-- Test 1: Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('children', 'child_guardian') 
AND schemaname = 'public';

-- Test 2: List ALL policies (to see if there are any we missed)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('children', 'child_guardian')
ORDER BY tablename, policyname;

-- Test 3: Try a direct INSERT as anon role (this simulates what the frontend does)
-- This will fail if RLS is blocking, succeed if it works
SET ROLE anon;

INSERT INTO children (
  cvcc_id,
  qr_code_payload,
  full_name,
  date_of_birth,
  gender,
  is_active
) VALUES (
  'TEST-001',
  '{"test": true}',
  'Test Child',
  '2024-01-01',
  'male',
  true
);

-- Clean up test
DELETE FROM children WHERE cvcc_id = 'TEST-001';

-- Reset role
RESET ROLE;
