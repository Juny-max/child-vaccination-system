-- ============================================
-- Row Level Security (RLS) Policies for Guardians Table
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable RLS on guardians table
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow all users to read guardians (for development)
-- This allows facility nurses to see all mothers when registering children
CREATE POLICY "Allow public read access to guardians"
ON guardians
FOR SELECT
TO public
USING (true);

-- Policy 2: Allow authenticated users to insert guardians
-- This allows facility nurses to register new mothers
CREATE POLICY "Allow authenticated users to insert guardians"
ON guardians
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy 3: Allow authenticated users to update guardians
-- This allows facility nurses to update mother information
CREATE POLICY "Allow authenticated users to update guardians"
ON guardians
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy 4: Allow authenticated users to delete guardians (optional)
-- Uncomment if you want to allow deletion
-- CREATE POLICY "Allow authenticated users to delete guardians"
-- ON guardians
-- FOR DELETE
-- TO authenticated
-- USING (true);

-- Verify policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'guardians';
