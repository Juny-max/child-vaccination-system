-- ============================================================================
-- Migration: Add current_catchment_area_id to children table
-- Purpose: Allow children to have explicit catchment area assignment
--          (inherited from primary guardian or manually set for special cases)
-- Date: 2026-02-21
-- ============================================================================

-- Add current_catchment_area_id column to children table
ALTER TABLE children 
ADD COLUMN current_catchment_area_id UUID REFERENCES catchment_areas(id);

-- Add index for faster CHW searches
CREATE INDEX idx_children_catchment ON children(current_catchment_area_id);

-- Add comment explaining the column
COMMENT ON COLUMN children.current_catchment_area_id IS 
'Current catchment area where child resides. Usually inherited from primary guardian, but can be manually set for children living with extended family, in orphanages, or other special cases.';

-- ============================================================================
-- Data Migration: Set current_catchment_area_id from primary guardian
-- ============================================================================

-- Populate current_catchment_area_id for existing children
-- by copying from their primary guardian's catchment_area_id
UPDATE children
SET current_catchment_area_id = (
  SELECT g.catchment_area_id
  FROM child_guardian cg
  JOIN guardians g ON g.id = cg.guardian_id
  WHERE cg.child_id = children.id
    AND cg.is_primary = true
  LIMIT 1
)
WHERE current_catchment_area_id IS NULL;

-- ============================================================================
-- Trigger: Auto-update child catchment when primary guardian changes
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_child_catchment_from_primary_guardian()
RETURNS TRIGGER AS $$
BEGIN
  -- When a guardian's catchment changes, update all their primary children
  IF (TG_OP = 'UPDATE' AND OLD.catchment_area_id IS DISTINCT FROM NEW.catchment_area_id) THEN
    UPDATE children
    SET current_catchment_area_id = NEW.catchment_area_id,
        updated_at = NOW()
    WHERE id IN (
      SELECT child_id 
      FROM child_guardian 
      WHERE guardian_id = NEW.id 
        AND is_primary = true
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_child_catchment_on_guardian_update
  AFTER UPDATE ON guardians
  FOR EACH ROW
  EXECUTE FUNCTION sync_child_catchment_from_primary_guardian();

-- ============================================================================
-- Trigger: Set child catchment when child-guardian relationship created
-- ============================================================================

CREATE OR REPLACE FUNCTION set_child_catchment_on_guardian_link()
RETURNS TRIGGER AS $$
BEGIN
  -- When a primary guardian is assigned to a child, copy their catchment
  IF NEW.is_primary = true THEN
    UPDATE children
    SET current_catchment_area_id = (
      SELECT catchment_area_id 
      FROM guardians 
      WHERE id = NEW.guardian_id
    ),
    updated_at = NOW()
    WHERE id = NEW.child_id
      AND current_catchment_area_id IS NULL; -- Only if not already set
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_child_catchment_on_primary_guardian
  AFTER INSERT OR UPDATE ON child_guardian
  FOR EACH ROW
  WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION set_child_catchment_on_guardian_link();

-- ============================================================================
-- Verification Query
-- ============================================================================

-- After running this migration, verify the data:
-- 
-- SELECT 
--   c.cvcc_id,
--   c.full_name as child_name,
--   ca.name as child_catchment,
--   g.full_name as guardian_name,
--   gca.name as guardian_catchment,
--   CASE 
--     WHEN c.current_catchment_area_id = g.catchment_area_id THEN '✓ Match'
--     ELSE '✗ Mismatch'
--   END as status
-- FROM children c
-- LEFT JOIN catchment_areas ca ON ca.id = c.current_catchment_area_id
-- LEFT JOIN child_guardian cg ON cg.child_id = c.id AND cg.is_primary = true
-- LEFT JOIN guardians g ON g.id = cg.guardian_id
-- LEFT JOIN catchment_areas gca ON gca.id = g.catchment_area_id;
