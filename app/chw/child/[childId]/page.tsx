"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { DotLottieReact } from "@lottiefiles/dotlottie-react"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Loader2,
  MapPin,
  Syringe,
  User,
  X,
} from "lucide-react"
import * as chwStorage from "@/lib/chw-offline-storage"
import { getChwChildChart, syncChwVaccinations, type ChwChildChart } from "@/lib/api/chw"
import { getChildById, getChildChart, saveChildChart } from "@/lib/chw-offline/db"
import { useNetworkStatus } from "@/lib/hooks/use-network-status"
import { isVaccineCutoffExpired } from "@/lib/vaccine-cutoffs"

import { ThemeToggle } from "@/components/theme-toggle"
import { NetworkStatusIndicator } from "@/components/chw/network-status-indicator"
import { TransferOutButton } from "@/components/chw/transfer-out-button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type VaccineStatus = "overdue" | "due" | "completed"

type ChildSnapshot = {
  id: string
  name: string
  age: string
  dateOfBirth?: string
  motherName: string
  motherPhone: string
  village: string
  outstandingVaccines: VaccineDose[]
  history: VaccineDose[]
}

type VaccineDose = {
  id: string
  name: string
  status: VaccineStatus
  scheduledDate: string
  administeredDate?: string
}

type PendingVaccination = chwStorage.CHWVaccinationRecord

const composePendingVaccinationKey = (entry: PendingVaccination) => 
  `${entry.childId}-${entry.vaccineId}-${entry.recordedDate}`

// Event to notify dashboard map to refresh
const VACCINATION_SAVED_EVENT = "chw-vaccination-saved"

// No longer needed - using IndexedDB
// const PENDING_VACCINATION_STORAGE_KEY = "chwPendingVaccinations"

const offlineChildren: Record<string, ChildSnapshot> = {
  "CHW-0001": {
    id: "CHW-0001",
    name: "Kofi Mensah",
    age: "9 months",
    motherName: "Demo Mensah",
    motherPhone: "+233 240 110 221",
    village: "Nakwabi",
    outstandingVaccines: [
      { id: "MR1", name: "Measles-Rubella 1", status: "overdue", scheduledDate: "03 Nov 2025" },
      { id: "YF", name: "Yellow Fever", status: "due", scheduledDate: "03 Nov 2025" },
    ],
    history: [
      { id: "PENTA3", name: "Penta 3", status: "completed", scheduledDate: "05 Sep 2025", administeredDate: "07 Sep 2025" },
      { id: "OPV3", name: "OPV 3", status: "completed", scheduledDate: "05 Sep 2025", administeredDate: "07 Sep 2025" },
    ],
  },
  "CHW-0002": {
    id: "CHW-0002",
    name: "Akosua Nyarko",
    age: "14 months",
    motherName: "Afia Nyarko",
    motherPhone: "+233 242 118 755",
    village: "Tuna Zongo",
    outstandingVaccines: [{ id: "OPV-B", name: "OPV Booster", status: "due", scheduledDate: "12 Nov 2025" }],
    history: [
      { id: "MR1", name: "Measles-Rubella 1", status: "completed", scheduledDate: "12 Sep 2025", administeredDate: "14 Sep 2025" },
      { id: "PENTA3", name: "Penta 3", status: "completed", scheduledDate: "10 Jun 2025", administeredDate: "12 Jun 2025" },
    ],
  },
}

type VaccinationCoordinate = {
  latitude: number
  longitude: number
}

const captureVaccinationCoordinate = async (): Promise<VaccinationCoordinate | null> => {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return null
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        })
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  })
}

export default function ChwChildChartPage() {
  const router = useRouter()
  const params = useParams<{ childId: string }>()
  const { isOnline } = useNetworkStatus()
  const childId = params?.childId ?? "unknown"
  const [userName, setUserName] = useState("")
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [pendingVaccinations, setPendingVaccinations] = useState<PendingVaccination[]>([])
  const [selectedVaccine, setSelectedVaccine] = useState<VaccineDose | null>(null)
  const [listModal, setListModal] = useState<"outstanding" | "history" | null>(null)
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [successVaccine, setSuccessVaccine] = useState<string | null>(null)
  const [remoteSnapshot, setRemoteSnapshot] = useState<ChildSnapshot | null>(null)
  const [loadingChart, setLoadingChart] = useState(true)
  const [vaccineScheduleUncached, setVaccineScheduleUncached] = useState(false)

  const mapChart = (chart: ChwChildChart): ChildSnapshot => ({
    id: chart.id,
    name: chart.name,
    age: chart.age,
    dateOfBirth: chart.dateOfBirth,
    motherName: chart.motherName,
    motherPhone: chart.motherPhone,
    village: chart.village,
    outstandingVaccines: chart.outstandingVaccines,
    history: chart.history,
  })

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
      router.push("/chw/dashboard")
      return
    }

    setUserName(name || "Community Health Worker")

    const loadChart = async () => {
      setLoadingChart(true)
      try {
        // Read network state fresh at call-time so this function is correct
        // even when isOnline is not in the useEffect dependency array.
        const networkAvailable = isOnline && navigator.onLine
        if (networkAvailable) {
          try {
            const chart = await getChwChildChart(childId)
            setRemoteSnapshot(mapChart(chart))
            // Cache the chart for offline use (fire-and-forget, don't block render)
            saveChildChart({
              childId,
              age: chart.age,
              village: chart.village,
              outstandingVaccines: chart.outstandingVaccines,
              history: chart.history,
              cachedAt: new Date().toISOString(),
            }).catch(() => {/* non-fatal */})
            return
          } catch (apiError) {
            console.warn("Backend chart fetch failed, falling back to offline cache", apiError)
          }
        }

        // OFFLINE FALLBACK: Load from both the child register and the chart cache in parallel
        const [localChild, cachedChart] = await Promise.all([
          getChildById(childId),
          getChildChart(childId),
        ])

        if (localChild) {
          if (!cachedChart) setVaccineScheduleUncached(true)
          setRemoteSnapshot({
            id: localChild.id,
            name: localChild.fullName,
            age: cachedChart?.age ?? "—",
            motherName: localChild.guardianName || "Unknown",
            motherPhone: localChild.guardianPhone || "N/A",
            village: cachedChart?.village ?? localChild.catchmentAreaId ?? "—",
            outstandingVaccines: cachedChart?.outstandingVaccines ?? [],
            history: cachedChart?.history ?? [],
          })
        } else if (cachedChart) {
          // Chart cache exists but child register entry doesn't (edge case)
          setRemoteSnapshot({
            id: childId,
            name: "Cached record",
            age: cachedChart.age,
            motherName: "—",
            motherPhone: "—",
            village: cachedChart.village,
            outstandingVaccines: cachedChart.outstandingVaccines,
            history: cachedChart.history,
          })
        } else {
          setSystemMessage("Child not found in offline cache. Open this child's chart while online to enable offline access.")
        }
      } catch (error) {
        console.error("Failed to load child chart", error)
        setSystemMessage("Could not load child chart. Please try again.")
      } finally {
        setLoadingChart(false)
      }
    }

    loadChart()
  // isOnline intentionally excluded: going offline must not re-trigger the auth
  // check or chart reload. loadChart() reads isOnline at call-time and falls back
  // to IndexedDB gracefully if the API is unavailable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, childId])

  useEffect(() => {
    if (!systemMessage) return
    const timeout = window.setTimeout(() => setSystemMessage(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [systemMessage])

  const childSnapshot = remoteSnapshot || offlineChildren[childId]

  useEffect(() => {
    if (!childSnapshot) {
      return
    }

    // Load pending vaccinations from IndexedDB
    const loadPendingVaccinations = async () => {
      try {
        const stored = await chwStorage.getCHWVaccinationsByChild(childSnapshot.id)
        setPendingVaccinations(stored)
      } catch (error) {
        console.error('Failed to load pending vaccinations:', error)
      }
    }

    loadPendingVaccinations()

    // Listen for new vaccinations saved
    const handleVaccinationSaved = () => {
      loadPendingVaccinations()
    }

    window.addEventListener(VACCINATION_SAVED_EVENT, handleVaccinationSaved)
    return () => {
      window.removeEventListener(VACCINATION_SAVED_EVENT, handleVaccinationSaved)
    }
  }, [childSnapshot])

  const openAdministerModal = (dose: VaccineDose) => {
    setSelectedVaccine(dose)
    setNotes("")
    setListModal(null)
  }

  const closeAdministerModal = () => {
    setSelectedVaccine(null)
    setNotes("")
  }

  const handleVaccinationSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!childSnapshot || !selectedVaccine) {
      return
    }

    setSaving(true)

    try {
      const coordinates = await captureVaccinationCoordinate()
      const recordedDate = new Date().toISOString().split("T")[0]

      const newEntry: Omit<PendingVaccination, 'timestamp'> = {
        childId: childSnapshot.id,
        childName: childSnapshot.name,
        vaccineId: selectedVaccine.id,
        vaccineName: selectedVaccine.name,
        recordedDate,
        latitude: coordinates?.latitude,
        longitude: coordinates?.longitude,
        notes: notes.trim() ? notes.trim() : undefined,
      }

      // Save to IndexedDB first (works offline)
      await chwStorage.saveCHWVaccination(newEntry)

      // If online, immediately sync this single vaccination to the backend
      if (isOnline) {
        try {
          await syncChwVaccinations([{
            childId: newEntry.childId,
            vaccineId: newEntry.vaccineId,
            vaccineName: newEntry.vaccineName,
            recordedDate,
            latitude: newEntry.latitude,
            longitude: newEntry.longitude,
            notes: newEntry.notes,
          }])
          await chwStorage.markCHWVaccinationSynced(newEntry.childId, newEntry.vaccineId, recordedDate)
        } catch {
          // Silent — background sync will pick it up later
        }
      }
      
      // Update UI immediately
      const stored = await chwStorage.getCHWVaccinationsByChild(childSnapshot.id)
      setPendingVaccinations(stored)
      
      // Dispatch event to update dashboard map
      window.dispatchEvent(new Event(VACCINATION_SAVED_EVENT))

      const savedName = selectedVaccine.name
      closeAdministerModal()
      setSuccessVaccine(savedName)
    } catch (error) {
      console.error('Failed to save vaccination:', error)
      setSystemMessage('Failed to save vaccination. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!childSnapshot) {
    if (loadingChart) {
      return (
        <div className="min-h-screen bg-muted/30">
          <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-4 px-4 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading child chart...</p>
          </main>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-muted/30">
        <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-4 px-4 text-center">
          <Alert className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This child is not in the offline cache. Sync at the clinic or register a new child before heading out.
            </AlertDescription>
          </Alert>
          <Button asChild>
            <Link href="/chw/find-child">Back to search</Link>
          </Button>
        </main>
      </div>
    )
  }

  const outstandingPreview = childSnapshot.outstandingVaccines.slice(0, 4)
  const historyPreview = childSnapshot.history.slice(0, 4)
  const outstandingCount = childSnapshot.outstandingVaccines.length
  const historyCount = childSnapshot.history.length

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <Button asChild variant="ghost" size="sm" className="shrink-0 gap-1.5 sm:gap-2">
              <Link href="/chw/find-child">
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Offline search</span><span className="sm:hidden">Back</span>
              </Link>
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-foreground sm:text-sm">Offline patient chart</p>
              <p className="truncate text-sm font-semibold text-foreground sm:text-lg">{childSnapshot.name}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <NetworkStatusIndicator />
            <ThemeToggle />
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-sm text-muted-foreground">{userName}</span>
              <span className="text-xs text-muted-foreground/80">Community Health Worker</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
        {systemMessage ? (
          <Alert className="mb-5">
            <AlertDescription>{systemMessage}</AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <Card className="border-primary/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-primary" /> Child summary
              </CardTitle>
              <CardDescription>Read-only snapshot pulled from backend (or offline cache).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-3">
                  <p className="text-foreground text-base font-semibold">{childSnapshot.name}</p>
                  <p>Age: {childSnapshot.age}</p>
                  <p>Mother: {childSnapshot.motherName}</p>
                  <p>
                    Phone: <span className="font-mono">{childSnapshot.motherPhone}</span>
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" /> {childSnapshot.village}
                  </p>
                </div>
                <TransferOutButton 
                  childId={childSnapshot.id}
                  childName={childSnapshot.name}
                  variant="outline"
                  onSuccess={() => {
                    setSystemMessage("Child transferred out. Returning to search...")
                    setTimeout(() => router.push("/chw/find-child"), 2000)
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="h-5 w-5 text-primary" /> Pending sync
              </CardTitle>
              <CardDescription>Vaccinations recorded offline during this outreach.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingVaccinations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No offline vaccinations yet.</p>
              ) : (
                pendingVaccinations.map((entry) => (
                  <div key={composePendingVaccinationKey(entry)} className="rounded-lg border border-border bg-background/80 p-3">
                    <p className="text-sm font-semibold text-foreground">{entry.vaccineName}</p>
                    <p className="text-xs text-muted-foreground">Recorded: {entry.recordedDate}</p>
                    <p className="text-xs text-muted-foreground">
                      Notes: {entry.notes ? entry.notes : "None"}
                    </p>
                    {entry.latitude !== undefined && entry.longitude !== undefined ? (
                      <p className="text-xs text-muted-foreground">
                        GPS: {entry.latitude.toFixed(6)}, {entry.longitude.toFixed(6)}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-destructive">
                <CircleAlert className="h-5 w-5" /> Overdue / due vaccines
              </CardTitle>
              <CardDescription>Prioritise these doses during outreach. Record once administered.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {vaccineScheduleUncached ? (
                <p className="text-sm text-muted-foreground">
                  Vaccine schedule not available offline. Open this child&apos;s chart while online to cache it.
                </p>
              ) : childSnapshot.outstandingVaccines.length === 0 ? (
                <p className="text-sm text-muted-foreground">No outstanding doses.</p>
              ) : (
                <>
                  {outstandingPreview.map((dose) => {
                    const cutoffExpired = dose.status === "overdue" && isVaccineCutoffExpired(dose.name, childSnapshot?.dateOfBirth)
                    return (
                      <div key={dose.id} className="rounded-lg border border-border bg-background/80 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{dose.name}</p>
                            <p className="text-xs text-muted-foreground">Due: {dose.scheduledDate}</p>
                            {cutoffExpired && (
                              <p className="mt-1 text-xs font-medium text-muted-foreground">
                                Administration window closed — this dose can no longer be given.
                              </p>
                            )}
                          </div>
                          <Badge variant={dose.status === "overdue" ? "destructive" : "secondary"} className="text-xs">
                            {dose.status === "overdue" ? "Overdue" : "Due"}
                          </Badge>
                        </div>
                        {cutoffExpired ? (
                          <Badge variant="outline" className="mt-3 border-muted-foreground/40 text-muted-foreground">
                            Window Expired
                          </Badge>
                        ) : (
                          <Button size="sm" className="mt-3 gap-2" onClick={() => openAdministerModal(dose)}>
                            <Syringe className="h-4 w-4" /> Administer vaccine
                          </Button>
                        )}
                      </div>
                    )
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between gap-2 border-dashed text-destructive hover:text-destructive"
                    onClick={() => setListModal("outstanding")}
                  >
                    View all doses ({outstandingCount})
                    <ChevronRight className="h-4 w-4 animate-pulse motion-reduce:animate-none" />
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-emerald-300/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-emerald-700">
                <CircleCheck className="h-5 w-5" /> Completed at clinic
              </CardTitle>
              <CardDescription>Recent doses synced down from head office.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {vaccineScheduleUncached ? (
                <p className="text-sm text-muted-foreground">
                  History not available offline. Open this child&apos;s chart while online to cache it.
                </p>
              ) : childSnapshot.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No history downloaded.</p>
              ) : (
                <>
                  {historyPreview.map((dose) => (
                    <div key={dose.id} className="rounded-lg border border-border bg-background/80 p-4">
                      <p className="text-sm font-semibold text-foreground">{dose.name}</p>
                      <p className="text-xs text-muted-foreground">Scheduled: {dose.scheduledDate}</p>
                      <p className="text-xs text-muted-foreground">Administered: {dose.administeredDate}</p>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between gap-2 border-dashed text-emerald-700 hover:text-emerald-700"
                    onClick={() => setListModal("history")}
                  >
                    View full history ({historyCount})
                    <ChevronRight className="h-4 w-4 animate-pulse motion-reduce:animate-none" />
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      {listModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  {listModal === "outstanding" ? "Overdue / due vaccines" : "Completed at clinic"}
                </p>
                <p className="text-base font-semibold text-foreground">
                  {listModal === "outstanding" ? "Outstanding doses" : "Vaccination history"}
                </p>
              </div>
              <button
                type="button"
                className="group flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-foreground text-xs font-medium shadow-sm transition-all duration-200 hover:w-24 hover:rounded-lg hover:bg-accent"
                onClick={() => setListModal(null)}
                aria-label="Close"
              >
                <X className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                <span className="max-w-0 overflow-hidden whitespace-nowrap transition-all duration-200 group-hover:max-w-[4rem] group-hover:ml-2">
                  Close
                </span>
              </button>
            </div>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-5">
              {listModal === "outstanding" ? (
                childSnapshot.outstandingVaccines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No outstanding doses offline.</p>
                ) : (
                  childSnapshot.outstandingVaccines.map((dose) => {
                    const cutoffExpired = dose.status === "overdue" && isVaccineCutoffExpired(dose.name, childSnapshot.dateOfBirth)
                    return (
                      <div key={dose.id} className="rounded-lg border border-border bg-background/80 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{dose.name}</p>
                            <p className="text-xs text-muted-foreground">Due: {dose.scheduledDate}</p>
                            {cutoffExpired && (
                              <p className="mt-1 text-xs font-medium text-muted-foreground">
                                Administration window closed — this dose can no longer be given.
                              </p>
                            )}
                          </div>
                          <Badge variant={dose.status === "overdue" ? "destructive" : "secondary"} className="text-xs">
                            {dose.status === "overdue" ? "Overdue" : "Due"}
                          </Badge>
                        </div>
                        {cutoffExpired ? (
                          <Badge variant="outline" className="mt-3 border-muted-foreground/40 text-muted-foreground">
                            Window Expired
                          </Badge>
                        ) : (
                          <Button size="sm" className="mt-3 gap-2" onClick={() => openAdministerModal(dose)}>
                            <Syringe className="h-4 w-4" /> Administer vaccine
                          </Button>
                        )}
                      </div>
                    )
                  })
                )
              ) : childSnapshot.history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No history downloaded.</p>
              ) : (
                childSnapshot.history.map((dose) => (
                  <div key={dose.id} className="rounded-lg border border-border bg-background/80 p-4">
                    <p className="text-sm font-semibold text-foreground">{dose.name}</p>
                    <p className="text-xs text-muted-foreground">Scheduled: {dose.scheduledDate}</p>
                    <p className="text-xs text-muted-foreground">Administered: {dose.administeredDate}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {selectedVaccine ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="text-xs text-muted-foreground">Record vaccination offline</p>
                <p className="text-base font-semibold text-foreground">{selectedVaccine.name}</p>
              </div>
              <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={closeAdministerModal}>
                Close
              </button>
            </div>
            <form className="space-y-4 px-5 py-5" onSubmit={handleVaccinationSave}>
              <div className="space-y-1">
                <Label htmlFor="vaccine-name">Vaccine</Label>
                <Input id="vaccine-name" value={selectedVaccine.name} disabled />
                <p className="text-xs text-muted-foreground">Batch numbers are captured at the clinic. Field visit only confirms administration.</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="vaccine-date">Date</Label>
                <Input
                  id="vaccine-date"
                  value={new Date().toLocaleDateString("en-CA")}
                  readOnly
                />
                <p className="text-xs text-muted-foreground">Uses today&apos;s date. Adjust later at the clinic if needed.</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="vaccine-notes">Notes (AEFI / follow-up)</Label>
                <textarea
                  id="vaccine-notes"
                  className="min-h-[96px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="E.g. Mild fever noted, counselled mother on paracetamol dose."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Button type="button" variant="ghost" onClick={closeAdministerModal}>
                  Cancel
                </Button>
                <Button type="submit" className="gap-2" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {isOnline ? "Save" : "Save locally"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {successVaccine ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-sm rounded-xl border border-border bg-background shadow-xl">
            <div className="flex flex-col items-center gap-2 px-6 pb-6 pt-5 text-center">
              <DotLottieReact
                src="/Done.lottie"
                autoplay
                loop={false}
                style={{ width: 120, height: 120 }}
              />
              <p className="text-lg font-semibold text-foreground">Vaccination recorded!</p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{successVaccine}</span> has been saved
                {isOnline ? " and will sync to the server shortly." : " locally. It will sync when you are back online."}
              </p>
              <p className="text-xs text-muted-foreground">Child: {childSnapshot.name}</p>
              <div className="mt-4 flex w-full flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSuccessVaccine(null)}
                >
                  Back to chart
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={() => {
                    setSuccessVaccine(null)
                    // Scroll to outstanding vaccines section
                    document.querySelector("[data-outstanding]")?.scrollIntoView({ behavior: "smooth" })
                  }}
                >
                  <Syringe className="h-4 w-4" /> Record another
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
