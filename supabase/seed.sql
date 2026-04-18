-- ============================================================================
-- Ghana Child Vaccination System - Seed Data (Nungua Scope)
-- Database: PostgreSQL (Supabase)
-- Scope: Nungua and surrounding communities, Greater Accra
-- ============================================================================

-- ============================================================================
-- 1. SEED BRANCHES (Health Facilities)
-- ============================================================================

INSERT INTO branches (id, name, code, region, district, address, phone, email, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Nungua Health Centre', 'BR-NUN-01', 'Greater Accra', 'Ledzokuku-Krowor', 'Nungua Barrier, Accra', '+233 302 711 234', 'nungua.hc@ghs.gov.gh', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Sakumono Polyclinic', 'BR-SAK-01', 'Greater Accra', 'Ledzokuku-Krowor', 'Sakumono Estate, Accra', '+233 302 712 100', 'sakumono.poly@ghs.gov.gh', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'Teshie Community Clinic', 'BR-TES-01', 'Greater Accra', 'Ledzokuku-Krowor', 'Teshie-Nungua, Accra', '+233 302 713 200', 'teshie.clinic@ghs.gov.gh', 'active');

-- ============================================================================
-- 2. SEED USERS
-- ============================================================================

-- HQ Admin (Greater Accra Regional Health Directorate)
INSERT INTO users (id, email, phone, full_name, role, status, branch_id) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin@health.gov.gh', '+233 302 111 000', 'Akua Mensimah', 'hq-admin', 'active', NULL);

-- Branch Managers
INSERT INTO users (id, email, phone, full_name, role, status, branch_id) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'branch.manager@health.gov.gh', '+233 302 711 201', 'Yaa Nartey', 'branch-manager', 'active', '11111111-1111-1111-1111-111111111111'),
  ('b0000000-0000-0000-0000-000000000002', 'kofi.sakumono@health.gov.gh', '+233 302 712 101', 'Kofi Tetteh', 'branch-manager', 'active', '22222222-2222-2222-2222-222222222222');

-- Facility Nurses
INSERT INTO users (id, email, phone, full_name, role, status, branch_id) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'nurse@health.gov.gh', '+233 302 711 250', 'Abena Osei', 'facility-nurse', 'active', '11111111-1111-1111-1111-111111111111'),
  ('c0000000-0000-0000-0000-000000000002', 'nurse.sakumono@health.gov.gh', '+233 302 712 150', 'Efua Quartey', 'facility-nurse', 'active', '22222222-2222-2222-2222-222222222222');

-- Community Health Workers
INSERT INTO users (id, email, phone, full_name, role, status, branch_id) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'chw@health.gov.gh', '+233 247 100 200', 'Mabel Laryea', 'chw', 'active', '11111111-1111-1111-1111-111111111111'),
  ('d0000000-0000-0000-0000-000000000002', 'ama.nungua@health.gov.gh', '+233 247 100 201', 'Ama Tetteh', 'chw', 'active', '11111111-1111-1111-1111-111111111111'),
  ('d0000000-0000-0000-0000-000000000003', 'kweku.teshie@health.gov.gh', '+233 247 200 300', 'Kweku Nortey', 'chw', 'active', '33333333-3333-3333-3333-333333333333');

-- ============================================================================
-- 3. UPDATE BRANCH MANAGERS
-- ============================================================================

UPDATE branches SET manager_id = 'b0000000-0000-0000-0000-000000000001' WHERE id = '11111111-1111-1111-1111-111111111111';
UPDATE branches SET manager_id = 'b0000000-0000-0000-0000-000000000002' WHERE id = '22222222-2222-2222-2222-222222222222';

-- ============================================================================
-- 4. SEED CATCHMENT AREAS
-- ============================================================================

INSERT INTO catchment_areas (id, name, code, branch_id, community, population_estimate, assigned_chw_id) VALUES
  ('ca000000-0000-0000-0000-000000000001', 'Nungua Barrier Zone', 'CA-NUN-01', '11111111-1111-1111-1111-111111111111', 'Nungua Barrier', 12000, 'd0000000-0000-0000-0000-000000000001'),
  ('ca000000-0000-0000-0000-000000000002', 'Sakumono Estate Zone', 'CA-SAK-01', '22222222-2222-2222-2222-222222222222', 'Sakumono Estate', 14000, 'd0000000-0000-0000-0000-000000000002'),
  ('ca000000-0000-0000-0000-000000000003', 'Teshie-Nungua Zone', 'CA-TES-01', '33333333-3333-3333-3333-333333333333', 'Teshie-Nungua', 16000, 'd0000000-0000-0000-0000-000000000003');

-- ============================================================================
-- 5. SEED GUARDIANS (MOTHERS)
-- ============================================================================

INSERT INTO guardians (id, full_name, phone_primary, phone_alternate, email, ghana_card_number, address_line1, landmark, city, region, community, catchment_area_id, preferred_contact, created_by_user_id) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Akosua Mensah', '+233 245 001 100', NULL, NULL, 'GHA-123456789-0', 'House 12, Nungua Barrier Road', 'Near Nungua Health Centre', 'Accra', 'Greater Accra', 'Nungua Barrier', 'ca000000-0000-0000-0000-000000000001', 'sms', 'c0000000-0000-0000-0000-000000000001'),
  ('a1000000-0000-0000-0000-000000000002', 'Abena Boateng', '+233 247 889 221', NULL, 'abena@example.com', NULL, 'House 10, Nungua Estates', 'Junction by Clinic', 'Accra', 'Greater Accra', 'Nungua Barrier', 'ca000000-0000-0000-0000-000000000001', 'sms', 'c0000000-0000-0000-0000-000000000001'),
  ('a1000000-0000-0000-0000-000000000003', 'Mabel Owusu', '+233 505 221 456', NULL, NULL, NULL, 'House 5, Sakumono Estate', 'Sakumono Roundabout', 'Accra', 'Greater Accra', 'Sakumono Estate', 'ca000000-0000-0000-0000-000000000002', 'sms', 'c0000000-0000-0000-0000-000000000001'),
  ('a1000000-0000-0000-0000-000000000004', 'Adwoa Nortey', '+233 247 200 400', NULL, 'adwoa@example.com', 'GHA-987654321-1', 'House 20, Teshie Old Town', 'Near Teshie Clinic', 'Accra', 'Greater Accra', 'Teshie-Nungua', 'ca000000-0000-0000-0000-000000000003', 'sms', 'c0000000-0000-0000-0000-000000000002');

-- Parent portal user for one guardian
INSERT INTO users (id, email, phone, full_name, role, status) VALUES
  ('a0000000-0000-0000-0000-000000000010', 'parent@example.com', '+233 247 889 221', 'Abena Boateng', 'parent', 'active');

UPDATE guardians SET user_id = 'a0000000-0000-0000-0000-000000000010' WHERE id = 'a1000000-0000-0000-0000-000000000002';

-- ============================================================================
-- 6. SEED CHILDREN
-- ============================================================================

INSERT INTO children (id, cvcc_id, qr_code_payload, full_name, date_of_birth, gender, birth_weight, birth_length, place_of_birth, delivery_type, blood_type, primary_facility_id, allergies, created_by_user_id) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'CH-2025-001', 'CH-2025-001|Kwame Boateng|2025-07-18', 'Kwame Boateng', '2025-07-18', 'male', 3.2, 49.0, 'Nungua Health Centre', 'Spontaneous vaginal', 'O+', '11111111-1111-1111-1111-111111111111', ARRAY['Penicillin'], 'c0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000002', 'CH-2025-002', 'CH-2025-002|Efua Agyeman|2025-02-02', 'Efua Agyeman', '2025-02-02', 'female', 3.0, 48.5, 'Nungua Health Centre', 'Spontaneous vaginal', 'A+', '11111111-1111-1111-1111-111111111111', ARRAY[]::TEXT[], 'c0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000003', 'CH-2025-003', 'CH-2025-003|Esi Mensah|2024-03-12', 'Esi Mensah', '2024-03-12', 'female', 3.4, 50.0, 'Nungua Health Centre', 'Caesarean section', 'B+', '11111111-1111-1111-1111-111111111111', ARRAY[]::TEXT[], 'c0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000004', 'CH-2025-004', 'CH-2025-004|Yaw Asare|2025-05-10', 'Yaw Asare', '2025-05-10', 'male', 3.1, 49.2, 'Nungua Health Centre', 'Spontaneous vaginal', 'O+', '11111111-1111-1111-1111-111111111111', ARRAY[]::TEXT[], 'c0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000005', 'CH-2025-005', 'CH-2025-005|Adwoa Nortey Jr|2025-08-20', 'Adwoa Nortey Jr', '2025-08-20', 'female', 2.9, 47.5, 'Teshie Community Clinic', 'Spontaneous vaginal', 'AB+', '33333333-3333-3333-3333-333333333333', ARRAY[]::TEXT[], 'c0000000-0000-0000-0000-000000000002');

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

INSERT INTO vaccination_schedules (vaccine_id, dose_number, schedule_name, due_days_from_birth, is_mandatory, sort_order) VALUES
  -- At birth
  ('b0000000-0000-0000-0000-000000000001', 1, 'At birth', 0, TRUE, 1),
  ('b0000000-0000-0000-0000-000000000002', 1, 'At birth', 0, TRUE, 2),
  -- 6 weeks
  ('b0000000-0000-0000-0000-000000000003', 1, '6 weeks', 42, TRUE, 3),
  ('b0000000-0000-0000-0000-000000000006', 1, '6 weeks', 42, TRUE, 4),
  ('b0000000-0000-0000-0000-000000000009', 1, '6 weeks', 42, TRUE, 5),
  ('b000000c-0000-0000-0000-000000000000', 1, '6 weeks', 42, TRUE, 6),
  -- 10 weeks
  ('b0000000-0000-0000-0000-000000000004', 2, '10 weeks', 70, TRUE, 7),
  ('b0000000-0000-0000-0000-000000000007', 2, '10 weeks', 70, TRUE, 8),
  ('b000000a-0000-0000-0000-000000000000', 2, '10 weeks', 70, TRUE, 9),
  ('b000000d-0000-0000-0000-000000000000', 2, '10 weeks', 70, TRUE, 10),
  -- 14 weeks
  ('b0000000-0000-0000-0000-000000000005', 3, '14 weeks', 98, TRUE, 11),
  ('b0000000-0000-0000-0000-000000000008', 3, '14 weeks', 98, TRUE, 12),
  ('b000000b-0000-0000-0000-000000000000', 3, '14 weeks', 98, TRUE, 13),
  -- 9 months
  ('b000000e-0000-0000-0000-000000000000', 1, '9 months', 270, TRUE, 14),
  ('b0000010-0000-0000-0000-000000000000', 1, '9 months', 270, TRUE, 15),
  ('b0000011-0000-0000-0000-000000000000', 1, '9 months', 270, TRUE, 16),
  -- 18 months
  ('b000000f-0000-0000-0000-000000000000', 2, '18 months', 540, TRUE, 17);

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
  ('system_name', 'general', '{"value": "Child Vaccination Command Center"}', 'System display name', TRUE),
  ('national_helpline', 'general', '{"value": "+233 302 711 234"}', 'Facility helpline number (Nungua Health Centre)', TRUE);

-- ============================================================================
-- END OF SEED DATA
-- ============================================================================
