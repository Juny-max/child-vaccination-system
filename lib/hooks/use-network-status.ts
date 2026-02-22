"use client"

import { useEffect, useRef, useState } from "react"
import { isBackendAvailable, resetConnectivityCache } from "@/lib/network/connectivity"

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  )
  const [wasOffline, setWasOffline] = useState(false)
  const wasOfflineRef = useRef(false)

  useEffect(() => {
    let mounted = true

    const updateConnectivity = async () => {
      const online = await isBackendAvailable()
      if (!mounted) return

      if (!online && !wasOfflineRef.current) {
        console.log("⚠️ Network/backend unavailable - switching to offline mode")
      }
      if (online && wasOfflineRef.current) {
        console.log("✅ Network connection restored")
      }

      wasOfflineRef.current = !online
      setWasOffline(!online)
      setIsOnline(online)
    }

    const handleOnline = () => {
      resetConnectivityCache()
      updateConnectivity()
    }

    const handleOffline = () => {
      wasOfflineRef.current = true
      setWasOffline(true)
      setIsOnline(false)
    }

    // Initial check
    updateConnectivity()

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Poll every 30 seconds (the 10s cache in connectivity.ts prevents floods)
    const checkInterval = setInterval(updateConnectivity, 30_000)

    return () => {
      mounted = false
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      clearInterval(checkInterval)
    }
  }, [])

  return { isOnline, wasOffline }
}
