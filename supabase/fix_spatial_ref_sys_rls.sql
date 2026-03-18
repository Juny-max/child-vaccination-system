-- Manual fix for Security Advisor warning:
-- "RLS Disabled in Public" for public.spatial_ref_sys
--
-- IMPORTANT:
-- Run this in the Supabase Dashboard SQL Editor (postgres/supabase_admin role).
-- Running as anon/authenticated/service_role will fail with "must be owner".

DO $$
BEGIN
  IF to_regclass('public.spatial_ref_sys') IS NOT NULL THEN
    ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.spatial_ref_sys') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'spatial_ref_sys'
        AND policyname = 'allow_select_spatial_ref_sys'
    ) THEN
      CREATE POLICY allow_select_spatial_ref_sys
      ON public.spatial_ref_sys
      FOR SELECT
      TO anon, authenticated
      USING (true);
    END IF;
  END IF;
END
$$;
