-- ============================================================================
-- SEED: stock_inventory for Accra Central Hospital (branch 11111111-...)
-- Covers the 8 key Ghana EPI vaccines supplied in vials/doses.
-- Run this in Supabase SQL Editor once to populate demo stock data.
-- ============================================================================

INSERT INTO stock_inventory (
  id, vaccine_id, facility_id,
  batch_number, lot_number, manufacturer,
  expiry_date,
  quantity_received, quantity_used, quantity_remaining,
  received_date, received_by_user_id
) VALUES

-- BCG  (10-dose vials, 50 vials received, 38 used → 12 remaining → Critical)
('f0000001-0000-0000-0000-000000000001',
 'b0000000-0000-0000-0000-000000000001',  -- BCG
 '11111111-1111-1111-1111-111111111111',
 'BCG-2025-GH-001', 'LOT-BCG-A1', 'Serum Institute of India',
 '2026-06-30',
 500, 380, 120,
 '2026-01-10', 'b0000000-0000-0000-0000-000000000001'),

-- OPV (20-dose vials, 60 vials received, 52 used → 8 remaining → Critical)
('f0000002-0000-0000-0000-000000000002',
 'b0000000-0000-0000-0000-000000000002',  -- OPV-0
 '11111111-1111-1111-1111-111111111111',
 'OPV-2025-GH-002', 'LOT-OPV-B2', 'Bio Farma',
 '2026-09-15',
 1200, 1040, 160,
 '2026-01-10', 'b0000000-0000-0000-0000-000000000001'),

-- Pentavalent (1-dose vials, 200 vials received, 110 used → 90 remaining → Low)
('f0000003-0000-0000-0000-000000000003',
 'b0000000-0000-0000-0000-000000000006',  -- Penta-1
 '11111111-1111-1111-1111-111111111111',
 'PENTA-2025-GH-003', 'LOT-PEN-C3', 'SK Bioscience',
 '2026-12-31',
 200, 110, 90,
 '2026-01-15', 'b0000000-0000-0000-0000-000000000001'),

-- PCV-13 (1-dose vials, 150 received, 75 used → 75 remaining → Moderate)
('f0000004-0000-0000-0000-000000000004',
 'b0000000-0000-0000-0000-000000000009',  -- PCV-1
 '11111111-1111-1111-1111-111111111111',
 'PCV-2025-GH-004', 'LOT-PCV-D4', 'Pfizer',
 '2027-03-20',
 150, 75, 75,
 '2026-02-01', 'b0000000-0000-0000-0000-000000000001'),

-- Rotavirus (1-dose vials, 100 received, 30 used → 70 remaining → Adequate)
('f0000005-0000-0000-0000-000000000005',
 'b000000c-0000-0000-0000-000000000000',  -- Rotavirus-1
 '11111111-1111-1111-1111-111111111111',
 'RV-2025-GH-005', 'LOT-ROT-E5', 'GlaxoSmithKline',
 '2027-01-10',
 100, 30, 70,
 '2026-02-10', 'b0000000-0000-0000-0000-000000000001'),

-- Measles-Rubella (10-dose vials, 80 vials received, 60 used → 200 doses remaining → Adequate)
('f0000006-0000-0000-0000-000000000006',
 'b000000e-0000-0000-0000-000000000000',  -- MR-1
 '11111111-1111-1111-1111-111111111111',
 'MR-2025-GH-006', 'LOT-MR-F6', 'Serum Institute of India',
 '2026-08-01',
 800, 600, 200,
 '2026-01-20', 'b0000000-0000-0000-0000-000000000001'),

-- Yellow Fever (10-dose vials, 60 vials, 55 used → 50 doses → Low, expiring soon)
('f0000007-0000-0000-0000-000000000007',
 'b0000010-0000-0000-0000-000000000000',  -- Yellow Fever
 '11111111-1111-1111-1111-111111111111',
 'YF-2025-GH-007', 'LOT-YF-G7', 'Institut Pasteur de Dakar',
 '2026-04-30',
 600, 550, 50,
 '2025-11-01', 'b0000000-0000-0000-0000-000000000001'),

-- Meningococcal A (1-dose vials, 120 received, 50 used → 70 remaining → Adequate)
('f0000008-0000-0000-0000-000000000008',
 'b0000011-0000-0000-0000-000000000000',  -- Meningococcal A
 '11111111-1111-1111-1111-111111111111',
 'MENING-2025-GH-008', 'LOT-MEN-H8', 'Serum Institute of India',
 '2027-06-15',
 120, 50, 70,
 '2026-02-15', 'b0000000-0000-0000-0000-000000000001');
