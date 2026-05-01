-- ============================================================================
-- Add RLS policy for vaccines table
-- ============================================================================
-- The vaccines table is a "National Vaccination Catalogue" - all vaccines are
-- global and should be readable by any authenticated user.
-- ============================================================================

-- Allow all authenticated users to read vaccines
CREATE POLICY "Authenticated users can read vaccines"
  ON vaccines
  FOR SELECT
  TO authenticated
  USING (true);

-- Also allow reading vaccination_schedules (they reference vaccines)
CREATE POLICY "Authenticated users can read vaccination schedules"
  ON vaccination_schedules
  FOR SELECT
  TO authenticated
  USING (true);
