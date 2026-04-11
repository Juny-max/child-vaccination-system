-- ============================================================================
-- Parent Portal Demo User - Akosua Asante
-- This is the primary test account for parent portal features
-- Generated: January 1, 2026
-- ============================================================================

-- ============================================================================
-- 1. CREATE PARENT USER (Portal Login)
-- ============================================================================

INSERT INTO users (id, email, phone, full_name, role, status) VALUES
  ('a0000000-0000-0000-0000-000000000100', 'akosua.asante@example.com', '+233 24 123 4567', 'Akosua Asante', 'parent', 'active')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. CREATE GUARDIAN PROFILE
-- ============================================================================

INSERT INTO guardians (
  id, 
  user_id, 
  full_name, 
  phone_primary, 
  phone_alternate, 
  email, 
  address_line1, 
  landmark, 
  city, 
  region, 
  country, 
  postal_code, 
  community,
  catchment_area_id,
  preferred_contact, 
  emergency_contact_name, 
  emergency_contact_phone,
  notes,
  created_by_user_id
) VALUES (
  'a1000000-0000-0000-0000-000000000100',
  'a0000000-0000-0000-0000-000000000100',
  'Akosua Asante',
  '+233 24 123 4567',
  '+233 20 765 4321',
  'akosua.asante@example.com',
  'House 12, Mango Street',
  'Near Ga Central Clinic',
  'Accra',
  'Greater Accra',
  'Ghana',
  'GA-184-5123',
  'Accra Metro',
  'ca000000-0000-0000-0000-000000000001', -- Adabraka Zone
  'sms',
  'Kwame Asante (Father) • +233 24 555 8899 | Akua Serwaa (Sister) • +233 20 111 2233',
  '+233 24 555 8899',
  'Primary emergency contact: Kwame Asante (Father). Secondary: Akua Serwaa (Sister)',
  'c0000000-0000-0000-0000-000000000001' -- Created by Accra Central Hospital nurse
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. CREATE CHILDREN
-- ============================================================================

-- Child 1: Esi Boadu (First daughter, Complete vaccinations)
INSERT INTO children (
  id,
  cvcc_id,
  qr_code_payload,
  full_name,
  date_of_birth,
  gender,
  birth_weight,
  birth_length,
  head_circumference,
  place_of_birth,
  delivery_type,
  birth_order,
  blood_type,
  primary_facility_id,
  profile_photo_url,
  allergies,
  critical_notes,
  is_active,
  created_by_user_id
) VALUES (
  'c1000000-0000-0000-0000-000000000100',
  'CHILD-001',
  'QRC-CH-A7M9K2T4N8X3R5P6V1W2',
  'Esi Boadu',
  '2023-05-10',
  'female',
  3.2,
  78.0,
  NULL,
  'Accra Central Hospital',
  'Spontaneous vaginal',
  '1st',
  'O+',
  '11111111-1111-1111-1111-111111111111', -- Accra Central Hospital
  '/images/demo-child-1.svg',
  ARRAY[]::TEXT[],
  NULL,
  TRUE,
  'c0000000-0000-0000-0000-000000000001'
)
ON CONFLICT (cvcc_id) DO NOTHING;

-- Child 2: Kojo Asante (Incomplete vaccinations)
INSERT INTO children (
  id,
  cvcc_id,
  qr_code_payload,
  full_name,
  date_of_birth,
  gender,
  birth_weight,
  birth_length,
  birth_order,
  blood_type,
  primary_facility_id,
  profile_photo_url,
  allergies,
  is_active,
  created_by_user_id
) VALUES (
  'c1000000-0000-0000-0000-000000000101',
  'CHILD-002',
  'QRC-CH-H3D8L6Q2B9Z7F5N4K1M0',
  'Kojo Asante',
  '2024-04-21',
  'male',
  3.0,
  66.0,
  '2nd',
  'A+',
  '11111111-1111-1111-1111-111111111111',
  '/images/demo-child-2.svg',
  ARRAY[]::TEXT[],
  TRUE,
  'c0000000-0000-0000-0000-000000000001'
)
ON CONFLICT (cvcc_id) DO NOTHING;

-- Child 3: Zara Asante (Complete vaccinations, different facility)
INSERT INTO children (
  id,
  cvcc_id,
  qr_code_payload,
  full_name,
  date_of_birth,
  gender,
  birth_weight,
  birth_length,
  birth_order,
  blood_type,
  primary_facility_id,
  profile_photo_url,
  allergies,
  is_active,
  created_by_user_id
) VALUES (
  'c1000000-0000-0000-0000-000000000102',
  'CHILD-003',
  'QRC-CH-T5P2V8R1X4N9C7K6L3J0',
  'Zara Asante',
  '2022-01-14',
  'female',
  3.4,
  96.0,
  '3rd',
  'B+',
  '33333333-3333-3333-3333-333333333333', -- Kumasi South Hospital (we'll add Madina later)
  '/images/demo-child-1.svg',
  ARRAY[]::TEXT[],
  TRUE,
  'c0000000-0000-0000-0000-000000000001'
)
ON CONFLICT (cvcc_id) DO NOTHING;

-- ============================================================================
-- 4. LINK CHILDREN TO GUARDIAN
-- ============================================================================

INSERT INTO child_guardian (child_id, guardian_id, relationship, is_primary) VALUES
  ('c1000000-0000-0000-0000-000000000100', 'a1000000-0000-0000-0000-000000000100', 'Mother', TRUE),
  ('c1000000-0000-0000-0000-000000000101', 'a1000000-0000-0000-0000-000000000100', 'Mother', TRUE),
  ('c1000000-0000-0000-0000-000000000102', 'a1000000-0000-0000-0000-000000000100', 'Mother', TRUE)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. VACCINATION EVENTS FOR ESI BOADU (CHILD-001)
-- ============================================================================

-- BCG - Dec 5, 2024
INSERT INTO vaccination_events (
  child_id,
  vaccine_id,
  dose_number,
  administered_date,
  administered_by_user_id,
  facility_id,
  batch_number,
  lot_number,
  vaccination_site,
  status,
  notes,
  is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000100',
  'b0000000-0000-0000-0000-000000000001', -- BCG
  1,
  '2024-12-05',
  'c0000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'BCG-2024-Q4-001',
  'LOT-BCG-889',
  'left-arm-upper',
  'completed',
  'BCG and Polio (1st dose) recorded. Mother educated on post-shot care and hydration.',
  TRUE
)
ON CONFLICT DO NOTHING;

-- OPV-0 (Polio Dose 1/3) - Dec 5, 2024
INSERT INTO vaccination_events (
  child_id,
  vaccine_id,
  dose_number,
  administered_date,
  administered_by_user_id,
  facility_id,
  batch_number,
  status,
  vaccination_site,
  is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000100',
  'b0000000-0000-0000-0000-000000000002', -- OPV-0
  1,
  '2024-12-05',
  'c0000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'OPV-2024-Q4-012',
  'completed',
  'oral',
  TRUE
)
ON CONFLICT DO NOTHING;

-- DPT (Penta) Dose 1/3 - Dec 19, 2024
INSERT INTO vaccination_events (
  child_id,
  vaccine_id,
  dose_number,
  administered_date,
  administered_by_user_id,
  facility_id,
  batch_number,
  status,
  notes,
  vaccination_site,
  is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000100',
  'b0000000-0000-0000-0000-000000000006', -- Pentavalent-1 (DPT1)
  1,
  '2024-12-19',
  'c0000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'PENTA-2024-Q4-045',
  'completed',
  'DPT (1st dose) administered. No adverse reactions. Growth chart updated.',
  'right-thigh',
  TRUE
)
ON CONFLICT DO NOTHING;

-- OPV-1 (Polio Dose 2/3) - Jan 20, 2025
INSERT INTO vaccination_events (
  child_id,
  vaccine_id,
  dose_number,
  administered_date,
  administered_by_user_id,
  facility_id,
  batch_number,
  status,
  vaccination_site,
  is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000100',
  'b0000000-0000-0000-0000-000000000003', -- OPV-1
  1,
  '2025-01-20',
  'c0000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'OPV-2025-Q1-003',
  'completed',
  'oral',
  TRUE
)
ON CONFLICT DO NOTHING;

-- DPT (Penta) Dose 2/3 - Jan 20, 2025
INSERT INTO vaccination_events (
  child_id,
  vaccine_id,
  dose_number,
  administered_date,
  administered_by_user_id,
  facility_id,
  batch_number,
  status,
  notes,
  vaccination_site,
  is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000100',
  'b0000000-0000-0000-0000-000000000007', -- Pentavalent-2 (DPT2)
  2,
  '2025-01-20',
  'c0000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'PENTA-2025-Q1-008',
  'completed',
  'DPT (2nd dose) administered. Mild fever recorded in the evening; resolved with paracetamol.',
  'left-thigh',
  TRUE
)
ON CONFLICT DO NOTHING;

-- OPV-2 (Polio Dose 3/3) - Completed earlier
INSERT INTO vaccination_events (
  child_id,
  vaccine_id,
  dose_number,
  administered_date,
  administered_by_user_id,
  facility_id,
  batch_number,
  status,
  vaccination_site,
  is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000100',
  'b0000000-0000-0000-0000-000000000004', -- OPV-2
  2,
  '2024-10-01',
  'c0000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'OPV-2024-Q3-056',
  'completed',
  'oral',
  TRUE
)
ON CONFLICT DO NOTHING;

-- DPT3 - Completed earlier
INSERT INTO vaccination_events (
  child_id,
  vaccine_id,
  dose_number,
  administered_date,
  administered_by_user_id,
  facility_id,
  status,
  vaccination_site,
  is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000100',
  'b0000000-0000-0000-0000-000000000008', -- Pentavalent-3 (DPT3)
  3,
  '2024-09-15',
  'c0000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'completed',
  'right-arm-upper',
  TRUE
)
ON CONFLICT DO NOTHING;

-- MR1 (Measles-Rubella) - Completed
INSERT INTO vaccination_events (
  child_id,
  vaccine_id,
  dose_number,
  administered_date,
  administered_by_user_id,
  facility_id,
  status,
  vaccination_site,
  is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000100',
  'b000000e-0000-0000-0000-000000000000', -- MR1
  1,
  '2024-08-10',
  'c0000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'completed',
  'left-arm-upper',
  TRUE
)
ON CONFLICT DO NOTHING;

-- Yellow Fever - Completed
INSERT INTO vaccination_events (
  child_id,
  vaccine_id,
  dose_number,
  administered_date,
  administered_by_user_id,
  facility_id,
  status,
  vaccination_site,
  is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000100',
  'b0000010-0000-0000-0000-000000000000', -- Yellow Fever
  1,
  '2024-08-10',
  'c0000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'completed',
  'right-arm-upper',
  TRUE
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. VACCINATION EVENTS FOR KOJO ASANTE (CHILD-002) - Incomplete
-- ============================================================================

-- BCG
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000101', 'b0000000-0000-0000-0000-000000000001', 1, '2024-04-25', 'c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'completed', 'left-arm-upper', TRUE
)
ON CONFLICT DO NOTHING;

-- OPV-0
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000101', 'b0000000-0000-0000-0000-000000000002', 1, '2024-04-25', 'c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'completed', 'oral', TRUE
)
ON CONFLICT DO NOTHING;

-- OPV-1
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000101', 'b0000000-0000-0000-0000-000000000003', 1, '2024-06-10', 'c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'completed', 'oral', TRUE
)
ON CONFLICT DO NOTHING;

-- DPT1
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000101', 'b0000000-0000-0000-0000-000000000006', 1, '2024-06-10', 'c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'completed', 'left-thigh', TRUE
)
ON CONFLICT DO NOTHING;

-- DPT2
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000101', 'b0000000-0000-0000-0000-000000000007', 2, '2024-07-20', 'c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'completed', 'right-thigh', TRUE
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. VACCINATION EVENTS FOR ZARA ASANTE (CHILD-003) - Complete
-- ============================================================================

-- BCG
INSERT INTO vaccination_events (
  child_id, vaccine_id, dose_number, administered_date, administered_by_user_id, facility_id, status, vaccination_site, is_synced
) VALUES (
  'c1000000-0000-0000-0000-000000000102', 'b0000000-0000-0000-0000-000000000001', 1, '2022-01-18', 'c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'completed', 'left-arm-upper', TRUE
)
ON CONFLICT DO NOTHING;

-- OPV series, DPT series, PCV, MR1 (all completed - not listing all for brevity)

-- ============================================================================
-- 8. CERTIFICATES
-- ============================================================================

-- Certificate for Esi Boadu (CHILD-001) - Complete
INSERT INTO certificates (
  id,
  certificate_id,
  child_id,
  qr_payload,
  issued_date,
  issued_by_user_id,
  issued_by_facility_id,
  completion_status,
  vaccines_completed,
  status,
  last_verified_at
) VALUES (
  'e0000000-0000-0000-0000-000000000100',
  'CERT-GH-2025-001234',
  'c1000000-0000-0000-0000-000000000100',
  'QRC-CERT-C9X4M7N2P5R8T1V6K3L0',
  '2025-10-12',
  'c0000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Complete',
  ARRAY['BCG', 'OPV0', 'OPV1', 'OPV2', 'DPT1', 'DPT2', 'DPT3', 'MR1', 'Yellow Fever'],
  'issued',
  '2025-11-15 14:22:00+00'
)
ON CONFLICT (certificate_id) DO NOTHING;

-- Certificate for Kojo Asante (CHILD-002) - Partial
INSERT INTO certificates (
  id,
  certificate_id,
  child_id,
  qr_payload,
  issued_date,
  issued_by_user_id,
  issued_by_facility_id,
  completion_status,
  vaccines_completed,
  status,
  last_verified_at
) VALUES (
  'e0000000-0000-0000-0000-000000000101',
  'CERT-GH-2025-001567',
  'c1000000-0000-0000-0000-000000000101',
  'QRC-CERT-H6Q1Z8D4F7K2N5P9T3R0',
  '2025-09-02',
  'c0000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Partial',
  ARRAY['BCG', 'OPV0', 'OPV1', 'DPT1', 'DPT2'],
  'draft',
  NULL
)
ON CONFLICT (certificate_id) DO NOTHING;

-- Certificate for Zara Asante (CHILD-003) - Complete
INSERT INTO certificates (
  id,
  certificate_id,
  child_id,
  qr_payload,
  issued_date,
  issued_by_user_id,
  issued_by_facility_id,
  completion_status,
  vaccines_completed,
  status,
  last_verified_at
) VALUES (
  'e0000000-0000-0000-0000-000000000102',
  'CERT-GH-2025-002045',
  'c1000000-0000-0000-0000-000000000102',
  'QRC-CERT-P4V9M2X7L1C8R5N6D3T0',
  '2025-08-20',
  'c0000000-0000-0000-0000-000000000001',
  '33333333-3333-3333-3333-333333333333',
  'Complete',
  ARRAY['BCG', 'OPV0', 'OPV1', 'OPV2', 'DPT1', 'DPT2', 'DPT3', 'PCV', 'MR1'],
  'issued',
  '2025-10-28 09:10:00+00'
)
ON CONFLICT (certificate_id) DO NOTHING;

-- ============================================================================
-- 9. APPOINTMENTS
-- ============================================================================

-- Upcoming appointment for Esi Boadu
INSERT INTO appointments (
  child_id,
  guardian_id,
  facility_id,
  scheduled_date,
  scheduled_time,
  status,
  notes
) VALUES (
  'c1000000-0000-0000-0000-000000000100',
  'a1000000-0000-0000-0000-000000000100',
  '11111111-1111-1111-1111-111111111111',
  '2025-03-05',
  '10:00:00',
  'scheduled',
  'Arrive 15 minutes early for triage. Bring health record booklet.'
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. MISSED/OVERDUE VACCINATIONS
-- ============================================================================

-- Hepatitis B 3rd dose - Due Feb 12, 2025 (14 days overdue as of Feb 26, 2025)
-- Note: Not administered yet, creating a scheduled entry that's overdue

-- Vitamin A Supplement - Due Jan 28, 2025 (29 days overdue as of Feb 26, 2025)
-- Note: Not administered yet, creating a scheduled entry that's overdue

-- ============================================================================
-- 11. NOTIFICATIONS
-- ============================================================================

-- Appointment reminder notification
INSERT INTO notifications (
  template_id,
  recipient_type,
  recipient_id,
  channel,
  recipient_contact,
  subject,
  message,
  status,
  sent_at,
  delivered_at,
  metadata
) VALUES (
  'appointment_reminder',
  'guardian',
  'a1000000-0000-0000-0000-000000000100',
  'sms',
  '+233 24 123 4567',
  'Appointment Reminder',
  'Reminder: Esi Boadu has an appointment tomorrow at 10:00 AM. Location: Accra Central Health Center',
  'delivered',
  '2025-03-04 08:00:00+00',
  '2025-03-04 08:00:15+00',
  '{"child_id": "c1000000-0000-0000-0000-000000000100", "appointment_date": "2025-03-05"}'::jsonb
)
ON CONFLICT DO NOTHING;

-- Missed dose notification - Hepatitis B 3rd dose (14 days overdue)
INSERT INTO notifications (
  template_id,
  recipient_type,
  recipient_id,
  channel,
  recipient_contact,
  subject,
  message,
  status,
  sent_at,
  delivered_at,
  metadata
) VALUES (
  'missed_vaccination',
  'guardian',
  'a1000000-0000-0000-0000-000000000100',
  'sms',
  '+233 24 123 4567',
  'Missed Vaccination Alert',
  'URGENT: Esi Boadu missed Hepatitis B (3rd dose) due on Feb 12, 2025. Now 14 days overdue. Please schedule immediately. Ensure child is not running a fever. Bring health record booklet.',
  'delivered',
  '2025-02-13 09:00:00+00',
  '2025-02-13 09:00:22+00',
  '{"child_id": "c1000000-0000-0000-0000-000000000100", "vaccine": "Hepatitis B 3", "due_date": "2025-02-12", "days_overdue": 14}'::jsonb
)
ON CONFLICT DO NOTHING;

-- Missed dose notification - Vitamin A Supplement (29 days overdue)
INSERT INTO notifications (
  template_id,
  recipient_type,
  recipient_id,
  channel,
  recipient_contact,
  subject,
  message,
  status,
  sent_at,
  delivered_at,
  metadata
) VALUES (
  'missed_vaccination',
  'guardian',
  'a1000000-0000-0000-0000-000000000100',
  'sms',
  '+233 24 123 4567',
  'Missed Supplement Alert',
  'URGENT: Esi Boadu missed Vitamin A Supplement due on Jan 28, 2025. Now 29 days overdue. Please visit clinic immediately. Ensure child is not running a fever. Bring health record booklet.',
  'delivered',
  '2025-01-29 09:00:00+00',
  '2025-01-29 09:00:18+00',
  '{"child_id": "c1000000-0000-0000-0000-000000000100", "vaccine": "Vitamin A", "due_date": "2025-01-28", "days_overdue": 29}'::jsonb
)
ON CONFLICT DO NOTHING;

-- Follow-up reminder - Hepatitis B overdue
INSERT INTO notifications (
  template_id,
  recipient_type,
  recipient_id,
  channel,
  recipient_contact,
  subject,
  message,
  status,
  sent_at,
  delivered_at,
  metadata
) VALUES (
  'missed_vaccination_reminder',
  'guardian',
  'a1000000-0000-0000-0000-000000000100',
  'sms',
  '+233 24 123 4567',
  'Vaccination Still Pending',
  'Reminder: Hepatitis B (3rd dose) for Esi Boadu is still pending. Call Accra Central Health Center at +233 XX XXX XXXX to schedule.',
  'delivered',
  '2025-02-19 10:00:00+00',
  '2025-02-19 10:00:11+00',
  '{"child_id": "c1000000-0000-0000-0000-000000000100", "vaccine": "Hepatitis B 3", "days_overdue": 7}'::jsonb
)
ON CONFLICT DO NOTHING;

-- Follow-up reminder - Vitamin A overdue
INSERT INTO notifications (
  template_id,
  recipient_type,
  recipient_id,
  channel,
  recipient_contact,
  subject,
  message,
  status,
  sent_at,
  delivered_at,
  metadata
) VALUES (
  'missed_vaccination_reminder',
  'guardian',
  'a1000000-0000-0000-0000-000000000100',
  'sms',
  '+233 24 123 4567',
  'Supplement Still Pending',
  'Reminder: Vitamin A Supplement for Esi Boadu is still pending. Call Accra Central Health Center at +233 XX XXX XXXX to schedule.',
  'delivered',
  '2025-02-04 10:00:00+00',
  '2025-02-04 10:00:09+00',
  '{"child_id": "c1000000-0000-0000-0000-000000000100", "vaccine": "Vitamin A", "days_overdue": 7}'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- END OF AKOSUA ASANTE DEMO DATA
-- ============================================================================
