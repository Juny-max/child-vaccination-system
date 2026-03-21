"use client"

import { useEffect } from "react"

const LEGACY_WORKER_PATHS = ["/chw-service-worker.js", "/chw-map-sw.js"]

export function LegacyServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return
    }

    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return
    }

    const cleanupLegacyWorkers = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations()

        await Promise.all(
          registrations.map(async (registration) => {
            const scriptUrl =
              registration.active?.scriptURL ||
              registration.waiting?.scriptURL ||
              registration.installing?.scriptURL ||
              ""

            const isLegacyWorker = LEGACY_WORKER_PATHS.some((workerPath) => scriptUrl.includes(workerPath))
            if (isLegacyWorker) {
              await registration.unregister()
            }
          }),
        )
      } catch (error) {
        console.warn("Legacy service worker cleanup failed", error)
      }
    }

    void cleanupLegacyWorkers()
  }, [])

  return null
}
