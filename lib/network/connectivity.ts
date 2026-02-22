import { API_BASE_URL } from "@/lib/api/config"

let lastCheckTime = 0
let lastResult = true
const CACHE_MS = 10_000 // cache result for 10 seconds to avoid request floods

/**
 * Checks whether CHW backend is currently reachable.
 * Uses a lightweight HEAD request and caches the result
 * for 10 seconds so multiple callers don't flood the server.
 */
export async function isBackendAvailable(timeoutMs = 4000): Promise<boolean> {
  if (typeof window === "undefined") {
    return true
  }

  // If browser says we're offline, immediately return false (don't use cache)
  if (!navigator.onLine) {
    lastResult = false
    lastCheckTime = 0 // Clear cache when offline
    return false
  }

  const now = Date.now()
  // Only use cache if we're confident we're online
  if (now - lastCheckTime < CACHE_MS && lastResult === true) {
    return lastResult
  }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    // Health endpoint now checks Supabase connectivity
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })

    // 503 = Supabase down, treat as offline
    lastResult = response.ok && response.status !== 503
  } catch {
    lastResult = false
  } finally {
    window.clearTimeout(timer)
    lastCheckTime = Date.now()
  }

  return lastResult
}

/** Force-clear the cached result (e.g. when browser fires online event) */
export function resetConnectivityCache() {
  lastCheckTime = 0
}
