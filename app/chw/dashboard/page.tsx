"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CircleDot,
  MapPin,
  RefreshCcw,
  Search,
  UserPlus,
  ClipboardList,
} from "lucide-react"
import * as chwStorage from "@/lib/chw-offline-storage"

import { ThemeToggle } from "@/components/theme-toggle"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type SyncState = "offline" | "syncing" | "synced"

type VisitTask = {
  id: string
  childName: string
  vaccineDue: string
  householdLocation: string
  distanceKm: number
}

const mockVisitList: VisitTask[] = [
  {
    id: "VIS-1101",
    childName: "Child Kwesi",
    vaccineDue: "Penta 3",
    householdLocation: "Kpalbusi Junction",
    distanceKm: 1.2,
  },
  {
    id: "VIS-1102",
    childName: "Kojo Mensima",
    vaccineDue: "Measles-Rubella 1",
    householdLocation: "Tunsungu Market Street",
    distanceKm: 2.4,
  },
  {
    id: "VIS-1103",
    childName: "Adjoa Ansah",
    vaccineDue: "OPV Booster",
    householdLocation: "Jakpa Riverside",
    distanceKm: 3.1,
  },
]

const mockPendingCounts = {
  registrations: 5,
  vaccinations: 7,
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
  const [userName, setUserName] = useState("")
  const [syncState, setSyncState] = useState<SyncState>("offline")
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [vaccinationLogs, setVaccinationLogs] = useState<VaccinationMapPoint[]>([])

  useEffect(() => {
    const legacyToken = localStorage.getItem("authToken")
    const accessToken = localStorage.getItem("accessToken")
    const userId = localStorage.getItem("userId")
    const role = localStorage.getItem("userRole")
    const detail = localStorage.getItem("userRoleDetail")
    const name = sessionStorage.getItem("userName") || localStorage.getItem("userName")

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

    setUserName(name || "Community Health Worker")
  }, [router])

  useEffect(() => {
    if (!systemMessage) return
    const timeout = window.setTimeout(() => setSystemMessage(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [systemMessage])

  useEffect(() => {
    const loadFromIndexedDB = async () => {
      if (typeof window === "undefined") {
        return
      }

      try {
        // Migrate legacy localStorage data to IndexedDB on first load
        await chwStorage.migrateFromLocalStorage()
        
        // Load all vaccinations with GPS coordinates
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
    }

    loadFromIndexedDB()
    window.addEventListener(VACCINATION_SAVED_EVENT, handleUpdate)

    return () => {
      window.removeEventListener(VACCINATION_SAVED_EVENT, handleUpdate)
    }
  }, [])

  const pendingSyncTotal = useMemo(() => mockPendingCounts.registrations + mockPendingCounts.vaccinations, [])

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
    setSystemMessage("Background sync queued. Keep the device awake until complete.")
    window.setTimeout(() => {
      setSyncState("synced")
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))
      setSystemMessage("All outreach records uploaded to head office.")
    }, 3200)
  }

  const handleLogout = () => {
    localStorage.removeItem("authToken")
    localStorage.removeItem("userRole")
    localStorage.removeItem("userRoleDetail")
    localStorage.removeItem("userName")
    sessionStorage.removeItem("userName")
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">My Outreach · Offline Home</p>
            <p className="text-lg font-semibold text-foreground">Jakpa CHPS Zone</p>
            <p className="text-xs text-muted-foreground">Savannah Region · Assigned households cached for offline work</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex flex-col items-end">
              <span className="text-sm text-muted-foreground">{userName}</span>
              <span className="text-xs text-muted-foreground/80">Community Health Worker</span>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
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

        <section className="grid gap-4 sm:grid-cols-3">
          <Button asChild className="h-28 flex-col gap-3 text-base">
            <Link href="/chw/find-child">
              <Search className="h-6 w-6" />
              Find child
            </Link>
          </Button>
          <Button asChild variant="secondary" className="h-28 flex-col gap-3 text-base">
            <Link href="/chw/register-child">
              <UserPlus className="h-6 w-6" />
              Register new child
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-28 flex-col gap-3 text-base">
            <Link href="#visit-list">
              <ClipboardList className="h-6 w-6" />
              My visit list
            </Link>
          </Button>
        </section>

        <section id="visit-list" className="mt-8">
          <Card className="border-primary/40">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CircleDot className="h-5 w-5 text-primary" /> Assigned visits
                </CardTitle>
                <CardDescription>Downloaded for offline rounds. Update status once visit is complete.</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {mockVisitList.length} household{mockVisitList.length === 1 ? "" : "s"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockVisitList.length === 0 ? (
                <p className="text-sm text-muted-foreground">No visits assigned. Sync with head office when online.</p>
              ) : (
                mockVisitList.map((task) => (
                  <div key={task.id} className="rounded-lg border border-border bg-background/80 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{task.childName}</p>
                        <p className="text-xs text-muted-foreground">Vaccine due: {task.vaccineDue}</p>
                        <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {task.householdLocation}
                        </p>
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
                <CardDescription>Automatically plots households where offline doses were captured today.</CardDescription>
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
  )
}
