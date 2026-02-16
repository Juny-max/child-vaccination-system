/**
 * Offline Vaccination Sync Utility
 * Handles storing pending vaccinations in IndexedDB and syncing when online
 */

import * as facilityApi from "@/lib/api/facility"

const DB_NAME = "cvcc_offline_vaccinations"
const DB_VERSION = 1
const STORE_NAME = "pending_vaccinations"

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

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.add(pendingVaccination)

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

    request.onsuccess = () => resolve(request.result || [])
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
      const vaccination = getRequest.result
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
    const index = store.index("status")
    const request = index.count(IDBKeyRange.only("pending"))

    request.onsuccess = () => resolve(request.result)
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
  const pendingOnly = pending.filter(v => v.status === "pending")

  let success = 0
  let failed = 0

  for (const vaccination of pendingOnly) {
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
    total: pendingOnly.length,
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
    
    if (result.success > 0 && onSyncComplete) {
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
