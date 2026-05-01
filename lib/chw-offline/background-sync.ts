"use client"

import { chwOfflineDb, upsertChildren, removeChildFromLocalRegister, getChildren } from "@/lib/chw-offline/db"
import { getChwLocalRegister, syncChwVaccinations } from "@/lib/api/chw"
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
 *
 * Key features:
 * - Syncs CHW's local register (children in their catchment)
 * - Removes children that were transferred OUT (pulled by another CHW)
 * - Uploads pending offline vaccinations
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
   *
   * This method:
   * 1. Fetches the CHW's current local register from backend
   * 2. Updates IndexedDB with the current children
   * 3. REMOVES children that are no longer in the register (transferred out / pulled away)
   */
  private async syncCatchmentData() {
    const online = await isBackendAvailable()
    if (!online) {
      console.log("[CHW Background Sync] Cannot sync - offline")
      return
    }

    try {
      console.log("[CHW Background Sync] Starting background sync...")

      // Fetch the CHW's LOCAL REGISTER (only children in their catchment)
      // This is the authoritative list from the backend
      const serverChildren = await getChwLocalRegister()

      // Get current local children from IndexedDB
      const localChildren = await getChildren()

      // Create a Set of IDs that should be in the local register
      const serverChildIds = new Set(serverChildren.map((c) => c.id))

      // Find children that are in local IndexedDB but NOT on server anymore
      // These children were transferred OUT (pulled by another CHW)
      const childrenToRemove = localChildren.filter((local) => !serverChildIds.has(local.id))

      if (childrenToRemove.length > 0) {
        console.log(
          `[CHW Background Sync] 🔄 Removing ${childrenToRemove.length} children that were transferred out:`,
          childrenToRemove.map((c) => c.fullName),
        )

        // Remove each transferred-out child from local IndexedDB
        for (const child of childrenToRemove) {
          await removeChildFromLocalRegister(child.id)
        }

        console.log(`[CHW Background Sync] ✅ Removed ${childrenToRemove.length} transferred-out children`)
      }

      // Update IndexedDB with current server data
      if (serverChildren.length > 0) {
        await upsertChildren(
          serverChildren.map((child) => ({
            id: child.id,
            cvccId: child.cvccId,
            fullName: child.fullName,
            dateOfBirth: child.dateOfBirth,
            gender: (child.gender || "unknown") as "male" | "female" | "intersex" | "undisclosed" | "unknown",
            guardianName: child.guardianName,
            guardianPhone: child.guardianPhone,
            catchmentAreaId: child.catchmentAreaId,
            updatedAt: new Date().toISOString(),
          })),
        )

        console.log(`[CHW Background Sync] ✅ Synced ${serverChildren.length} children to IndexedDB`)
      } else {
        console.log("[CHW Background Sync] No children in catchment to sync")
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
