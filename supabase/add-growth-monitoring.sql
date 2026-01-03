-- ============================================================================
-- Add Growth Monitoring / Anthropometric Measurements Table
-- ============================================================================

-- Growth monitoring measurements table
CREATE TABLE IF NOT EXISTS growth_monitoring (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  measurement_date DATE NOT NULL,
  weight_kg DECIMAL(5, 2), -- Weight in kilograms
  length_cm DECIMAL(5, 2), -- Length/height in centimeters
  head_circumference_cm DECIMAL(5, 2), -- Head circumference in centimeters
  muac_cm DECIMAL(5, 2), -- Mid-upper arm circumference in centimeters
  temperature_c DECIMAL(4, 2), -- Temperature in celsius
  recorded_by_user_id UUID REFERENCES users(id),
  recorded_by_name VARCHAR(255) NOT NULL, -- Name for display
  facility_id UUID REFERENCES branches(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_growth_monitoring_child_id ON growth_monitoring(child_id);
CREATE INDEX IF NOT EXISTS idx_growth_monitoring_measurement_date ON growth_monitoring(measurement_date);
CREATE INDEX IF NOT EXISTS idx_growth_monitoring_recorded_by ON growth_monitoring(recorded_by_user_id);

-- Trigger for updated_at
CREATE TRIGGER update_growth_monitoring_updated_at BEFORE UPDATE ON growth_monitoring
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE growth_monitoring ENABLE ROW LEVEL SECURITY;

-- Add comment
COMMENT ON TABLE growth_monitoring IS 'Stores anthropometric measurements for children (weight, length, head circumference, MUAC, temperature)';
