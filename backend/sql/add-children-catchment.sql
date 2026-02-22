-- ============================================================================
-- Migration: Add catchment_area_id to Children Table
-- Purpose: Enable direct child-to-catchment assignment for Transfer In/Out
-- Date: 2026-02-21
-- ============================================================================

-- Add catchment_area_id column to children table
ALTER TABLE children 
ADD COLUMN IF NOT EXISTS catchment_area_id UUID REFERENCES catchment_areas(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_children_catchment_area_id ON children(catchment_area_id);

-- Backfill existing children's catchment from their primary guardian
-- This ensures existing data has catchment assignments
UPDATE children c
SET catchment_area_id = (
  SELECT g.catchment_area_id
  FROM child_guardian cg
  JOIN guardians g ON g.id = cg.guardian_id
  WHERE cg.child_id = c.id
    AND cg.is_primary = TRUE
    AND g.catchment_area_id IS NOT NULL
  LIMIT 1
)
WHERE c.catchment_area_id IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN children.catchment_area_id IS 
'CHW catchment area assignment. NULL means child has been transferred out or not yet assigned. Set by CHW Transfer In/Out operations.';

-- Update the updated_at trigger to include catchment changes
-- (The trigger already exists, just documenting that catchment changes will update timestamp)
