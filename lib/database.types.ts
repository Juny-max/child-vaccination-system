// ============================================================================
// Database Types - Generated from Supabase Schema
// Auto-generated: January 1, 2026
// ============================================================================

// ============================================================================
// ENUMS
// ============================================================================

export type UserRole =
  | 'hq-admin'
  | 'branch-manager'
  | 'facility-nurse'
  | 'chw'
  | 'data-officer'
  | 'pha'
  | 'parent';

export type UserStatus = 'active' | 'inactive' | 'suspended';

export type ContactMethod = 'sms' | 'email' | 'whatsapp';

export type GenderType = 'male' | 'female' | 'intersex' | 'undisclosed';

export type VaccineStatus = 'active' | 'archived' | 'discontinued';

export type VaccinationSite =
  | 'left-arm-upper'
  | 'right-arm-upper'
  | 'left-thigh'
  | 'right-thigh'
  | 'oral'
  | 'intranasal'
  | 'other';

export type VaccinationEventStatus = 'completed' | 'missed' | 'refused' | 'contraindicated';

export type AefiSeverity = 'mild' | 'moderate' | 'severe' | 'life-threatening';

export type AefiStatus = 'reported' | 'under-review' | 'investigated' | 'resolved' | 'escalated';

export type CertificateStatus = 'draft' | 'issued' | 'revoked' | 'expired';

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'missed' | 'cancelled';

export type NotificationChannel = 'sms' | 'email' | 'whatsapp' | 'push';

export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';

export type VisitStatus = 'planned' | 'in-progress' | 'completed' | 'cancelled' | 'rescheduled';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';

export type DuplicateStatus = 'pending' | 'merged' | 'dismissed' | 'under-review';

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'export' | 'merge' | 'access';

// ============================================================================
// DATABASE TABLES
// ============================================================================

export interface User {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  password_hash: string | null;
  profile_photo_url: string | null;
  metadata: Record<string, any>;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  region: string;
  district: string | null;
  address: string | null;
  gps_coordinates: { x: number; y: number } | null; // PostGIS POINT
  phone: string | null;
  email: string | null;
  manager_id: string | null;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

export interface CatchmentArea {
  id: string;
  name: string;
  code: string;
  branch_id: string;
  community: string | null;
  polygon: any | null; // PostGIS GEOMETRY
  population_estimate: number | null;
  assigned_chw_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Guardian {
  id: string;
  user_id: string | null;
  full_name: string;
  phone_primary: string;
  phone_alternate: string | null;
  email: string | null;
  ghana_card_number: string | null;
  nhis_number: string | null;
  address_line1: string;
  landmark: string | null;
  city: string;
  region: string;
  country: string;
  postal_code: string | null;
  community: string | null;
  catchment_area_id: string | null;
  preferred_contact: ContactMethod;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
}

export interface Child {
  id: string;
  cvcc_id: string;
  qr_code_payload: string;
  full_name: string;
  date_of_birth: string;
  gender: GenderType;
  birth_weight: number | null;
  birth_length: number | null;
  head_circumference: number | null;
  place_of_birth: string | null;
  delivery_type: string | null;
  birth_order: string | null;
  blood_type: string | null;
  primary_facility_id: string | null;
  profile_photo_url: string | null;
  allergies: string[];
  critical_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
}

export interface ChildGuardian {
  id: string;
  child_id: string;
  guardian_id: string;
  relationship: string;
  is_primary: boolean;
  created_at: string;
}

export interface Vaccine {
  id: string;
  code: string;
  name: string;
  description: string | null;
  manufacturer: string | null;
  status: VaccineStatus;
  created_at: string;
  updated_at: string;
}

export interface VaccinationSchedule {
  id: string;
  vaccine_id: string;
  dose_number: number;
  schedule_name: string;
  due_days_from_birth: number;
  min_age_days: number | null;
  max_age_days: number | null;
  is_mandatory: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface VaccinationEvent {
  id: string;
  child_id: string;
  vaccine_id: string;
  dose_number: number;
  administered_date: string;
  administered_by_user_id: string | null;
  facility_id: string | null;
  batch_number: string | null;
  lot_number: string | null;
  expiry_date: string | null;
  manufacturer: string | null;
  vaccination_site: VaccinationSite | null;
  status: VaccinationEventStatus;
  notes: string | null;
  gps_coordinates: { x: number; y: number } | null;
  is_synced: boolean;
  created_at: string;
  updated_at: string;
}

export interface AefiReport {
  id: string;
  vaccination_event_id: string;
  child_id: string;
  reported_by_user_id: string | null;
  symptoms: string[];
  severity: AefiSeverity;
  onset_date: string;
  status: AefiStatus;
  action_taken: string | null;
  outcome: string | null;
  notes: string | null;
  notified_branch_nurse: boolean;
  notified_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Certificate {
  id: string;
  certificate_id: string;
  child_id: string;
  qr_payload: string;
  issued_date: string;
  issued_by_user_id: string | null;
  issued_by_facility_id: string | null;
  completion_status: string;
  vaccines_completed: string[];
  pdf_url: string | null;
  status: CertificateStatus;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  child_id: string;
  guardian_id: string | null;
  vaccine_id: string | null;
  facility_id: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  status: AppointmentStatus;
  notes: string | null;
  reminder_sent_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  template_id: string;
  recipient_type: string;
  recipient_id: string;
  channel: NotificationChannel;
  recipient_contact: string;
  subject: string | null;
  message: string;
  status: NotificationStatus;
  sent_at: string | null;
  delivered_at: string | null;
  error_message: string | null;
  retry_count: number;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplate {
  id: string;
  label: string;
  description: string | null;
  sms_template: string | null;
  email_template: string | null;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VisitLog {
  id: string;
  chw_id: string;
  child_id: string | null;
  household_location: string;
  gps_coordinates: { x: number; y: number } | null;
  catchment_area_id: string | null;
  visit_date: string;
  status: VisitStatus;
  distance_km: number | null;
  vaccines_administered: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncQueue {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string | null;
  operation: 'create' | 'update' | 'delete';
  payload: Record<string, any>;
  status: SyncStatus;
  conflict_reason: string | null;
  retry_count: number;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DuplicateCandidate {
  id: string;
  pair_id: string;
  child_a_id: string;
  child_b_id: string;
  similarity_score: number;
  matching_fields: string[];
  status: DuplicateStatus;
  survivor_id: string | null;
  merged_by_user_id: string | null;
  merge_reason: string | null;
  merge_note: string | null;
  merged_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncConflict {
  id: string;
  conflict_id: string;
  sync_queue_id: string | null;
  entity_type: string;
  entity_id: string | null;
  conflict_type: string;
  local_data: Record<string, any>;
  server_data: Record<string, any> | null;
  recommended_action: string | null;
  status: DuplicateStatus;
  resolved_by_user_id: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  before_data: Record<string, any> | null;
  after_data: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  category: string | null;
  created_at: string;
}

export interface SystemSetting {
  id: string;
  category: string;
  value: Record<string, any>;
  description: string | null;
  is_public: boolean;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockInventory {
  id: string;
  vaccine_id: string;
  facility_id: string | null;
  batch_number: string;
  lot_number: string | null;
  manufacturer: string | null;
  expiry_date: string;
  quantity_received: number;
  quantity_used: number;
  quantity_remaining: number | null;
  received_date: string;
  received_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// COMPOSITE TYPES (WITH RELATIONS)
// ============================================================================

export interface ChildWithGuardians extends Child {
  guardians: (ChildGuardian & { guardian: Guardian })[];
  primary_guardian?: Guardian;
}

export interface VaccinationEventWithDetails extends VaccinationEvent {
  child: Child;
  vaccine: Vaccine;
  administered_by: User | null;
  facility: Branch | null;
}

export interface CertificateWithDetails extends Certificate {
  child: Child;
  issued_by: User | null;
  facility: Branch | null;
}

export interface AppointmentWithDetails extends Appointment {
  child: Child;
  guardian: Guardian | null;
  vaccine: Vaccine | null;
  facility: Branch | null;
}

export interface DuplicateCandidateWithChildren extends DuplicateCandidate {
  child_a: Child;
  child_b: Child;
  merged_by: User | null;
}

// ============================================================================
// INSERT TYPES (WITHOUT AUTO-GENERATED FIELDS)
// ============================================================================

export type InsertUser = Omit<User, 'id' | 'created_at' | 'updated_at' | 'last_login_at'>;
export type InsertBranch = Omit<Branch, 'id' | 'created_at' | 'updated_at'>;
export type InsertGuardian = Omit<Guardian, 'id' | 'created_at' | 'updated_at'>;
export type InsertChild = Omit<Child, 'id' | 'created_at' | 'updated_at'>;
export type InsertVaccinationEvent = Omit<VaccinationEvent, 'id' | 'created_at' | 'updated_at'>;
export type InsertAppointment = Omit<Appointment, 'id' | 'created_at' | 'updated_at'>;
export type InsertNotification = Omit<Notification, 'id' | 'created_at' | 'updated_at'>;
export type InsertVisitLog = Omit<VisitLog, 'id' | 'created_at' | 'updated_at'>;
export type InsertSyncQueue = Omit<SyncQueue, 'id' | 'created_at' | 'updated_at'>;

// ============================================================================
// UPDATE TYPES (PARTIAL)
// ============================================================================

export type UpdateUser = Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>;
export type UpdateChild = Partial<Omit<Child, 'id' | 'created_at' | 'updated_at'>>;
export type UpdateGuardian = Partial<Omit<Guardian, 'id' | 'created_at' | 'updated_at'>>;
export type UpdateVaccinationEvent = Partial<Omit<VaccinationEvent, 'id' | 'created_at' | 'updated_at'>>;
export type UpdateAppointment = Partial<Omit<Appointment, 'id' | 'created_at' | 'updated_at'>>;
export type UpdateNotification = Partial<Omit<Notification, 'id' | 'created_at' | 'updated_at'>>;
export type UpdateSyncQueue = Partial<Omit<SyncQueue, 'id' | 'created_at' | 'updated_at'>>;

// ============================================================================
// HELPER TYPES
// ============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface DatabaseResponse<T> {
  data: T | null;
  error: Error | null;
  count?: number;
}

export interface VaccinationScheduleWithVaccine extends VaccinationSchedule {
  vaccine: Vaccine;
}

export interface ChildVaccinationProgress {
  child: Child;
  total_vaccines: number;
  completed_vaccines: number;
  pending_vaccines: number;
  overdue_vaccines: number;
  completion_percentage: number;
  next_due_vaccine?: VaccinationScheduleWithVaccine;
  next_due_date?: string;
}

// ============================================================================
// QUERY FILTERS
// ============================================================================

export interface ChildFilters {
  cvcc_id?: string;
  full_name?: string;
  guardian_phone?: string;
  facility_id?: string;
  catchment_area_id?: string;
  is_active?: boolean;
  date_of_birth_from?: string;
  date_of_birth_to?: string;
}

export interface VaccinationEventFilters {
  child_id?: string;
  vaccine_id?: string;
  facility_id?: string;
  administered_date_from?: string;
  administered_date_to?: string;
  status?: VaccinationEventStatus;
  is_synced?: boolean;
}

export interface AppointmentFilters {
  child_id?: string;
  facility_id?: string;
  scheduled_date_from?: string;
  scheduled_date_to?: string;
  status?: AppointmentStatus;
}

export interface NotificationFilters {
  recipient_id?: string;
  channel?: NotificationChannel;
  status?: NotificationStatus;
  created_at_from?: string;
  created_at_to?: string;
}
