"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  BookOpen,
  ChevronLeft,
  Loader2,
  Phone,
  RefreshCcw,
  Search,
  User,
} from "lucide-react"
import { getChwLocalRegister, type ChwRegisterChild } from "@/lib/api/chw"
import { getChildren } from "@/lib/chw-offline/db"
import { useNetworkStatus } from "@/lib/hooks/use-network-status"

import { ThemeToggle } from "@/components/theme-toggle"
import { NetworkStatusIndicator } from "@/components/chw/network-status-indicator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type RegisterEntry = {
  id: string
  cvccId: string
  fullName: string
  dateOfBirth: string
  gender: string
  guardianName: string
  guardianPhone: string
  source: "online" | "offline"
}

type GenderFilter = "all" | "male" | "female"

function toAgeLabel(dateOfBirth: string): string {
  const dob = new Date(dateOfBirth)
  if (isNaN(dob.getTime())) return "Unknown age"
  const now = new Date()
  const months = Math.max(
    0,
    (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth()),
  )
  if (months < 24) return `${months} month${months === 1 ? "" : "s"}`
  const years = Math.floor(months / 12)
  return `${years} year${years === 1 ? "" : "s"}`
}

export default function ChwRegisterPage() {
  const router = useRouter()
  const { isOnline } = useNetworkStatus()
  const [userName, setUserName] = useState("")
  const [entries, setEntries] = useState<RegisterEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState<"online" | "offline">("online")
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all")

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
    loadRegister()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const loadRegister = async () => {
    setLoading(true)
    setSystemMessage(null)

    // Online: fetch from backend
    if (isOnline) {
      try {
        const data = await getChwLocalRegister()
        setEntries(
          data.map((child: ChwRegisterChild) => ({
            id: child.id,
            cvccId: child.cvccId,
            fullName: child.fullName,
            dateOfBirth: child.dateOfBirth,
            gender: child.gender,
            guardianName: child.guardianName,
            guardianPhone: child.guardianPhone,
            source: "online",
          })),
        )
        setDataSource("online")
        setLoading(false)
        return
      } catch (error) {
        console.warn("Backend register fetch failed, falling back to offline cache", error)
      }
    }

    // Offline fallback: IndexedDB
    try {
      const localChildren = await getChildren()
      setEntries(
        localChildren.map((child) => ({
          id: child.id,
          cvccId: child.cvccId,
          fullName: child.fullName,
          dateOfBirth: child.dateOfBirth,
          gender: child.gender,
          guardianName: child.guardianName || "Unknown",
          guardianPhone: child.guardianPhone || "N/A",
          source: "offline",
        })),
      )
      setDataSource("offline")
      if (localChildren.length === 0) {
        setSystemMessage(
          "No children in offline cache. Sync at the clinic when you have internet to load your register.",
        )
      }
    } catch (error) {
      console.error("Failed to load offline register", error)
      setSystemMessage("Could not load register. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Re-run loadRegister when network comes back online
  useEffect(() => {
    if (isOnline && dataSource === "offline") {
      loadRegister()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter((entry) => {
      const matchesSearch =
        !q ||
        entry.fullName.toLowerCase().includes(q) ||
        entry.cvccId.toLowerCase().includes(q) ||
        entry.guardianName.toLowerCase().includes(q)

      const matchesGender =
        genderFilter === "all" ||
        (genderFilter === "male" && entry.gender === "male") ||
        (genderFilter === "female" && entry.gender === "female")

      return matchesSearch && matchesGender
    })
  }, [entries, search, genderFilter])

  const genderTabs: { label: string; value: GenderFilter }[] = [
    { label: "All", value: "all" },
    { label: "Male", value: "male" },
    { label: "Female", value: "female" },
  ]

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <Button asChild variant="ghost" size="sm" className="shrink-0 gap-1.5">
              <Link href="/chw/dashboard">
                <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                Community register ·{" "}
                {dataSource === "offline" ? (
                  <span className="text-amber-600">Offline cache</span>
                ) : (
                  <span className="text-emerald-600">Live data</span>
                )}
              </p>
              <p className="truncate text-sm font-semibold text-foreground sm:text-lg">My catchment children</p>
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
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{systemMessage}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="border-primary/40">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5 text-primary" /> Community register
              </CardTitle>
              <CardDescription>
                All children assigned to your catchment area. Tap any child to view their vaccination chart.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {filtered.length} of {entries.length} child{entries.length === 1 ? "" : "ren"}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 px-2 text-xs"
                onClick={loadRegister}
                disabled={loading}
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, CVCC ID, or guardian…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Gender filter tabs */}
            <div className="flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
              {genderTabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setGenderFilter(tab.value)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
                    genderFilter === tab.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* List */}
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">Loading register…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 py-10 text-center">
                <User className="h-8 w-8 text-primary/40" />
                {entries.length === 0 ? (
                  <>
                    <p className="text-sm font-medium text-foreground">No children in register yet</p>
                    <p className="max-w-xs text-xs text-muted-foreground">
                      {isOnline
                        ? "Your catchment area has no assigned children. Contact your supervisor to assign children."
                        : "Connect to internet to load your catchment register. Offline cache is empty."}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground">No matches</p>
                    <p className="text-xs text-muted-foreground">
                      Try a different name, CVCC ID, or clear the filter.
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSearch("")
                        setGenderFilter("all")
                      }}
                    >
                      Clear filters
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((child) => (
                  <div
                    key={child.id}
                    className="rounded-lg border border-border bg-background/80 p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{child.fullName}</p>
                          <Badge
                            variant="outline"
                            className={`shrink-0 text-xs capitalize ${
                              child.gender === "male"
                                ? "border-blue-300 text-blue-700"
                                : child.gender === "female"
                                  ? "border-pink-300 text-pink-700"
                                  : ""
                            }`}
                          >
                            {child.gender}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {toAgeLabel(child.dateOfBirth)} · CVCC: {child.cvccId}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Guardian: {child.guardianName}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button size="sm" variant="ghost" asChild>
                          <a href={`tel:${child.guardianPhone.replace(/\s+/g, "")}`}>
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                        <Button size="sm" asChild>
                          <Link href={`/chw/child/${child.id}`}>View chart</Link>
                        </Button>
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
