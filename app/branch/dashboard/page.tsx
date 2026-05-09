"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { Html5Qrcode } from "html5-qrcode"
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  BarChart3,
  BellRing,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Gauge,
  Info,
  Layers,
  Loader2,
  MessageSquareWarning,
  Package,
  Pencil,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
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
import { toast } from "sonner"

import { DatePicker } from "@/components/ui/date-picker"
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
  resetExpiringStock,
  getBranchChildManagementQueues,
  assignBranchChildFollowUp,
  searchBranchChildren,
  registerStaff,
  updateStaffStatus,
  markAefiReviewed,
  adjustStock,
  type AlertItem,
  type BranchDashboardData,
  type BranchChildManagementQueues,
  type BranchChildLookupResult,
  type BranchChildQueueItem,
  type BranchChildQueuePriority,
  type BranchChildQueueType,
  type StockAlert,
  type VaccineOption,
  type RegisterStaffPayload,
  type StaffRole,
} from "@/lib/api/branch-manager"

const STOCK_RESET_EXPIRY_WINDOW_DAYS = 90

const SECTIONS = [
  { id: "overview", label: "Branch Overview", icon: Activity },
  { id: "actions", label: "Action Centre", icon: AlertTriangle },
  { id: "staff", label: "Staff Supervision", icon: Users },
  { id: "analytics", label: "Coverage Analytics", icon: BarChart3 },
  // TODO: Re-enable Catchment Command after the upgraded version ships.
  // { id: "catchment", label: "Catchment Command", icon: Compass },
  { id: "modules", label: "Key Modules", icon: ClipboardList },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]
type ChildLookupCameraState = "idle" | "starting" | "active" | "error"
type ChildManagementView = "queues" | "search"
type ChildQueueTab = BranchChildQueueType

const EMPTY_CHILD_QUEUES: BranchChildManagementQueues = {
  overdue: [],
  zeroDose: [],
  missed: [],
  failedReminders: [],
}

const CHILD_QUEUE_COPY: Record<
  ChildQueueTab,
  {
    tabLabel: string
    heading: string
    description: string
    emptyState: string
  }
> = {
  overdue: {
    tabLabel: "Overdue vaccinations",
    heading: "Overdue vaccinations queue",
    description:
      "Children here have at least one vaccine dose past due date. Urgency (high/critical) shows how late the dose is, not missed appointments.",
    emptyState: "No overdue vaccination records in this queue right now.",
  },
  "zero-dose": {
    tabLabel: "Zero-dose children",
    heading: "Zero-dose queue",
    description:
      "Children in this queue are registered but have no completed vaccinations recorded yet.",
    emptyState: "No zero-dose children in this queue right now.",
  },
  missed: {
    tabLabel: "Missed appointments",
    heading: "Missed appointments queue",
    description:
      "This queue shows missed appointment visits. It is separate from overdue vaccination doses.",
    emptyState: "No missed appointments in this queue right now.",
  },
  "failed-reminder": {
    tabLabel: "Failed reminders",
    heading: "Failed reminder delivery queue",
    description:
      "Reminder messages that failed to deliver (SMS/email). Follow up to confirm contacts and re-engage caregivers.",
    emptyState: "No failed reminder deliveries in this queue right now.",
  },
}

const filterAlertsByDateRange = (
  items: AlertItem[],
  startDate: Date | undefined,
  endDate: Date | undefined,
) => {
  if (!startDate && !endDate) return items

  return items.filter((item) => {
    const rawDate = item.createdAt ?? item.timestamp
    const itemTs = Date.parse(rawDate)
    if (Number.isNaN(itemTs)) return true

    if (startDate && itemTs < startDate.getTime()) return false
    if (endDate) {
      const endOfDay = new Date(endDate)
      endOfDay.setHours(23, 59, 59, 999)
      if (itemTs > endOfDay.getTime()) return false
    }

    return true
  })
}

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
  const [stockVaccinesLoading, setStockVaccinesLoading] = useState(false)
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
  const [resettingStockVaccineId, setResettingStockVaccineId] = useState<string | null>(null)
  const [resetStockModalOpen, setResetStockModalOpen] = useState(false)
  const [resetStockTarget, setResetStockTarget] = useState<StockAlert | null>(null)
  const [adjustStockModalOpen, setAdjustStockModalOpen] = useState(false)
  const [adjustStockTarget, setAdjustStockTarget] = useState<StockAlert | null>(null)
  const [adjustStockForm, setAdjustStockForm] = useState({ newQuantity: "", reason: "", notes: "" })
  const [isAdjustingStock, setIsAdjustingStock] = useState(false)
  const [adjustStockError, setAdjustStockError] = useState<string | null>(null)

  // Stock warning modal — auto-opens on load when vaccines are expired or out of stock
  const [stockWarningModalOpen, setStockWarningModalOpen] = useState(false)
  const [stockWarningAcknowledged, setStockWarningAcknowledged] = useState(false)

  // AEFI login alert modal — auto-opens on load when there are unreviewed AEFI events
  const [aefiLoginAlertOpen, setAefiLoginAlertOpen] = useState(false)
  const [aefiLoginAlertAcknowledged, setAefiLoginAlertAcknowledged] = useState(false)

  // Logout state
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Register staff modal state
  const [registerStaffModalOpen, setRegisterStaffModalOpen] = useState(false)
  const [registerStaffOpening, setRegisterStaffOpening] = useState(false)
  const [visitLogModalOpen, setVisitLogModalOpen] = useState(false)
  const [visitSummaryDownloading, setVisitSummaryDownloading] = useState(false)
  const [overdueModalOpen, setOverdueModalOpen] = useState(false)
  const [overdueFilterStart, setOverdueFilterStart] = useState<Date | undefined>(undefined)
  const [overdueFilterEnd, setOverdueFilterEnd] = useState<Date | undefined>(undefined)
  const [selectedOverdueItem, setSelectedOverdueItem] = useState<AlertItem | null>(null)
  const [aefiModalOpen, setAefiModalOpen] = useState(false)
  const [dropoutInfoOpen, setDropoutInfoOpen] = useState(false)
  const [aefiFilterStart, setAefiFilterStart] = useState<Date | undefined>(undefined)
  const [aefiFilterEnd, setAefiFilterEnd] = useState<Date | undefined>(undefined)
  const [selectedAefiItem, setSelectedAefiItem] = useState<AlertItem | null>(null)
  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const [syncFilterStart, setSyncFilterStart] = useState<Date | undefined>(undefined)
  const [syncFilterEnd, setSyncFilterEnd] = useState<Date | undefined>(undefined)
  const [selectedSyncItem, setSelectedSyncItem] = useState<AlertItem | null>(null)
  const [childLookupModalOpen, setChildLookupModalOpen] = useState(false)
  const [childManagementView, setChildManagementView] = useState<ChildManagementView>("queues")
  const [childQueueTab, setChildQueueTab] = useState<ChildQueueTab>("overdue")
  const [childManagementQueues, setChildManagementQueues] = useState<BranchChildManagementQueues>(EMPTY_CHILD_QUEUES)
  const [childManagementQueuesLoading, setChildManagementQueuesLoading] = useState(false)
  const [childManagementQueuesError, setChildManagementQueuesError] = useState<string | null>(null)
  const [childLookupQuery, setChildLookupQuery] = useState("")
  const [childLookupResults, setChildLookupResults] = useState<BranchChildLookupResult[]>([])
  const [childLookupLoading, setChildLookupLoading] = useState(false)
  const [childLookupError, setChildLookupError] = useState<string | null>(null)
  const [childLookupCameraState, setChildLookupCameraState] = useState<ChildLookupCameraState>("idle")
  const [childLookupCameraError, setChildLookupCameraError] = useState<string | null>(null)
  const childLookupScannerRef = useRef<Html5Qrcode | null>(null)
  const childLookupIsProcessingScan = useRef(false)
  const childLookupScannerId = "branch-child-lookup-scanner"
  const [assignFollowUpModalOpen, setAssignFollowUpModalOpen] = useState(false)
  const [assignFollowUpItem, setAssignFollowUpItem] = useState<BranchChildQueueItem | null>(null)
  const [assignFollowUpStaffId, setAssignFollowUpStaffId] = useState("")
  const [assignFollowUpNotes, setAssignFollowUpNotes] = useState("")
  const [assignFollowUpLoading, setAssignFollowUpLoading] = useState(false)
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

  // Auto-open AEFI alert modal once per mount when there are unreviewed AEFI events
  useEffect(() => {
    if (!dashData || aefiLoginAlertAcknowledged) return
    const hasNew = (dashData.aefiEvents ?? []).some((e: any) => e.status === 'New')
    if (hasNew) setAefiLoginAlertOpen(true)
  }, [dashData, aefiLoginAlertAcknowledged])

  useEffect(() => {
    if (childLookupModalOpen) return

    setChildLookupCameraState("idle")
    setChildLookupCameraError(null)
    childLookupIsProcessingScan.current = false

    if (childLookupScannerRef.current?.isScanning) {
      childLookupScannerRef.current.stop().catch(console.error)
    }
  }, [childLookupModalOpen])

  useEffect(() => {
    return () => {
      if (childLookupScannerRef.current?.isScanning) {
        childLookupScannerRef.current.stop().catch(console.error)
      }
    }
  }, [])

  const activeStockAlerts = useMemo(
    () => (dashData?.stockAlerts ?? []).filter((alert) => alert.status !== "healthy"),
    [dashData],
  )

  const assignableFollowUpStaff = useMemo(
    () =>
      (dashData?.staffRoster ?? []).filter(
        (staff) =>
          staff.status === "active" &&
          (staff.role === "Nurse" || staff.role === "CHW"),
      ),
    [dashData],
  )

  const childQueueCounts = useMemo(
    () => ({
      overdue: childManagementQueues.overdue.length,
      "zero-dose": childManagementQueues.zeroDose.length,
      missed: childManagementQueues.missed.length,
      "failed-reminder": childManagementQueues.failedReminders.length,
    }),
    [childManagementQueues],
  )

  const overdueAlerts = dashData?.overdueVaccinations ?? []
  const aefiAlerts = dashData?.aefiEvents ?? []
  const syncAlerts = dashData?.syncErrors ?? []

  const overduePreview = useMemo(() => overdueAlerts.slice(0, 5), [overdueAlerts])
  const aefiPreview = useMemo(() => aefiAlerts.slice(0, 5), [aefiAlerts])
  const syncPreview = useMemo(() => syncAlerts.slice(0, 5), [syncAlerts])

  const overdueFiltered = useMemo(
    () => filterAlertsByDateRange(overdueAlerts, overdueFilterStart, overdueFilterEnd),
    [overdueAlerts, overdueFilterStart, overdueFilterEnd],
  )
  const aefiFiltered = useMemo(
    () => filterAlertsByDateRange(aefiAlerts, aefiFilterStart, aefiFilterEnd),
    [aefiAlerts, aefiFilterStart, aefiFilterEnd],
  )
  const syncFiltered = useMemo(
    () => filterAlertsByDateRange(syncAlerts, syncFilterStart, syncFilterEnd),
    [syncAlerts, syncFilterStart, syncFilterEnd],
  )

  const activeChildQueueItems = useMemo(() => {
    switch (childQueueTab) {
      case "overdue":
        return childManagementQueues.overdue
      case "zero-dose":
        return childManagementQueues.zeroDose
      case "missed":
        return childManagementQueues.missed
      case "failed-reminder":
        return childManagementQueues.failedReminders
      default:
        return []
    }
  }, [childManagementQueues, childQueueTab])

  const activeChildQueueCopy = CHILD_QUEUE_COPY[childQueueTab]

  const handleOpenAefiDetail = async (event: AlertItem) => {
    setSelectedAefiItem(event)
    if (event.status === "New") {
      try {
        await markAefiReviewed(event.id)
        // Optimistically update local state so the badge changes immediately
        setDashData((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            aefiEvents: prev.aefiEvents.map((e) =>
              e.id === event.id ? { ...e, status: "Under review" } : e
            ),
          }
        })
        setSelectedAefiItem({ ...event, status: "Under review" })
      } catch {
        // Non-critical — detail still opens, badge stays New until next refresh
      }
    }
  }

  const handleOpenStockModal = async () => {
    setStockModalOpen(true)
    setStockFormError(null)
    if (stockVaccines.length === 0) {
      setStockVaccinesLoading(true)
      try {
        const list = await getVaccineOptions()
        setStockVaccines(list)
      } catch {
        // Dropdown will be empty — user can still submit if they type manually via select
      } finally {
        setStockVaccinesLoading(false)
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

  const canResetAlertStock = (alert: StockAlert) => alert.daysToExpiry <= STOCK_RESET_EXPIRY_WINDOW_DAYS

  const handleOpenResetStockModal = (alert: StockAlert) => {
    if (!canResetAlertStock(alert)) return
    setResetStockTarget(alert)
    setResetStockModalOpen(true)
  }

  const handleOpenAdjustStockModal = (alert: StockAlert) => {
    setAdjustStockTarget(alert)
    setAdjustStockForm({ newQuantity: String(alert.remaining), reason: "", notes: "" })
    setAdjustStockError(null)
    setAdjustStockModalOpen(true)
  }

  const handleAdjustStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjustStockTarget) return
    const newQty = parseInt(adjustStockForm.newQuantity, 10)
    if (isNaN(newQty) || newQty < 0) {
      setAdjustStockError("Please enter a valid quantity (0 or more).")
      return
    }
    if (!adjustStockForm.reason) {
      setAdjustStockError("Please select a reason for this adjustment.")
      return
    }
    setIsAdjustingStock(true)
    setAdjustStockError(null)
    try {
      await adjustStock({
        vaccineId: adjustStockTarget.vaccineId,
        newQuantity: newQty,
        reason: adjustStockForm.reason,
        notes: adjustStockForm.notes || undefined,
      })
      toast.success(`Stock adjusted: ${adjustStockTarget.vaccine} updated to ${newQty} doses.`)
      setAdjustStockModalOpen(false)
      setAdjustStockTarget(null)
      loadDashboard()
    } catch (err: unknown) {
      setAdjustStockError(err instanceof Error ? err.message : "Failed to adjust stock. Please try again.")
    } finally {
      setIsAdjustingStock(false)
    }
  }

  const handleResetExpiringAndRestock = async (alert: StockAlert) => {
    if (!canResetAlertStock(alert)) {
      return
    }

    setResettingStockVaccineId(alert.vaccineId)
    try {
      const result = await resetExpiringStock({
        vaccineId: alert.vaccineId,
        expiryWindowDays: STOCK_RESET_EXPIRY_WINDOW_DAYS,
      })

      await handleOpenStockModal()
      setStockForm((prev) => ({ ...prev, vaccineId: alert.vaccineId }))
      setSystemMessage(`${result.message} Continue by logging the new replacement delivery.`)
      loadDashboard()
    } catch (err: unknown) {
      setSystemMessage(err instanceof Error ? err.message : "Failed to reset expiring stock.")
    } finally {
      setResettingStockVaccineId(null)
      setResetStockModalOpen(false)
      setResetStockTarget(null)
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

  const extractLookupIdentifier = (decodedText: string): string => {
    let value = (decodedText || "").trim()
    if (!value) return ""

    try {
      const parsed = JSON.parse(value)
      const candidate =
        parsed?.childId ||
        parsed?.id ||
        parsed?.cvccId ||
        parsed?.qrPayload ||
        parsed?.certificateId ||
        parsed?.token

      if (typeof candidate === "string" && candidate.trim()) {
        value = candidate.trim()
      }
    } catch {
      // Not JSON payload.
    }

    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value)
        const fromParams =
          url.searchParams.get("id") ||
          url.searchParams.get("childId") ||
          url.searchParams.get("certificateId") ||
          url.searchParams.get("token")

        if (fromParams && fromParams.trim()) {
          value = fromParams.trim()
        } else {
          const segments = url.pathname.split("/").filter(Boolean)
          const lastSegment = segments[segments.length - 1]
          if (lastSegment) {
            value = lastSegment
          }
        }
      } catch {
        // Keep raw value when URL parse fails.
      }
    }

    if (value.includes("|")) {
      value = value.split("|")[0].trim()
    }

    value = value.trim().slice(0, 100)

    if (/^(qrc-(ch|cert)-|cert-gh-|ch-|cvcc-)/i.test(value)) {
      value = value.toUpperCase()
    }

    return value
  }

  const runChildLookup = async (rawValue: string) => {
    const trimmed = rawValue.trim()
    const isQrToken = /^QRC-(CH|CERT)-/i.test(trimmed)

    if (!trimmed) {
      setChildLookupError("Enter a child name, guardian phone, CVCC ID, or scan a QR code.")
      setChildLookupResults([])
      return
    }

    if (trimmed.length < 2 && !isQrToken) {
      setChildLookupError("Type at least 2 characters to search.")
      setChildLookupResults([])
      return
    }

    setChildLookupLoading(true)
    setChildLookupError(null)

    try {
      const results = await searchBranchChildren(trimmed)
      setChildLookupResults(results)
      if (results.length === 0) {
        setChildLookupError("No matching child records found in this branch.")
      }
    } catch (error) {
      console.error("Branch child lookup failed:", error)
      setChildLookupResults([])
      setChildLookupError("Failed to search child records. Please try again.")
    } finally {
      setChildLookupLoading(false)
    }
  }

  const loadChildManagementQueues = async () => {
    setChildManagementQueuesLoading(true)
    setChildManagementQueuesError(null)

    try {
      const queues = await getBranchChildManagementQueues()
      setChildManagementQueues(queues)
    } catch (error) {
      console.error("Failed to load branch child queues:", error)
      setChildManagementQueues(EMPTY_CHILD_QUEUES)
      setChildManagementQueuesError(
        "Unable to load operational child queues. Please try again.",
      )
    } finally {
      setChildManagementQueuesLoading(false)
    }
  }

  const handleOpenChildJourneyFromQueue = async (item: BranchChildQueueItem) => {
    const preferredQuery = item.childCvccId !== "N/A" ? item.childCvccId : item.childName
    setChildManagementView("search")
    setChildLookupQuery(preferredQuery)
    await runChildLookup(preferredQuery)
  }

  const getQueuePriorityBadgeVariant = (priority: BranchChildQueuePriority) => {
    if (priority === "critical") return "destructive" as const
    if (priority === "high") return "secondary" as const
    return "outline" as const
  }

  const handleOpenAssignFollowUp = (item: BranchChildQueueItem) => {
    setAssignFollowUpItem(item)
    setAssignFollowUpStaffId("")
    setAssignFollowUpNotes("")
    setAssignFollowUpModalOpen(true)
  }

  const handleAssignFollowUp = async () => {
    if (!assignFollowUpItem) return
    if (!assignFollowUpStaffId) {
      setSystemMessage("Select a nurse or CHW before assigning follow-up.")
      return
    }

    setAssignFollowUpLoading(true)
    try {
      const selectedStaff = assignableFollowUpStaff.find(
        (staff) => staff.id === assignFollowUpStaffId,
      )

      const result = await assignBranchChildFollowUp({
        childId: assignFollowUpItem.childId,
        assigneeUserId: assignFollowUpStaffId,
        queueType: assignFollowUpItem.queueType,
        reason: assignFollowUpItem.reason,
        notes: assignFollowUpNotes.trim() || undefined,
      })

      toast.success(result.message || "Follow-up assigned successfully.", {
        icon: null,
      })
      setSystemMessage(result.message || "Follow-up assigned successfully.")
      setAssignFollowUpModalOpen(false)
      setAssignFollowUpItem(null)
      await loadChildManagementQueues()
    } catch (error) {
      console.error("Failed to assign follow-up:", error)
      setSystemMessage("Failed to assign follow-up. Please try again.")
    } finally {
      setAssignFollowUpLoading(false)
    }
  }

  const formatLookupDate = (dateValue?: string | null) => {
    if (!dateValue) return "-"
    const parsed = new Date(dateValue)
    if (Number.isNaN(parsed.getTime())) return dateValue

    return parsed.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const stopChildLookupScanner = async () => {
    if (childLookupScannerRef.current?.isScanning) {
      try {
        await childLookupScannerRef.current.stop()
      } catch (error) {
        console.error("Failed to stop child lookup scanner:", error)
      }
    }

    setChildLookupCameraState("idle")
  }

  const startChildLookupScanner = async () => {
    if (childLookupCameraState === "active" || childLookupCameraState === "starting") {
      return
    }

    setChildLookupCameraError(null)
    setChildLookupCameraState("starting")

    await new Promise((resolve) => setTimeout(resolve, 100))

    try {
      if (!window.isSecureContext && window.location.hostname !== "localhost") {
        throw new Error("Camera requires HTTPS or localhost.")
      }

      const element = document.getElementById(childLookupScannerId)
      if (!element) {
        throw new Error("Scanner container not available. Please try again.")
      }

      if (!childLookupScannerRef.current) {
        childLookupScannerRef.current = new Html5Qrcode(childLookupScannerId)
      }

      const cameras = await Html5Qrcode.getCameras()
      if (!cameras || cameras.length === 0) {
        throw new Error("No camera detected for QR scanning.")
      }

      const preferredCameraId =
        cameras.find((camera) =>
          /back|rear|environment/i.test(camera.label),
        )?.id || cameras[0].id

      await childLookupScannerRef.current.start(
        preferredCameraId,
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          if (childLookupIsProcessingScan.current) return
          childLookupIsProcessingScan.current = true

          const lookupId = extractLookupIdentifier(decodedText)
          if (lookupId) {
            setChildLookupQuery(lookupId)
            await runChildLookup(lookupId)
            await stopChildLookupScanner()
          } else {
            setChildLookupCameraError("Scanned QR code is not a valid child identifier.")
          }

          window.setTimeout(() => {
            childLookupIsProcessingScan.current = false
          }, 1500)
        },
        (scanError) => {
          if (!scanError.includes("NotFoundException")) {
            console.log("Child lookup scan error:", scanError)
          }
        },
      )

      setChildLookupCameraState("active")
    } catch (error) {
      console.error("Child lookup scanner failed:", error)
      setChildLookupCameraError(
        error instanceof Error ? error.message : "Unable to start camera scanner.",
      )
      setChildLookupCameraState("error")
    }
  }

  const handleOpenChildLookupModal = () => {
    setChildLookupModalOpen(true)
    setChildManagementView("queues")
    setChildQueueTab("overdue")
    setChildManagementQueuesError(null)
    setChildLookupQuery("")
    setChildLookupResults([])
    setChildLookupError(null)
    setChildLookupCameraError(null)
    void loadChildManagementQueues()
  }

  const handleOpenModule = (module: "child-records") => {
    if (module === "child-records") {
      handleOpenChildLookupModal()
    }
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
            const canReset = canResetAlertStock(alert)
            const resetInProgress = resettingStockVaccineId === alert.vaccineId
            return (
              <div key={alert.vaccineId} className="rounded-lg border border-border bg-background p-4 flex flex-col gap-2">
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
                <div className="flex items-center justify-end gap-2 mt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="group h-8 w-8 p-0 transition-all duration-300 hover:border-primary hover:bg-primary/10 hover:shadow-md"
                    aria-label="Adjust stock quantity"
                    title="Adjust stock quantity"
                    onClick={() => handleOpenAdjustStockModal(alert)}
                  >
                    <Pencil className="h-3.5 w-3.5 transition-all duration-300 group-hover:-rotate-12 group-hover:scale-125 group-hover:text-primary group-hover:drop-shadow-sm" />
                  </Button>
                  {canReset ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="group h-8 w-8 p-0"
                      disabled={resetInProgress}
                      aria-label="Reset expiring stock and restock"
                      title="Reset expiring stock and restock"
                      onClick={() => handleOpenResetStockModal(alert)}
                    >
                      {resetInProgress ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-180" />
                      )}
                    </Button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

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
    </div>
  )

  const renderActions = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Overdue vaccinations
              </CardTitle>
              <CardDescription>Reach out to guardians and schedule immediate follow-ups.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedOverdueItem(null)
                setOverdueModalOpen(true)
              }}
            >
              View all
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {overdueAlerts.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <p className="text-sm text-muted-foreground">All vaccinations are up to date. No overdue appointments.</p>
            </div>
          ) : overduePreview.map((item) => {
            const days = item.daysOverdue ?? 0
            const urgencyVariant: "destructive" | "secondary" | "outline" =
              days > 14 ? "destructive" : days > 7 ? "secondary" : "secondary"
            const urgencyColor = days > 14 ? "border-destructive/60" : days > 7 ? "border-amber-400/60" : "border-border"
            return (
              <button
                key={item.id}
                type="button"
                className={`w-full rounded-lg border bg-background p-4 text-left transition hover:border-primary/40 hover:bg-primary/5 ${urgencyColor}`}
                onClick={() => {
                  setSelectedOverdueItem(item)
                  setOverdueModalOpen(true)
                }}
              >
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
              </button>
            )
          })}
          {overdueAlerts.length > 5 ? (
            <p className="text-xs text-muted-foreground">Showing top 5 of {overdueAlerts.length} overdue cases.</p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-primary" /> AEFI log
                </CardTitle>
                <CardDescription>Coordinate with district health officers for rapid response.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedAefiItem(null)
                  setAefiModalOpen(true)
                }}
              >
                View all
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {aefiAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No AEFI events reported.</p>
            ) : aefiPreview.map((event) => (
              <button
                key={event.id}
                type="button"
                className="w-full rounded-lg border border-border bg-background p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                onClick={() => {
                  handleOpenAefiDetail(event)
                  setAefiModalOpen(true)
                }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{event.child}</p>
                  <Badge variant={event.status === "New" ? "destructive" : "outline"}>{event.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{event.detail}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground/80">{event.timestamp}</p>
              </button>
            ))}
            {aefiAlerts.length > 5 ? (
              <p className="text-xs text-muted-foreground">Showing top 5 of {aefiAlerts.length} reports.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary" /> CHW sync errors
                </CardTitle>
                <CardDescription>Resolve data conflicts and failed submissions quickly.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedSyncItem(null)
                  setSyncModalOpen(true)
                }}
              >
                View all
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {syncAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sync errors.</p>
            ) : syncPreview.map((error) => (
              <button
                key={error.id}
                type="button"
                className="w-full rounded-lg border border-border bg-background p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                onClick={() => {
                  setSelectedSyncItem(error)
                  setSyncModalOpen(true)
                }}
              >
                <p className="text-sm font-semibold text-foreground">{error.detail}</p>
                {error.child && error.child !== 'N/A' ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">Reported by: {error.child}</p>
                ) : null}
                <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground/80">{error.timestamp}</p>
              </button>
            ))}
            {syncAlerts.length > 5 ? (
              <p className="text-xs text-muted-foreground">Showing top 5 of {syncAlerts.length} sync errors.</p>
            ) : null}
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
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers className="h-5 w-5 text-primary" /> Dropout analysis (Dose 1 vs Dose 3)
              </CardTitle>
              <CardDescription>Track follow-up needs for incomplete vaccination series.</CardDescription>
            </div>
            <button
              type="button"
              onClick={() => setDropoutInfoOpen(true)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:text-primary"
              aria-label="What is this?"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
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
    <div className="grid gap-6 md:grid-cols-2">
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

      {/* ── Child Record Lookup Modal ────────────────────────────────────── */}
      <Dialog
        open={childLookupModalOpen}
        onOpenChange={(open) => {
          setChildLookupModalOpen(open)
          if (!open) {
            void stopChildLookupScanner()
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" /> Child record management
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Use operational queues first, then search fallback when needed.
            </p>
          </DialogHeader>

          <Tabs
            value={childManagementView}
            onValueChange={(value) => setChildManagementView(value as ChildManagementView)}
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="queues">Operational queues</TabsTrigger>
              <TabsTrigger value="search">Search fallback</TabsTrigger>
            </TabsList>

            <TabsContent value="queues" className="space-y-4">
              <Tabs
                value={childQueueTab}
                onValueChange={(value) => setChildQueueTab(value as ChildQueueTab)}
                className="space-y-4"
              >
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                  <TabsTrigger value="overdue">{CHILD_QUEUE_COPY.overdue.tabLabel} ({childQueueCounts.overdue})</TabsTrigger>
                  <TabsTrigger value="zero-dose">{CHILD_QUEUE_COPY["zero-dose"].tabLabel} ({childQueueCounts["zero-dose"]})</TabsTrigger>
                  <TabsTrigger value="missed">{CHILD_QUEUE_COPY.missed.tabLabel} ({childQueueCounts.missed})</TabsTrigger>
                  <TabsTrigger value="failed-reminder">{CHILD_QUEUE_COPY["failed-reminder"].tabLabel} ({childQueueCounts["failed-reminder"]})</TabsTrigger>
                </TabsList>

                {childManagementQueuesError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{childManagementQueuesError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="rounded-md border border-border/70 bg-muted/30 p-3">
                  <p className="text-sm font-medium text-foreground">{activeChildQueueCopy.heading}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{activeChildQueueCopy.description}</p>
                </div>

                <div className="max-h-[400px] space-y-3 overflow-y-auto pr-1">
                  {childManagementQueuesLoading ? (
                    <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading child action queues...
                    </div>
                  ) : activeChildQueueItems.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {activeChildQueueCopy.emptyState}
                    </p>
                  ) : (
                    activeChildQueueItems.map((item) => (
                      <div key={item.id} className="rounded-lg border border-border bg-background p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{item.childName}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.childCvccId} • Guardian: {item.guardianName} • {item.guardianPhone}
                            </p>
                          </div>
                          <Badge variant={getQueuePriorityBadgeVariant(item.priority)}>
                            Urgency: {item.priority.toUpperCase()}
                          </Badge>
                        </div>

                        <p className="mt-2 text-xs text-muted-foreground">{item.reason}</p>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">Opened: {item.daysOpen} day{item.daysOpen === 1 ? "" : "s"}</Badge>
                          <Badge variant="outline">Reference: {formatLookupDate(item.referenceDate)}</Badge>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleOpenChildJourneyFromQueue(item)}
                          >
                            Open child journey
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => handleOpenAssignFollowUp(item)}
                          >
                            <UserPlus className="h-3.5 w-3.5" /> Assign follow-up
                          </Button>
                        </div>

                        {item.assignedToName ? (
                          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                            Assigned to {item.assignedToName}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </Tabs>
            </TabsContent>

            <TabsContent value="search" className="space-y-4">
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  void runChildLookup(childLookupQuery)
                }}
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={childLookupQuery}
                    onChange={(event) => setChildLookupQuery(event.target.value)}
                    placeholder="Search phone, CVCC ID, or QR token"
                    className="sm:flex-1"
                  />
                  <Button type="submit" disabled={childLookupLoading} className="gap-2">
                    {childLookupLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    {childLookupLoading ? "Searching..." : "Search"}
                  </Button>
                  <Button
                    type="button"
                    variant={childLookupCameraState === "active" ? "secondary" : "outline"}
                    className="gap-2"
                    onClick={() => {
                      if (childLookupCameraState === "active") {
                        void stopChildLookupScanner()
                        return
                      }
                      void startChildLookupScanner()
                    }}
                    disabled={childLookupCameraState === "starting"}
                  >
                    {childLookupCameraState === "starting" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                    {childLookupCameraState === "active" ? "Stop camera" : "Scan QR"}
                  </Button>
                </div>

                {childLookupCameraState !== "idle" ? (
                  <div className="space-y-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
                    <div id={childLookupScannerId} className="min-h-[220px] w-full overflow-hidden rounded-md bg-background" />
                    {childLookupCameraState === "starting" ? (
                      <p className="text-xs text-muted-foreground">Starting camera scanner...</p>
                    ) : null}
                  </div>
                ) : null}

                {childLookupCameraError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{childLookupCameraError}</AlertDescription>
                  </Alert>
                ) : null}

                {childLookupError && !childLookupLoading ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{childLookupError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
                  {childLookupLoading ? (
                    <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading child records...
                    </div>
                  ) : childLookupResults.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Search to review a specific child vaccination journey.
                    </p>
                  ) : (
                    childLookupResults.map((child) => (
                      <div key={child.id} className="rounded-lg border border-border bg-background p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{child.childName}</p>
                            <p className="text-xs text-muted-foreground">
                              {child.childId} • {child.age} • {child.gender}
                            </p>
                          </div>
                          <Badge
                            variant={
                              child.vaccinationStatus === "Overdue"
                                ? "destructive"
                                : child.vaccinationStatus === "Complete"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {child.vaccinationStatus}
                          </Badge>
                        </div>

                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          <p>
                            Guardian: {child.guardianName} • {child.guardianPhone}
                          </p>
                          <p>Facility: {child.facilityName}</p>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline">Completed: {child.completedVaccines}</Badge>
                          <Badge variant="outline">Upcoming: {child.upcomingVaccines}</Badge>
                          <Badge variant="outline">Overdue: {child.overdueVaccines}</Badge>
                        </div>

                        <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                          <p>
                            Next due: {child.nextVaccine ? `${child.nextVaccine} (${formatLookupDate(child.nextDueDate)})` : "All scheduled doses completed"}
                          </p>
                          <p className="mt-1">Last completed dose: {formatLookupDate(child.lastVisit)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </form>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setChildLookupModalOpen(false)
                void stopChildLookupScanner()
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign Follow-Up Modal ─────────────────────────────────────── */}
      <Dialog
        open={assignFollowUpModalOpen}
        onOpenChange={(open) => {
          setAssignFollowUpModalOpen(open)
          if (!open) {
            setAssignFollowUpItem(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Assign follow-up
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {assignFollowUpItem
                ? `Assign ${assignFollowUpItem.childName} follow-up to an active nurse or CHW.`
                : "Select an item to assign."}
            </p>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="assign-follow-up-staff">Assign to *</Label>
              <select
                id="assign-follow-up-staff"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={assignFollowUpStaffId}
                onChange={(event) => setAssignFollowUpStaffId(event.target.value)}
                disabled={assignFollowUpLoading}
              >
                <option value="">Select staff member...</option>
                {assignableFollowUpStaff.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name} ({staff.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="assign-follow-up-notes">Notes (optional)</Label>
              <Input
                id="assign-follow-up-notes"
                placeholder="Add context for field follow-up"
                value={assignFollowUpNotes}
                onChange={(event) => setAssignFollowUpNotes(event.target.value)}
                disabled={assignFollowUpLoading}
              />
            </div>

            {assignableFollowUpStaff.length === 0 ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No active nurse or CHW available to assign right now.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={assignFollowUpLoading}
              onClick={() => {
                setAssignFollowUpModalOpen(false)
                setAssignFollowUpItem(null)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={assignFollowUpLoading || !assignFollowUpItem}
              onClick={() => void handleAssignFollowUp()}
            >
              {assignFollowUpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {assignFollowUpLoading ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dropout Analysis Explainer ───────────────────────────────────────── */}
      <Dialog open={dropoutInfoOpen} onOpenChange={setDropoutInfoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" /> Dropout Analysis — What does this mean?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              This chart compares how many children received <span className="font-semibold text-foreground">Dose 1</span> of a vaccine series against how many completed <span className="font-semibold text-foreground">Dose 3</span> — for Penta, OPV, and PCV vaccines.
            </p>
            <p>
              The <span className="font-semibold text-foreground">gap between the two bars</span> represents <span className="font-semibold text-foreground">dropouts</span> — children who started a vaccine series but never finished it. These children are partially protected and remain at risk.
            </p>
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
              <p className="font-medium text-foreground">Example</p>
              <p>120 children received Penta Dose 1 but only 80 completed Penta Dose 3. That means <span className="font-semibold text-foreground">40 children dropped out</span> and need a follow-up visit from a CHW.</p>
            </div>
            <p>
              This is one of the key metrics used by <span className="font-semibold text-foreground">Ghana Health Service</span> and the <span className="font-semibold text-foreground">WHO</span> to measure how well an immunisation programme is performing. A large gap signals that CHW outreach or supply chain issues are interrupting vaccine series midway.
            </p>
            <p>
              Use this chart during your branch review meetings to identify which vaccines have the highest dropout and direct CHWs to follow up with those families.
            </p>
          </div>
          <DialogFooter className="pt-2">
            <Button onClick={() => setDropoutInfoOpen(false)} className="w-full">Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AEFI Login Alert Modal ───────────────────────────────────────────── */}
      <Dialog
        open={aefiLoginAlertOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAefiLoginAlertOpen(false)
            setAefiLoginAlertAcknowledged(true)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex flex-col items-center gap-3 pb-2 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
                <BellRing className="h-9 w-9 text-amber-600 dark:text-amber-400" />
              </div>
              <DialogTitle className="text-xl font-bold text-amber-700 dark:text-amber-400">
                Unreviewed AEFI Reports
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                The following adverse events have been reported and require your <span className="font-semibold text-foreground">review and follow-up</span>.
              </p>
            </div>
          </DialogHeader>

          <div className="max-h-72 space-y-3 overflow-y-auto py-1">
            {(dashData?.aefiEvents ?? [])
              .filter((e: any) => e.status === 'New')
              .map((event: any) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-foreground">{event.child}</p>
                    <Badge variant="destructive" className="shrink-0 text-xs">New</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{event.detail}</p>
                  <p className="mt-2 text-xs text-muted-foreground/70">{event.timestamp}</p>
                </div>
              ))}
          </div>

          <DialogFooter className="flex flex-col gap-2 pt-2 sm:flex-col">
            <Button
              className="w-full gap-2 py-5 text-base font-semibold bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => {
                setAefiLoginAlertOpen(false)
                setAefiLoginAlertAcknowledged(true)
                setAefiModalOpen(true)
              }}
            >
              <BellRing className="h-5 w-5" /> Review AEFI reports now
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setAefiLoginAlertOpen(false)
                setAefiLoginAlertAcknowledged(true)
              }}
            >
              Dismiss — I will review later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <div className="relative">
                <select
                  id="stock-vaccine"
                  value={stockForm.vaccineId}
                  onChange={(e) => setStockForm((f) => ({ ...f, vaccineId: e.target.value }))}
                  required
                  disabled={stockVaccinesLoading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    {stockVaccinesLoading ? "Loading vaccines..." : "Select vaccine…"}
                  </option>
                  {stockVaccines.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                {stockVaccinesLoading && (
                  <Loader2 className="absolute right-8 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
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
                <Label>Date received *</Label>
                <DatePicker
                  date={stockForm.receivedDate ? new Date(stockForm.receivedDate) : undefined}
                  onDateChange={(d) => setStockForm((f) => ({
                    ...f,
                    receivedDate: d ? d.toISOString().split("T")[0] : "",
                  }))}
                  placeholder="Pick received date"
                  maxDate={new Date()}
                />
              </div>
            </div>

            {/* Expiry date */}
            <div className="space-y-1">
              <Label>Expiry date *</Label>
              <DatePicker
                date={stockForm.expiryDate ? new Date(stockForm.expiryDate) : undefined}
                onDateChange={(d) => setStockForm((f) => ({
                  ...f,
                  expiryDate: d ? d.toISOString().split("T")[0] : "",
                }))}
                placeholder="Pick expiry date"
                minDate={new Date()}
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

      {/* ── Stock Reset Confirmation Modal ─────────────────────────────────── */}
      <Dialog
        open={resetStockModalOpen}
        onOpenChange={(open) => {
          setResetStockModalOpen(open)
          if (!open && !resettingStockVaccineId) {
            setResetStockTarget(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" /> Reset expiring stock
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Reset expiring stock for {resetStockTarget?.vaccine ?? "this vaccine"}? This will clear current quantities that expire within {STOCK_RESET_EXPIRY_WINDOW_DAYS} days before you log the new delivery.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(resettingStockVaccineId)}
              onClick={() => {
                setResetStockModalOpen(false)
                setResetStockTarget(null)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={!resetStockTarget || Boolean(resettingStockVaccineId)}
              onClick={() => {
                if (!resetStockTarget) return
                void handleResetExpiringAndRestock(resetStockTarget)
              }}
            >
              {resettingStockVaccineId ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {resettingStockVaccineId ? "Resetting..." : "Confirm reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Stock Adjustment Modal ──────────────────────────────────────── */}
      <Dialog
        open={adjustStockModalOpen}
        onOpenChange={(open) => {
          if (!isAdjustingStock) {
            setAdjustStockModalOpen(open)
            if (!open) { setAdjustStockTarget(null); setAdjustStockError(null) }
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Adjust stock quantity
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Record a change to the current stock level. A reason is required for the audit trail.
            </p>
          </DialogHeader>
          <form onSubmit={handleAdjustStockSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Vaccine</Label>
              <Input value={adjustStockTarget?.vaccine ?? ""} readOnly className="bg-muted cursor-not-allowed" />
            </div>
            <div className="space-y-1">
              <Label>Current quantity on hand</Label>
              <Input value={`${adjustStockTarget?.remaining ?? 0} doses`} readOnly className="bg-muted cursor-not-allowed" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="newQuantity">New quantity <span className="text-destructive">*</span></Label>
              <Input
                id="newQuantity"
                type="number"
                min="0"
                required
                placeholder="Enter corrected quantity"
                value={adjustStockForm.newQuantity}
                onChange={(e) => setAdjustStockForm((f) => ({ ...f, newQuantity: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="adjustReason">Reason <span className="text-destructive">*</span></Label>
              <select
                id="adjustReason"
                required
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                value={adjustStockForm.reason}
                onChange={(e) => setAdjustStockForm((f) => ({ ...f, reason: e.target.value }))}
              >
                <option value="">Select a reason</option>
                <option value="wastage">Wastage (damaged, cold-chain failure, discarded)</option>
                <option value="physical_count">Physical count correction (stocktake mismatch)</option>
                <option value="transfer_out">Transfer out (sent to another facility)</option>
                <option value="correction">Stock correction (wrong quantity logged)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="adjustNotes">Notes (optional)</Label>
              <Input
                id="adjustNotes"
                placeholder="e.g. 12 vials found damaged after cold chain power cut"
                value={adjustStockForm.notes}
                onChange={(e) => setAdjustStockForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            {adjustStockError && (
              <p className="text-sm text-destructive">{adjustStockError}</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isAdjustingStock}
                onClick={() => { setAdjustStockModalOpen(false); setAdjustStockTarget(null); setAdjustStockError(null) }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isAdjustingStock} className="gap-2">
                {isAdjustingStock ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                {isAdjustingStock ? "Saving..." : "Save adjustment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Overdue Vaccinations Modal ──────────────────────────────────── */}
      <Dialog
        open={overdueModalOpen}
        onOpenChange={(open) => {
          setOverdueModalOpen(open)
          if (!open) setSelectedOverdueItem(null)
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Overdue vaccinations
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedOverdueItem
                ? "Vaccination overdue details"
                : `${overdueFiltered.length} overdue record${overdueFiltered.length !== 1 ? "s" : ""} found`}
            </p>
          </DialogHeader>

          {selectedOverdueItem ? (
            <div className="space-y-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-1 gap-1.5"
                onClick={() => setSelectedOverdueItem(null)}
              >
                <ChevronLeft className="h-4 w-4" /> Back to list
              </Button>
              <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-foreground">{selectedOverdueItem.child}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{selectedOverdueItem.detail}</p>
                  </div>
                  <Badge
                    variant={
                      (selectedOverdueItem.daysOverdue ?? 0) > 14
                        ? "destructive"
                        : "secondary"
                    }
                    className="shrink-0 whitespace-nowrap"
                  >
                    {selectedOverdueItem.daysOverdue ?? 0} day{selectedOverdueItem.daysOverdue !== 1 ? "s" : ""} overdue
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                    <p className="mt-1 text-sm text-foreground">{selectedOverdueItem.status || "Pending follow-up"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recorded</p>
                    <p className="mt-1 text-sm text-foreground">{selectedOverdueItem.timestamp}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">From</Label>
                  <DatePicker
                    date={overdueFilterStart}
                    onDateChange={setOverdueFilterStart}
                    placeholder="Start date"
                    className="w-40"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">To</Label>
                  <DatePicker
                    date={overdueFilterEnd}
                    onDateChange={setOverdueFilterEnd}
                    placeholder="End date"
                    minDate={overdueFilterStart}
                    className="w-40"
                  />
                </div>
                {(overdueFilterStart || overdueFilterEnd) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setOverdueFilterStart(undefined); setOverdueFilterEnd(undefined) }}
                  >
                    Clear filters
                  </Button>
                ) : null}
              </div>

              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {overdueFiltered.length === 0 ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-6">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                    <p className="text-sm text-muted-foreground">No overdue records match the selected filters.</p>
                  </div>
                ) : overdueFiltered.map((item) => {
                  const days = item.daysOverdue ?? 0
                  const urgencyVariant: "destructive" | "secondary" | "outline" =
                    days > 14 ? "destructive" : "secondary"
                  const urgencyColor = days > 14 ? "border-destructive/60" : days > 7 ? "border-amber-400/60" : "border-border"
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`w-full rounded-lg border bg-background p-4 text-left transition hover:border-primary/40 hover:bg-primary/5 ${urgencyColor}`}
                      onClick={() => setSelectedOverdueItem(item)}
                    >
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
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOverdueModalOpen(false)
                setSelectedOverdueItem(null)
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AEFI Log Modal ───────────────────────────────────────────────── */}
      <Dialog
        open={aefiModalOpen}
        onOpenChange={(open) => {
          setAefiModalOpen(open)
          if (!open) setSelectedAefiItem(null)
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-primary" /> AEFI log
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedAefiItem
                ? "AEFI event details"
                : `${aefiFiltered.length} event${aefiFiltered.length !== 1 ? "s" : ""} found`}
            </p>
          </DialogHeader>

          {selectedAefiItem ? (
            <div className="space-y-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-1 gap-1.5"
                onClick={() => setSelectedAefiItem(null)}
              >
                <ChevronLeft className="h-4 w-4" /> Back to list
              </Button>
              <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-foreground">{selectedAefiItem.child}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{selectedAefiItem.detail}</p>
                  </div>
                  <Badge
                    variant={selectedAefiItem.status === "New" ? "destructive" : "outline"}
                    className="shrink-0"
                  >
                    {selectedAefiItem.status || "Unknown"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reported</p>
                    <p className="mt-1 text-sm text-foreground">{selectedAefiItem.timestamp}</p>
                  </div>
                </div>
                {selectedAefiItem.notes ? (
                  <div className="rounded-lg border border-border bg-background p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nurse note</p>
                    <p className="mt-1 text-sm text-foreground leading-relaxed">{selectedAefiItem.notes}</p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">From</Label>
                  <DatePicker
                    date={aefiFilterStart}
                    onDateChange={setAefiFilterStart}
                    placeholder="Start date"
                    className="w-40"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">To</Label>
                  <DatePicker
                    date={aefiFilterEnd}
                    onDateChange={setAefiFilterEnd}
                    placeholder="End date"
                    minDate={aefiFilterStart}
                    className="w-40"
                  />
                </div>
                {(aefiFilterStart || aefiFilterEnd) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setAefiFilterStart(undefined); setAefiFilterEnd(undefined) }}
                  >
                    Clear filters
                  </Button>
                ) : null}
              </div>

              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {aefiFiltered.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No AEFI events match the selected filters.</p>
                ) : aefiFiltered.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="w-full rounded-lg border border-border bg-background p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
                    onClick={() => handleOpenAefiDetail(event)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-foreground">{event.child}</p>
                      <Badge variant={event.status === "New" ? "destructive" : "outline"} className="shrink-0">
                        {event.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{event.detail}</p>
                    <p className="mt-2 text-xs text-muted-foreground/70">{event.timestamp}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAefiModalOpen(false)
                setSelectedAefiItem(null)
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CHW Sync Errors Modal ─────────────────────────────────────────── */}
      <Dialog
        open={syncModalOpen}
        onOpenChange={(open) => {
          setSyncModalOpen(open)
          if (!open) setSelectedSyncItem(null)
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" /> CHW sync errors
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedSyncItem
                ? "Sync error details"
                : `${syncFiltered.length} error${syncFiltered.length !== 1 ? "s" : ""} found`}
            </p>
          </DialogHeader>

          {selectedSyncItem ? (
            <div className="space-y-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-1 gap-1.5"
                onClick={() => setSelectedSyncItem(null)}
              >
                <ChevronLeft className="h-4 w-4" /> Back to list
              </Button>
              <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-5">
                <div>
                  <p className="text-lg font-semibold text-foreground">{selectedSyncItem.detail}</p>
                  {selectedSyncItem.child && selectedSyncItem.child !== 'N/A' ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">Reported by: {selectedSyncItem.child}</p>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                  {selectedSyncItem.status ? (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                      <Badge variant="outline" className="mt-1">{selectedSyncItem.status}</Badge>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reported</p>
                    <p className="mt-1 text-sm text-foreground">{selectedSyncItem.timestamp}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">From</Label>
                  <DatePicker
                    date={syncFilterStart}
                    onDateChange={setSyncFilterStart}
                    placeholder="Start date"
                    className="w-40"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">To</Label>
                  <DatePicker
                    date={syncFilterEnd}
                    onDateChange={setSyncFilterEnd}
                    placeholder="End date"
                    minDate={syncFilterStart}
                    className="w-40"
                  />
                </div>
                {(syncFilterStart || syncFilterEnd) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSyncFilterStart(undefined); setSyncFilterEnd(undefined) }}
                  >
                    Clear filters
                  </Button>
                ) : null}
              </div>

              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {syncFiltered.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No sync errors match the selected filters.</p>
                ) : syncFiltered.map((error) => (
                  <button
                    key={error.id}
                    type="button"
                    className="w-full rounded-lg border border-border bg-background p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
                    onClick={() => setSelectedSyncItem(error)}
                  >
                    <p className="text-sm font-semibold text-foreground">{error.detail}</p>
                    {error.child && error.child !== 'N/A' ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">Reported by: {error.child}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground/70">{error.timestamp}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSyncModalOpen(false)
                setSelectedSyncItem(null)
              }}
            >
              Close
            </Button>
          </DialogFooter>
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
