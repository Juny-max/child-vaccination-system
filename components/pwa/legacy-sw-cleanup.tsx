"use client"

import { useEffect } from "react"

const LEGACY_WORKER_PATHS = ["/chw-service-worker.js", "/chw-map-sw.js"]
const LEGACY_CACHE_PREFIXES = ["chw-offline-cache", "cvcc-chw-osm-tiles", "chw-map-tiles"]

export function LegacyServiceWorkerCleanup() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return
    }

    const cleanupLegacyWorkers = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations()
        let removedLegacyWorker = false

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
              removedLegacyWorker = true
            }
          }),
        )

        if ("caches" in window) {
          const cacheKeys = await caches.keys()
          await Promise.all(
            cacheKeys
              .filter((cacheKey) => LEGACY_CACHE_PREFIXES.some((prefix) => cacheKey.startsWith(prefix)))
              .map((cacheKey) => caches.delete(cacheKey)),
          )
        }

        const controllerScript = navigator.serviceWorker.controller?.scriptURL || ""
        const controlledByLegacyWorker = LEGACY_WORKER_PATHS.some((workerPath) => controllerScript.includes(workerPath))

        if (removedLegacyWorker && controlledByLegacyWorker) {
          window.location.reload()
        }
      } catch (error) {
        console.warn("Legacy service worker cleanup failed", error)
      }
    }

    void cleanupLegacyWorkers()
  }, [])

  return null
}
