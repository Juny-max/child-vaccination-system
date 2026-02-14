-- ============================================================================
-- Create storage bucket for child profile photos
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================================

-- Create the bucket (public so images can be displayed without auth)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'child-photos',
  'child-photos',
  true,
  5242880, -- 5MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read (public bucket)
CREATE POLICY "Public read access for child photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'child-photos');

-- Allow authenticated and anon users to upload (since we use anon key from frontend)
CREATE POLICY "Allow uploads to child photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'child-photos');

-- Allow updates (upsert)
CREATE POLICY "Allow updates to child photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'child-photos');
