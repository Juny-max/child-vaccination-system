import { apiRequest } from './config';

// ============================================
// Types - Match backend DTOs
// ============================================

export interface ChildProfile {
  id: string;
  childId: string;
  qrPayload?: string;
  name: string;
  dateOfBirth: string;
  age: string;
  gender: string;
  bloodType?: string;
  weight?: string;
  length?: string;
  profilePhoto?: string;
  registrationDate: string;
  facilityName: string;
  facilityId: string;
}

export interface VaccinationRecord {
  id: string;
  vaccine: string;
  vaccineCode: string;
  doseNumber: number;
  administeredDate: string;
  status: 'Completed' | 'Scheduled' | 'Missed';
  batchNumber?: string;
  facilityName: string;
  administeredBy?: string;
  nextDoseDate?: string;
  sideEffects?: string;
}

export interface UpcomingVaccination {
  id: string;
  vaccine: string;
  vaccineCode: string;
  doseNumber: number;
  scheduleName: string;
  dueDate: string;
  isOverdue: boolean;
  daysOverdue: number;
  isMandatory: boolean;
}

export interface MissedVaccination {
  childId: string;
  childName: string;
  vaccine: string;
  dueDate: string;
  daysOverdue: number;
}

export interface Certificate {
  id?: string;
  certificateId: string;
  childId: string;
  childName: string;
  completionStatus: 'Complete' | 'Partial' | 'Pending';
  issuedDate?: string;
  validUntil?: string;
  issuedBy?: string;
  issuedByFacility?: string;
  qrPayload?: string;
  vaccines?: string[];
  vaccinesCompleted?: string[];
  lastVerified?: string | null;
  pdfUrl?: string | null;
  vaccinationProgress?: string;
}

export interface Appointment {
  id: string;
  childId: string;
  childName: string;
  childCvccId?: string;
  vaccineName?: string;
  facilityId: string;
  facilityName: string;
  facilityPhone?: string;
  facilityAddress?: string;
  scheduledDate: string;
  scheduledTime: string;
  purpose: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'missed';
  notes?: string;
}

export interface MotherDetails {
  id: string;
  name: string;
  primaryPhone?: string;
  secondaryPhone?: string;
  email?: string;
  address?: string;
  preferredContact: 'phone' | 'sms' | 'email';
  preferredLanguage: string;
  emergencyContacts: EmergencyContact[];
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  isPrimary: boolean;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'reminder' | 'alert' | 'info' | 'success';
  isRead: boolean;
  createdAt: string;
}

export interface ChildSummary {
  id: string;
  name: string;
  age: string;
  profilePhoto?: string;
  vaccinationProgress: {
    completed: number;
    total: number;
    percentage: number;
  };
  nextVaccination?: {
    vaccine: string;
    dueDate: string;
  };
  hasMissedVaccinations: boolean;
  hasCompleteCertificate: boolean;
}

export interface ParentDashboard {
  guardian: {
    name: string;
    email: string;
  };
  children: ChildSummary[];
  upcomingAppointments: Appointment[];
  missedVaccinations: MissedVaccination[];
  recentNotifications: Notification[];
  healthReminders: string[];
}

// ============================================
// Request DTOs
// ============================================

export interface CreateAppointmentRequest {
  childId: string;
  facilityId: string;
  scheduledDate: string;
  scheduledTime: string;
  purpose: string;
  contactPhone?: string;
  notes?: string;
}

export interface UpdateMotherDetailsRequest {
  name?: string;
  primaryPhone?: string;
  secondaryPhone?: string;
  email?: string;
  addressLine1?: string;
  landmark?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  preferredContactMethod?: 'phone' | 'sms' | 'email';
  emergencyContacts?: Array<{
    name: string;
    relationship: string;
    phone: string;
    isPrimary?: boolean;
  }>;
}

// ============================================
// Parent API Functions
// ============================================

/**
 * Get parent dashboard overview
 */
export async function getDashboard(): Promise<ParentDashboard> {
  return apiRequest<ParentDashboard>('/parent/dashboard');
}

/**
 * Get guardian/mother profile
 */
export async function getProfile(): Promise<MotherDetails> {
  return apiRequest<MotherDetails>('/parent/profile');
}

/**
 * Update guardian/mother profile
 */
export async function updateProfile(data: UpdateMotherDetailsRequest): Promise<MotherDetails> {
  return apiRequest<MotherDetails>('/parent/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Get all children
 */
export async function getChildren(): Promise<ChildProfile[]> {
  return apiRequest<ChildProfile[]>('/parent/children');
}

/**
 * Get child details by ID
 */
export async function getChildDetails(childId: string): Promise<ChildProfile> {
  return apiRequest<ChildProfile>(`/parent/children/${childId}`);
}

/**
 * Get vaccination history for a child
 */
export async function getVaccinationHistory(childId: string): Promise<VaccinationRecord[]> {
  return apiRequest<VaccinationRecord[]>(`/parent/children/${childId}/vaccinations`);
}

/**
 * Get upcoming vaccinations for a child
 */
export async function getUpcomingVaccinations(childId: string): Promise<UpcomingVaccination[]> {
  return apiRequest<UpcomingVaccination[]>(`/parent/children/${childId}/vaccinations/upcoming`);
}

/**
 * Get all missed vaccinations across all children
 */
export async function getMissedVaccinations(): Promise<MissedVaccination[]> {
  return apiRequest<MissedVaccination[]>('/parent/missed-vaccinations');
}

/**
 * Get all certificates
 */
export async function getAllCertificates(): Promise<Certificate[]> {
  return apiRequest<Certificate[]>('/parent/certificates');
}

/**
 * Get certificates for a specific child
 */
export async function getChildCertificates(childId: string): Promise<Certificate[]> {
  return apiRequest<Certificate[]>(`/parent/children/${childId}/certificates`);
}

/**
 * Get all appointments
 */
export async function getAppointments(): Promise<Appointment[]> {
  return apiRequest<Appointment[]>('/parent/appointments');
}

/**
 * Create a new appointment
 */
export async function createAppointment(data: CreateAppointmentRequest): Promise<Appointment> {
  // Transform frontend data to match backend DTO
  const backendPayload = {
    childId: data.childId,
    facilityId: data.facilityId || undefined,
    preferredDate: data.scheduledDate,
    preferredTime: data.scheduledTime,
    contactPhone: data.contactPhone || undefined,
    notes: data.notes,
    // vaccineId is optional - backend will handle it
  };

  return apiRequest<Appointment>('/parent/appointments', {
    method: 'POST',
    body: JSON.stringify(backendPayload),
  });
}

/**
 * Cancel an appointment
 */
export async function cancelAppointment(appointmentId: string, reason?: string): Promise<void> {
  return apiRequest<void>(`/parent/appointments/${appointmentId}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  });
}

/**
 * Get notifications
 */
export async function getNotifications(): Promise<Notification[]> {
  return apiRequest<Notification[]>('/parent/notifications');
}
