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
