// ============================================================================
// Facility Nurse Module DTOs - Data Transfer Objects
// ============================================================================

import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

// ============================================================================
// REQUEST DTOs
// ============================================================================

/**
 * Search for a child by name, CVCC ID, or guardian phone
 */
export class SearchChildDto {
  @IsString()
  @IsNotEmpty()
  query: string; // Can be child name, CVCC ID, or phone number
}

/**
 * Administer vaccine request
 */
export class AdministerVaccineDto {
  @IsString()
  @IsNotEmpty()
  vaccineName: string;

  @IsString()
  @IsNotEmpty()
  administeredDate: string; // ISO date string

  @IsString()
  @IsNotEmpty()
  batchNumber: string;

  @IsString()
  @IsOptional()
  expiryDate?: string;

  @IsString()
  @IsNotEmpty()
  administeredBy: string;

  @IsString()
  @IsOptional()
  vaccinationSite?: string;

  @IsOptional()
  aefiFlag?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

/**
 * Record growth monitoring measurement request
 */
export class RecordGrowthMeasurementDto {
  @IsString()
  @IsNotEmpty()
  measurementDate: string; // ISO date string

  @IsString()
  @IsNotEmpty()
  recordedByName: string;

  @IsNotEmpty()
  weightKg: number;

  @IsOptional()
  lengthCm?: number;

  @IsOptional()
  headCircumferenceCm?: number;

  @IsOptional()
  muacCm?: number;

  @IsOptional()
  temperatureC?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

/**
 * Record clinic session note request
 */
export class RecordSessionNoteDto {
  @IsString()
  @IsNotEmpty()
  visitDate: string; // ISO date string

  @IsString()
  @IsNotEmpty()
  recordedByName: string;

  @IsString()
  @IsNotEmpty()
  notes: string;
}

/**
 * Register new guardian (mother/caregiver) request
 */
export class RegisterGuardianDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsOptional()
  alternatePhone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  addressLine1: string;

  @IsString()
  @IsOptional()
  landmark?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  region: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsString()
  @IsOptional()
  community?: string;

  @IsString()
  @IsOptional()
  ghanaCard?: string;

  @IsString()
  @IsOptional()
  nhisNumber?: string;

  @IsString()
  @IsNotEmpty()
  preferredContact: 'sms' | 'email';

  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  @IsString()
  @IsOptional()
  emergencyContactPhone?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

/**
 * Child search result
 */
export class ChildSearchResultDto {
  id: string;
  childId: string; // CVCC ID (e.g., CH-2025-001)
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

/**
 * Detailed child profile for facility nurses
 */
export class FacilityChildProfileDto {
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

/**
 * Vaccination event for facility nurses
 */
export class VaccinationEventDto {
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

/**
 * Schedule item for facility nurses
 */
export class ScheduledVaccineDto {
  scheduleId: string;
  vaccineName: string;
  vaccineCode: string;
  doseNumber: number;
  dueDate: string;
  isOverdue: boolean;
  daysOverdue: number;
  isMandatory: boolean;
}

/**
 * Growth monitoring measurement response
 */
export class GrowthMeasurementDto {
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

/**
 * Clinic session note response
 */
export class SessionNoteDto {
  id: string;
  childId: string;
  visitDate: string;
  recordedByName: string;
  notes: string;
  createdAt: string;
}

/**
 * Update guardian details request
 */
export class UpdateGuardianDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  phonePrimary: string;

  @IsString()
  @IsOptional()
  phoneAlternate?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  addressLine1: string;

  @IsString()
  @IsOptional()
  landmark?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  region: string;

  @IsString()
  @IsOptional()
  preferredContact?: 'sms' | 'email' | 'whatsapp';
}

/**
 * Guardian details response
 */
export class GuardianDto {
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

/**
 * Today's appointment response
 */
export class TodayAppointmentDto {
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
 * Urgent follow-up response
 */
export class UrgentFollowUpDto {
  id: string;
  childId: string;
  childName: string;
  reason: string;
  caregiver: string;
  contact: string;
  daysOverdue: number;
}

/**
 * Registered guardian response (after successful registration)
 */
export class RegisteredGuardianDto {
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
}
