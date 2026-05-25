-- ============================================================================
-- Add Schedule Versioning
-- ============================================================================
-- Use this on an existing Supabase database where schema.sql was already run.
-- It adds only the new schedule-versioning pieces and backfills existing data.
-- Safe to paste into Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS schedule_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  version_number INTEGER UNIQUE NOT NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  based_on_version_id UUID REFERENCES schedule_versions(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO schedule_versions (id, name, version_number, effective_from, status, notes)
VALUES (
  '11111111-2222-3333-4444-555555555555',
  'Ghana EPI Schedule v1',
  1,
  '2025-01-01',
  'active',
  'Initial schedule version backfilled for existing CVCC data.'
)
ON CONFLICT (version_number) DO NOTHING;

ALTER TABLE vaccination_schedules
  ADD COLUMN IF NOT EXISTS schedule_version_id UUID REFERENCES schedule_versions(id);

ALTER TABLE children
  ADD COLUMN IF NOT EXISTS schedule_version_id UUID REFERENCES schedule_versions(id);

ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS schedule_version_id UUID REFERENCES schedule_versions(id);

UPDATE vaccination_schedules
SET schedule_version_id = COALESCE(
  schedule_version_id,
  (SELECT id FROM schedule_versions WHERE version_number = 1)
)
WHERE schedule_version_id IS NULL;

UPDATE children
SET schedule_version_id = COALESCE(
  schedule_version_id,
  (SELECT id FROM schedule_versions WHERE version_number = 1)
)
WHERE schedule_version_id IS NULL;

UPDATE certificates
SET schedule_version_id = COALESCE(
  schedule_version_id,
  (SELECT schedule_version_id FROM children WHERE children.id = certificates.child_id),
  (SELECT id FROM schedule_versions WHERE version_number = 1)
)
WHERE schedule_version_id IS NULL;

ALTER TABLE vaccination_schedules
  ALTER COLUMN schedule_version_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vaccination_schedules_schedule_version_id
  ON vaccination_schedules(schedule_version_id);

CREATE INDEX IF NOT EXISTS idx_children_schedule_version_id
  ON children(schedule_version_id);

CREATE INDEX IF NOT EXISTS idx_certificates_schedule_version_id
  ON certificates(schedule_version_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_schedule_versions_updated_at'
  ) THEN
    CREATE TRIGGER update_schedule_versions_updated_at
      BEFORE UPDATE ON schedule_versions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE schedule_versions ENABLE ROW LEVEL SECURITY;
