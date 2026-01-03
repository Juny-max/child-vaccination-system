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
