"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { useNetworkStatus } from "@/lib/hooks/use-network-status"
import { Wifi, WifiOff } from "lucide-react"

export function NetworkStatusIndicator() {
  const { isOnline } = useNetworkStatus()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <Badge
      variant={isOnline ? "default" : "secondary"}
      className={`gap-1 text-xs ${
        isOnline ? "bg-green-600 hover:bg-green-700" : "bg-orange-600 hover:bg-orange-700"
      }`}
    >
      {isOnline ? (
        <>
          <Wifi className="h-3 w-3" />
          <span className="hidden sm:inline">Online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          <span className="hidden sm:inline">Offline</span>
        </>
      )}
    </Badge>
  )
}
