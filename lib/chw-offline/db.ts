import Dexie, { type Table } from "dexie"
import { encryptObject, decryptObject } from "@/lib/chw-offline/encryption"
import { logDataAccess } from "@/lib/chw-offline/audit-log"

// Sensitive fields that should be encrypted
const CHILD_SENSITIVE_FIELDS: (keyof OfflineChild)[] = [
  "fullName",
  "dateOfBirth",
  "guardianName",
  "guardianPhone",
]

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

export type QueueActionType = "record_vaccination" | "register_child" | "update_child" | "transfer_in" | "transfer_out"
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

  try {
    // Encrypt sensitive fields before storing
    const encrypted = await Promise.all(
      children.map(async (child) => {
        const normalized = {
          ...child,
          updatedAt: child.updatedAt || new Date().toISOString(),
          syncedAt: new Date().toISOString(),
        }
        return await encryptObject(normalized, CHILD_SENSITIVE_FIELDS)
      }),
    )

    await chwOfflineDb.children.bulkPut(encrypted)
    
    // Log data access for audit
    logDataAccess("store", "children", encrypted.length)
    
    return encrypted.length
  } catch (error) {
    console.error("Failed to encrypt and store children:", error)
    // Fallback: store unencrypted if encryption fails (degraded mode)
    const normalized = children.map((child) => ({
      ...child,
      updatedAt: child.updatedAt || new Date().toISOString(),
      syncedAt: new Date().toISOString(),
    }))
    await chwOfflineDb.children.bulkPut(normalized)
    return normalized.length
  }
}

/**
 * Get children from IndexedDB and decrypt sensitive fields
 */
export async function getChildren(limit?: number): Promise<OfflineChild[]> {
  try {
    const query = chwOfflineDb.children.orderBy("syncedAt").reverse()
    const encrypted = limit ? await query.limit(limit).toArray() : await query.toArray()

    // Decrypt sensitive fields
    const decrypted = await Promise.all(
      encrypted.map((child) => decryptObject(child, CHILD_SENSITIVE_FIELDS)),
    )

    // Log data access for audit
    logDataAccess("read", "children", decrypted.length)

    return decrypted
  } catch (error) {
    console.error("Failed to decrypt children:", error)
    return []
  }
}

/**
 * Get a single child by ID and decrypt
 */
export async function getChildById(id: string): Promise<OfflineChild | undefined> {
  try {
    const encrypted = await chwOfflineDb.children.get(id)
    if (!encrypted) return undefined

    const decrypted = await decryptObject(encrypted, CHILD_SENSITIVE_FIELDS)
    
    // Log data access for audit
    logDataAccess("read", "child", 1, { childId: id })

    return decrypted
  } catch (error) {
    console.error("Failed to decrypt child:", error)
    return undefined
  }
}

export async function getPendingQueueCount(): Promise<number> {
  return chwOfflineDb.vaccinationQueue.where("status").equals("pending").count()
}

/**
 * Queue a transfer-in operation (to be synced when online)
 */
export async function queueTransferIn(childId: string, notes?: string): Promise<string> {
  const queueId = `transfer-in-${childId}-${Date.now()}`
  const item: VaccinationQueueItem = {
    queueId,
    actionType: "transfer_in",
    payload: { childId, notes },
    childId,
    idempotencyKey: queueId,
    status: "pending",
    retryCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await chwOfflineDb.vaccinationQueue.add(item)
  
  logDataAccess("write", "queue_transfer_in", 1, { childId })
  
  return queueId
}

/**
 * Queue a transfer-out operation (to be synced when online)
 */
export async function queueTransferOut(childId: string, reason?: string): Promise<string> {
  const queueId = `transfer-out-${childId}-${Date.now()}`
  const item: VaccinationQueueItem = {
    queueId,
    actionType: "transfer_out",
    payload: { childId, reason },
    childId,
    idempotencyKey: queueId,
    status: "pending",
    retryCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await chwOfflineDb.vaccinationQueue.add(item)
  
  logDataAccess("write", "queue_transfer_out", 1, { childId })
  
  return queueId
}

/**
 * Remove child from local Dexie register (after successful transfer-out)
 */
export async function removeChildFromLocalRegister(childId: string): Promise<void> {
  await chwOfflineDb.children.delete(childId)
  
  logDataAccess("delete", "child", 1, { childId })
}

/**
 * Get all children in a specific catchment area
 */
export async function getChildrenByCatchment(catchmentAreaId: string): Promise<OfflineChild[]> {
  try {
    const encrypted = await chwOfflineDb.children
      .where("catchmentAreaId")
      .equals(catchmentAreaId)
      .toArray()

    const decrypted = await Promise.all(
      encrypted.map((child) => decryptObject(child, CHILD_SENSITIVE_FIELDS)),
    )

    logDataAccess("read", "children_by_catchment", decrypted.length, { catchmentAreaId })

    return decrypted
  } catch (error) {
    console.error("Failed to get children by catchment:", error)
    return []
  }
}
