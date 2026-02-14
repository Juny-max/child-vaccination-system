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
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  childId: string;  // CVCC ID for display (e.g., CHILD-001)
  name: string;
  dateOfBirth: string;
  age: string;
  gender: string;
  weight: string;
  length: string;
  bloodType: string;
  profilePhoto: string;
  registrationDate: string;
  facilityName: string;
  facilityId: string;
}

/**
 * Vaccination record for a child
 */
export class VaccinationRecordDto {
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
  /** Progress of vaccinations e.g. "10/17" */
  vaccinationProgress?: string;
}

/**
 * Appointment record
 */
export class AppointmentDto {
  id: string;
  purpose: string;
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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmergencyContactRequestDto)
  emergencyContacts?: EmergencyContactRequestDto[];
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
  @Matches(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, {
    message: 'childId must be a valid UUID format',
  })
  childId: string;

  @IsOptional()
  @Matches(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, {
    message: 'vaccineId must be a valid UUID format',
  })
  vaccineId?: string;

  @IsOptional()
  @Matches(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, {
    message: 'facilityId must be a valid UUID format',
  })
  facilityId?: string;

  @IsDateString()
  preferredDate: string;

  @IsOptional()
  @IsString()
  preferredTime?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

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
  @IsUUID('all')  // Accept all UUID formats
  certificateId: string;

  @IsOptional()
  @IsString()
  format?: 'pdf' | 'image';
}
