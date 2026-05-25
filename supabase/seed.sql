-- ============================================================================
-- Ghana Child Vaccination System - Seed Data
-- Database: PostgreSQL (Supabase)
-- Generated: January 1, 2026
-- ============================================================================

-- ============================================================================
-- 1. SEED BRANCHES (Health Facilities)
-- ============================================================================

INSERT INTO branches (id, name, code, region, district, address, phone, email, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Accra Central Hospital', 'BR-001', 'Greater Accra', 'Accra Metro', 'Independence Avenue, Accra', '+233 302 665 401', 'info@accrach.gov.gh', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Tamale Teaching Hospital', 'BR-014', 'Northern', 'Tamale Metro', 'Hospital Road, Tamale', '+233 372 022 451', 'info@tth.gov.gh', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'Kumasi South Hospital', 'BR-007', 'Ashanti', 'Kumasi Metro', 'Adum Street, Kumasi', '+233 322 024 567', 'kumasi.south@health.gov.gh', 'active'),
  ('44444444-4444-4444-4444-444444444444', 'Cape Coast Teaching Hospital', 'BR-010', 'Central', 'Cape Coast Metro', 'Commercial Road, Cape Coast', '+233 332 132 330', 'capecth@health.gov.gh', 'active');

-- ============================================================================
-- 2. SEED USERS
-- ============================================================================

-- HQ Admin
INSERT INTO users (id, email, phone, full_name, role, status, branch_id) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin@health.gov.gh', '+233 302 111 000', 'Akua Mensimah', 'hq-admin', 'active', NULL);

-- Branch Managers
INSERT INTO users (id, email, phone, full_name, role, status, branch_id) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'branch.manager@health.gov.gh', '+233 302 111 001', 'Yaa Boakye', 'branch-manager', 'active', '11111111-1111-1111-1111-111111111111'),
  ('b0000000-0000-0000-0000-000000000002', 'haruna.yakubu@health.gov.gh', '+233 372 022 500', 'Haruna Yakubu', 'branch-manager', 'active', '22222222-2222-2222-2222-222222222222');

-- Facility Nurses
INSERT INTO users (id, email, phone, full_name, role, status, branch_id) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'nurse@health.gov.gh', '+233 302 665 450', 'Abena Nurse', 'facility-nurse', 'active', '11111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-000000000002', 'nurse.tamale@health.gov.gh', '+233 372 022 460', 'Fatima Alhassan', 'facility-nurse', 'active', '22222222-2222-2222-2222-222222222222');

-- Community Health Workers
INSERT INTO users (id, email, phone, full_name, role, status, branch_id) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'chw@health.gov.gh', '+233 247 100 200', 'Mabel Owusu', 'chw', 'active', '11111111-1111-1111-1111-111111111111'),
  ('d0000000-0000-0000-0000-000000000002', 'kwesi.antwi@health.gov.gh', '+233 247 100 201', 'Kwesi Antwi', 'chw', 'active', '11111111-1111-1111-1111-111111111111'),
  ('d0000000-0000-0000-0000-000000000003', 'zeinab.yakubu@health.gov.gh', '+233 247 200 300', 'Zeinab Yakubu', 'chw', 'active', '22222222-2222-2222-2222-222222222222');

-- Data Officers
INSERT INTO users (id, email, phone, full_name, role, status, branch_id) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'data.officer@health.gov.gh', '+233 302 111 002', 'Kofi Antwi', 'data-officer', 'active', NULL);

-- Public Health Authority
INSERT INTO users (id, email, phone, full_name, role, status, branch_id) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'pha@health.gov.gh', '+233 302 111 003', 'Dr. Adjoa Asante', 'pha', 'active', NULL);

-- ============================================================================
-- 3. UPDATE BRANCH MANAGERS
-- ============================================================================

UPDATE branches SET manager_id = 'b0000000-0000-0000-0000-000000000001' WHERE id = '11111111-1111-1111-1111-111111111111';
UPDATE branches SET manager_id = 'b0000000-0000-0000-0000-000000000002' WHERE id = '22222222-2222-2222-2222-222222222222';

-- ============================================================================
-- 4. SEED CATCHMENT AREAS
-- ============================================================================

INSERT INTO catchment_areas (id, name, code, branch_id, community, population_estimate, assigned_chw_id) VALUES
  ('ca000000-0000-0000-0000-000000000001', 'Adabraka Zone', 'CA-ACC-01', '11111111-1111-1111-1111-111111111111', 'Adabraka', 15000, 'd0000000-0000-0000-0000-000000000001'),
  ('ca000000-0000-0000-0000-000000000002', 'Osu Zone', 'CA-ACC-02', '11111111-1111-1111-1111-111111111111', 'Osu', 18000, 'd0000000-0000-0000-0000-000000000002'),
  ('ca000000-0000-0000-0000-000000000003', 'Tamale Central', 'CA-TAM-01', '22222222-2222-2222-2222-222222222222', 'Tamale Central', 22000, 'd0000000-0000-0000-0000-000000000003');

-- ============================================================================
-- 5. SEED GUARDIANS (MOTHERS)
-- ============================================================================

INSERT INTO guardians (id, full_name, phone_primary, phone_alternate, email, ghana_card_number, address_line1, landmark, city, region, community, catchment_area_id, preferred_contact, created_by_user_id) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Akosua Mensah', '+233 245 001 100', NULL, NULL, 'GHA-123456789-0', 'House 12, Zongo Lane', 'Jakpa Junction', 'Accra', 'Greater Accra', 'Adabraka', 'ca000000-0000-0000-0000-000000000001', 'sms', 'c0000000-0000-0000-0000-000000000001'),
  ('a1000000-0000-0000-0000-000000000002', 'Abena Boateng', '+233 247 889 221', NULL, 'abena@example.com', NULL, 'House 10, Jakpa North', 'Near Clinic', 'Accra', 'Greater Accra', 'Adabraka', 'ca000000-0000-0000-0000-000000000001', 'sms', 'c0000000-0000-0000-0000-000000000001'),
  ('a1000000-0000-0000-0000-000000000003', 'Mabel Owusu', '+233 505 221 456', NULL, NULL, NULL, 'House 5, Riverside', 'Bole Market', 'Accra', 'Greater Accra', 'Osu', 'ca000000-0000-0000-0000-000000000002', 'sms', 'c0000000-0000-0000-0000-000000000001'),
  ('a1000000-0000-0000-0000-000000000004', 'Fatima Ibrahim', '+233 247 200 400', NULL, 'fatima@example.com', 'GHA-987654321-1', 'House 20, Market Street', 'Central Mosque', 'Tamale', 'Northern', 'Tamale Central', 'ca000000-0000-0000-0000-000000000003', 'sms', 'c0000000-0000-0000-0000-000000000002');

-- Parent portal user for one guardian
INSERT INTO users (id, email, phone, full_name, role, status) VALUES
  ('a0000000-0000-0000-0000-000000000010', 'parent@example.com', '+233 247 889 221', 'Abena Boateng', 'parent', 'active');

UPDATE guardians SET user_id = 'a0000000-0000-0000-0000-000000000010' WHERE id = 'a1000000-0000-0000-0000-000000000002';

-- ============================================================================
-- 6. SEED CHILDREN
-- ============================================================================

INSERT INTO schedule_versions (id, name, version_number, effective_from, status, notes) VALUES
  ('11111111-2222-3333-4444-555555555555', 'Ghana EPI Schedule v1', 1, '2025-01-01', 'active', 'Initial Ghana national immunization schedule.');

INSERT INTO children (id, cvcc_id, qr_code_payload, full_name, date_of_birth, gender, birth_weight, birth_length, place_of_birth, delivery_type, blood_type, primary_facility_id, schedule_version_id, allergies, created_by_user_id) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'CH-2025-001', 'CH-2025-001|Kwame Boateng|2025-07-18', 'Kwame Boateng', '2025-07-18', 'male', 3.2, 49.0, 'Jakpa District Hospital', 'Spontaneous vaginal', 'O+', '11111111-1111-1111-1111-111111111111', '11111111-2222-3333-4444-555555555555', ARRAY['Penicillin'], 'c0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000002', 'CH-2025-002', 'CH-2025-002|Efua Agyeman|2025-02-02', 'Efua Agyeman', '2025-02-02', 'female', 3.0, 48.5, 'Accra Central Hospital', 'Spontaneous vaginal', 'A+', '11111111-1111-1111-1111-111111111111', '11111111-2222-3333-4444-555555555555', ARRAY[]::TEXT[], 'c0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000003', 'CH-2025-003', 'CH-2025-003|Esi Mensah|2024-03-12', 'Esi Mensah', '2024-03-12', 'female', 3.4, 50.0, 'Accra Central Hospital', 'Caesarean section', 'B+', '11111111-1111-1111-1111-111111111111', '11111111-2222-3333-4444-555555555555', ARRAY[]::TEXT[], 'c0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000004', 'CH-2025-004', 'CH-2025-004|Yaw Asare|2025-05-10', 'Yaw Asare', '2025-05-10', 'male', 3.1, 49.2, 'Accra Central Hospital', 'Spontaneous vaginal', 'O+', '11111111-1111-1111-1111-111111111111', '11111111-2222-3333-4444-555555555555', ARRAY[]::TEXT[], 'c0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000005', 'CH-2025-005', 'CH-2025-005|Amina Ibrahim|2025-08-20', 'Amina Ibrahim', '2025-08-20', 'female', 2.9, 47.5, 'Tamale Teaching Hospital', 'Spontaneous vaginal', 'AB+', '22222222-2222-2222-2222-222222222222', '11111111-2222-3333-4444-555555555555', ARRAY[]::TEXT[], 'c0000000-0000-0000-0000-000000000002');

-- ============================================================================
-- 7. SEED CHILD-GUARDIAN RELATIONSHIPS
-- ============================================================================

INSERT INTO child_guardian (child_id, guardian_id, relationship, is_primary) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 'Mother', TRUE),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'Mother', TRUE),
  ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'Mother', TRUE),
  ('c1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000003', 'Mother', TRUE),
  ('c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000004', 'Mother', TRUE);

-- ============================================================================
-- 8. SEED VACCINES (Ghana National Immunization Schedule)
-- ============================================================================

INSERT INTO vaccines (id, code, name, description, status) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'VAC-BCG', 'BCG', 'Bacillus Calmette-Guérin (Tuberculosis)', 'active'),
  ('b0000000-0000-0000-0000-000000000002', 'VAC-OPV0', 'OPV-0', 'Oral Polio Vaccine (Birth dose)', 'active'),
  ('b0000000-0000-0000-0000-000000000003', 'VAC-OPV1', 'OPV-1', 'Oral Polio Vaccine (1st dose)', 'active'),
  ('b0000000-0000-0000-0000-000000000004', 'VAC-OPV2', 'OPV-2', 'Oral Polio Vaccine (2nd dose)', 'active'),
  ('b0000000-0000-0000-0000-000000000005', 'VAC-OPV3', 'OPV-3', 'Oral Polio Vaccine (3rd dose)', 'active'),
  ('b0000000-0000-0000-0000-000000000006', 'VAC-PENTA1', 'Pentavalent-1', 'DPT-HepB-Hib (1st dose)', 'active'),
  ('b0000000-0000-0000-0000-000000000007', 'VAC-PENTA2', 'Pentavalent-2', 'DPT-HepB-Hib (2nd dose)', 'active'),
  ('b0000000-0000-0000-0000-000000000008', 'VAC-PENTA3', 'Pentavalent-3', 'DPT-HepB-Hib (3rd dose)', 'active'),
  ('b0000000-0000-0000-0000-000000000009', 'VAC-PCV1', 'PCV-1', 'Pneumococcal Conjugate Vaccine (1st dose)', 'active'),
  ('b000000a-0000-0000-0000-000000000000', 'VAC-PCV2', 'PCV-2', 'Pneumococcal Conjugate Vaccine (2nd dose)', 'active'),
  ('b000000b-0000-0000-0000-000000000000', 'VAC-PCV3', 'PCV-3', 'Pneumococcal Conjugate Vaccine (3rd dose)', 'active'),
  ('b000000c-0000-0000-0000-000000000000', 'VAC-RV1', 'Rotavirus-1', 'Rotavirus Vaccine (1st dose)', 'active'),
  ('b000000d-0000-0000-0000-000000000000', 'VAC-RV2', 'Rotavirus-2', 'Rotavirus Vaccine (2nd dose)', 'active'),
  ('b000000e-0000-0000-0000-000000000000', 'VAC-MR1', 'Measles-Rubella-1', 'Measles-Rubella (1st dose)', 'active'),
  ('b000000f-0000-0000-0000-000000000000', 'VAC-MR2', 'Measles-Rubella-2', 'Measles-Rubella (2nd dose)', 'active'),
  ('b0000010-0000-0000-0000-000000000000', 'VAC-YF', 'Yellow Fever', 'Yellow Fever Vaccine', 'active'),
  ('b0000011-0000-0000-0000-000000000000', 'VAC-MENING', 'Meningococcal A', 'Meningococcal A Conjugate Vaccine', 'active');

-- ============================================================================
-- 9. SEED VACCINATION SCHEDULES (Ghana National Schedule)
-- ============================================================================

INSERT INTO vaccination_schedules (schedule_version_id, vaccine_id, dose_number, schedule_name, due_days_from_birth, is_mandatory, sort_order) VALUES
  -- At birth
  ('11111111-2222-3333-4444-555555555555', 'b0000000-0000-0000-0000-000000000001', 1, 'At birth', 0, TRUE, 1),   -- BCG
  ('11111111-2222-3333-4444-555555555555', 'b0000000-0000-0000-0000-000000000002', 1, 'At birth', 0, TRUE, 2),   -- OPV-0
  
  -- 6 weeks
  ('11111111-2222-3333-4444-555555555555', 'b0000000-0000-0000-0000-000000000003', 1, '6 weeks', 42, TRUE, 3),   -- OPV-1
  ('11111111-2222-3333-4444-555555555555', 'b0000000-0000-0000-0000-000000000006', 1, '6 weeks', 42, TRUE, 4),   -- Penta-1
  ('11111111-2222-3333-4444-555555555555', 'b0000000-0000-0000-0000-000000000009', 1, '6 weeks', 42, TRUE, 5),   -- PCV-1
  ('11111111-2222-3333-4444-555555555555', 'b000000c-0000-0000-0000-000000000000', 1, '6 weeks', 42, TRUE, 6),   -- Rotavirus-1
  
  -- 10 weeks
  ('11111111-2222-3333-4444-555555555555', 'b0000000-0000-0000-0000-000000000004', 2, '10 weeks', 70, TRUE, 7),  -- OPV-2
  ('11111111-2222-3333-4444-555555555555', 'b0000000-0000-0000-0000-000000000007', 2, '10 weeks', 70, TRUE, 8),  -- Penta-2
  ('11111111-2222-3333-4444-555555555555', 'b000000a-0000-0000-0000-000000000000', 2, '10 weeks', 70, TRUE, 9),  -- PCV-2
  ('11111111-2222-3333-4444-555555555555', 'b000000d-0000-0000-0000-000000000000', 2, '10 weeks', 70, TRUE, 10), -- Rotavirus-2
  
  -- 14 weeks
  ('11111111-2222-3333-4444-555555555555', 'b0000000-0000-0000-0000-000000000005', 3, '14 weeks', 98, TRUE, 11), -- OPV-3
  ('11111111-2222-3333-4444-555555555555', 'b0000000-0000-0000-0000-000000000008', 3, '14 weeks', 98, TRUE, 12), -- Penta-3
  ('11111111-2222-3333-4444-555555555555', 'b000000b-0000-0000-0000-000000000000', 3, '14 weeks', 98, TRUE, 13), -- PCV-3
  
  -- 9 months
  ('11111111-2222-3333-4444-555555555555', 'b000000e-0000-0000-0000-000000000000', 1, '9 months', 270, TRUE, 14), -- MR-1
  ('11111111-2222-3333-4444-555555555555', 'b0000010-0000-0000-0000-000000000000', 1, '9 months', 270, TRUE, 15), -- Yellow Fever
  ('11111111-2222-3333-4444-555555555555', 'b0000011-0000-0000-0000-000000000000', 1, '9 months', 270, TRUE, 16), -- Meningococcal A
  
  -- 18 months
  ('11111111-2222-3333-4444-555555555555', 'b000000f-0000-0000-0000-000000000000', 2, '18 months', 540, TRUE, 17); -- MR-2

-- ============================================================================
-- 10. SEED NOTIFICATION TEMPLATES
-- ============================================================================

INSERT INTO notification_templates (id, label, description, sms_template, email_template, variables, is_active) VALUES
  ('pre_due', 'Upcoming Dose Reminder', 'Sent 3 days before a scheduled vaccination', 
   'Hello {guardianName}, {childName} is due for {vaccineName} on {scheduledDate}. Please visit {facilityName}.',
   '<p>Dear {guardianName},</p><p>This is a reminder that {childName} is due for {vaccineName} on {scheduledDate}.</p><p>Facility: {facilityName}</p>',
   ARRAY['guardianName', 'childName', 'vaccineName', 'scheduledDate', 'facilityName'], TRUE),
   
  ('overdue', 'Overdue Alert', 'Sent when a vaccine is 3 days overdue',
   '{childName} has missed the {vaccineName} dose scheduled for {scheduledDate}. Please contact {facilityName} immediately.',
   '<p>Dear {guardianName},</p><p>{childName} has missed the {vaccineName} dose scheduled for {scheduledDate}. Kindly reach out to {facilityName} to reschedule.</p>',
   ARRAY['guardianName', 'childName', 'vaccineName', 'scheduledDate', 'facilityName'], TRUE),
   
  ('certificate', 'Certificate Issued', 'Sent when a child completes the national schedule',
   'Congratulations! {childName}''s vaccination certificate is ready. Access it via the Parent Portal or visit {facilityName}.',
   '<p>Dear {guardianName},</p><p>Congratulations! {childName} has completed the national immunisation schedule. The digital certificate is now available.</p>',
   ARRAY['guardianName', 'childName', 'facilityName'], TRUE),
   
  ('appointment_reminder', 'Appointment Reminder', 'Sent 1 day before appointment',
   'Reminder: {childName} has an appointment tomorrow at {appointmentTime} for {vaccineName}. Location: {facilityName}.',
   '<p>Dear {guardianName},</p><p>Reminder: {childName} has an appointment tomorrow at {appointmentTime} for {vaccineName}.</p><p>Location: {facilityName}</p>',
   ARRAY['guardianName', 'childName', 'appointmentTime', 'vaccineName', 'facilityName'], TRUE);

-- ============================================================================
-- 11. SEED SYSTEM SETTINGS
-- ============================================================================

INSERT INTO system_settings (id, category, value, description, is_public) VALUES
  ('sms_gateway', 'notifications', '{"provider": "africas_talking", "api_key": "", "sender_id": "GH_HEALTH"}', 'SMS gateway configuration', FALSE),
  ('email_service', 'notifications', '{"provider": "sendgrid", "api_key": "", "from_email": "noreply@health.gov.gh"}', 'Email service configuration', FALSE),
  ('reminder_days_before', 'notifications', '{"value": 3}', 'Send reminders X days before due date', TRUE),
  ('overdue_threshold_days', 'notifications', '{"value": 3}', 'Flag vaccine as overdue after X days', TRUE),
  ('duplicate_similarity_threshold', 'data_quality', '{"value": 80}', 'Minimum similarity score to flag duplicates (0-100)', FALSE),
  ('system_name', 'general', '{"value": "Ghana Child Vaccination Command Center"}', 'System display name', TRUE),
  ('national_helpline', 'general', '{"value": "+233 302 111 000"}', 'National helpline number', TRUE);

-- ============================================================================
-- END OF SEED DATA
-- ============================================================================
