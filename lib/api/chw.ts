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

export async function getChwDashboardSummary(): Promise<ChwDashboardSummary> {
  return apiRequest<ChwDashboardSummary>("/chw/dashboard/summary")
}

export async function searchChwChildren(query: string): Promise<ChwSearchResult[]> {
  return apiRequest<ChwSearchResult[]>(`/chw/children/search?query=${encodeURIComponent(query)}`)
}

export async function getChwChildChart(childId: string): Promise<ChwChildChart> {
  return apiRequest<ChwChildChart>(`/chw/children/${encodeURIComponent(childId)}/chart`)
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
