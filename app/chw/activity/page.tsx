"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  RefreshCcw,
  Stethoscope,
  UserPlus,
  ArrowRightLeft,
  LogOut,
  AlertCircle,
} from "lucide-react"
import { getAllCHWVaccinations, type CHWVaccinationRecord } from "@/lib/chw-offline-storage"
import { chwOfflineDb, type VaccinationQueueItem } from "@/lib/chw-offline/db"
import { chwBackgroundSync } from "@/lib/chw-offline/background-sync"
import { useNetworkStatus } from "@/lib/hooks/use-network-status"

import { ThemeToggle } from "@/components/theme-toggle"
import { NetworkStatusIndicator } from "@/components/chw/network-status-indicator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type ActivityEntry =
  | { kind: "vaccination"; time: string; childName: string; vaccineName: string; synced: boolean }
  | { kind: "register_child"; time: string; childName: string; synced: boolean }
  | { kind: "transfer_in"; time: string; childId: string; synced: boolean }
  | { kind: "transfer_out"; time: string; childId: string; synced: boolean }

function todayDateString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatTime(isoOrTimestamp: string | number): string {
  const d = typeof isoOrTimestamp === "number" ? new Date(isoOrTimestamp) : new Date(isoOrTimestamp)
  if (isNaN(d.getTime())) return "--:--"
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export default function ChwActivityPage() {
  const router = useRouter()
  const { isOnline } = useNetworkStatus()
  const [userName, setUserName] = useState("")
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [systemMessage, setSystemMessage] = useState<string | null>(null)

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
    loadActivity()

    const handleSaved = () => loadActivity()
    window.addEventListener("chw-vaccination-saved", handleSaved)
    return () => window.removeEventListener("chw-vaccination-saved", handleSaved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  useEffect(() => {
    if (!systemMessage) return
    const t = window.setTimeout(() => setSystemMessage(null), 4000)
    return () => window.clearTimeout(t)
  }, [systemMessage])

  const loadActivity = async () => {
    setLoading(true)
    const today = todayDateString()

    try {
      // 1. Vaccinations recorded today
      const allVaccinations = await getAllCHWVaccinations()
      const todayVaccinations = allVaccinations.filter(
        (v: CHWVaccinationRecord) => v.recordedDate === today,
      )

      const vaccinationEntries: ActivityEntry[] = todayVaccinations.map((v: CHWVaccinationRecord) => ({
        kind: "vaccination",
        time: formatTime(v.timestamp),
        childName: v.childName,
        vaccineName: v.vaccineName,
        synced: v.synced === true,
      }))

      // 2. Queue actions today (register, transfer_in, transfer_out)
      const allQueue = await chwOfflineDb.vaccinationQueue.toArray()
      const todayQueue = allQueue.filter((item: VaccinationQueueItem) => {
        const createdDate = item.createdAt.slice(0, 10)
        return (
          createdDate === today &&
          (item.actionType === "register_child" ||
            item.actionType === "transfer_in" ||
            item.actionType === "transfer_out")
        )
      })

      const queueEntries: ActivityEntry[] = todayQueue.map((item: VaccinationQueueItem) => {
        const isSynced = item.status !== "pending"
        if (item.actionType === "register_child") {
          const payload = item.payload as Record<string, string>
          return {
            kind: "register_child",
            time: formatTime(item.createdAt),
            childName: payload.childName || "Unknown child",
            synced: isSynced,
          }
        }
        if (item.actionType === "transfer_out") {
          return {
            kind: "transfer_out",
            time: formatTime(item.createdAt),
            childId: item.childId || "Unknown",
            synced: isSynced,
          }
        }
        // transfer_in
        return {
          kind: "transfer_in",
          time: formatTime(item.createdAt),
          childId: item.childId || "Unknown",
          synced: isSynced,
        }
      })

      // Merge and sort by time descending (most recent first)
      const all: ActivityEntry[] = [...vaccinationEntries, ...queueEntries].sort((a, b) =>
        b.time.localeCompare(a.time),
      )
      setEntries(all)
    } catch (error) {
      console.error("Failed to load activity", error)
      setSystemMessage("Could not load today's activity. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleSyncAll = async () => {
    if (!isOnline) {
      setSystemMessage("No internet connection. Sync will happen automatically when you're online.")
      return
    }
    setSyncing(true)
    try {
      chwBackgroundSync.start()
      setSystemMessage("Sync started. Records will upload in the background.")
    } finally {
      setSyncing(false)
    }
  }

  const stats = useMemo(() => {
    return {
      vaccines: entries.filter((e) => e.kind === "vaccination").length,
      registrations: entries.filter((e) => e.kind === "register_child").length,
      transfersIn: entries.filter((e) => e.kind === "transfer_in").length,
      transfersOut: entries.filter((e) => e.kind === "transfer_out").length,
    }
  }, [entries])

  const totalActions = entries.length
  const pendingCount = entries.filter((e) => !e.synced).length

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <Button asChild variant="ghost" size="sm" className="shrink-0 gap-1.5">
              <Link href="/chw/dashboard">
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <p className="truncate text-sm font-semibold text-foreground sm:text-lg">Today&apos;s activity</p>
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

      <main className="mx-auto w-full max-w-4xl px-3 py-4 sm:px-6 sm:py-6 space-y-6">
        {systemMessage ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{systemMessage}</AlertDescription>
          </Alert>
        ) : null}

        {/* Summary stat cards */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Vaccines recorded"
            value={stats.vaccines}
            icon={<Stethoscope className="h-5 w-5 text-primary" />}
            color="border-primary/30 bg-primary/5"
          />
          <StatCard
            label="Registrations"
            value={stats.registrations}
            icon={<UserPlus className="h-5 w-5 text-emerald-600" />}
            color="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20"
          />
          <StatCard
            label="Transfers in"
            value={stats.transfersIn}
            icon={<ArrowRightLeft className="h-5 w-5 text-blue-600" />}
            color="border-blue-200 bg-blue-50 dark:bg-blue-950/20"
          />
          <StatCard
            label="Transfers out"
            value={stats.transfersOut}
            icon={<LogOut className="h-5 w-5 text-amber-600" />}
            color="border-amber-200 bg-amber-50 dark:bg-amber-950/20"
          />
        </section>

        {/* Sync banner */}
        {pendingCount > 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
            <Clock className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              {pendingCount} action{pendingCount === 1 ? "" : "s"} pending sync to server.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-amber-400 text-amber-700 hover:bg-amber-100"
              onClick={handleSyncAll}
              disabled={syncing || !isOnline}
            >
              <RefreshCcw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              Sync now
            </Button>
          </div>
        ) : totalActions > 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>All activity synced to server.</span>
          </div>
        ) : null}

        {/* Timeline */}
        <Card className="border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-primary" /> Timeline
              </CardTitle>
              <CardDescription>{totalActions} action{totalActions === 1 ? "" : "s"} recorded today.</CardDescription>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 px-2 text-xs"
              onClick={loadActivity}
              disabled={loading}
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
                <RefreshCcw className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 py-10 text-center">
                <Clock className="h-8 w-8 text-primary/30" />
                <p className="text-sm font-medium text-foreground">No activity recorded today</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Head to Find Child to start recording vaccines, or Register Child to add a new child to your area.
                </p>
                <div className="flex gap-2 mt-1">
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/chw/find-child">Find Child</Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link href="/chw/register-child">Register Child</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative space-y-0">
                {/* Vertical timeline line */}
                <div className="absolute left-[17px] top-3 bottom-3 w-px bg-border" />

                {entries.map((entry, index) => (
                  <div key={index} className="relative flex gap-4 pb-4 last:pb-0">
                    <div className="relative z-10 mt-1 shrink-0">
                      <TimelineIcon kind={entry.kind} />
                    </div>
                    <div className="flex-1 rounded-lg border border-border bg-background/80 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <ActionLabel kind={entry.kind} />
                          </p>
                          <p className="mt-0.5 text-sm font-medium text-foreground">
                            <EntryDetail entry={entry} />
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-xs text-muted-foreground">{entry.time}</span>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              entry.synced
                                ? "border-emerald-300 text-emerald-700"
                                : "border-amber-300 text-amber-700"
                            }`}
                          >
                            {entry.synced ? "Synced" : "Pending"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className={`rounded-lg border p-3 ${color}`}>
      <div className="flex items-center justify-between">
        {icon}
        <span className="text-2xl font-bold text-foreground">{value}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function TimelineIcon({ kind }: { kind: ActivityEntry["kind"] }) {
  const base = "h-9 w-9 rounded-full flex items-center justify-center border-2 border-background"
  switch (kind) {
    case "vaccination":
      return (
        <div className={`${base} bg-primary/10 text-primary`}>
          <Stethoscope className="h-4 w-4" />
        </div>
      )
    case "register_child":
      return (
        <div className={`${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40`}>
          <UserPlus className="h-4 w-4" />
        </div>
      )
    case "transfer_in":
      return (
        <div className={`${base} bg-blue-100 text-blue-700 dark:bg-blue-950/40`}>
          <ArrowRightLeft className="h-4 w-4" />
        </div>
      )
    case "transfer_out":
      return (
        <div className={`${base} bg-amber-100 text-amber-700 dark:bg-amber-950/40`}>
          <LogOut className="h-4 w-4" />
        </div>
      )
  }
}

function ActionLabel({ kind }: { kind: ActivityEntry["kind"] }) {
  switch (kind) {
    case "vaccination":
      return <>Vaccine recorded</>
    case "register_child":
      return <>New registration</>
    case "transfer_in":
      return <>Transfer in</>
    case "transfer_out":
      return <>Transfer out</>
  }
}

function EntryDetail({ entry }: { entry: ActivityEntry }) {
  switch (entry.kind) {
    case "vaccination":
      return (
        <>
          {entry.childName} — {entry.vaccineName}
        </>
      )
    case "register_child":
      return <>{entry.childName}</>
    case "transfer_in":
      return <>Child added to your catchment</>
    case "transfer_out":
      return <>Child removed from your catchment</>
  }
}
