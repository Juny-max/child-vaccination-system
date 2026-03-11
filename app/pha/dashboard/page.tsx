"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Activity,
  Calendar,
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  UserX,
  RefreshCw,
  Printer,
} from "lucide-react"

import { PHASidebar } from "@/components/pha/pha-sidebar"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getPHADashboard, type PHADashboardData } from "@/lib/api/pha"

export default function PHADashboard() {
  const [selectedTimeRange, setSelectedTimeRange] = useState("12months")
  const router = useRouter()
  const [dashData, setDashData] = useState<PHADashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    const legacyToken = localStorage.getItem("authToken")
    const accessToken = localStorage.getItem("accessToken")
    const userId = localStorage.getItem("userId")
    const role = localStorage.getItem("userRole")
    const detail = localStorage.getItem("userRoleDetail")

    const hasAuth = Boolean(userId || accessToken || legacyToken)

    if (!hasAuth) {
      router.replace("/auth/login")
      return
    }

    if (role !== "staff" || detail !== "pha") {
      const detailRoutes: Record<string, string> = {
        "facility-nurse": "/facility/dashboard",
        "branch-manager": "/branch/dashboard",
        "hq-admin": "/hq/dashboard",
        "chw": "/chw/dashboard",
        "data-officer": "/dashboard",
      }
      if (detail && detailRoutes[detail]) {
        router.replace(detailRoutes[detail])
      } else if (role === "parent") {
        router.replace("/parent/dashboard")
      } else {
        router.replace("/auth/login")
      }
    }
  }, [router])

  // Fetch real dashboard data once on mount. The backend returns all historical
  // trend data; we slice it locally based on selectedTimeRange so no refetch is needed.
  useEffect(() => {
    const token = localStorage.getItem("accessToken")
    if (!token) return // auth guard above will redirect

    setIsLoading(true)
    setApiError(null)
    getPHADashboard()
      .then((data) => setDashData(data))
      .catch(() => setApiError("Could not load dashboard data. Check your connection and try again."))
      .finally(() => setIsLoading(false))
  }, [])

  const formatNumber = (num: number) => new Intl.NumberFormat("en-GH").format(num)

  // Slice the trend array to the last N months for the selected time range.
  // The array is chronological so we take from the end.
  const trendMonthCount =
    selectedTimeRange === "3months" ? 3 : selectedTimeRange === "6months" ? 6 : 12

  // Build a full month-by-month grid for the selected window so the X-axis
  // always spans the correct period. Months with no Penta3 data show as 0%.
  const visibleTrend = (() => {
    const dataMap = new Map(
      (dashData?.coverageTrend ?? []).map((p) => [p.month, p.coverage])
    )
    const grid: { month: string; coverage: number }[] = []
    for (let i = trendMonthCount - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - i)
      const label = d.toLocaleDateString("en-GH", { month: "short", year: "numeric" })
      grid.push({ month: label, coverage: dataMap.get(label) ?? 0 })
    }
    return grid
  })()

  const coverageBarColor = (c: number) =>
    c >= 90 ? "bg-green-500" : c >= 80 ? "bg-amber-400" : "bg-red-500"

  const coverageBadgeClass = (c: number) =>
    c >= 90
      ? "border-green-300 bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400"
      : c >= 80
      ? "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
      : "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400"

  // Loading skeleton shared between KPI cards and panels
  const KPISkeleton = () => (
    <div className="h-24 animate-pulse rounded-xl bg-muted" />
  )

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden">
      <PHASidebar />

      <div className="flex-1 overflow-y-auto bg-muted/20">
      <main className="space-y-6 px-4 py-5 sm:px-6 sm:py-8">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">National Dashboard</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Public Health Authority · Ghana</p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted print:hidden"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Print Dashboard</span>
          </button>
        </div>

        {/* Error banner */}
        {apiError && (
          <div className="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{apiError}</span>
            <button
              onClick={() => {
                const months = selectedTimeRange === "3months" ? 3 : selectedTimeRange === "6months" ? 6 : 12
                setIsLoading(true)
                setApiError(null)
                getPHADashboard(months)
                  .then(setDashData)
                  .catch(() => setApiError("Could not load dashboard data. Check your connection and try again."))
                  .finally(() => setIsLoading(false))
              }}
              className="ml-auto flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs hover:bg-red-100 dark:border-red-700 dark:hover:bg-red-900/30"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        )}

        {/* KPI Cards */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <KPISkeleton key={i} />)
          ) : (
            <>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Children Registered</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">
                        {formatNumber(dashData?.kpis.totalChildrenRegistered ?? 0)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Nationwide · All-time</p>
                    </div>
                    <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                      <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Doses Administered</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">
                        {formatNumber(dashData?.kpis.totalDosesAdministered ?? 0)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">All vaccines · All-time</p>
                    </div>
                    <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
                      <Activity className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Penta3 Coverage</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">
                        {(dashData?.kpis.penta3Coverage ?? 0).toFixed(1)}%
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">WHO benchmark · National</p>
                    </div>
                    <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
                      <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-amber-200 dark:border-amber-800">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Dropout Rate</p>
                      <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {(dashData?.kpis.dropoutRate ?? 0).toFixed(1)}%
                      </p>
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">DPT1→DPT3 · Target &lt;10%</p>
                    </div>
                    <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
                      <TrendingDown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-200 dark:border-red-800">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Zero-Dose Children</p>
                      <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
                        {formatNumber(dashData?.kpis.zeroDoseChildren ?? 0)}
                      </p>
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">No vaccines received · Priority</p>
                    </div>
                    <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
                      <UserX className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </section>

        {/* Coverage Trend + AEFI Snapshot */}
        <section className="grid gap-6 lg:grid-cols-[1fr,320px]">
          {/* Coverage Trend */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calendar className="h-4 w-4 text-primary" /> Penta3 Coverage Trend
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {selectedTimeRange === "3months"
                      ? "Last 3 months"
                      : selectedTimeRange === "6months"
                      ? "Last 6 months"
                      : "Last 12 months"}
                  </CardDescription>
                </div>
                <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
                  {(["3months", "6months", "12months"] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setSelectedTimeRange(range)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        selectedTimeRange === range
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {range === "3months" ? "3M" : range === "6months" ? "6M" : "12M"}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[300px] animate-pulse rounded-xl bg-muted" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={visibleTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="month"
                        className="text-xs"
                        tick={{ fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(v: number) => [`${v}%`, "Coverage"]}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="coverage"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        name="Coverage %"
                        dot={{ fill: "#3b82f6", r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  {visibleTrend.length > 1 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Trend: {visibleTrend[0].coverage.toFixed(1)}%
                      ({visibleTrend[0].month}) &rarr;{" "}
                      {visibleTrend[visibleTrend.length - 1].coverage.toFixed(1)}%
                      ({visibleTrend[visibleTrend.length - 1].month})
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* AEFI Snapshot */}
          <Card className="self-start">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> AEFI Surveillance
              </CardTitle>
              <CardDescription>Adverse events · National aggregate</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="space-y-3">
                  <div className="h-20 animate-pulse rounded-xl bg-muted" />
                  <div className="h-10 animate-pulse rounded-xl bg-muted" />
                  <div className="h-10 animate-pulse rounded-xl bg-muted" />
                  <div className="h-10 animate-pulse rounded-xl bg-muted" />
                </div>
              ) : (
                <>
                  <div className="rounded-lg border bg-muted/30 p-4 text-center">
                    <p className="text-4xl font-bold text-foreground">
                      {formatNumber(dashData?.aefiSummary.total ?? 0)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Total Reports This Year</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-3 py-2 dark:bg-green-950/20">
                      <span className="text-xs font-medium text-green-700 dark:text-green-400">Mild</span>
                      <span className="text-sm font-bold text-green-900 dark:text-green-100">
                        {formatNumber(dashData?.aefiSummary.mild ?? 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:bg-amber-950/20">
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Moderate</span>
                      <span className="text-sm font-bold text-amber-900 dark:text-amber-100">
                        {formatNumber(dashData?.aefiSummary.moderate ?? 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:bg-red-950/20">
                      <span className="text-xs font-medium text-red-700 dark:text-red-400">Severe</span>
                      <span className="text-sm font-bold text-red-900 dark:text-red-100">
                        {dashData?.aefiSummary.severe ?? 0}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Live data from national AEFI surveillance database.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Regional Coverage */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Regional Coverage · All 16 Regions</CardTitle>
              <CardDescription>Sorted by coverage rate — identify regions needing intervention</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-6 animate-pulse rounded-full bg-muted" />
                  ))}
                </div>
              ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {(dashData?.regionalCoverage ?? []).map((r) => (
                  <div key={r.region} className="flex items-center gap-3">
                    <div className="w-28 shrink-0 truncate text-xs text-muted-foreground">{r.region}</div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full transition-all ${coverageBarColor(r.coverage)}`}
                        style={{ width: `${Math.min(r.coverage, 100)}%` }}
                      />
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-xs ${coverageBadgeClass(r.coverage)}`}>
                      {r.coverage.toFixed(1)}%
                    </Badge>
                  </div>
                ))}
                {!isLoading && (dashData?.regionalCoverage?.length ?? 0) === 0 && (
                  <p className="col-span-2 py-4 text-center text-sm text-muted-foreground">
                    No regional data available for the selected period.
                  </p>
                )}
              </div>
              )}
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-3 rounded-full bg-green-500" /> ≥90% On track
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-3 rounded-full bg-amber-400" /> 80–89% Needs monitoring
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-3 rounded-full bg-red-500" /> &lt;80% Needs intervention
                </span>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
      </div>
    </div>
  )
}
