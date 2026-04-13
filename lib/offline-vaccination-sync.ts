/**
 * Offline Vaccination Sync Utility
 * Handles storing pending vaccinations in IndexedDB and syncing when online
 */

import * as facilityApi from "@/lib/api/facility"
import { decryptData, encryptData } from "@/lib/secure-storage"

const DB_NAME = "cvcc_offline_vaccinations"
const DB_VERSION = 1
const STORE_NAME = "pending_vaccinations"
const ENCRYPTION_KEY_STORAGE = "facility_offline_encryption_key"
const STABLE_ENCRYPTION_KEY_PREFIX = "facility_offline_stable_key:"

export type PendingVaccination = {
  id: string
  childId: string
  vaccineName: string
  administeredDate: string
  batchNumber: string
  expiryDate?: string
  administeredBy: string
  vaccinationSite?: string
  aefiFlag: boolean
  notes?: string
  timestamp: number
  retryCount: number
  status: "pending" | "syncing" | "failed"
}

type StoredPendingVaccination = {
  id: string
  status: PendingVaccination["status"]
  retryCount: number
  timestamp: number
  encryptedPayload?: string
  // Legacy plain-text fields for backward compatibility.
  childId?: string
  vaccineName?: string
  administeredDate?: string
  batchNumber?: string
  expiryDate?: string
  administeredBy?: string
  vaccinationSite?: string
  aefiFlag?: boolean
  notes?: string
}

function getEncryptionKey(): string {
  if (typeof window === "undefined") {
    throw new Error("Offline encryption is only available in the browser")
  }

  const cached = sessionStorage.getItem(ENCRYPTION_KEY_STORAGE)
  if (cached) {
    return cached
  }

  const userId = localStorage.getItem("userId") || "anonymous"
  const stableKeyStorageName = `${STABLE_ENCRYPTION_KEY_PREFIX}${userId}`
  const stableKey = localStorage.getItem(stableKeyStorageName)

  if (stableKey) {
    sessionStorage.setItem(ENCRYPTION_KEY_STORAGE, stableKey)
    return stableKey
  }

  const token = localStorage.getItem("accessToken") || localStorage.getItem("authToken")
  const generatedKey = token
    ? `${userId}:${token.substring(0, 32)}`
    : `${userId}:cvcc-facility-offline`

  localStorage.setItem(stableKeyStorageName, generatedKey)
  sessionStorage.setItem(ENCRYPTION_KEY_STORAGE, generatedKey)

  return generatedKey
}

function isLegacyPlainRecord(
  record: StoredPendingVaccination,
): record is PendingVaccination {
  return (
    typeof record.childId === "string" &&
    typeof record.vaccineName === "string" &&
    typeof record.administeredDate === "string" &&
    typeof record.batchNumber === "string" &&
    typeof record.administeredBy === "string"
  )
}

async function toStoredRecord(
  vaccination: PendingVaccination,
): Promise<StoredPendingVaccination> {
  const encryptedPayload = await encryptData(vaccination, getEncryptionKey())

  return {
    id: vaccination.id,
    status: vaccination.status,
    retryCount: vaccination.retryCount,
    timestamp: vaccination.timestamp,
    encryptedPayload,
  }
}

async function fromStoredRecord(
  storedRecord: StoredPendingVaccination,
): Promise<PendingVaccination | null> {
  if (storedRecord.encryptedPayload) {
    try {
      const decrypted = await decryptData<PendingVaccination>(
        storedRecord.encryptedPayload,
        getEncryptionKey(),
      )

      return {
        ...decrypted,
        id: storedRecord.id,
        status: storedRecord.status,
        retryCount:
          typeof storedRecord.retryCount === "number"
            ? storedRecord.retryCount
            : decrypted.retryCount,
        timestamp:
          typeof storedRecord.timestamp === "number"
            ? storedRecord.timestamp
            : decrypted.timestamp,
      }
    } catch (error) {
      console.error(
        `Failed to decrypt offline vaccination ${storedRecord.id}:`,
        error,
      )
      return null
    }
  }

  if (!isLegacyPlainRecord(storedRecord)) {
    return null
  }

  return {
    id: storedRecord.id,
    childId: storedRecord.childId,
    vaccineName: storedRecord.vaccineName,
    administeredDate: storedRecord.administeredDate,
    batchNumber: storedRecord.batchNumber,
    expiryDate: storedRecord.expiryDate,
    administeredBy: storedRecord.administeredBy,
    vaccinationSite: storedRecord.vaccinationSite,
    aefiFlag: Boolean(storedRecord.aefiFlag),
    notes: storedRecord.notes,
    timestamp: storedRecord.timestamp,
    retryCount: storedRecord.retryCount,
    status: storedRecord.status,
  }
}

async function migrateLegacyRecords(
  records: PendingVaccination[],
): Promise<void> {
  if (records.length === 0) {
    return
  }

  const db = await openDB()
  const encryptedRecords = await Promise.all(records.map(toStoredRecord))

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)

    encryptedRecords.forEach((record) => {
      store.put(record)
    })
  })
}

// Initialize IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: "id" })
        objectStore.createIndex("status", "status", { unique: false })
        objectStore.createIndex("timestamp", "timestamp", { unique: false })
      }
    }
  })
}

// Save vaccination to IndexedDB
export async function savePendingVaccination(
  childId: string,
  data: facilityApi.AdministerVaccineRequest
): Promise<string> {
  const db = await openDB()
  const id = `vax_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const pendingVaccination: PendingVaccination = {
    id,
    childId,
    vaccineName: data.vaccineName,
    administeredDate: data.administeredDate,
    batchNumber: data.batchNumber,
    expiryDate: data.expiryDate,
    administeredBy: data.administeredBy,
    vaccinationSite: data.vaccinationSite,
    aefiFlag: data.aefiFlag || false,
    notes: data.notes,
    timestamp: Date.now(),
    retryCount: 0,
    status: "pending",
  }

  const storedVaccination = await toStoredRecord(pendingVaccination)

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.add(storedVaccination)

    request.onsuccess = () => resolve(id)
    request.onerror = () => reject(request.error)
  })
}

// Get all pending vaccinations
export async function getPendingVaccinations(): Promise<PendingVaccination[]> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => {
      ;(async () => {
        const rawRecords = (request.result || []) as StoredPendingVaccination[]
        const legacyRecordsToMigrate: PendingVaccination[] = []

        const parsed = await Promise.all(
          rawRecords.map(async (record) => {
            const parsedRecord = await fromStoredRecord(record)
            if (parsedRecord && !record.encryptedPayload) {
              legacyRecordsToMigrate.push(parsedRecord)
            }
            return parsedRecord
          }),
        )

        const validRecords = parsed.filter(
          (item): item is PendingVaccination => item !== null,
        )

        resolve(validRecords)

        if (legacyRecordsToMigrate.length > 0) {
          void migrateLegacyRecords(legacyRecordsToMigrate).catch((error) => {
            console.error("Failed to migrate legacy offline records:", error)
          })
        }
      })().catch((error) => reject(error))
    }
    request.onerror = () => reject(request.error)
  })
}

// Update vaccination status
export async function updateVaccinationStatus(
  id: string,
  status: "pending" | "syncing" | "failed",
  retryCount?: number
): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const getRequest = store.get(id)

    getRequest.onsuccess = () => {
      const vaccination = getRequest.result as StoredPendingVaccination | undefined
      if (vaccination) {
        vaccination.status = status
        if (retryCount !== undefined) {
          vaccination.retryCount = retryCount
        }
        
        const updateRequest = store.put(vaccination)
        updateRequest.onsuccess = () => resolve()
        updateRequest.onerror = () => reject(updateRequest.error)
      } else {
        resolve()
      }
    }
    getRequest.onerror = () => reject(getRequest.error)
  })
}

// Delete vaccination from IndexedDB
export async function deletePendingVaccination(id: string): Promise<void> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// Get count of pending vaccinations
export async function getPendingCount(): Promise<number> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => {
      const records = (request.result || []) as StoredPendingVaccination[]
      const unsyncedCount = records.filter(
        (record) => record.status === "pending" || record.status === "failed",
      ).length
      resolve(unsyncedCount)
    }
    request.onerror = () => reject(request.error)
  })
}

// Sync a single pending vaccination
async function syncVaccination(vaccination: PendingVaccination): Promise<boolean> {
  try {
    await updateVaccinationStatus(vaccination.id, "syncing")

    const requestData: facilityApi.AdministerVaccineRequest = {
      vaccineName: vaccination.vaccineName,
      administeredDate: vaccination.administeredDate,
      batchNumber: vaccination.batchNumber,
      expiryDate: vaccination.expiryDate,
      administeredBy: vaccination.administeredBy,
      vaccinationSite: vaccination.vaccinationSite,
      aefiFlag: vaccination.aefiFlag,
      notes: vaccination.notes,
    }

    await facilityApi.administerVaccine(vaccination.childId, requestData)
    await deletePendingVaccination(vaccination.id)
    
    return true
  } catch (error) {
    console.error(`Failed to sync vaccination ${vaccination.id}:`, error)
    
    // Update retry count and status
    const newRetryCount = vaccination.retryCount + 1
    const newStatus = newRetryCount >= 5 ? "failed" : "pending"
    await updateVaccinationStatus(vaccination.id, newStatus, newRetryCount)
    
    return false
  }
}

// Sync all pending vaccinations
export async function syncPendingVaccinations(): Promise<{
  success: number
  failed: number
  total: number
}> {
  const pending = await getPendingVaccinations()
  const unsynced = pending.filter(
    (vaccination) =>
      vaccination.status === "pending" || vaccination.status === "failed",
  )

  let success = 0
  let failed = 0

  for (const vaccination of unsynced) {
    const result = await syncVaccination(vaccination)
    if (result) {
      success++
    } else {
      failed++
    }
  }

  return {
    success,
    failed,
    total: unsynced.length,
  }
}

// Start background sync monitoring
export function startBackgroundSync(
  onSyncComplete?: (result: { success: number; failed: number; total: number }) => void
) {
  let isOnline = navigator.onLine
  let syncInterval: NodeJS.Timeout | null = null

  const attemptSync = async () => {
    if (!navigator.onLine) return

    const pending = await getPendingCount()
    if (pending === 0) return

    const result = await syncPendingVaccinations()
    
    if (onSyncComplete && result.total > 0) {
      onSyncComplete(result)
    }
  }

  // Listen for online event
  const handleOnline = () => {
    if (!isOnline) {
      isOnline = true
      attemptSync()
    }
  }

  const handleOffline = () => {
    isOnline = false
  }

  window.addEventListener("online", handleOnline)
  window.addEventListener("offline", handleOffline)

  // Check every 30 seconds when online
  syncInterval = setInterval(() => {
    if (navigator.onLine) {
      attemptSync()
    }
  }, 30000)

  // Return cleanup function
  return () => {
    window.removeEventListener("online", handleOnline)
    window.removeEventListener("offline", handleOffline)
    if (syncInterval) {
      clearInterval(syncInterval)
    }
  }
}
