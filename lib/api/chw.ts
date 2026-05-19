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

export type ChwNotification = {
  id: string
  templateId: string
  subject: string | null
  message: string
  status: string
  createdAt: string
  metadata: Record<string, unknown>
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
  // Added for pull transfer support
  catchmentAreaId?: string | null
  currentZoneName?: string | null
  currentBranchId?: string | null
  requiresPull?: boolean
}

export type TransferInSearchResult = ChwSearchResult & {
  requiresPull: boolean
}

export type AdvancedTransferInSearchInput = {
  childName: string
  motherName: string
  dob: string
}

export type ChwChildChart = {
  id: string
  name: string
  age: string
  dateOfBirth: string
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

export async function getChwNotifications(
  limit = 10,
  unreadOnly = true,
): Promise<ChwNotification[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    unreadOnly: String(unreadOnly),
  })
  return apiRequest<ChwNotification[]>(`/chw/notifications?${params.toString()}`)
}

export async function markChwNotificationRead(
  notificationId: string,
): Promise<{ success: boolean; marked: boolean }> {
  return apiRequest<{ success: boolean; marked: boolean }>(
    `/chw/notifications/${encodeURIComponent(notificationId)}/read`,
    {
      method: "POST",
    },
  )
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

/**
 * Quick transfer-in search by exact child UUID or exact mother phone number.
 */
export async function quickSearchTransferInChildren(identifier: string): Promise<TransferInSearchResult[]> {
  return apiRequest<TransferInSearchResult[]>(
    `/children/search?identifier=${encodeURIComponent(identifier)}`,
  )
}

/**
 * Advanced fallback transfer-in search by child name, mother name, and date of birth.
 */
export async function advancedSearchTransferInChildren(
  input: AdvancedTransferInSearchInput,
): Promise<TransferInSearchResult[]> {
  const params = new URLSearchParams({
    childName: input.childName,
    motherName: input.motherName,
    dob: input.dob,
  })

  return apiRequest<TransferInSearchResult[]>(`/children/advanced-search?${params.toString()}`)
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
  return apiRequest<{
    queued: boolean
    queueId: string
    status: string
    createdAt: string
    childId?: string | null
    errorMessage?: string
  }>(
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

// ============================================================================
// CATCHMENT REGISTER
// ============================================================================

export type ChwRegisterChild = {
  id: string
  cvccId: string
  fullName: string
  dateOfBirth: string
  gender: string
  primaryFacilityId?: string
  catchmentAreaId: string
  guardianName: string
  guardianPhone: string
}

/**
 * Fetch all children in the CHW's assigned catchment area (the community register)
 */
export async function getChwLocalRegister(): Promise<ChwRegisterChild[]> {
  return apiRequest<ChwRegisterChild[]>("/chw/register")
}

// ============================================================================
// TRANSFER OPERATIONS
// ============================================================================

export type TransferPullResult = {
  success: boolean
  message: string
  childId: string
  childName: string
  previousCatchment: string
  newCatchment: string
  newCatchmentId?: string
  wasPulled: boolean
  timestamp: string
}

/**
 * Transfer Pull: Forcefully pull a child from another catchment area
 *
 * This is the "Pull Mechanism" - allows a CHW to pull a child's record from
 * another CHW's catchment area, even if the old CHW hasn't transferred them out.
 *
 * Creates dual audit logs:
 * - transfer_out for the OLD catchment/branch
 * - transfer_in for the NEW catchment/branch
 */
export async function transferPullChild(
  childId: string,
  notes?: string,
): Promise<TransferPullResult> {
  return apiRequest<TransferPullResult>(`/chw/children/${encodeURIComponent(childId)}/transfer-pull`, {
    method: "POST",
    body: JSON.stringify({ childId, notes }),
  })
}
