-- ============================================================================
-- Fix Esi Boadu's Vaccination Data
-- This script completes Esi's vaccination schedule to match her "Complete" certificate
-- ============================================================================

-- Esi Boadu's child_id: c1000000-0000-0000-0000-000000000100
-- Date of Birth: 2023-05-10

-- ============================================================================
-- 1. ADD MISSING VACCINATION EVENTS FOR ESI BOADU
-- ============================================================================

-- PCV-1 (6 weeks = 2023-06-21)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, batch_number, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000100',
  'b0000000-0000-0000-0000-000000000009', -- PCV-1
  1,
  '2023-06-21',
  'c0000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'PCV-2023-Q2-001',
  'completed',
  'right-thigh',
  TRUE
)
ON CONFLICT DO NOTHING;

-- Rotavirus-1 (6 weeks = 2023-06-21)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, batch_number, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000100',
  'b000000c-0000-0000-0000-000000000000', -- Rotavirus-1
  1,
  '2023-06-21',
  'c0000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'RV-2023-Q2-001',
  'completed',
  'oral',
  TRUE
)
ON CONFLICT DO NOTHING;

-- PCV-2 (10 weeks = 2023-07-19)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, batch_number, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000100',
  'b000000a-0000-0000-0000-000000000000', -- PCV-2
  2,
  '2023-07-19',
  'c0000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'PCV-2023-Q3-002',
  'completed',
  'left-thigh',
  TRUE
)
ON CONFLICT DO NOTHING;

-- Rotavirus-2 (10 weeks = 2023-07-19)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, batch_number, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000100',
  'b000000d-0000-0000-0000-000000000000', -- Rotavirus-2
  2,
  '2023-07-19',
  'c0000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'RV-2023-Q3-002',
  'completed',
  'oral',
  TRUE
)
ON CONFLICT DO NOTHING;

-- OPV-3 (14 weeks = 2023-08-16)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, batch_number, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000100',
  'b0000000-0000-0000-0000-000000000005', -- OPV-3
  3,
  '2023-08-16',
  'c0000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'OPV-2023-Q3-003',
  'completed',
  'oral',
  TRUE
)
ON CONFLICT DO NOTHING;

-- PCV-3 (14 weeks = 2023-08-16)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, batch_number, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000100',
  'b000000b-0000-0000-0000-000000000000', -- PCV-3
  3,
  '2023-08-16',
  'c0000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'PCV-2023-Q3-003',
  'completed',
  'right-thigh',
  TRUE
)
ON CONFLICT DO NOTHING;

-- Meningococcal A (9 months = 2024-02-10)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, batch_number, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000100',
  'b0000011-0000-0000-0000-000000000000', -- Meningococcal A
  1,
  '2024-02-10',
  'c0000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'MENA-2024-Q1-001',
  'completed',
  'left-arm-upper',
  TRUE
)
ON CONFLICT DO NOTHING;

-- MR-2 (18 months = 2024-11-10)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, batch_number, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000100',
  'b000000f-0000-0000-0000-000000000000', -- MR-2
  2,
  '2024-11-10',
  'c0000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'MR-2024-Q4-002',
  'completed',
  'right-arm-upper',
  TRUE
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. UPDATE ESI'S CERTIFICATE WITH ALL 17 VACCINES
-- ============================================================================

UPDATE certificates
SET 
  vaccines_completed = ARRAY[
    'BCG', 'OPV-0', 'OPV-1', 'OPV-2', 'OPV-3',
    'Pentavalent-1', 'Pentavalent-2', 'Pentavalent-3',
    'PCV-1', 'PCV-2', 'PCV-3',
    'Rotavirus-1', 'Rotavirus-2',
    'Measles-Rubella-1', 'Measles-Rubella-2',
    'Yellow Fever', 'Meningococcal A'
  ],
  completion_status = 'Complete',
  status = 'issued'
WHERE child_id = 'c1000000-0000-0000-0000-000000000100';

-- ============================================================================
-- 3. ADD COMPLETE VACCINATION EVENTS FOR ZARA ASANTE (CHILD-003)
-- ============================================================================

-- Zara Asante's child_id: c1000000-0000-0000-0000-000000000102
-- Date of Birth: 2022-01-15 (she's older, so all her vaccines would be done)

-- OPV-0 (birth)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000102', 'b0000000-0000-0000-0000-000000000002', 1, '2022-01-18', 'c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'completed', 'oral', TRUE
)
ON CONFLICT DO NOTHING;

-- OPV-1 (6 weeks = 2022-02-26)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000102', 'b0000000-0000-0000-0000-000000000003', 1, '2022-02-26', 'c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'completed', 'oral', TRUE
)
ON CONFLICT DO NOTHING;

-- OPV-2 (10 weeks = 2022-03-26)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000102', 'b0000000-0000-0000-0000-000000000004', 2, '2022-03-26', 'c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'completed', 'oral', TRUE
)
ON CONFLICT DO NOTHING;

-- OPV-3 (14 weeks = 2022-04-23)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000102', 'b0000000-0000-0000-0000-000000000005', 3, '2022-04-23', 'c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'completed', 'oral', TRUE
)
ON CONFLICT DO NOTHING;

-- Pentavalent-1 (6 weeks = 2022-02-26)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000102', 'b0000000-0000-0000-0000-000000000006', 1, '2022-02-26', 'c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'completed', 'left-thigh', TRUE
)
ON CONFLICT DO NOTHING;

-- Pentavalent-2 (10 weeks = 2022-03-26)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000102', 'b0000000-0000-0000-0000-000000000007', 2, '2022-03-26', 'c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'completed', 'right-thigh', TRUE
)
ON CONFLICT DO NOTHING;

-- Pentavalent-3 (14 weeks = 2022-04-23)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000102', 'b0000000-0000-0000-0000-000000000008', 3, '2022-04-23', 'c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'completed', 'left-thigh', TRUE
)
ON CONFLICT DO NOTHING;

-- PCV-1 (6 weeks = 2022-02-26)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000102', 'b0000000-0000-0000-0000-000000000009', 1, '2022-02-26', 'c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'completed', 'right-thigh', TRUE
)
ON CONFLICT DO NOTHING;

-- PCV-2 (10 weeks = 2022-03-26)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000102', 'b000000a-0000-0000-0000-000000000000', 2, '2022-03-26', 'c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'completed', 'left-thigh', TRUE
)
ON CONFLICT DO NOTHING;

-- PCV-3 (14 weeks = 2022-04-23)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000102', 'b000000b-0000-0000-0000-000000000000', 3, '2022-04-23', 'c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'completed', 'right-thigh', TRUE
)
ON CONFLICT DO NOTHING;

-- Rotavirus-1 (6 weeks = 2022-02-26)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000102', 'b000000c-0000-0000-0000-000000000000', 1, '2022-02-26', 'c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'completed', 'oral', TRUE
)
ON CONFLICT DO NOTHING;

-- Rotavirus-2 (10 weeks = 2022-03-26)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000102', 'b000000d-0000-0000-0000-000000000000', 2, '2022-03-26', 'c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'completed', 'oral', TRUE
)
ON CONFLICT DO NOTHING;

-- MR-1 (9 months = 2022-10-15)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000102', 'b000000e-0000-0000-0000-000000000000', 1, '2022-10-15', 'c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'completed', 'left-arm-upper', TRUE
)
ON CONFLICT DO NOTHING;

-- MR-2 (18 months = 2023-07-15)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000102', 'b000000f-0000-0000-0000-000000000000', 2, '2023-07-15', 'c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'completed', 'right-arm-upper', TRUE
)
ON CONFLICT DO NOTHING;

-- Yellow Fever (9 months = 2022-10-15)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000102', 'b0000010-0000-0000-0000-000000000000', 1, '2022-10-15', 'c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'completed', 'left-arm-upper', TRUE
)
ON CONFLICT DO NOTHING;

-- Meningococcal A (9 months = 2022-10-15)
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000102', 'b0000011-0000-0000-0000-000000000000', 1, '2022-10-15', 'c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'completed', 'right-arm-upper', TRUE
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. UPDATE ZARA'S CERTIFICATE WITH ALL 17 VACCINES
-- ============================================================================

UPDATE certificates
SET 
  vaccines_completed = ARRAY[
    'BCG', 'OPV-0', 'OPV-1', 'OPV-2', 'OPV-3',
    'Pentavalent-1', 'Pentavalent-2', 'Pentavalent-3',
    'PCV-1', 'PCV-2', 'PCV-3',
    'Rotavirus-1', 'Rotavirus-2',
    'Measles-Rubella-1', 'Measles-Rubella-2',
    'Yellow Fever', 'Meningococcal A'
  ],
  completion_status = 'Complete',
  status = 'issued'
WHERE child_id = 'c1000000-0000-0000-0000-000000000102';

-- ============================================================================
-- VERIFICATION QUERY (run after to confirm)
-- ============================================================================
-- SELECT c.full_name, COUNT(ve.id) as completed_vaccines
-- FROM children c
-- LEFT JOIN vaccination_events ve ON c.id = ve.child_id AND ve.status = 'completed'
-- WHERE c.id IN ('c1000000-0000-0000-0000-000000000100', 'c1000000-0000-0000-0000-000000000102')
-- GROUP BY c.id, c.full_name;
