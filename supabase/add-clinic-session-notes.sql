-- ============================================================================
-- Add Clinic Session Notes Table
-- ============================================================================

-- Clinic session notes table (for facility nurse documentation)
CREATE TABLE IF NOT EXISTS clinic_session_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES branches(id),
  visit_date DATE NOT NULL,
  recorded_by_user_id UUID REFERENCES users(id),
  recorded_by_name VARCHAR(255) NOT NULL,
  notes TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_clinic_session_notes_child_id ON clinic_session_notes(child_id);
CREATE INDEX IF NOT EXISTS idx_clinic_session_notes_visit_date ON clinic_session_notes(visit_date);
CREATE INDEX IF NOT EXISTS idx_clinic_session_notes_facility_id ON clinic_session_notes(facility_id);

-- Trigger for updated_at
CREATE TRIGGER update_clinic_session_notes_updated_at BEFORE UPDATE ON clinic_session_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE clinic_session_notes ENABLE ROW LEVEL SECURITY;

-- Add comment
COMMENT ON TABLE clinic_session_notes IS 'Stores clinical session notes from facility nurses documenting counseling, observations, and follow-up actions';
