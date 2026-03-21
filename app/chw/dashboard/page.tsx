"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  CircleDot,
  MapPin,
  RefreshCcw,
  Search,
  UserPlus,
  ClipboardList,
  Activity,
} from "lucide-react"
import * as chwStorage from "@/lib/chw-offline-storage"
import { getAllCHWVaccinations } from "@/lib/chw-offline-storage"
import { chwBackgroundSync } from "@/lib/chw-offline/background-sync"
import { chwOfflineDb } from "@/lib/chw-offline/db"
import { getChwDashboardSummary, type ChwVisit } from "@/lib/api/chw"
import { isBackendAvailable } from "@/lib/network/connectivity"
import { useNetworkStatus } from "@/lib/hooks/use-network-status"
import { autoLogoutTimer } from "@/lib/chw-offline/auto-logout"
import { checkAndClearStaleData, updateLastAccess } from "@/lib/chw-offline/auto-clear"
import { clearEncryptionKey } from "@/lib/chw-offline/encryption"

import { ThemeToggle } from "@/components/theme-toggle"
import { NetworkStatusIndicator } from "@/components/chw/network-status-indicator"
import { SecurityStatusBanner } from "@/components/chw/security-banner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type SyncState = "offline" | "syncing" | "synced"

type VisitTask = {
  id: string
  childId?: string
  childName: string
  vaccineDue: string
  householdLocation: string
  distanceKm: number
}

type VaccinationMapPoint = {
  childId: string
  childName: string
  vaccineId: string
  vaccineName: string
  recordedDate: string
  latitude: number
  longitude: number
}

const VACCINATION_SAVED_EVENT = "chw-vaccination-saved"

const OutreachMap = dynamic(
  () => import("@/components/chw/outreach-map").then((module) => module.OutreachMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-primary/30 bg-primary/5 text-sm text-muted-foreground">
        Loading outreach map…
      </div>
    ),
  },
)

export default function ChwDashboardPage() {
  const router = useRouter()
  const visitListSectionRef = useRef<HTMLElement | null>(null)
  const { isOnline } = useNetworkStatus()
  const [syncState, setSyncState] = useState<SyncState>("offline")
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [vaccinationLogs, setVaccinationLogs] = useState<VaccinationMapPoint[]>([])
  const [visitList, setVisitList] = useState<VisitTask[]>([])
  const [pendingSyncTotal, setPendingSyncTotal] = useState(0)
  const [todayActivityCount, setTodayActivityCount] = useState(0)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const loadDashboardSummary = async () => {
    try {
      if (!isOnline) {
        setSyncState("offline")
        setSystemMessage("Offline mode active. Data will sync automatically when connection is restored.")
        return
      }

      const summary = await getChwDashboardSummary()
      const localPending = await chwStorage.getCHWPendingCount()
      setVisitList(
        summary.visits.map((entry: ChwVisit) => ({
          id: entry.id,
          childId: entry.childId,
          childName: entry.childName,
          vaccineDue: entry.vaccineDue,
          householdLocation: entry.householdLocation,
          distanceKm: entry.distanceKm,
        })),
      )
      setPendingSyncTotal(summary.pendingQueueCount + localPending)
      setLastSyncTime(new Date(summary.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))
      setSyncState("synced")
    } catch (error) {
      console.error("Failed to load CHW dashboard summary", error)
      setSyncState("offline")
      setSystemMessage("Using offline mode. Data refresh will continue automatically in background.")
    }
  }

  useEffect(() => {
    const legacyToken = localStorage.getItem("authToken")
    const accessToken = localStorage.getItem("accessToken")
    const userId = localStorage.getItem("userId")
    const role = localStorage.getItem("userRole")
    const detail = localStorage.getItem("userRoleDetail")

    const hasAuthState = Boolean(userId || accessToken || legacyToken)

    if (!hasAuthState) {
      router.push("/auth/login")
      return
    }

    if (role !== "staff" || detail !== "chw") {
      if (detail === "facility-nurse") {
        router.push("/facility/dashboard")
        return
      }
      if (detail === "branch-manager") {
        router.push("/branch/dashboard")
        return
      }
      if (detail === "hq-admin") {
        router.push("/hq/dashboard")
        return
      }
      if (role === "parent") {
        router.push("/parent/dashboard")
        return
      }
      router.push("/dashboard")
      return
    }

    // Security: Check and clear stale data (7+ days old)
    checkAndClearStaleData().then((wasCleared) => {
      if (wasCleared) {
        setSystemMessage("Offline data was cleared due to 7 days of inactivity (security policy)")
      }
    })

    // Security: Update last access timestamp
    updateLastAccess()

    // Security: Start auto-logout timer (15 minutes idle)
    autoLogoutTimer.start(
      () => {
        // Logout handler
        console.log("[Security] Auto-logout triggered")
        clearEncryptionKey()
        localStorage.clear()
        sessionStorage.clear()
        router.push("/auth/login?timeout=1")
      },
      (secondsRemaining) => {
        // Warning handler
        if (secondsRemaining === 120) {
          setSystemMessage("⚠️ You will be logged out in 2 minutes due to inactivity")
        }
      },
    )

    loadDashboardSummary()
    chwBackgroundSync.start()
    loadTodayActivityCount()

    return () => {
      chwBackgroundSync.stop()
      autoLogoutTimer.stop()
    }
  }, [router])

  const loadTodayActivityCount = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const [vaccinations, queue] = await Promise.all([
        getAllCHWVaccinations(),
        chwOfflineDb.vaccinationQueue.toArray(),
      ])
      const todayVaccinations = vaccinations.filter((v) => v.recordedDate === today).length
      const todayQueue = queue.filter(
        (item) =>
          item.createdAt.slice(0, 10) === today &&
          (item.actionType === "register_child" ||
            item.actionType === "transfer_in" ||
            item.actionType === "transfer_out"),
      ).length
      setTodayActivityCount(todayVaccinations + todayQueue)
    } catch {
      // non-critical
    }
  }

  useEffect(() => {
    if (!systemMessage) return
    const timeout = window.setTimeout(() => setSystemMessage(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [systemMessage])

  // Reactively update sync state when network status changes
  useEffect(() => {
    if (!isOnline && syncState !== "syncing") {
      setSyncState("offline")
      setSystemMessage("Connection lost. Operating in offline mode.")
    } else if (isOnline && syncState === "offline") {
      // When coming back online, refresh the dashboard
      setSystemMessage("Connection restored. Refreshing data...")
      loadDashboardSummary()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  useEffect(() => {
    const loadFromIndexedDB = async () => {
      if (typeof window === "undefined") {
        return
      }

      try {
        await chwStorage.migrateFromLocalStorage()
        const records = await chwStorage.getCHWVaccinationsWithGPS()

        const mapPoints: VaccinationMapPoint[] = records.map((record) => ({
          childId: record.childId,
          childName: record.childName,
          vaccineId: record.vaccineId,
          vaccineName: record.vaccineName,
          recordedDate: record.recordedDate,
          latitude: record.latitude!,
          longitude: record.longitude!,
        }))

        setVaccinationLogs(mapPoints)
      } catch (error) {
        console.error("Failed to load vaccination logs for outreach map", error)
        setVaccinationLogs([])
      }
    }

    const handleUpdate = () => {
      loadFromIndexedDB()
      loadTodayActivityCount()
    }

    loadFromIndexedDB()
    window.addEventListener(VACCINATION_SAVED_EVENT, handleUpdate)

    return () => {
      window.removeEventListener(VACCINATION_SAVED_EVENT, handleUpdate)
    }
  }, [])

  const syncIndicator = useMemo(() => {
    switch (syncState) {
      case "offline":
        return {
          label: `Offline. ${pendingSyncTotal} record${pendingSyncTotal === 1 ? "" : "s"} waiting to sync.`,
          classes: "bg-destructive/10 border-destructive/50 text-destructive",
          icon: <AlertCircle className="h-4 w-4" />,
        }
      case "syncing":
        return {
          label: "Syncing data to head office… Do not close.",
          classes: "bg-amber-100 border-amber-400 text-amber-700",
          icon: <RefreshCcw className="h-4 w-4 animate-spin" />,
        }
      case "synced":
      default:
        return {
          label: `All data saved to server. Last sync: ${lastSyncTime ?? "Just now"}.`,
          classes: "bg-emerald-100 border-emerald-300 text-emerald-700",
          icon: <CheckCircle2 className="h-4 w-4" />,
        }
    }
  }, [syncState, pendingSyncTotal, lastSyncTime])

  const mapPoints = useMemo(() => vaccinationLogs, [vaccinationLogs])

  const triggerMockSync = () => {
    if (syncState === "syncing") return
    setSyncState("syncing")
    setSystemMessage("Refreshing from server...")
    loadDashboardSummary().finally(() => {
      setSystemMessage("Dashboard refreshed from backend.")
    })
  }

  const confirmLogout = () => {
    localStorage.removeItem("authToken")
    localStorage.removeItem("userRole")
    localStorage.removeItem("userRoleDetail")
    localStorage.removeItem("userName")
    sessionStorage.removeItem("userName")
    router.push("/")
  }

  const scrollToVisitList = () => {
    visitListSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <>
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground sm:text-lg">CHW Dashboard</p>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">Outreach overview</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <NetworkStatusIndicator />
            <ThemeToggle />
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs sm:h-9 sm:text-sm" onClick={() => setShowLogoutConfirm(true)}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
        <SecurityStatusBanner />

        <div className={`mb-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${syncIndicator.classes}`}>
          {syncIndicator.icon}
          <span>{syncIndicator.label}</span>
          <Button size="sm" variant="ghost" className="ml-auto h-8" onClick={triggerMockSync}>
            Sync now
          </Button>
        </div>

        {systemMessage ? (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{systemMessage}</AlertDescription>
          </Alert>
        ) : null}

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <Button asChild className="h-24 flex-col gap-2 text-sm sm:h-28 sm:gap-3 sm:text-base">
            <Link href="/chw/find-child">
              <Search className="h-6 w-6" />
              Find child
            </Link>
          </Button>
          <Button asChild variant="secondary" className="h-24 flex-col gap-2 text-sm sm:h-28 sm:gap-3 sm:text-base">
            <Link href="/chw/register-child">
              <UserPlus className="h-6 w-6" />
              Register child
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-24 flex-col gap-2 text-sm sm:h-28 sm:gap-3 sm:text-base">
            <Link href="/chw/register">
              <BookOpen className="h-6 w-6" />
              My register
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-24 flex-col gap-2 text-sm sm:h-28 sm:gap-3 sm:text-base"
            onClick={scrollToVisitList}
          >
            <ClipboardList className="h-6 w-6" />
            Visit list
          </Button>
        </section>

        {/* Today's activity link */}
        <Link
          href="/chw/activity"
          className="mt-3 flex items-center justify-between rounded-lg border border-border bg-background/80 px-4 py-2.5 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="h-4 w-4 text-primary" />
            <span>Today&apos;s activity</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {todayActivityCount} action{todayActivityCount === 1 ? "" : "s"}
          </Badge>
        </Link>

        <section id="visit-list" ref={visitListSectionRef} className="mt-8">
          <Card className="border-primary/40">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CircleDot className="h-5 w-5 text-primary" /> Assigned visits
                </CardTitle>
                <CardDescription>Visits available for your rounds.</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {visitList.length} household{visitList.length === 1 ? "" : "s"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {visitList.length === 0 ? (
                <p className="text-sm text-muted-foreground">No visits assigned. Sync with head office when online.</p>
              ) : (
                visitList.map((task) => (
                  <div key={task.id} className="rounded-lg border border-border bg-background/80 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{task.childName}</p>
                        <p className="text-xs text-muted-foreground">Vaccine due: {task.vaccineDue}</p>
                        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {task.householdLocation}
                        </p>
                        {task.childId ? (
                          <Link href={`/chw/child/${task.childId}`} className="text-xs text-primary hover:underline">
                            Open child chart
                          </Link>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {task.distanceKm.toFixed(1)} km away
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>

        <section className="mt-8">
          <Card className="border-primary/30">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5 text-primary" /> Outreach vaccination map
                </CardTitle>
                <CardDescription>Locations captured from recorded vaccinations.</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {mapPoints.length} site{mapPoints.length === 1 ? "" : "s"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {mapPoints.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Record at least one vaccination with GPS to see your outreach footprint on the map.
                </p>
              ) : (
                <>
                  <OutreachMap entries={mapPoints} />
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Most recent captures</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {mapPoints.slice(0, 4).map((entry) => (
                        <div
                          key={`${entry.childId}-${entry.vaccineId}-${entry.recordedDate}`}
                          className="rounded-lg border border-border bg-background/80 p-3 text-xs text-muted-foreground"
                        >
                          <p className="text-sm font-semibold text-foreground">{entry.childName}</p>
                          <p>Vaccine: {entry.vaccineName}</p>
                          <p>Date: {entry.recordedDate}</p>
                          <p className="font-mono">
                            {entry.latitude.toFixed(6)}, {entry.longitude.toFixed(6)}
                          </p>
                        </div>
                      ))}
                    </div>
                    {mapPoints.length > 4 ? (
                      <p className="text-xs text-muted-foreground">
                        Additional coordinates sync to head office automatically once you reconnect.
                      </p>
                    ) : null}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>

    <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Log out?</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingSyncTotal > 0
              ? `You have ${pendingSyncTotal} record${pendingSyncTotal === 1 ? "" : "s"} waiting to sync. They will upload automatically next time you log in with internet access.`
              : "Any pending offline records will sync automatically next time you log in with internet access."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay logged in</AlertDialogCancel>
          <AlertDialogAction onClick={confirmLogout}>Log out</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
