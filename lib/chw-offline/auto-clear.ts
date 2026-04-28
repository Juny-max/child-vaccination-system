/**
 * Auto-Clear Inactive Data
 * Automatically clears IndexedDB data after 7 days of inactivity
 * for security and data minimization compliance
 */

import { chwOfflineDb } from "@/lib/chw-offline/db"
import { clearAuditLog } from "@/lib/chw-offline/audit-log"
import { clearEncryptionKey } from "@/lib/chw-offline/encryption"

const LAST_ACCESS_KEY = "chw_last_data_access"
const INACTIVITY_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Update last access timestamp
 */
export function updateLastAccess(): void {
  if (typeof window === "undefined") return
  localStorage.setItem(LAST_ACCESS_KEY, new Date().toISOString())
}

/**
 * Get last access timestamp
 */
export function getLastAccess(): Date | null {
  if (typeof window === "undefined") return null

  const lastAccess = localStorage.getItem(LAST_ACCESS_KEY)
  return lastAccess ? new Date(lastAccess) : null
}

/**
 * Check if data is stale (not accessed for 7 days)
 */
export function isDataStale(): boolean {
  const lastAccess = getLastAccess()
  if (!lastAccess) return false

  const now = new Date()
  const timeSinceLastAccess = now.getTime() - lastAccess.getTime()

  return timeSinceLastAccess > INACTIVITY_THRESHOLD_MS
}

/**
 * Clear all offline data (for security/compliance)
 */
export async function clearAllOfflineData(): Promise<void> {
  if (typeof window === "undefined") return

  try {
    console.log("[Security] Clearing all offline data...")

    // Clear IndexedDB databases
    await chwOfflineDb.children.clear()
    await chwOfflineDb.vaccinationQueue.clear()
    await chwOfflineDb.offlineMapStatus.clear()
    await chwOfflineDb.childCharts.clear()

    // Clear audit log
    clearAuditLog()

    // Clear encryption key
    clearEncryptionKey()

    // Clear last access timestamp
    localStorage.removeItem(LAST_ACCESS_KEY)

    console.log("[Security] ✅ All offline data cleared")
  } catch (error) {
    console.error("[Security] Failed to clear offline data:", error)
  }
}

/**
 * Auto-clear check - run on app startup
 * Clears data if inactive for 7 days
 */
export async function checkAndClearStaleData(): Promise<boolean> {
  if (isDataStale()) {
    console.log("[Security] Data inactive for 7+ days - auto-clearing for security")
    await clearAllOfflineData()
    return true
  }

  // Update last access on check
  updateLastAccess()
  return false
}

/**
 * Get days since last access
 */
export function getDaysSinceLastAccess(): number | null {
  const lastAccess = getLastAccess()
  if (!lastAccess) return null

  const now = new Date()
  const timeSinceLastAccess = now.getTime() - lastAccess.getTime()
  return Math.floor(timeSinceLastAccess / (24 * 60 * 60 * 1000))
}
