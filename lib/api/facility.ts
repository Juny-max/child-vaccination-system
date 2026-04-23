import { apiRequest } from './config';

// ============================================
// Types - Match backend DTOs
// ============================================

export interface ChildSearchResult {
  id: string;
  childId: string; // CVCC ID
  name: string;
  dateOfBirth: string;
  age: string;
  gender: string;
  guardianName: string;
  guardianPhone: string;
  lastVisit: string | null;
  facilityName: string;
  vaccinationStatus: 'Complete' | 'In Progress' | 'Overdue';
  upcomingVaccines: number;
  overdueVaccines: number;
}

export interface FacilityChildProfile {
  // Child info
  id: string;
  childId: string;
  name: string;
  dateOfBirth: string;
  age: string;
  gender: string;
  weight: string | null;
  length: string | null;
  bloodType: string | null;
  profilePhoto: string | null;

  // Guardian info
  guardianId: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string | null;
  guardianAddress: string | null;
  guardianPreferredContact: 'sms' | 'email' | 'whatsapp';

  // Facility info
  facilityId: string;
  facilityName: string;
  registrationDate: string;
  lastVisit: string | null;

  // Vaccination summary
  vaccinationsCompleted: number;
  vaccinationsTotal: number;
  nextVaccineDue: string | null;
  hasOverdueVaccines: boolean;
}

export interface VaccinationEvent {
  id: string;
  vaccineId: string;
  vaccineName: string;
  vaccineCode: string;
  doseNumber: number;
  administeredDate: string;
  administeredBy: string;
  batchNumber: string | null;
  lotNumber: string | null;
  vaccinationSite: string | null;
  status: 'completed' | 'scheduled' | 'missed';
  notes: string | null;
}

export interface ScheduledVaccine {
  scheduleId: string;
  vaccineName: string;
  vaccineCode: string;
  doseNumber: number;
  dueDate: string;
  isOverdue: boolean;
  daysOverdue: number;
  isMandatory: boolean;
}

// ============================================
// Facility API Functions
// ============================================

/**
 * Search for children by name, CVCC ID, or guardian phone number
 */
export async function searchChildren(query: string): Promise<ChildSearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }
  return apiRequest<ChildSearchResult[]>(`/facility/search?query=${encodeURIComponent(query)}`);
}

/**
 * Get detailed child profile
 */
export async function getChildProfile(childId: string): Promise<FacilityChildProfile> {
  return apiRequest<FacilityChildProfile>(`/facility/children/${childId}`);
}

/**
 * Get vaccination history for a child
 */
export async function getVaccinationHistory(childId: string): Promise<VaccinationEvent[]> {
  return apiRequest<VaccinationEvent[]>(`/facility/children/${childId}/vaccinations`);
}

/**
 * Get scheduled/upcoming vaccinations for a child
 */
export async function getScheduledVaccinations(
  childId: string,
  dateOfBirth: string
): Promise<ScheduledVaccine[]> {
  return apiRequest<ScheduledVaccine[]>(
    `/facility/children/${childId}/scheduled?dateOfBirth=${encodeURIComponent(dateOfBirth)}`
  );
}

/**
 * Administer a vaccine to a child
 */
export interface AdministerVaccineRequest {
  vaccineName: string;
  administeredDate: string;
  batchNumber: string;
  expiryDate?: string;
  administeredBy: string;
  vaccinationSite?: string;
  aefiFlag?: boolean;
  notes?: string;
}

export async function administerVaccine(
  childId: string,
  data: AdministerVaccineRequest
): Promise<VaccinationEvent> {
  return apiRequest<VaccinationEvent>(`/facility/children/${childId}/vaccinations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface VaccineStockInfo {
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
}

/**
 * Fetch the current in-stock batch number and expiry date for a vaccine at a
 * given facility. Returns null when no stock record exists.
 */
export async function getVaccineStockInfo(
  vaccineName: string,
  facilityId: string
): Promise<VaccineStockInfo | null> {
  try {
    return await apiRequest<VaccineStockInfo | null>(
      `/facility/vaccine-stock?vaccine=${encodeURIComponent(vaccineName)}&facilityId=${encodeURIComponent(facilityId)}`
    );
  } catch {
    return null;
  }
}

/**
 * Growth monitoring measurement
 */
export interface GrowthMeasurement {
  id: string;
  childId: string;
  measurementDate: string;
  weightKg: number | null;
  lengthCm: number | null;
  headCircumferenceCm: number | null;
  muacCm: number | null;
  temperatureC: number | null;
  recordedByName: string;
  notes: string | null;
  createdAt: string;
}

export interface RecordGrowthMeasurementRequest {
  measurementDate: string;
  recordedByName: string;
  weightKg: number;
  lengthCm?: number;
  headCircumferenceCm?: number;
  muacCm?: number;
  temperatureC?: number;
  notes?: string;
}

/**
 * Record a growth monitoring measurement
 */
export async function recordGrowthMeasurement(
  childId: string,
  data: RecordGrowthMeasurementRequest
): Promise<GrowthMeasurement> {
  return apiRequest<GrowthMeasurement>(`/facility/children/${childId}/measurements`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get growth monitoring history for a child
 */
export async function getGrowthMonitoringHistory(childId: string): Promise<GrowthMeasurement[]> {
  return apiRequest<GrowthMeasurement[]>(`/facility/children/${childId}/measurements`);
}

/**
 * Clinic session note
 */
export interface SessionNote {
  id: string;
  childId: string;
  visitDate: string;
  recordedByName: string;
  notes: string;
  createdAt: string;
}

export interface RecordSessionNoteRequest {
  visitDate: string;
  recordedByName: string;
  notes: string;
}

/**
 * Record a clinic session note
 */
export async function recordSessionNote(
  childId: string,
  data: RecordSessionNoteRequest
): Promise<SessionNote> {
  return apiRequest<SessionNote>(`/facility/children/${childId}/session-notes`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get clinic session notes for a child
 */
export async function getSessionNotes(childId: string): Promise<SessionNote[]> {
  return apiRequest<SessionNote[]>(`/facility/children/${childId}/session-notes`);
}

/**
 * Guardian details
 */
export interface Guardian {
  id: string;
  fullName: string;
  phonePrimary: string;
  phoneAlternate: string | null;
  email: string | null;
  addressLine1: string;
  landmark: string | null;
  city: string;
  region: string;
  preferredContact: 'sms' | 'email' | 'whatsapp';
}

export interface UpdateGuardianRequest {
  fullName: string;
  phonePrimary: string;
  phoneAlternate?: string;
  email?: string;
  addressLine1: string;
  landmark?: string;
  city: string;
  region: string;
  preferredContact?: 'sms' | 'email' | 'whatsapp';
}

/**
 * Get guardian details for a child
 */
export async function getGuardian(childId: string): Promise<Guardian> {
  return apiRequest<Guardian>(`/facility/children/${childId}/guardian`);
}

/**
 * Update guardian details
 */
export async function updateGuardian(
  guardianId: string,
  data: UpdateGuardianRequest
): Promise<Guardian> {
  return apiRequest<Guardian>(`/facility/guardians/${guardianId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Today's appointment
 */
export interface TodayAppointment {
  id: string;
  childId: string;
  childName: string;
  caregiver: string;
  scheduledTime: string;
  vaccine: string;
  contact: string;
  status: string;
}

/**
 * Urgent follow-up
 */
export interface UrgentFollowUp {
  id: string;
  childId: string;
  childName: string;
  reason: string;
  caregiver: string;
  contact: string;
  daysOverdue: number;
  guardianId?: string;
  phoneAlternate?: string;
  email?: string;
  address?: string;
  community?: string;
  preferredContact?: string;
  relationship?: string;
  nhisNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

/**
 * Get today's appointments for the facility
 */
export async function getTodaysAppointments(facilityId?: string): Promise<TodayAppointment[]> {
  const url = facilityId 
    ? `/facility/appointments/today?facilityId=${encodeURIComponent(facilityId)}`
    : '/facility/appointments/today';
  return apiRequest<TodayAppointment[]>(url);
}

/**
 * Get urgent follow-ups (children with overdue vaccinations)
 */
export async function getUrgentFollowUps(facilityId?: string): Promise<UrgentFollowUp[]> {
  const url = facilityId 
    ? `/facility/follow-ups/urgent?facilityId=${encodeURIComponent(facilityId)}`
    : '/facility/follow-ups/urgent';
  return apiRequest<UrgentFollowUp[]>(url);
}

export interface GuardianOption {
  id: string;
  name: string;
  phone: string;
  community: string;
}

export interface GetGuardiansParams {
  query?: string;
  limit?: number;
  offset?: number;
}

export interface RegisterChildRequest {
  guardianId: string;
  fullName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'intersex' | 'undisclosed';
  birthWeight?: number;
  birthLength?: number;
  headCircumference?: number;
  placeOfBirth?: string;
  deliveryType?: string;
  birthOrder?: string;
  bloodType?: string;
  notes?: string;
  profilePhotoUrl?: string;
  branchId?: string;
}

export interface RegisterChildResponse {
  id: string;
  cvccId: string;
  guardianId: string;
  guardianName: string;
  guardianPhone: string;
  smsSent: boolean;
  message: string;
}

export async function getGuardians(params: GetGuardiansParams = {}): Promise<GuardianOption[]> {
  const searchParams = new URLSearchParams();
  if (params.query?.trim()) searchParams.set('query', params.query.trim());
  if (typeof params.limit === 'number') searchParams.set('limit', String(params.limit));
  if (typeof params.offset === 'number') searchParams.set('offset', String(params.offset));
  const qs = searchParams.toString();
  return apiRequest<GuardianOption[]>(`/facility/guardians${qs ? `?${qs}` : ''}`);
}

export async function registerChild(data: RegisterChildRequest): Promise<RegisterChildResponse> {
  return apiRequest<RegisterChildResponse>('/facility/children', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============================================
// Guardian Registration
// ============================================

/**
 * Request to register a new guardian (mother/caregiver)
 */
export interface RegisterGuardianRequest {
  fullName: string;
  phoneNumber: string;
  alternatePhone?: string;
  email?: string;
  addressLine1: string;
  landmark?: string;
  city: string;
  region: string;
  country?: string;
  postalCode?: string;
  community?: string;
  ghanaCard?: string;
  nhisNumber?: string;
  preferredContact: 'sms' | 'email';
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
}

/**
 * Response after registering a guardian
 */
export interface RegisteredGuardian {
  id: string;
  fullName: string;
  phonePrimary: string;
  phoneAlternate: string | null;
  email: string | null;
  addressLine1: string;
  landmark: string | null;
  city: string;
  region: string;
  country: string;
  ghanaCard: string | null;
  nhisNumber: string | null;
  preferredContact: 'sms' | 'email';
  message: string;
  emailSent?: boolean; // Indicates if credentials were emailed successfully
  smsSent?: boolean; // Indicates if SMS notification was sent successfully
}

/**
 * Register a new guardian (mother/caregiver)
 */
export async function registerGuardian(data: RegisterGuardianRequest): Promise<RegisteredGuardian> {
  return apiRequest<RegisteredGuardian>('/facility/guardians', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============================================
// Appointment Management (Nurse Review)
// ============================================

/**
 * Appointment request from parent (for nurse review)
 */
export interface AppointmentRequest {
  id: string;
  childId: string;
  childName: string;
  childCvccId: string;
  vaccine: string;
  guardianName: string;
  guardianPhone: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Get pending appointment requests for review
 */
export async function getAppointmentRequests(
  facilityId?: string,
  status?: string,
): Promise<AppointmentRequest[]> {
  const params = new URLSearchParams();
  if (facilityId) params.append('facilityId', facilityId);
  if (status) params.append('status', status);
  const qs = params.toString();
  return apiRequest<AppointmentRequest[]>(
    `/facility/appointments/requests${qs ? `?${qs}` : ''}`,
  );
}

/**
 * Update appointment status (confirm/reject/complete)
 */
export async function updateAppointmentStatus(
  appointmentId: string,
  action: 'confirmed' | 'cancelled' | 'completed',
  options?: { notes?: string; confirmedDate?: string; confirmedTime?: string },
): Promise<{ success: boolean; message: string }> {
  return apiRequest<{ success: boolean; message: string }>(
    `/facility/appointments/${appointmentId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        action,
        ...options,
      }),
    },
  );
}

// ============================================
// Branch/Facility Details
// ============================================

export interface BranchDetails {
  id: string;
  name: string;
  code: string;
  region: string;
  district: string;
  address: string;
  phone: string;
  email: string;
}

/**
 * Get branch/facility details by ID
 */
export async function getBranchDetails(branchId: string): Promise<BranchDetails> {
  return apiRequest<BranchDetails>(`/facility/branch/${branchId}`, {
    method: 'GET',
  });
}

// ============================================
// Certificate Management
// ============================================

export interface CreateCertificateRequest {
  childId: string;
  certificateSerialNumber: string;
  vaccinationsCompleted: number;
}

export interface Certificate {
  id: string;
  childId: string;
  certificateId: string;
  issuedDate: string;
  completionStatus: string;
  vaccinesCompleted: string[];
  issuedBy: string;
  region: string;
}

/**
 * Create/issue a certificate for a child who has completed vaccinations
 */
export async function createCertificate(
  data: CreateCertificateRequest
): Promise<Certificate> {
  return apiRequest<Certificate>('/facility/certificates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
