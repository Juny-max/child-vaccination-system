"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { ThemeToggle } from "@/components/theme-toggle"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import * as offlineSync from "@/lib/offline-vaccination-sync"

export default function OfflineSyncPage() {
  const router = useRouter()
  const [userName, setUserName] = useState("")
  const [isOnline, setIsOnline] = useState(true)
  const [pendingVaccinations, setPendingVaccinations] = useState<offlineSync.PendingVaccination[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const role = localStorage.getItem("userRole")
    const detail = localStorage.getItem("userRoleDetail")
    const name = sessionStorage.getItem("userName") || localStorage.getItem("userName")

    if (role !== "staff" || detail !== "facility-nurse") {
      router.push("/facility/dashboard")
      return
    }

    setUserName(name || "Facility Nurse")
    setIsOnline(navigator.onLine)
  }, [router])

  useEffect(() => {
    loadPendingVaccinations()
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      toast.info("Connection restored")
    }

    const handleOffline = () => {
      setIsOnline(false)
      toast.warning("You're offline")
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const loadPendingVaccinations = async () => {
    setIsLoading(true)
    try {
      const pending = await offlineSync.getPendingVaccinations()
      // Sort by timestamp (newest first)
      pending.sort((a, b) => b.timestamp - a.timestamp)
      setPendingVaccinations(pending)
    } catch (error) {
      console.error("Failed to load pending vaccinations:", error)
      toast.error("Failed to load offline records")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSyncAll = async () => {
    if (!isOnline) {
      toast.error("Cannot sync while offline. Please check your internet connection.")
      return
    }

    const unsyncedVaccinations = pendingVaccinations.filter(
      (vaccination) => vaccination.status === "pending" || vaccination.status === "failed",
    )

    if (unsyncedVaccinations.length === 0) {
      toast.info("No offline vaccinations need syncing")
      return
    }

    setIsSyncing(true)
    toast.loading("Syncing all pending vaccinations...")

    try {
      const result = await offlineSync.syncPendingVaccinations()
      
      if (result.success > 0) {
        toast.success(
          `Successfully synced ${result.success} vaccination${result.success > 1 ? "s" : ""}!`
        )
      }
      
      if (result.failed > 0) {
        toast.error(
          `${result.failed} vaccination${result.failed > 1 ? "s" : ""} failed to sync. Please retry.`
        )
      }

      await loadPendingVaccinations()
    } catch (error) {
      console.error("Sync all failed:", error)
      toast.error("Sync failed. Please try again.")
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSyncSingle = async (vaccination: offlineSync.PendingVaccination) => {
    if (!isOnline) {
      toast.error("Cannot sync while offline")
      return
    }

    setSyncingIds(prev => new Set(prev).add(vaccination.id))

    try {
      await offlineSync.updateVaccinationStatus(vaccination.id, "syncing")
      
      const requestData = {
        vaccineName: vaccination.vaccineName,
        doseNumber: vaccination.doseNumber,
        administeredDate: vaccination.administeredDate,
        batchNumber: vaccination.batchNumber,
        expiryDate: vaccination.expiryDate,
        administeredBy: vaccination.administeredBy,
        vaccinationSite: vaccination.vaccinationSite,
        aefiFlag: vaccination.aefiFlag,
        notes: vaccination.notes,
      }

      // Import facilityApi dynamically to avoid circular dependency
      const { administerVaccine } = await import("@/lib/api/facility")
      await administerVaccine(vaccination.childId, requestData)
      
      await offlineSync.deletePendingVaccination(vaccination.id)
      toast.success(`${vaccination.vaccineName} synced successfully!`)
      
      await loadPendingVaccinations()
    } catch (error) {
      console.error("Sync single failed:", error)
      
      const newRetryCount = vaccination.retryCount + 1
      const newStatus = newRetryCount >= 5 ? "failed" : "pending"
      await offlineSync.updateVaccinationStatus(vaccination.id, newStatus, newRetryCount)
      
      toast.error(`Failed to sync ${vaccination.vaccineName}`)
      await loadPendingVaccinations()
    } finally {
      setSyncingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(vaccination.id)
        return newSet
      })
    }
  }

  const handleDelete = async (vaccination: offlineSync.PendingVaccination) => {
    if (!confirm(`Delete offline record for ${vaccination.vaccineName}? This cannot be undone.`)) {
      return
    }

    setDeletingIds(prev => new Set(prev).add(vaccination.id))

    try {
      await offlineSync.deletePendingVaccination(vaccination.id)
      toast.success("Offline record deleted")
      await loadPendingVaccinations()
    } catch (error) {
      console.error("Delete failed:", error)
      toast.error("Failed to delete record")
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(vaccination.id)
        return newSet
      })
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const getStatusBadge = (status: string, retryCount: number) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending {retryCount > 0 && `(${retryCount} retries)`}
          </Badge>
        )
      case "syncing":
        return (
          <Badge variant="default" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Syncing...
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Failed (max retries)
          </Badge>
        )
      default:
        return null
    }
  }

  const pendingCount = pendingVaccinations.filter(v => v.status === "pending").length
  const failedCount = pendingVaccinations.filter(v => v.status === "failed").length
  const unsyncedCount = pendingCount + failedCount

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-2" asChild>
              <Link href="/facility/dashboard">
                <ArrowLeft className="h-4 w-4" /> Back to dashboard
              </Link>
            </Button>
            <div>
              <p className="text-sm text-muted-foreground">Offline Sync</p>
              <p className="text-lg font-semibold text-foreground">Manage Offline Records</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {isOnline ? (
              <Badge variant="default" className="gap-1">
                <Wifi className="h-3 w-3" />
                Online
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <WifiOff className="h-3 w-3" />
                Offline
              </Badge>
            )}
            <div className="flex flex-col items-end">
              <span className="text-sm text-muted-foreground">{userName}</span>
              <span className="text-xs text-muted-foreground/80">Facility Nurse</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Offline</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{pendingVaccinations.length}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending Sync</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-yellow-600">{pendingCount}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-600">{failedCount}</p>
              </CardContent>
            </Card>
          </div>

          {/* Sync All Button */}
          {unsyncedCount > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Ready to sync {unsyncedCount} record{unsyncedCount > 1 ? "s" : ""}</p>
                    <p className="text-sm text-muted-foreground">
                      Upload pending and retry failed records to the server
                    </p>
                  </div>
                  <Button
                    onClick={handleSyncAll}
                    disabled={!isOnline || isSyncing}
                    className="gap-2"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Sync All Now
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Offline Records List */}
          <Card>
            <CardHeader>
              <CardTitle>Offline Vaccination Records</CardTitle>
              <CardDescription>
                Vaccinations saved locally that need to be synced to the server
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : pendingVaccinations.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                  <div>
                    <p className="font-medium">All synced!</p>
                    <p className="text-sm text-muted-foreground">
                      No offline vaccination records found
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingVaccinations.map((vaccination) => (
                    <div
                      key={vaccination.id}
                      className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{vaccination.vaccineName}</p>
                          {vaccination.aefiFlag && (
                            <Badge variant="destructive" className="text-xs">
                              AEFI
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Administered: {vaccination.administeredDate} • Batch: {vaccination.batchNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          By {vaccination.administeredBy} • Saved {formatDate(vaccination.timestamp)}
                        </p>
                        <div className="pt-1">
                          {getStatusBadge(vaccination.status, vaccination.retryCount)}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSyncSingle(vaccination)}
                          disabled={
                            !isOnline ||
                            syncingIds.has(vaccination.id) ||
                            vaccination.status === "syncing"
                          }
                          className="gap-2"
                        >
                          {syncingIds.has(vaccination.id) ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Syncing
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4" />
                              Sync
                            </>
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(vaccination)}
                          disabled={deletingIds.has(vaccination.id)}
                          className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          {deletingIds.has(vaccination.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Help Info */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Tip:</strong> Offline records are encrypted before they are saved in IndexedDB and will automatically sync when internet connection is restored.
              You can also manually sync records using the buttons above.
            </AlertDescription>
          </Alert>
        </div>
      </main>
    </div>
  )
}
