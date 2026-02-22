"use client"

import { useEffect, useState } from "react"
import { Shield, AlertTriangle, Lock, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { getDaysSinceLastAccess } from "@/lib/chw-offline/auto-clear"

/**
 * Security Status Banner
 * Shows device security warnings and recommendations
 */
export function SecurityStatusBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [daysSinceAccess, setDaysSinceAccess] = useState<number | null>(null)
  const [isHttps, setIsHttps] = useState(true)

  useEffect(() => {
    // Check if running on HTTPS (required for production)
    setIsHttps(window.location.protocol === "https:")

    // Check days since last access
    const days = getDaysSinceLastAccess()
    setDaysSinceAccess(days)

    // Show banner if any security concerns
    if (!isHttps || (days !== null && days > 3)) {
      setShowBanner(true)
    }
  }, [])

  if (!showBanner) return null

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Security Recommendations</AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <div className="space-y-1">
          {!isHttps && (
            <div className="flex items-start gap-2">
              <span className="text-sm">⚠️ Not using HTTPS - data may be intercepted</span>
            </div>
          )}
          {daysSinceAccess !== null && daysSinceAccess > 3 && (
            <div className="flex items-start gap-2">
              <span className="text-sm">
                📅 Data last accessed {daysSinceAccess} days ago - will auto-clear after 7 days
              </span>
            </div>
          )}
        </div>

        <div className="mt-3 space-y-1 text-sm opacity-90">
          <p className="font-medium">To secure this device:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Enable full disk encryption (BitLocker/FileVault)</li>
            <li>Set a strong device password</li>
            <li>Enable auto-lock after 5 minutes</li>
            <li>Keep browser up to date</li>
          </ul>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowBanner(false)}
          className="mt-2 bg-white text-black hover:bg-gray-100"
        >
          I understand
        </Button>
      </AlertDescription>
    </Alert>
  )
}

/**
 * Device Encryption Check Component
 * Shows detailed security status
 */
export function DeviceSecurityStatus() {
  const [status, setStatus] = useState({
    https: false,
    serviceWorker: false,
    indexedDB: false,
    crypto: false,
  })

  useEffect(() => {
    const checkStatus = async () => {
      const https = window.location.protocol === "https:"
      const serviceWorker = "serviceWorker" in navigator
      const indexedDB = "indexedDB" in window
      const crypto = "crypto" in window && "subtle" in window.crypto

      setStatus({
        https,
        serviceWorker,
        indexedDB,
        crypto,
      })
    }

    checkStatus()
  }, [])

  const allSecure = Object.values(status).every((v) => v)

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        {allSecure ? (
          <Shield className="h-5 w-5 text-green-600" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-amber-600" />
        )}
        <h3 className="font-medium">
          Device Security Status: {allSecure ? "Good" : "Needs Attention"}
        </h3>
      </div>

      <div className="space-y-2 text-sm">
        <SecurityItem
          label="HTTPS Connection"
          status={status.https}
          description="Encrypts data in transit"
        />
        <SecurityItem
          label="Service Worker"
          status={status.serviceWorker}
          description="Enables offline mode"
        />
        <SecurityItem
          label="IndexedDB Support"
          status={status.indexedDB}
          description="Local encrypted storage"
        />
        <SecurityItem
          label="Web Crypto API"
          status={status.crypto}
          description="Client-side encryption"
        />
      </div>

      {!allSecure && (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded text-sm">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            ⚠️ Some security features are unavailable
          </p>
          <p className="text-amber-800 dark:text-amber-300 mt-1">
            For full security, use a modern browser with HTTPS
          </p>
        </div>
      )}
    </div>
  )
}

function SecurityItem({
  label,
  status,
  description,
}: {
  label: string
  status: boolean
  description: string
}) {
  return (
    <div className="flex items-start gap-2">
      {status ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={status ? "text-green-900 dark:text-green-100" : "text-amber-900 dark:text-amber-100"}>
            {label}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
    </div>
  )
}
