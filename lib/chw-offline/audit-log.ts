/**
 * Audit Logging for CHW Offline Data Access
 * Tracks all access to sensitive health data for compliance and security
 */

const AUDIT_LOG_KEY = "chw_audit_log"
const MAX_AUDIT_ENTRIES = 1000 // Keep last 1000 entries

export type AuditLogEntry = {
  timestamp: string
  userId: string | null
  action: "read" | "write" | "delete" | "store"
  resourceType: string
  recordCount: number
  metadata?: Record<string, any>
  sessionId: string
}

/**
 * Get or create session ID for tracking user sessions
 */
function getSessionId(): string {
  if (typeof window === "undefined") return "server"

  let sessionId = sessionStorage.getItem("audit_session_id")
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
    sessionStorage.setItem("audit_session_id", sessionId)
  }
  return sessionId
}

/**
 * Log data access event
 */
export function logDataAccess(
  action: AuditLogEntry["action"],
  resourceType: string,
  recordCount: number,
  metadata?: Record<string, any>,
): void {
  if (typeof window === "undefined") return

  try {
    const userId = localStorage.getItem("userId")
    const sessionId = getSessionId()

    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      userId,
      action,
      resourceType,
      recordCount,
      metadata,
      sessionId,
    }

    // Get existing log
    const existingLog = localStorage.getItem(AUDIT_LOG_KEY)
    const log: AuditLogEntry[] = existingLog ? JSON.parse(existingLog) : []

    // Add new entry
    log.push(entry)

    // Keep only last MAX_AUDIT_ENTRIES to prevent storage bloat
    if (log.length > MAX_AUDIT_ENTRIES) {
      log.splice(0, log.length - MAX_AUDIT_ENTRIES)
    }

    // Save back to localStorage
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(log))

    // Console log for debugging (can be disabled in production)
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[Audit] ${action.toUpperCase()} ${resourceType} (${recordCount} records)`,
        metadata || "",
      )
    }
  } catch (error) {
    console.error("Failed to write audit log:", error)
  }
}

/**
 * Get audit log entries
 */
export function getAuditLog(limit?: number): AuditLogEntry[] {
  if (typeof window === "undefined") return []

  try {
    const existingLog = localStorage.getItem(AUDIT_LOG_KEY)
    if (!existingLog) return []

    const log: AuditLogEntry[] = JSON.parse(existingLog)

    if (limit) {
      return log.slice(-limit)
    }

    return log
  } catch (error) {
    console.error("Failed to read audit log:", error)
    return []
  }
}

/**
 * Clear audit log (for data retention compliance)
 */
export function clearAuditLog(): void {
  if (typeof window === "undefined") return

  try {
    localStorage.removeItem(AUDIT_LOG_KEY)
    console.log("[Audit] Audit log cleared")
  } catch (error) {
    console.error("Failed to clear audit log:", error)
  }
}

/**
 * Export audit log for compliance reporting
 */
export function exportAuditLog(): string {
  const log = getAuditLog()
  return JSON.stringify(log, null, 2)
}

/**
 * Get audit statistics
 */
export function getAuditStats(): {
  totalEntries: number
  readCount: number
  writeCount: number
  deleteCount: number
  storeCount: number
  uniqueUsers: number
  dateRange: { from: string; to: string } | null
} {
  const log = getAuditLog()

  if (log.length === 0) {
    return {
      totalEntries: 0,
      readCount: 0,
      writeCount: 0,
      deleteCount: 0,
      storeCount: 0,
      uniqueUsers: 0,
      dateRange: null,
    }
  }

  const uniqueUsers = new Set(log.filter((e) => e.userId).map((e) => e.userId))

  return {
    totalEntries: log.length,
    readCount: log.filter((e) => e.action === "read").length,
    writeCount: log.filter((e) => e.action === "write").length,
    deleteCount: log.filter((e) => e.action === "delete").length,
    storeCount: log.filter((e) => e.action === "store").length,
    uniqueUsers: uniqueUsers.size,
    dateRange: {
      from: log[0].timestamp,
      to: log[log.length - 1].timestamp,
    },
  }
}
