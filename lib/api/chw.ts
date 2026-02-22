import { apiRequest } from "./config"

export type ChwVisit = {
  id: string
  childId: string
  childName: string
  vaccineDue: string
  householdLocation: string
  distanceKm: number
}

export type ChwDashboardSummary = {
  totalAssignedChildren: number
  pendingQueueCount: number
  visits: ChwVisit[]
  fetchedAt: string
}

export type ChwSearchResult = {
  id: string
  childId: string
  childName: string
  motherName: string
  motherPhone: string
  nextVaccine: string
  village: string
  dateOfBirth: string
  gender: string
}

export type ChwChildChart = {
  id: string
  name: string
  age: string
  motherName: string
  motherPhone: string
  village: string
  outstandingVaccines: Array<{
    id: string
    name: string
    status: "overdue" | "due"
    scheduledDate: string
  }>
  history: Array<{
    id: string
    name: string
    status: "completed"
    scheduledDate: string
    administeredDate: string
  }>
}

export type ChwMotherSearchResult = {
  id: string
  name: string
  phone: string
}

export async function getChwDashboardSummary(): Promise<ChwDashboardSummary> {
  return apiRequest<ChwDashboardSummary>("/chw/dashboard/summary")
}

export async function searchChwChildren(query: string): Promise<ChwSearchResult[]> {
  return apiRequest<ChwSearchResult[]>(`/chw/children/search?query=${encodeURIComponent(query)}`)
}

/**
 * Search all children without catchment restriction (for online mode)
 * Used when CHW is online and can help children from any area
 */
export async function searchAllChwChildren(query: string): Promise<ChwSearchResult[]> {
  return apiRequest<ChwSearchResult[]>(`/chw/children/search-all?query=${encodeURIComponent(query)}`)
}

export async function searchChwMothers(query: string): Promise<ChwMotherSearchResult[]> {
  return apiRequest<ChwMotherSearchResult[]>(`/chw/mothers/search?query=${encodeURIComponent(query)}`)
}

export async function getChwChildChart(childId: string): Promise<ChwChildChart> {
  return apiRequest<ChwChildChart>(`/chw/children/${encodeURIComponent(childId)}/chart`)
}

/**
 * Get child chart without catchment restriction (for online mode)
 * Used when CHW is online and can help children from any area
 */
export async function getChwChildChartAll(childId: string): Promise<ChwChildChart> {
  return apiRequest<ChwChildChart>(`/chw/children/${encodeURIComponent(childId)}/chart-all`)
}

export async function queueChwOfflineRegistration(payload: Record<string, unknown>) {
  return apiRequest<{ queued: boolean; queueId: string; status: string; createdAt: string }>(
    "/chw/offline-registrations",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  )
}

// ============================================================================
// VACCINATION SYNC
// ============================================================================

export type CHWVaccinationRecord = {
  childId: string
  vaccineId: string
  vaccineName: string
  recordedDate: string
  latitude?: number
  longitude?: number
  notes?: string
}

export type SyncVaccinationsResult = {
  synced: number
  failed: number
  errors: Array<{
    vaccination: CHWVaccinationRecord
    reason: string
  }>
}

/**
 * Sync offline CHW vaccinations to the database
 * Uploads vaccinations recorded in the field with GPS coordinates
 */
export async function syncChwVaccinations(
  vaccinations: CHWVaccinationRecord[],
): Promise<SyncVaccinationsResult> {
  return apiRequest<SyncVaccinationsResult>("/chw/vaccinations/sync", {
    method: "POST",
    body: JSON.stringify({ vaccinations }),
  })
}
