"use client"

import { chwOfflineDb, upsertChildren } from "@/lib/chw-offline/db"
import { searchAllChwChildren, syncChwVaccinations } from "@/lib/api/chw"
import { isBackendAvailable } from "@/lib/network/connectivity"
import {
  getPendingCHWVaccinations,
  markCHWVaccinationSynced,
  type CHWVaccinationRecord,
} from "@/lib/chw-offline-storage"

/**
 * Background Sync Service for CHW Offline-First Architecture
 * 
 * Automatically syncs data from backend to IndexedDB when online
 * Updates happen in the background without user intervention
 */

const SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
const SYNC_STORAGE_KEY = "chw-last-background-sync"

export class ChwBackgroundSyncService {
  private syncInterval: NodeJS.Timeout | null = null
  private isRunning = false

  /**
   * Start background sync service
   * Syncs catchment data every 5 minutes when online
   */
  start() {
    if (this.isRunning) {
      console.log("[CHW Background Sync] Already running")
      return
    }

    console.log("[CHW Background Sync] Starting service")
    this.isRunning = true

    // Initial sync on start
    this.syncCatchmentData()

    // Periodic sync every 5 minutes
    this.syncInterval = setInterval(() => {
      if (navigator.onLine) {
        this.syncCatchmentData()
      } else {
        console.log("[CHW Background Sync] Skipping sync - offline")
      }
    }, SYNC_INTERVAL_MS)

    // Sync when network comes back online
    window.addEventListener("online", this.handleOnline)
  }

  /**
   * Stop background sync service
   */
  stop() {
    console.log("[CHW Background Sync] Stopping service")
    this.isRunning = false

    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }

    window.removeEventListener("online", this.handleOnline)
  }

  private handleOnline = () => {
    console.log("[CHW Background Sync] Network restored - triggering sync")
    this.syncCatchmentData()
  }

  /**
   * Sync catchment data from backend to IndexedDB
   * Updates IndexedDB with fresh data for offline use
   */
  private async syncCatchmentData() {
    const online = await isBackendAvailable()
    if (!online) {
      console.log("[CHW Background Sync] Cannot sync - offline")
      return
    }

    try {
      console.log("[CHW Background Sync] Starting background sync...")

      // Get all children from backend (this will be filtered by catchment on backend)
      // We use a wildcard search to get recent data
      const recentChildren = await searchAllChwChildren("")

      if (recentChildren.length === 0) {
        console.log("[CHW Background Sync] No children to sync")
      } else {
        // Update IndexedDB with latest data
        await upsertChildren(
          recentChildren.map((child) => ({
            id: child.id,
            cvccId: child.childId,
            fullName: child.childName,
            dateOfBirth: child.dateOfBirth,
            gender: (child.gender || "unknown") as "male" | "female" | "intersex" | "undisclosed" | "unknown",
            guardianName: child.motherName,
            guardianPhone: child.motherPhone,
            updatedAt: new Date().toISOString(),
          })),
        )

        console.log(`[CHW Background Sync] ✅ Synced ${recentChildren.length} children to IndexedDB`)
      }

      // Sync pending vaccinations to backend
      await this.syncPendingVaccinations()

      // Record last sync time
      localStorage.setItem(SYNC_STORAGE_KEY, new Date().toISOString())
    } catch (error) {
      console.error("[CHW Background Sync] Sync failed:", error)
    }
  }

  /**
   * Sync pending vaccinations from IndexedDB to backend
   * Uploads offline-recorded vaccinations with GPS coordinates
   */
  private async syncPendingVaccinations() {
    try {
      // Get only unsynced vaccinations from IndexedDB
      const pendingVaccinations = await getPendingCHWVaccinations()

      if (pendingVaccinations.length === 0) {
        console.log("[CHW Background Sync] No pending vaccinations to sync")
        return
      }

      console.log(`[CHW Background Sync] Uploading ${pendingVaccinations.length} pending vaccinations...`)

      // Format for backend API
      const vaccinationsToSync = pendingVaccinations.map((v) => ({
        childId: v.childId,
        vaccineId: v.vaccineId,
        vaccineName: v.vaccineName,
        recordedDate: v.recordedDate,
        latitude: v.latitude,
        longitude: v.longitude,
        notes: v.notes,
      }))

      // Upload to backend
      const result = await syncChwVaccinations(vaccinationsToSync)

      console.log(
        `[CHW Background Sync] Vaccination sync complete - synced: ${result.synced}, failed: ${result.failed}`,
      )

      // Mark synced vaccinations (keep records for activity log, just flag as synced)
      for (const vaccination of pendingVaccinations) {
        const wasFailed = result.errors.some(
          (err) =>
            err.vaccination.childId === vaccination.childId &&
            err.vaccination.vaccineId === vaccination.vaccineId &&
            err.vaccination.recordedDate === vaccination.recordedDate,
        )

        if (!wasFailed) {
          await markCHWVaccinationSynced(vaccination.childId, vaccination.vaccineId, vaccination.recordedDate)
        }
      }

      if (result.failed > 0) {
        console.error("[CHW Background Sync] Some vaccinations failed to sync:", result.errors)
      }
    } catch (error) {
      console.error("[CHW Background Sync] Vaccination sync failed:", error)
    }
  }

  /**
   * Manually trigger sync
   * Useful for user-initiated refresh
   */
  async manualSync(): Promise<void> {
    return this.syncCatchmentData()
  }

  /**
   * Get last sync timestamp
   */
  getLastSyncTime(): string | null {
    return localStorage.getItem(SYNC_STORAGE_KEY)
  }
}

// Export singleton instance
export const chwBackgroundSync = new ChwBackgroundSyncService()
