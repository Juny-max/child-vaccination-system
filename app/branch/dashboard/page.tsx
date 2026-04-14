"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  BarChart3,
  BellRing,
  CheckCircle2,
  ClipboardList,
  Compass,
  Gauge,
  Layers,
  Loader2,
  MessageSquareWarning,
  Package,
  Radio,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react"
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
} from "recharts"

import { ThemeToggle } from "@/components/theme-toggle"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getBranchDashboard,
  getVaccineOptions,
  recordStockDelivery,
  registerStaff,
  updateStaffStatus,
  type BranchDashboardData,
  type VaccineOption,
  type RegisterStaffPayload,
  type StaffRole,
} from "@/lib/api/branch-manager"

const SECTIONS = [
  { id: "overview", label: "Branch Overview", icon: Activity },
  { id: "actions", label: "Action Centre", icon: AlertTriangle },
  { id: "staff", label: "Staff Supervision", icon: Users },
  { id: "analytics", label: "Coverage Analytics", icon: BarChart3 },
  { id: "catchment", label: "Catchment Command", icon: Compass },
  { id: "modules", label: "Key Modules", icon: ClipboardList },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

const CatchmentCommandCenter = dynamic(
  () => import("@/components/branch/catchment-command-center"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] items-center justify-center rounded-xl border border-border bg-background/80 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading catchment command center...
      </div>
    ),
  },
)

export default function BranchDashboardPage() {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<SectionId>("overview")
  const [userName, setUserName] = useState("")
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [dashData, setDashData] = useState<BranchDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Stock delivery modal state
  const [stockModalOpen, setStockModalOpen] = useState(false)
  const [stockVaccines, setStockVaccines] = useState<VaccineOption[]>([])
  const [stockForm, setStockForm] = useState({
    vaccineId: "",
    batchNumber: "",
    lotNumber: "",
    manufacturer: "",
    expiryDate: "",
    quantityReceived: "",
    receivedDate: new Date().toISOString().split("T")[0],
  })
  const [stockSubmitting, setStockSubmitting] = useState(false)
  const [stockFormError, setStockFormError] = useState<string | null>(null)

  // Stock warning modal — auto-opens on load when vaccines are expired or out of stock
  const [stockWarningModalOpen, setStockWarningModalOpen] = useState(false)
  const [stockWarningAcknowledged, setStockWarningAcknowledged] = useState(false)

  // Logout state
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Register staff modal state
  const [registerStaffModalOpen, setRegisterStaffModalOpen] = useState(false)
  const [registerStaffOpening, setRegisterStaffOpening] = useState(false)
  const [visitLogModalOpen, setVisitLogModalOpen] = useState(false)
  const [visitSummaryDownloading, setVisitSummaryDownloading] = useState(false)
  const [staffRole, setStaffRole] = useState<StaffRole>("facility-nurse")
  const [staffForm, setStaffForm] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    nationalId: "",
    specialization: "", // for nurses
    catchmentAreaId: "", // for CHWs
  })
  const [staffSubmitting, setStaffSubmitting] = useState(false)
  const [staffStatusUpdatingId, setStaffStatusUpdatingId] = useState<string | null>(null)
  const [staffFormError, setStaffFormError] = useState<string | null>(null)
  const [staffFormSuccess, setStaffFormSuccess] = useState<string | null>(null)

  const loadDashboard = useCallback(() => {
    setIsLoading(true)
    setLoadError(null)
    getBranchDashboard()
      .then((data) => setDashData(data))
      .catch((err: Error) => {
        console.error("Failed to load branch dashboard:", err)
        setLoadError(err.message || "Failed to load dashboard data. Please try again.")
      })
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    const legacyToken = localStorage.getItem("authToken")
    const accessToken = localStorage.getItem("accessToken")
    const role = localStorage.getItem("userRole")
    const detail = localStorage.getItem("userRoleDetail")
    const name = sessionStorage.getItem("userName") || localStorage.getItem("userName")

    const hasAuth = Boolean(accessToken || legacyToken)

    if (!hasAuth) {
      router.push("/auth/login")
      return
    }

    if (role !== "staff") {
      router.push("/parent/dashboard")
      return
    }

    if (detail !== "branch-manager") {
      if (detail === "hq-admin") {
        router.push("/hq/dashboard")
        return
      }
      router.push("/dashboard")
      return
    }

    setUserName(name || "Branch Manager")

    // Fetch real dashboard data from the API
    loadDashboard()
  }, [router, loadDashboard])

  useEffect(() => {
    if (!systemMessage) return
    const timeout = window.setTimeout(() => setSystemMessage(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [systemMessage])

  // Auto-open the stock warning modal once per mount when critical alerts exist
  useEffect(() => {
    if (!dashData || stockWarningAcknowledged) return
    const hasCritical = (dashData.stockAlerts ?? []).some(
      (a) => a.status === 'expired' || a.status === 'out-of-stock',
    )
    if (hasCritical) setStockWarningModalOpen(true)
  }, [dashData, stockWarningAcknowledged])

  const activeStockAlerts = useMemo(
    () => (dashData?.stockAlerts ?? []).filter((alert) => alert.status !== "healthy"),
    [dashData],
  )

  const handleOpenStockModal = async () => {
    setStockModalOpen(true)
    setStockFormError(null)
    if (stockVaccines.length === 0) {
      try {
        const list = await getVaccineOptions()
        setStockVaccines(list)
      } catch {
        // Dropdown will be empty — user can still submit if they type manually via select
      }
    }
  }

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stockForm.vaccineId || !stockForm.batchNumber || !stockForm.expiryDate || !stockForm.quantityReceived) {
      setStockFormError("Please fill in all required fields.")
      return
    }
    setStockSubmitting(true)
    setStockFormError(null)
    try {
      await recordStockDelivery({
        vaccineId: stockForm.vaccineId,
        batchNumber: stockForm.batchNumber,
        lotNumber: stockForm.lotNumber || undefined,
        manufacturer: stockForm.manufacturer || undefined,
        expiryDate: stockForm.expiryDate,
        quantityReceived: parseInt(stockForm.quantityReceived, 10),
        receivedDate: stockForm.receivedDate,
      })
      setStockModalOpen(false)
      setStockForm({
        vaccineId: "",
        batchNumber: "",
        lotNumber: "",
        manufacturer: "",
        expiryDate: "",
        quantityReceived: "",
        receivedDate: new Date().toISOString().split("T")[0],
      })
      setSystemMessage("Delivery logged. Stock levels have been updated.")
      loadDashboard()
    } catch (err: unknown) {
      setStockFormError(err instanceof Error ? err.message : "Failed to log delivery. Please try again.")
    } finally {
      setStockSubmitting(false)
    }
  }

  const handleExportReports = () => {
    setSystemMessage("Branch analytics export queued. You will receive an email when it is ready to download.")
  }

  const handleOpenRegisterStaffModal = () => {
    setRegisterStaffOpening(true)
    setRegisterStaffModalOpen(true)
    setStaffFormError(null)
    setStaffFormSuccess(null)
    setStaffForm({
      fullName: "",
      email: "",
      phoneNumber: "",
      nationalId: "",
      specialization: "",
      catchmentAreaId: "",
    })
    setStaffRole("facility-nurse")
    window.setTimeout(() => setRegisterStaffOpening(false), 250)
  }

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffForm.fullName || !staffForm.email || !staffForm.phoneNumber) {
      setStaffFormError("Please fill in all required fields.")
      return
    }
    setStaffSubmitting(true)
    setStaffFormError(null)
    setStaffFormSuccess(null)
    try {
      const payload: RegisterStaffPayload = {
        fullName: staffForm.fullName.trim(),
        email: staffForm.email.trim(),
        phoneNumber: staffForm.phoneNumber.trim(),
        nationalId: staffForm.nationalId.trim() || undefined,
        role: staffRole,
        specialization: staffRole === "facility-nurse" ? staffForm.specialization.trim() || undefined : undefined,
        catchmentAreaId: staffRole === "chw" ? staffForm.catchmentAreaId.trim() || undefined : undefined,
      }
      const result = await registerStaff(payload)
      const defaultMessage = result.emailSent
        ? `Staff registered successfully! Login credentials have been sent to ${result.email}.`
        : `Staff registered successfully! Please contact ${result.email} to provide their login credentials.`
      const temporaryPasswordNotice = !result.emailSent && result.temporaryPassword
        ? ` Temporary password: ${result.temporaryPassword}`
        : ""
      setStaffFormSuccess(
        `${result.message || defaultMessage}${temporaryPasswordNotice}`
      )
      loadDashboard()
    } catch (err: unknown) {
      setStaffFormError(err instanceof Error ? err.message : "Failed to register staff. Please try again.")
    } finally {
      setStaffSubmitting(false)
    }
  }

  const handleSuspendStaff = async (staffId: string, currentStatus: string) => {
    setStaffStatusUpdatingId(staffId)
    try {
      const newStatus = currentStatus === "active" ? "suspended" : "active"
      await updateStaffStatus(staffId, newStatus)
      setSystemMessage(`Staff ${newStatus === "suspended" ? "suspended" : "activated"} successfully.`)
      loadDashboard()
    } catch (err: unknown) {
      setSystemMessage(err instanceof Error ? err.message : "Failed to update staff status.")
    } finally {
      setStaffStatusUpdatingId(null)
    }
  }

  const handleOpenVisitLog = () => {
    setVisitLogModalOpen(true)
  }

  const handleDownloadVisitSummary = () => {
    const visitLogs = dashData?.recentVisitLogs ?? []

    if (visitLogs.length === 0) {
      setSystemMessage("No visit logs available yet to download.")
      return
    }

    setVisitSummaryDownloading(true)
    try {
      const csvHeaders = ["Visit Date", "CHW", "Child", "Status", "Vaccines Administered", "Notes"]
      const csvRows = visitLogs.map((log) => [
        log.visitDate,
        log.chwName,
        log.childName,
        log.status,
        String(log.vaccinesAdministered),
        (log.notes || "").replace(/\r?\n/g, " "),
      ])

      const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`
      const csvContent = [csvHeaders, ...csvRows]
        .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
        .join("\n")

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)

      const anchor = document.createElement("a")
      anchor.href = url
      const branchSlug = (dashData?.branchMeta?.name || "branch")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
      const dateStamp = new Date().toISOString().split("T")[0]
      anchor.download = `${branchSlug || "branch"}-visit-summary-${dateStamp}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)

      URL.revokeObjectURL(url)
      setSystemMessage("Visit summary downloaded successfully.")
    } catch {
      setSystemMessage("Failed to download visit summary. Please try again.")
    } finally {
      setVisitSummaryDownloading(false)
    }
  }

  const handleOpenModule = (module: "users" | "child-records") => {
    const messages: Record<typeof module, string> = {
      users: "Branch user management will open once backend routes are integrated.",
      "child-records": "Child record search coming soon. Connect API to enable lookups.",
    }
    setSystemMessage(messages[module])
  }

  const kpis = dashData?.kpis ?? { childrenRegistered: 0, vaccinationsToday: 0, chwsActiveToday: 0, pendingSyncs: 0, zeroDoseChildren: 0 }
  const coverageTrendData = (dashData?.coverageTrend ?? []).map((p) => ({ day: p.day, measles: p.vaccinations }))
  const branchCoverageValueRaw = dashData?.branchCoverage ?? 0
  const branchCoverageValue = Math.max(0, Math.min(100, Number(branchCoverageValueRaw) || 0))
  const branchCoverageChart = [
    {
      name: "Coverage",
      covered: branchCoverageValue,
    },
  ]

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Children Registered</CardTitle>
            <CardDescription>Total children under this branch</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{kpis.childrenRegistered.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Vaccinations today</CardTitle>
            <CardDescription>Doses recorded since 00:00</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{kpis.vaccinationsToday}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">CHWs active today</CardTitle>
            <CardDescription>Sync activity in the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{kpis.chwsActiveToday}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Zero-dose children</CardTitle>
            <CardDescription>Registered but never vaccinated</CardDescription>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-semibold ${kpis.zeroDoseChildren > 0 ? "text-destructive" : ""}`}>
              {kpis.zeroDoseChildren.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,1fr]">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gauge className="h-5 w-5 text-primary" /> Branch coverage rate
            </CardTitle>
            <CardDescription>Coverage across all registered children</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ResponsiveContainer width="100%" height={280}>
              <RadialBarChart innerRadius="60%" outerRadius="110%" data={branchCoverageChart} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar
                  dataKey="covered"
                  cornerRadius={18}
                  fill="#16a34a"
                  background={{ fill: "#cbd5e1" }}
                  clockWise
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Covered
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> Remaining
              </span>
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">Coverage: {branchCoverageValue}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" /> 7-day coverage trend
            </CardTitle>
            <CardDescription>Daily vaccination count (7 days)</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={coverageTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="measles" stroke="#2563eb" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" /> Vaccine stock alerts
          </CardTitle>
          <CardDescription>Cold chain and outreach stock levels · sorted by urgency</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(dashData?.stockAlerts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-4">No stock data yet. Run the seed-stock-inventory.sql script in Supabase to populate demo data.</p>
          ) : (dashData?.stockAlerts ?? []).map((alert) => {
            const statusConfig: Record<string, { label: string; badgeVariant: "destructive" | "secondary" | "outline"; barColor: string }> = {
              expired:        { label: "Expired",      badgeVariant: "destructive", barColor: "bg-rose-800" },
              "out-of-stock": { label: "Out of stock", badgeVariant: "destructive", barColor: "bg-destructive" },
              critical:       { label: "Critical",     badgeVariant: "destructive", barColor: "bg-rose-500" },
              low:            { label: "Low",          badgeVariant: "secondary",   barColor: "bg-amber-500" },
              moderate:       { label: "Moderate",     badgeVariant: "secondary",   barColor: "bg-sky-500" },
              adequate:       { label: "Adequate",     badgeVariant: "outline",     barColor: "bg-emerald-500" },
            }
            const cfg = statusConfig[alert.status] ?? statusConfig.adequate
            const expiryWarning = alert.daysToExpiry <= 90
            return (
              <div key={alert.vaccine} className="rounded-lg border border-border bg-background p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground leading-tight">{alert.vaccine}</p>
                  <Badge variant={cfg.badgeVariant} className="shrink-0 text-xs">{cfg.label}</Badge>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {alert.remaining.toLocaleString()}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">doses</span>
                </p>
                {/* Stock level bar — max anchored at 500 for visual comparison */}
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${cfg.barColor}`}
                    style={{ width: `${Math.min(100, (alert.remaining / 500) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className={`text-xs ${expiryWarning ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                    Exp: {alert.expiryDate} {expiryWarning && `(${alert.daysToExpiry}d)`}
                  </p>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )

  const renderActions = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Overdue vaccinations
          </CardTitle>
          <CardDescription>Reach out to guardians and schedule immediate follow-ups.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(dashData?.overdueVaccinations ?? []).length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <p className="text-sm text-muted-foreground">All vaccinations are up to date. No overdue appointments.</p>
            </div>
          ) : (dashData?.overdueVaccinations ?? []).map((item) => {
            const days = item.daysOverdue ?? 0
            const urgencyVariant: "destructive" | "secondary" | "outline" =
              days > 14 ? "destructive" : days > 7 ? "secondary" : "secondary"
            const urgencyColor = days > 14 ? "border-destructive/60" : days > 7 ? "border-amber-400/60" : "border-border"
            return (
              <div key={item.id} className={`rounded-lg border bg-background p-4 ${urgencyColor}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{item.child}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                  <Badge variant={urgencyVariant} className="shrink-0 whitespace-nowrap">
                    {days} day{days !== 1 ? "s" : ""} overdue
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground/70">{item.timestamp}</p>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-primary" /> AEFI log
            </CardTitle>
            <CardDescription>Coordinate with district health officers for rapid response.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(dashData?.aefiEvents ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No AEFI events reported.</p>
            ) : (dashData?.aefiEvents ?? []).map((event) => (
              <div key={event.id} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{event.child}</p>
                  <Badge variant={event.status === "New" ? "destructive" : "outline"}>{event.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{event.detail}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground/80">{event.timestamp}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" /> CHW sync errors
            </CardTitle>
            <CardDescription>Resolve data conflicts and failed submissions quickly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(dashData?.syncErrors ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No sync errors.</p>
            ) : (dashData?.syncErrors ?? []).map((error) => (
              <div key={error.id} className="rounded-lg border border-border bg-background p-3">
                <p className="text-sm font-semibold text-foreground">{error.detail}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground/80">{error.timestamp}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareWarning className="h-4 w-4 text-primary" /> Notification failures
            </CardTitle>
            <CardDescription>Follow up with guardians whose reminders did not deliver.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(dashData?.notificationFailures ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No notification failures.</p>
            ) : (dashData?.notificationFailures ?? []).map((failure) => (
              <div key={failure.id} className="rounded-lg border border-border bg-background p-3">
                <p className="text-sm font-semibold text-foreground">{failure.child}</p>
                <p className="mt-1 text-xs text-muted-foreground">{failure.detail}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground/80">{failure.timestamp}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderStaff = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Staff roster</CardTitle>
              <CardDescription>Monitor nurse and CHW activity across catchments.</CardDescription>
            </div>
            <Button onClick={handleOpenRegisterStaffModal} disabled={registerStaffOpening}>
              {registerStaffOpening ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
              {registerStaffOpening ? "Opening..." : "Register Staff"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Last activity</th>
                <th className="py-2 pr-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(dashData?.staffRoster ?? []).length === 0 ? (
                <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No staff assigned to this branch.</td></tr>
              ) : (dashData?.staffRoster ?? []).map((staff) => (
                <tr key={staff.id} className="text-foreground">
                  <td className="py-2 pr-4 font-medium">{staff.name}</td>
                  <td className="py-2 pr-4">
                    <Badge variant={staff.role === "Nurse" ? "secondary" : "outline"}>{staff.role}</Badge>
                  </td>
                  <td className="py-2 pr-4">
                    <Badge variant={staff.status === "active" ? "default" : staff.status === "suspended" ? "destructive" : "secondary"}>
                      {staff.status || "active"}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">{staff.lastActive}</td>
                  <td className="py-2 pr-4">
                    {(() => {
                      const isUpdatingThisRow = staffStatusUpdatingId === staff.id
                      const actionLabel = (staff.status || "active") === "active" ? "Suspend" : "Activate"
                      const loadingLabel = actionLabel === "Suspend" ? "Suspending..." : "Activating..."
                      return (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isUpdatingThisRow}
                      onClick={() => handleSuspendStaff(staff.id, staff.status || "active")}
                    >
                      {isUpdatingThisRow ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {isUpdatingThisRow ? loadingLabel : actionLabel}
                    </Button>
                      )
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> CHW productivity (past 7 days)
          </CardTitle>
          <CardDescription>Registrations and vaccinations recorded per CHW.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dashData?.chwProductivity ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="registrations" fill="#2563eb" name="Registrations" />
              <Bar dataKey="vaccinations" fill="#10b981" name="Vaccinations" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Field visit log</CardTitle>
          <CardDescription>Open the detailed outreach visit tracker.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleOpenVisitLog}>Open CHW visit log</Button>
          <Button variant="ghost" className="gap-2" onClick={handleDownloadVisitSummary} disabled={visitSummaryDownloading}>
            {visitSummaryDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
            {visitSummaryDownloading ? "Preparing summary..." : "Download latest visit summary"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  const renderAnalytics = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="h-5 w-5 text-primary" /> Dropout analysis (Dose 1 vs Dose 3)
          </CardTitle>
          <CardDescription>Track follow-up needs for incomplete vaccination series.</CardDescription>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dashData?.dropoutData ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="vaccine" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="series1" fill="#2563eb" name="Dose 1" />
              <Bar dataKey="series3" fill="#f97316" name="Dose 3" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle>Export reports</CardTitle>
          <CardDescription>Generate CSV/Excel files for branch review meetings.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button className="gap-2" onClick={handleExportReports}>
            <ArrowDownToLine className="h-4 w-4" /> Export branch analytics
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => handleOpenModule("child-records")}>
            <ClipboardList className="h-4 w-4" /> Export child register
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  const renderCatchment = () => (
    <div className="space-y-6">
      <CatchmentCommandCenter
        staffRoster={dashData?.staffRoster ?? []}
        branchRegion={dashData?.branchMeta?.region}
        onDataChanged={loadDashboard}
      />
    </div>
  )

  const renderModules = () => (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="border border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg">User management</CardTitle>
          <CardDescription>Create, edit, or deactivate branch staff accounts.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={() => handleOpenModule("users")} className="gap-2">
            <Users className="h-4 w-4" /> Manage users
          </Button>
          <p className="text-xs text-muted-foreground">Assign CHWs to catchment areas within your branch.</p>
        </CardContent>
      </Card>

      <Card className="border border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg">Child record management</CardTitle>
          <CardDescription>Find and review child vaccination journeys.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={() => handleOpenModule("child-records")} className="gap-2">
            <Radio className="h-4 w-4" /> Open child lookup
          </Button>
          <p className="text-xs text-muted-foreground">Search by name, phone, or scan QR code.</p>
        </CardContent>
      </Card>

      <Card className="border border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg">Field stock management</CardTitle>
          <CardDescription>Log incoming vaccine deliveries and monitor stock levels.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={handleOpenStockModal} className="gap-2">
            <Package className="h-4 w-4" /> Log new delivery
          </Button>
          <p className="text-xs text-muted-foreground">Record each shipment received from the district medical store.</p>
        </CardContent>
      </Card>
    </div>
  )

  const renderContent = () => {
    switch (activeSection) {
      case "overview":
        return renderOverview()
      case "actions":
        return renderActions()
      case "staff":
        return renderStaff()
      case "analytics":
        return renderAnalytics()
      case "catchment":
        return renderCatchment()
      case "modules":
        return renderModules()
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-primary/30 bg-primary/5">
              <Image src="/images/cvcc-logo.png" alt="Child Vaccination Command Center logo" fill sizes="48px" className="object-cover" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Branch Operations Console</p>
              <p className="text-xl font-semibold text-foreground">{dashData?.branchMeta?.name ?? "Loading..."}</p>
              <p className="text-xs text-muted-foreground">
                {[dashData?.branchMeta?.district, dashData?.branchMeta?.region].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="flex flex-col items-end">
              <span className="text-sm text-muted-foreground">Welcome, {userName}</span>
              <span className="text-xs text-muted-foreground/80">Role: Branch Manager</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={isLoggingOut}
              onClick={() => {
                setIsLoggingOut(true)
                localStorage.removeItem("authToken")
                localStorage.removeItem("accessToken")
                localStorage.removeItem("userRole")
                localStorage.removeItem("userRoleDetail")
                localStorage.removeItem("userName")
                localStorage.removeItem("userId")
                localStorage.removeItem("branchId")
                sessionStorage.removeItem("userName")
                router.push("/")
              }}
            >
              {isLoggingOut && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLoggingOut ? "Logging out..." : "Logout"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="lg:w-72">
            <div className="rounded-xl border border-border bg-background/80 shadow-sm lg:sticky lg:top-24">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Command modules</p>
                <p className="text-xs text-muted-foreground">Inspect branch performance.</p>
              </div>
              <nav className="flex flex-col gap-1 p-3">
                {SECTIONS.map((section) => {
                  const Icon = section.icon
                  const isActive = activeSection === section.id
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveSection(section.id)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                        isActive
                          ? "border-primary bg-primary text-primary-foreground shadow"
                          : "border-transparent bg-transparent text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {section.label}
                      </span>
                      {isActive ? <span className="text-xs">Active</span> : null}
                    </button>
                  )
                })}
              </nav>
            </div>
          </aside>

          <section className="flex-1 space-y-4">
            {systemMessage ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{systemMessage}</AlertDescription>
              </Alert>
            ) : null}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Loading dashboard...</span>
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20">
                <AlertCircle className="h-10 w-10 text-destructive" />
                <p className="max-w-sm text-center text-sm text-muted-foreground">{loadError}</p>
                <Button onClick={loadDashboard} className="gap-2">
                  <RefreshCw className="h-4 w-4" /> Try again
                </Button>
              </div>
            ) : renderContent()}
          </section>
        </div>
      </main>

      {/* ── CHW Visit Log Modal ─────────────────────────────────────────── */}
      <Dialog open={visitLogModalOpen} onOpenChange={setVisitLogModalOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" /> CHW Visit Log Tracker
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Latest outreach visits recorded by CHWs in this branch.
            </p>
          </DialogHeader>

          <div className="max-h-[420px] overflow-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">CHW</th>
                  <th className="px-3 py-2 font-medium">Child</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Vaccines</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(dashData?.recentVisitLogs ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      No CHW visit logs found yet for this branch.
                    </td>
                  </tr>
                ) : (dashData?.recentVisitLogs ?? []).map((log) => (
                  <tr key={log.id} className="align-top">
                    <td className="px-3 py-2 text-muted-foreground">{log.visitDate}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{log.chwName}</td>
                    <td className="px-3 py-2 text-foreground">{log.childName}</td>
                    <td className="px-3 py-2">
                      <Badge variant={log.status === "completed" ? "default" : "secondary"}>{log.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-foreground">{log.vaccinesAdministered}</td>
                    <td className="px-3 py-2 text-muted-foreground">{log.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button variant="outline" className="gap-2" onClick={handleDownloadVisitSummary} disabled={visitSummaryDownloading}>
              {visitSummaryDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
              {visitSummaryDownloading ? "Preparing summary..." : "Download summary"}
            </Button>
            <Button onClick={() => setVisitLogModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Urgent Stock Warning Modal ─────────────────────────────────────── */}
      <Dialog
        open={stockWarningModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setStockWarningModalOpen(false)
            setStockWarningAcknowledged(true)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex flex-col items-center gap-3 pb-2 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-9 w-9 text-destructive" />
              </div>
              <DialogTitle className="text-xl font-bold text-destructive">
                Urgent Stock Alert
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                The following vaccines require <span className="font-semibold text-foreground">immediate action</span>.
                Contact your district medical store to arrange replenishment or safe disposal.
              </p>
            </div>
          </DialogHeader>

          <div className="max-h-72 space-y-3 overflow-y-auto py-1">
            {(dashData?.stockAlerts ?? [])
              .filter((a) => a.status === "expired" || a.status === "out-of-stock")
              .map((alert) => (
                <div
                  key={alert.vaccine}
                  className={`flex items-center justify-between rounded-xl border p-4 ${
                    alert.status === "expired"
                      ? "border-rose-500/60 bg-rose-50 dark:bg-rose-950/40"
                      : "border-orange-400/60 bg-orange-50 dark:bg-orange-950/40"
                  }`}
                >
                  <div>
                    <p className="font-semibold text-foreground">{alert.vaccine}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {alert.status === "expired"
                        ? `Expired on ${alert.expiryDate}`
                        : `Stock fully depleted — 0 doses remaining`}
                    </p>
                  </div>
                  <Badge variant="destructive" className="shrink-0 px-3 py-1 text-sm font-bold tracking-wide">
                    {alert.status === "expired" ? "EXPIRED" : "FINISHED"}
                  </Badge>
                </div>
              ))}
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="destructive"
              className="w-full gap-2 py-5 text-base font-semibold"
              onClick={() => {
                setStockWarningModalOpen(false)
                setStockWarningAcknowledged(true)
              }}
            >
              <CheckCircle2 className="h-5 w-5" /> Acknowledged — I will take action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Stock Delivery Modal ──────────────────────────────────────────── */}
      <Dialog open={stockModalOpen} onOpenChange={setStockModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> Log vaccine delivery
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleStockSubmit} className="space-y-4 pt-1">
            {/* Vaccine */}
            <div className="space-y-1">
              <Label htmlFor="stock-vaccine">Vaccine *</Label>
              <select
                id="stock-vaccine"
                value={stockForm.vaccineId}
                onChange={(e) => setStockForm((f) => ({ ...f, vaccineId: e.target.value }))}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <option value="">Select vaccine…</option>
                {stockVaccines.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            {/* Batch / Lot */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="stock-batch">Batch number *</Label>
                <Input
                  id="stock-batch"
                  placeholder="e.g. BCG-2026-001"
                  value={stockForm.batchNumber}
                  onChange={(e) => setStockForm((f) => ({ ...f, batchNumber: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="stock-lot">Lot number</Label>
                <Input
                  id="stock-lot"
                  placeholder="e.g. LOT-A1"
                  value={stockForm.lotNumber}
                  onChange={(e) => setStockForm((f) => ({ ...f, lotNumber: e.target.value }))}
                />
              </div>
            </div>

            {/* Manufacturer */}
            <div className="space-y-1">
              <Label htmlFor="stock-mfr">Manufacturer</Label>
              <Input
                id="stock-mfr"
                placeholder="e.g. Serum Institute of India"
                value={stockForm.manufacturer}
                onChange={(e) => setStockForm((f) => ({ ...f, manufacturer: e.target.value }))}
              />
            </div>

            {/* Qty / Received date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="stock-qty">Quantity received *</Label>
                <Input
                  id="stock-qty"
                  type="number"
                  min="1"
                  placeholder="e.g. 500"
                  value={stockForm.quantityReceived}
                  onChange={(e) => setStockForm((f) => ({ ...f, quantityReceived: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="stock-rcvd">Date received *</Label>
                <Input
                  id="stock-rcvd"
                  type="date"
                  value={stockForm.receivedDate}
                  onChange={(e) => setStockForm((f) => ({ ...f, receivedDate: e.target.value }))}
                  required
                />
              </div>
            </div>

            {/* Expiry date */}
            <div className="space-y-1">
              <Label htmlFor="stock-exp">Expiry date *</Label>
              <Input
                id="stock-exp"
                type="date"
                value={stockForm.expiryDate}
                onChange={(e) => setStockForm((f) => ({ ...f, expiryDate: e.target.value }))}
                required
              />
            </div>

            {stockFormError && (
              <p className="text-sm text-destructive">{stockFormError}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStockModalOpen(false)}
                disabled={stockSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={stockSubmitting} className="gap-2">
                {stockSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {stockSubmitting ? "Saving…" : "Log delivery"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Register Staff Modal ──────────────────────────────────────────── */}
      <Dialog open={registerStaffModalOpen} onOpenChange={setRegisterStaffModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Register Staff Member
            </DialogTitle>
          </DialogHeader>

          <Tabs value={staffRole} onValueChange={(val) => setStaffRole(val as StaffRole)} className="pt-1">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="facility-nurse">Nurse</TabsTrigger>
              <TabsTrigger value="chw">CHW</TabsTrigger>
            </TabsList>

            <form onSubmit={handleStaffSubmit} className="space-y-4 pt-4">
              {/* Common fields */}
              <div className="space-y-1">
                <Label htmlFor="staff-name">Full name *</Label>
                <Input
                  id="staff-name"
                  placeholder="e.g. Jane Smith"
                  value={staffForm.fullName}
                  onChange={(e) => setStaffForm((f) => ({ ...f, fullName: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="staff-email">Email *</Label>
                  <Input
                    id="staff-email"
                    type="email"
                    placeholder="jane@example.com"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="staff-phone">Phone *</Label>
                  <Input
                    id="staff-phone"
                    type="tel"
                    placeholder="+233 XX XXX XXXX"
                    value={staffForm.phoneNumber}
                    onChange={(e) => setStaffForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="staff-national-id">National ID</Label>
                <Input
                  id="staff-national-id"
                  placeholder="GHA-XXXXXXXXX-X"
                  value={staffForm.nationalId}
                  onChange={(e) => setStaffForm((f) => ({ ...f, nationalId: e.target.value }))}
                />
              </div>

              {/* Nurse-specific fields */}
              <TabsContent value="facility-nurse" className="mt-0 space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="staff-specialization">Specialization</Label>
                  <Input
                    id="staff-specialization"
                    placeholder="e.g. Pediatric Immunization"
                    value={staffForm.specialization}
                    onChange={(e) => setStaffForm((f) => ({ ...f, specialization: e.target.value }))}
                  />
                </div>
              </TabsContent>

              {/* CHW-specific fields */}
              <TabsContent value="chw" className="mt-0 space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="staff-catchment">Catchment area</Label>
                  <Input
                    id="staff-catchment"
                    placeholder="Catchment area ID (optional)"
                    value={staffForm.catchmentAreaId}
                    onChange={(e) => setStaffForm((f) => ({ ...f, catchmentAreaId: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Leave blank to assign later</p>
                </div>
              </TabsContent>

              {staffFormError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{staffFormError}</AlertDescription>
                </Alert>
              )}

              {staffFormSuccess && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="whitespace-pre-line text-green-800 dark:text-green-100">
                    {staffFormSuccess}
                  </AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRegisterStaffModalOpen(false)}
                  disabled={staffSubmitting}
                >
                  {staffFormSuccess ? "Close" : "Cancel"}
                </Button>
                {!staffFormSuccess && (
                  <Button type="submit" disabled={staffSubmitting} className="gap-2">
                    {staffSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {staffSubmitting ? "Registering…" : "Register Staff"}
                  </Button>
                )}
              </DialogFooter>
            </form>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
