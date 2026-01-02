// ============================================================================
// Parent Module DTOs - Data Transfer Objects
// These define the shape of data sent/received by the Parent API endpoints
// ============================================================================

import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsDateString,
  IsArray,
  IsUUID,
  IsNotEmpty,
  MinLength,
} from 'class-validator';

// ============================================================================
// ENUMS
// ============================================================================

export enum ContactMethod {
  SMS = 'sms',
  EMAIL = 'email',
  WHATSAPP = 'whatsapp',
}

export enum VaccinationStatus {
  COMPLETE = 'Complete',
  ON_TRACK = 'On Track',
  UPCOMING = 'Upcoming',
  OVERDUE = 'Overdue',
}

export enum CertificateCompletionStatus {
  COMPLETE = 'Complete',
  PARTIAL = 'Partial',
}

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  MISSED = 'missed',
  CANCELLED = 'cancelled',
}

// ============================================================================
// RESPONSE DTOs (Data returned from API)
// ============================================================================

/**
 * Child profile as returned to parent
 */
export class ChildProfileDto {
  id: string;
  cvccId: string;
  name: string;
  dateOfBirth: string;
  age: string;
  gender: string;
  birthWeight: string;
  birthLength: string;
  bloodType: string;
  relationship: string;
  primaryFacility: {
    id: string;
    name: string;
    address: string;
    phone: string;
  };
  profilePhoto: string;
  allergies: string[];
  criticalNotes: string | null;
}

/**
 * Vaccination record for a child
 */
export class VaccinationRecordDto {
  id: string;
  vaccine: string;
  vaccineCode: string;
  dose: string;
  date: string;
  status: VaccinationStatus;
  administeredBy: string;
  facility: string;
  batchNumber: string | null;
  notes: string | null;
}

/**
 * Upcoming/Missed vaccination
 */
export class UpcomingVaccinationDto {
  scheduleId: string;
  vaccine: string;
  vaccineCode: string;
  doseNumber: number;
  scheduleName: string;
  dueDate: string;
  isOverdue: boolean;
  daysOverdue: number;
  isMandatory: boolean;
}

/**
 * Missed vaccination with child info
 */
export class MissedVaccinationDto {
  childId: string;
  childName: string;
  vaccine: string;
  dueDate: string;
  daysOverdue: number;
}

/**
 * Certificate record
 */
export class CertificateDto {
  certificateId: string;
  childId: string;
  childName: string;
  issuedDate: string;
  issuedBy: string;
  issuedByFacility: string;
  completionStatus: CertificateCompletionStatus;
  qrPayload: string;
  vaccinesCompleted: string[];
  lastVerified: string | null;
  pdfUrl: string | null;
}

/**
 * Appointment record
 */
export class AppointmentDto {
  id: string;
  title: string;
  childId: string;
  childName: string;
  date: string;
  time: string;
  location: string;
  facilityPhone: string;
  status: AppointmentStatus;
  notes: string | null;
}

/**
 * Mother/Guardian profile
 */
export class MotherDetailsDto {
  id: string;
  name: string;
  primaryPhone: string;
  secondaryPhone: string | null;
  email: string | null;
  addressLine1: string;
  landmark: string | null;
  city: string;
  region: string;
  country: string;
  postalCode: string | null;
  preferredContactMethod: ContactMethod;
  emergencyContacts: EmergencyContactDto[];
}

/**
 * Emergency contact
 */
export class EmergencyContactDto {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  isPrimary: boolean;
}

/**
 * Notification record
 */
export class NotificationDto {
  id: string;
  type: string;
  subject: string;
  message: string;
  channel: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
}

/**
 * Dashboard summary for parent
 */
export class ParentDashboardDto {
  guardian: {
    name: string;
    email: string;
  };
  children: ChildSummaryDto[];
  upcomingAppointments: AppointmentDto[];
  missedVaccinations: MissedVaccinationDto[];
  recentNotifications: NotificationDto[];
  healthReminders: string[];
}

/**
 * Child summary for dashboard
 */
export class ChildSummaryDto {
  id: string;
  name: string;
  age: string;
  profilePhoto: string;
  vaccinationProgress: {
    completed: number;
    total: number;
    percentage: number;
  };
  nextVaccination: {
    vaccine: string;
    dueDate: string;
  } | null;
  hasMissedVaccinations: boolean;
  hasCompleteCertificate: boolean;
}

// ============================================================================
// REQUEST DTOs (Data sent to API)
// ============================================================================

/**
 * Update guardian profile
 */
export class UpdateMotherDetailsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  primaryPhone?: string;

  @IsOptional()
  @IsString()
  secondaryPhone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  landmark?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsEnum(ContactMethod)
  preferredContactMethod?: ContactMethod;
}

/**
 * Add/Update emergency contact
 */
export class EmergencyContactRequestDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  relationship: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  isPrimary?: boolean;
}

/**
 * Request an appointment
 */
export class CreateAppointmentDto {
  @IsUUID()
  childId: string;

  @IsOptional()
  @IsUUID()
  vaccineId?: string;

  @IsDateString()
  preferredDate: string;

  @IsOptional()
  @IsString()
  preferredTime?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Cancel appointment
 */
export class CancelAppointmentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * Download certificate request
 */
export class DownloadCertificateDto {
  @IsUUID()
  certificateId: string;

  @IsOptional()
  @IsString()
  format?: 'pdf' | 'image';
}
