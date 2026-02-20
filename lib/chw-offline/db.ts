import Dexie, { type Table } from "dexie"

export type OfflineChild = {
  id: string
  cvccId: string
  fullName: string
  dateOfBirth: string
  gender: "male" | "female" | "intersex" | "undisclosed" | "unknown"
  primaryFacilityId?: string
  catchmentAreaId?: string
  guardianName?: string
  guardianPhone?: string
  updatedAt: string
  syncedAt?: string
}

export type QueueActionType = "record_vaccination" | "register_child" | "update_child"
export type QueueStatus = "pending" | "syncing" | "failed"

export type VaccinationQueueItem = {
  queueId: string
  actionType: QueueActionType
  payload: Record<string, unknown>
  childId?: string
  catchmentAreaId?: string
  idempotencyKey: string
  status: QueueStatus
  retryCount: number
  lastError?: string
  createdAt: string
  updatedAt: string
}

export type OfflineMapStatus = {
  id: string
  catchmentAreaId: string
  minLat: number
  minLng: number
  maxLat: number
  maxLng: number
  minZoom: number
  maxZoom: number
  tileCountEstimated: number
  tileCountCached: number
  lastPreparedAt?: string
  lastSyncedAt?: string
}

class ChwOfflineDatabase extends Dexie {
  children!: Table<OfflineChild, string>
  vaccinationQueue!: Table<VaccinationQueueItem, string>
  offlineMapStatus!: Table<OfflineMapStatus, string>

  constructor() {
    super("cvcc_chw_offline_v2")

    this.version(1).stores({
      children: "id, cvccId, fullName, catchmentAreaId, updatedAt, syncedAt",
      vaccinationQueue:
        "queueId, status, actionType, childId, catchmentAreaId, createdAt, updatedAt, idempotencyKey",
      offlineMapStatus: "id, catchmentAreaId, lastPreparedAt, lastSyncedAt",
    })
  }
}

export const chwOfflineDb = new ChwOfflineDatabase()

export async function upsertChildren(children: OfflineChild[]): Promise<number> {
  if (children.length === 0) return 0

  const normalized = children.map((child) => ({
    ...child,
    updatedAt: child.updatedAt || new Date().toISOString(),
    syncedAt: new Date().toISOString(),
  }))

  await chwOfflineDb.children.bulkPut(normalized)
  return normalized.length
}

export async function getPendingQueueCount(): Promise<number> {
  return chwOfflineDb.vaccinationQueue.where("status").equals("pending").count()
}
