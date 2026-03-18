-- ============================================================================
-- Ghana Child Vaccination System - Complete Database Schema
-- Database: PostgreSQL (Supabase)
-- Generated: January 1, 2026
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostGIS for geo-spatial features (optional but useful for catchment areas)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- 1. USERS & AUTHENTICATION
-- ============================================================================

-- User roles enum
CREATE TYPE user_role AS ENUM (
  'hq-admin',
  'branch-manager', 
  'facility-nurse',
  'chw',
  'data-officer',
  'pha',
  'parent'
);

-- User status enum
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');

-- Users table (all system users)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  full_name VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  status user_status DEFAULT 'active',
  branch_id UUID, -- FK to branches (nullable for HQ/PHA)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  password_hash VARCHAR(255), -- For non-Supabase auth
  profile_photo_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================================================
-- 2. ORGANIZATIONAL STRUCTURE
-- ============================================================================

-- Branches (health facilities)
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL, -- e.g., BR-001
  region VARCHAR(100) NOT NULL,
  district VARCHAR(100),
  address TEXT,
  gps_coordinates POINT, -- PostGIS point (latitude, longitude)
  phone VARCHAR(20),
  email VARCHAR(255),
  manager_id UUID, -- FK to users
  status user_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Catchment areas (territories for CHWs)
CREATE TABLE catchment_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  community VARCHAR(255),
  polygon GEOMETRY(POLYGON, 4326), -- PostGIS polygon for geo-boundaries
  population_estimate INTEGER,
  assigned_chw_id UUID, -- FK to users (CHW)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. MOTHERS/GUARDIANS
-- ============================================================================

-- Preferred contact method enum
CREATE TYPE contact_method AS ENUM ('sms', 'email', 'whatsapp');

-- Mothers/Guardians table
CREATE TABLE guardians (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL, -- Link to parent portal login
  full_name VARCHAR(255) NOT NULL,
  phone_primary VARCHAR(20) NOT NULL,
  phone_alternate VARCHAR(20),
  email VARCHAR(255),
  ghana_card_number VARCHAR(50),
  nhis_number VARCHAR(50),
  address_line1 TEXT NOT NULL,
  landmark TEXT,
  city VARCHAR(100) NOT NULL,
  region VARCHAR(100) NOT NULL,
  country VARCHAR(100) DEFAULT 'Ghana',
  postal_code VARCHAR(20),
  community VARCHAR(255),
  catchment_area_id UUID REFERENCES catchment_areas(id),
  preferred_contact contact_method DEFAULT 'sms',
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID REFERENCES users(id)
);

-- ============================================================================
-- 4. CHILDREN
-- ============================================================================

-- Gender enum
CREATE TYPE gender_type AS ENUM ('male', 'female', 'intersex', 'undisclosed');

-- Children table
CREATE TABLE children (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cvcc_id VARCHAR(50) UNIQUE NOT NULL, -- Child Vaccination Command Center ID (e.g., CH-2025-001)
  qr_code_payload TEXT UNIQUE NOT NULL, -- QR code data (JWT or signed JSON)
  full_name VARCHAR(255) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender gender_type NOT NULL,
  birth_weight DECIMAL(5, 2), -- kg
  birth_length DECIMAL(5, 2), -- cm
  head_circumference DECIMAL(5, 2), -- cm
  place_of_birth VARCHAR(255),
  delivery_type VARCHAR(100),
  birth_order VARCHAR(20),
  blood_type VARCHAR(5),
  primary_facility_id UUID REFERENCES branches(id),
  profile_photo_url TEXT,
  allergies TEXT[], -- Array of allergies
  critical_notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID REFERENCES users(id)
);

-- Child-Guardian relationship (many-to-many)
CREATE TABLE child_guardian (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  relationship VARCHAR(100) NOT NULL, -- e.g., "mother", "father", "grandmother"
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, guardian_id)
);

-- ============================================================================
-- 5. VACCINATION SCHEDULES & VACCINES
-- ============================================================================

-- Vaccine status enum
CREATE TYPE vaccine_status AS ENUM ('active', 'archived', 'discontinued');

-- Vaccines master catalog
CREATE TABLE vaccines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL, -- e.g., VAC-BCG, VAC-OPV1
  name VARCHAR(255) NOT NULL,
  description TEXT,
  manufacturer VARCHAR(255),
  status vaccine_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- National vaccination schedule (dosing rules)
CREATE TABLE vaccination_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vaccine_id UUID NOT NULL REFERENCES vaccines(id) ON DELETE CASCADE,
  dose_number INTEGER NOT NULL, -- e.g., 1, 2, 3
  schedule_name VARCHAR(255) NOT NULL, -- e.g., "At birth", "6 weeks", "14 weeks"
  due_days_from_birth INTEGER NOT NULL, -- Days after birth when dose is due
  min_age_days INTEGER, -- Minimum age in days
  max_age_days INTEGER, -- Maximum age in days
  is_mandatory BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 6. VACCINATION EVENTS (ACTUAL DOSES GIVEN)
-- ============================================================================

-- Vaccination site enum
CREATE TYPE vaccination_site AS ENUM (
  'left-arm-upper',
  'right-arm-upper',
  'left-thigh',
  'right-thigh',
  'oral',
  'intranasal',
  'other'
);

-- Vaccination status enum
CREATE TYPE vaccination_event_status AS ENUM ('completed', 'missed', 'refused', 'contraindicated');

-- Vaccination events (doses administered)
CREATE TABLE vaccination_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  vaccine_id UUID NOT NULL REFERENCES vaccines(id),
  dose_number INTEGER NOT NULL,
  administered_date DATE NOT NULL,
  administered_by_user_id UUID REFERENCES users(id), -- Nurse or CHW
  facility_id UUID REFERENCES branches(id),
  batch_number VARCHAR(100),
  lot_number VARCHAR(100),
  expiry_date DATE,
  manufacturer VARCHAR(255),
  vaccination_site vaccination_site,
  status vaccination_event_status DEFAULT 'completed',
  notes TEXT,
  gps_coordinates POINT, -- For CHW outreach vaccinations
  is_synced BOOLEAN DEFAULT TRUE, -- FALSE for offline-captured records
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. ADVERSE EVENTS FOLLOWING IMMUNIZATION (AEFI)
-- ============================================================================

-- AEFI severity enum
CREATE TYPE aefi_severity AS ENUM ('mild', 'moderate', 'severe', 'life-threatening');

-- AEFI status enum
CREATE TYPE aefi_status AS ENUM ('reported', 'under-review', 'investigated', 'resolved', 'escalated');

-- AEFI reports
CREATE TABLE aefi_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vaccination_event_id UUID NOT NULL REFERENCES vaccination_events(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id),
  reported_by_user_id UUID REFERENCES users(id),
  symptoms TEXT[] NOT NULL, -- Array of symptoms
  severity aefi_severity NOT NULL,
  onset_date TIMESTAMPTZ NOT NULL,
  status aefi_status DEFAULT 'reported',
  action_taken TEXT,
  outcome TEXT,
  notes TEXT,
  notified_branch_nurse BOOLEAN DEFAULT FALSE,
  notified_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 8. CERTIFICATES
-- ============================================================================

-- Certificate status enum
CREATE TYPE certificate_status AS ENUM ('draft', 'issued', 'revoked', 'expired');

-- Certificates table
CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  certificate_id VARCHAR(100) UNIQUE NOT NULL, -- e.g., CERT-GH-2025-001234
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  qr_payload TEXT UNIQUE NOT NULL,
  issued_date DATE NOT NULL,
  issued_by_user_id UUID REFERENCES users(id),
  issued_by_facility_id UUID REFERENCES branches(id),
  completion_status VARCHAR(50) NOT NULL, -- 'Complete' or 'Partial'
  vaccines_completed TEXT[], -- Array of vaccine names
  pdf_url TEXT, -- Link to generated PDF
  status certificate_status DEFAULT 'issued',
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 9. APPOINTMENTS
-- ============================================================================

-- Appointment status enum
CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'completed', 'missed', 'cancelled');

-- Appointments table
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  guardian_id UUID REFERENCES guardians(id),
  vaccine_id UUID REFERENCES vaccines(id),
  facility_id UUID REFERENCES branches(id),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  status appointment_status DEFAULT 'scheduled',
  notes TEXT,
  reminder_sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 10. NOTIFICATIONS (SMS/EMAIL LOG)
-- ============================================================================

-- Notification channel enum
CREATE TYPE notification_channel AS ENUM ('sms', 'email', 'whatsapp', 'push');

-- Notification status enum
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'delivered', 'failed', 'bounced');

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id VARCHAR(50) NOT NULL, -- e.g., 'pre_due', 'overdue', 'certificate'
  recipient_type VARCHAR(50) NOT NULL, -- 'guardian', 'staff'
  recipient_id UUID NOT NULL, -- guardian_id or user_id
  channel notification_channel NOT NULL,
  recipient_contact VARCHAR(255) NOT NULL, -- Phone or email
  subject VARCHAR(500),
  message TEXT NOT NULL,
  status notification_status DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb, -- e.g., child_id, vaccine_id
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification templates
CREATE TABLE notification_templates (
  id VARCHAR(50) PRIMARY KEY, -- e.g., 'pre_due', 'overdue'
  label VARCHAR(255) NOT NULL,
  description TEXT,
  sms_template TEXT,
  email_template TEXT,
  variables TEXT[], -- e.g., ['guardianName', 'childName', 'vaccineName']
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 11. CHW FIELD OPERATIONS
-- ============================================================================

-- Visit status enum
CREATE TYPE visit_status AS ENUM ('planned', 'in-progress', 'completed', 'cancelled', 'rescheduled');

-- CHW visit logs (household visits)
CREATE TABLE visit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chw_id UUID NOT NULL REFERENCES users(id),
  child_id UUID REFERENCES children(id),
  household_location TEXT NOT NULL,
  gps_coordinates POINT,
  catchment_area_id UUID REFERENCES catchment_areas(id),
  visit_date DATE NOT NULL,
  status visit_status DEFAULT 'planned',
  distance_km DECIMAL(5, 2),
  vaccines_administered TEXT[], -- Array of vaccine codes
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 12. OFFLINE SYNC QUEUE
-- ============================================================================

-- Sync status enum
CREATE TYPE sync_status AS ENUM ('pending', 'syncing', 'synced', 'failed', 'conflict');

-- Offline sync queue
CREATE TABLE sync_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id), -- CHW or nurse who created offline record
  entity_type VARCHAR(50) NOT NULL, -- 'child', 'vaccination_event', 'visit_log'
  entity_id UUID, -- ID of the record being synced
  operation VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete'
  payload JSONB NOT NULL, -- Full record data
  status sync_status DEFAULT 'pending',
  conflict_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 13. DATA QUALITY & DEDUPLICATION
-- ============================================================================

-- Duplicate status enum
CREATE TYPE duplicate_status AS ENUM ('pending', 'merged', 'dismissed', 'under-review');

-- Duplicate candidates
CREATE TABLE duplicate_candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pair_id VARCHAR(50) UNIQUE NOT NULL, -- e.g., DQ-4472
  child_a_id UUID NOT NULL REFERENCES children(id),
  child_b_id UUID NOT NULL REFERENCES children(id),
  similarity_score DECIMAL(5, 2) NOT NULL, -- 0.00 to 100.00
  matching_fields TEXT[], -- e.g., ['dob', 'mother_phone', 'catchment']
  status duplicate_status DEFAULT 'pending',
  survivor_id UUID REFERENCES children(id), -- Which record was kept (if merged)
  merged_by_user_id UUID REFERENCES users(id),
  merge_reason TEXT,
  merge_note TEXT,
  merged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT different_children CHECK (child_a_id != child_b_id)
);

-- Sync conflicts (for Data Officer resolution)
CREATE TABLE sync_conflicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conflict_id VARCHAR(50) UNIQUE NOT NULL, -- e.g., SC-982
  sync_queue_id UUID REFERENCES sync_queue(id),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  conflict_type VARCHAR(100) NOT NULL, -- e.g., 'orphaned_reference', 'deleted_child_reference'
  local_data JSONB NOT NULL,
  server_data JSONB,
  recommended_action TEXT,
  status duplicate_status DEFAULT 'pending',
  resolved_by_user_id UUID REFERENCES users(id),
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 14. AUDIT LOGS
-- ============================================================================

-- Audit action enum
CREATE TYPE audit_action AS ENUM (
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'export',
  'merge',
  'access'
);

-- Audit logs (immutable)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action audit_action NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- 'child', 'vaccination_event', 'user', etc.
  entity_id UUID,
  before_data JSONB, -- State before change
  after_data JSONB, -- State after change
  ip_address INET,
  user_agent TEXT,
  category VARCHAR(50), -- 'clinical', 'administrative', 'security'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 15. SYSTEM SETTINGS
-- ============================================================================

-- System settings table
CREATE TABLE system_settings (
  id VARCHAR(100) PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE, -- Can be read by non-admin users
  updated_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 16. VACCINE STOCK INVENTORY (OPTIONAL)
-- ============================================================================

-- Stock inventory table (for batch/lot tracking)
CREATE TABLE stock_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vaccine_id UUID NOT NULL REFERENCES vaccines(id),
  facility_id UUID REFERENCES branches(id),
  batch_number VARCHAR(100) NOT NULL,
  lot_number VARCHAR(100),
  manufacturer VARCHAR(255),
  expiry_date DATE NOT NULL,
  quantity_received INTEGER NOT NULL,
  quantity_used INTEGER DEFAULT 0,
  quantity_remaining INTEGER,
  received_date DATE NOT NULL,
  received_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_branch_id ON users(branch_id);

-- Branches indexes
CREATE INDEX idx_branches_region ON branches(region);
CREATE INDEX idx_branches_manager_id ON branches(manager_id);

-- Guardians indexes
CREATE INDEX idx_guardians_phone_primary ON guardians(phone_primary);
CREATE INDEX idx_guardians_user_id ON guardians(user_id);
CREATE INDEX idx_guardians_catchment_area_id ON guardians(catchment_area_id);

-- Children indexes
CREATE INDEX idx_children_cvcc_id ON children(cvcc_id);
CREATE INDEX idx_children_date_of_birth ON children(date_of_birth);
CREATE INDEX idx_children_primary_facility_id ON children(primary_facility_id);
CREATE INDEX idx_children_is_active ON children(is_active);

-- Child-Guardian indexes
CREATE INDEX idx_child_guardian_child_id ON child_guardian(child_id);
CREATE INDEX idx_child_guardian_guardian_id ON child_guardian(guardian_id);

-- Vaccination events indexes
CREATE INDEX idx_vaccination_events_child_id ON vaccination_events(child_id);
CREATE INDEX idx_vaccination_events_vaccine_id ON vaccination_events(vaccine_id);
CREATE INDEX idx_vaccination_events_administered_date ON vaccination_events(administered_date);
CREATE INDEX idx_vaccination_events_facility_id ON vaccination_events(facility_id);
CREATE INDEX idx_vaccination_events_is_synced ON vaccination_events(is_synced);

-- Appointments indexes
CREATE INDEX idx_appointments_child_id ON appointments(child_id);
CREATE INDEX idx_appointments_scheduled_date ON appointments(scheduled_date);
CREATE INDEX idx_appointments_status ON appointments(status);

-- Notifications indexes
CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Visit logs indexes
CREATE INDEX idx_visit_logs_chw_id ON visit_logs(chw_id);
CREATE INDEX idx_visit_logs_child_id ON visit_logs(child_id);
CREATE INDEX idx_visit_logs_visit_date ON visit_logs(visit_date);

-- Sync queue indexes
CREATE INDEX idx_sync_queue_user_id ON sync_queue(user_id);
CREATE INDEX idx_sync_queue_status ON sync_queue(status);
CREATE INDEX idx_sync_queue_created_at ON sync_queue(created_at);

-- Duplicate candidates indexes
CREATE INDEX idx_duplicate_candidates_status ON duplicate_candidates(status);
CREATE INDEX idx_duplicate_candidates_child_a_id ON duplicate_candidates(child_a_id);
CREATE INDEX idx_duplicate_candidates_child_b_id ON duplicate_candidates(child_b_id);

-- Audit logs indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================================

ALTER TABLE users ADD CONSTRAINT fk_users_branch 
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;

ALTER TABLE branches ADD CONSTRAINT fk_branches_manager 
  FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE catchment_areas ADD CONSTRAINT fk_catchment_chw 
  FOREIGN KEY (assigned_chw_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_catchment_areas_updated_at BEFORE UPDATE ON catchment_areas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guardians_updated_at BEFORE UPDATE ON guardians
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_children_updated_at BEFORE UPDATE ON children
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vaccines_updated_at BEFORE UPDATE ON vaccines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vaccination_schedules_updated_at BEFORE UPDATE ON vaccination_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vaccination_events_updated_at BEFORE UPDATE ON vaccination_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_aefi_reports_updated_at BEFORE UPDATE ON aefi_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_certificates_updated_at BEFORE UPDATE ON certificates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON notification_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visit_logs_updated_at BEFORE UPDATE ON visit_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_queue_updated_at BEFORE UPDATE ON sync_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_duplicate_candidates_updated_at BEFORE UPDATE ON duplicate_candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_conflicts_updated_at BEFORE UPDATE ON sync_conflicts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_inventory_updated_at BEFORE UPDATE ON stock_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - TO BE CONFIGURED
-- ============================================================================

-- Enable RLS on all tables (policies to be added later)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE catchment_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_guardian ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaccines ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaccination_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaccination_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE aefi_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE duplicate_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_select_spatial_ref_sys
  ON public.spatial_ref_sys
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
