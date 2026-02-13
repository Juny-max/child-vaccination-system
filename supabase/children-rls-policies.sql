-- ============================================
-- Row Level Security (RLS) Policies for Children & Child_Guardian Tables
-- Run this in Supabase SQL Editor to allow child registration
-- ============================================

-- First, drop all existing policies to start fresh
DROP POLICY IF EXISTS "Allow public read access to children" ON children;
DROP POLICY IF EXISTS "Allow public insert access to children" ON children;
DROP POLICY IF EXISTS "Allow public update access to children" ON children;
DROP POLICY IF EXISTS "Allow authenticated users to insert children" ON children;
DROP POLICY IF EXISTS "Allow authenticated users to update children" ON children;

DROP POLICY IF EXISTS "Allow public read access to child_guardian" ON child_guardian;
DROP POLICY IF EXISTS "Allow public insert access to child_guardian" ON child_guardian;
DROP POLICY IF EXISTS "Allow public update access to child_guardian" ON child_guardian;
DROP POLICY IF EXISTS "Allow authenticated users to insert child_guardian" ON child_guardian;
DROP POLICY IF EXISTS "Allow authenticated users to update child_guardian" ON child_guardian;

-- Disable RLS temporarily
ALTER TABLE children DISABLE ROW LEVEL SECURITY;
ALTER TABLE child_guardian DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_guardian ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CHILDREN TABLE POLICIES
-- ============================================

-- Policy 1: Allow all users to read children (for searching/viewing)
CREATE POLICY "Allow read access to children"
ON children
FOR SELECT
TO anon, authenticated
USING (true);

-- Policy 2: Allow all users to insert children
CREATE POLICY "Allow insert access to children"
ON children
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Policy 3: Allow all users to update children
CREATE POLICY "Allow update access to children"
ON children
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- CHILD_GUARDIAN TABLE POLICIES
-- ============================================

-- Policy 1: Allow all users to read child-guardian relationships
CREATE POLICY "Allow read access to child_guardian"
ON child_guardian
FOR SELECT
TO anon, authenticated
USING (true);

-- Policy 2: Allow all users to insert child-guardian links
CREATE POLICY "Allow insert access to child_guardian"
ON child_guardian
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Policy 3: Allow all users to update child-guardian relationships
CREATE POLICY "Allow update access to child_guardian"
ON child_guardian
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('children', 'child_guardian')
ORDER BY tablename, policyname;
