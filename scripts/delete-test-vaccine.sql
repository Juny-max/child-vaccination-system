-- ============================================================================
-- Script to delete a test vaccine and its associated records
-- USE WITH CAUTION: This permanently deletes data!
-- ============================================================================

-- Replace 'DGB' with the vaccine code you want to delete
-- Run this in Supabase SQL Editor

DO $$
DECLARE
  vaccine_code TEXT := 'DGB';  -- <-- Change this to your test vaccine code
  vaccine_uuid UUID;
  deleted_vaccinations INT;
  deleted_schedules INT;
BEGIN
  -- 1. Get the vaccine UUID
  SELECT id INTO vaccine_uuid FROM vaccines WHERE code = vaccine_code;
  
  IF vaccine_uuid IS NULL THEN
    RAISE NOTICE 'Vaccine with code % not found', vaccine_code;
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found vaccine: % (ID: %)', vaccine_code, vaccine_uuid;
  
  -- 2. Delete vaccination_events referencing this vaccine
  DELETE FROM vaccination_events WHERE vaccine_id = vaccine_uuid;
  GET DIAGNOSTICS deleted_vaccinations = ROW_COUNT;
  RAISE NOTICE 'Deleted % vaccination event(s)', deleted_vaccinations;
  
  -- 3. Delete vaccination_schedules for this vaccine
  DELETE FROM vaccination_schedules WHERE vaccine_id = vaccine_uuid;
  GET DIAGNOSTICS deleted_schedules = ROW_COUNT;
  RAISE NOTICE 'Deleted % schedule(s)', deleted_schedules;
  
  -- 4. Delete the vaccine itself
  DELETE FROM vaccines WHERE id = vaccine_uuid;
  RAISE NOTICE 'Deleted vaccine: %', vaccine_code;
  
  RAISE NOTICE '✅ Cleanup complete for vaccine: %', vaccine_code;
END $$;
