/**
 * Auto-Logout Timer
 * Automatically logs out user after 15 minutes of inactivity
 * Tracks mouse, keyboard, touch activity
 */

const IDLE_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes
const WARNING_BEFORE_LOGOUT_MS = 2 * 60 * 1000 // Warn 2 minutes before logout

type IdleCallback = () => void
type WarningCallback = (secondsRemaining: number) => void

class AutoLogoutTimer {
  private idleTimer: NodeJS.Timeout | null = null
  private warningTimer: NodeJS.Timeout | null = null
  private lastActivity: number = Date.now()
  private isActive: boolean = false
  private onLogout: IdleCallback | null = null
  private onWarning: WarningCallback | null = null

  /**
   * Start auto-logout timer
   */
  start(onLogout: IdleCallback, onWarning?: WarningCallback): void {
    if (typeof window === "undefined") return

    this.onLogout = onLogout
    this.onWarning = onWarning || null
    this.isActive = true
    this.lastActivity = Date.now()

    // Listen for user activity
    this.bindActivityListeners()

    // Start timer
    this.resetTimer()

    console.log("[Auto-Logout] Timer started - 15 minute idle timeout")
  }

  /**
   * Stop auto-logout timer
   */
  stop(): void {
    this.isActive = false
    this.unbindActivityListeners()
    this.clearTimers()
    console.log("[Auto-Logout] Timer stopped")
  }

  /**
   * Reset timer on user activity
   */
  private resetTimer(): void {
    this.clearTimers()

    if (!this.isActive) return

    // Set warning timer (2 minutes before logout)
    this.warningTimer = setTimeout(() => {
      if (this.onWarning) {
        this.onWarning(120) // 2 minutes = 120 seconds
      }
      console.log("[Auto-Logout] ⚠️ Warning - You will be logged out in 2 minutes due to inactivity")
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_LOGOUT_MS)

    // Set logout timer
    this.idleTimer = setTimeout(() => {
      if (this.onLogout) {
        console.log("[Auto-Logout] 🔒 Logging out due to 15 minutes of inactivity")
        this.onLogout()
      }
      this.stop()
    }, IDLE_TIMEOUT_MS)
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer)
      this.warningTimer = null
    }
  }

  /**
   * Handle user activity
   */
  private handleActivity = (): void => {
    const now = Date.now()
    const timeSinceLastActivity = now - this.lastActivity

    // Only reset timer if more than 1 second since last activity
    // (prevents excessive timer resets on rapid events)
    if (timeSinceLastActivity > 1000) {
      this.lastActivity = now
      this.resetTimer()
    }
  }

  /**
   * Bind event listeners for user activity
   */
  private bindActivityListeners(): void {
    if (typeof window === "undefined") return

    window.addEventListener("mousedown", this.handleActivity)
    window.addEventListener("keydown", this.handleActivity)
    window.addEventListener("touchstart", this.handleActivity)
    window.addEventListener("scroll", this.handleActivity)
  }

  /**
   * Unbind event listeners
   */
  private unbindActivityListeners(): void {
    if (typeof window === "undefined") return

    window.removeEventListener("mousedown", this.handleActivity)
    window.removeEventListener("keydown", this.handleActivity)
    window.removeEventListener("touchstart", this.handleActivity)
    window.removeEventListener("scroll", this.handleActivity)
  }

  /**
   * Get time remaining until logout (in milliseconds)
   */
  getTimeRemaining(): number {
    if (!this.isActive) return 0

    const elapsed = Date.now() - this.lastActivity
    return Math.max(0, IDLE_TIMEOUT_MS - elapsed)
  }

  /**
   * Get time remaining until logout (in minutes)
   */
  getMinutesRemaining(): number {
    return Math.floor(this.getTimeRemaining() / (60 * 1000))
  }
}

// Export singleton instance
export const autoLogoutTimer = new AutoLogoutTimer()

/**
 * Helper to format time remaining
 */
export function formatTimeRemaining(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / (60 * 1000))
  const seconds = Math.floor((milliseconds % (60 * 1000)) / 1000)

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}
