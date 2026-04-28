"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import DOMPurify from "dompurify"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  Activity,
  ArrowDownToLine,
  BellRing,
  Building2,
  Check,
  CheckCircle2,
  FileText,
  Gauge,
  Globe2,
  Layers,
  ListChecks,
  Loader2,
  MapPin,
  MapPinned,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  ServerCog,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  Users as UsersIcon,
} from "lucide-react"
import { ResponsiveContainer, RadialBarChart, RadialBar, Legend, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, ReferenceLine } from "recharts"

import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  createHqBranch,
  getHqBranches,
  updateHqBranch,
  updateHqBranchChws,
  updateHqBranchStatus,
  cleanupDuplicateChwAssignments,
} from "@/lib/api/hq-branches"
import {
  createHqUser,
  getHqUsers,
  resetHqUserPassword,
  updateHqUser,
  updateHqUserStatus,
} from "@/lib/api/hq-users"
import { getHqAnalytics, getHqOverviewStats, HqOverviewStats, getHqAefiReports, getHqDeviceSyncStatus } from "@/lib/api/hq-analytics"
import {
  getHqVaccines,
  createHqVaccine,
  updateHqVaccine,
  deleteHqVaccine,
  getHqSchedules,
  createHqSchedule,
  updateHqSchedule,
  deleteHqSchedule,
} from "@/lib/api/hq-vaccines"
import {
  getHqCatchmentAreas,
  createHqCatchmentArea,
  updateHqCatchmentArea,
  deleteHqCatchmentArea,
} from "@/lib/api/hq-catchment-areas"
import {
  configureBackup,
  getAuditActivity,
} from "@/lib/api/hq-system"
import {
  getNotificationDeliveryStatus,
  retryFailedNotification,
  getNotificationStats,
} from "@/lib/api/hq-notifications"
import {
  getCustomRoles,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
  getAvailablePermissions,
} from "@/lib/api/hq-roles"
import { getHqAuditLogs } from "@/lib/api/hq-audit-logs"
import { API_BASE_URL, getAuthHeaders } from "@/lib/api/config"

const SECTIONS = [
  { id: "overview", label: "National Dashboard", icon: Activity },
  { id: "branches", label: "Branch & Catchments", icon: Building2 },
  { id: "users", label: "User Management", icon: UsersIcon },
  { id: "vaccines", label: "Vaccine & Schedule", icon: Shield },
  { id: "analytics", label: "Analytics & Reports", icon: FileText },
  { id: "notifications", label: "Notifications", icon: Megaphone },
  { id: "system", label: "System Health", icon: ServerCog },
] as const

const HQ_REVIEW_QUEUE_STORAGE_KEY = "hqReviewQueue"
const HQ_NOTIFICATION_TEMPLATES_STORAGE_KEY = "hqNotificationTemplates"


type SectionId = (typeof SECTIONS)[number]["id"]

type Branch = {
  id: string
  name: string
  region: string
  manager: string
  catchmentAreas: string[]
  status: "active" | "inactive"
  assignedChws: string[]
}

type UserRecord = {
  id: string
  name: string
  email: string
  role: string
  branch?: string
  status: "active" | "inactive"
}

type VaccineConfig = {
  id: string
  name: string
  schedule: string
  dueDays: number
  status: "active" | "archived"
}

type NotificationTemplate = {
  id: string
  label: string
  description: string
  sms: string
  email: string
}

type PreviewChannel = "sms" | "email"


type CatchmentArea = {
  id: string
  name: string
  code: string
  branchId: string
  community?: string
  populationEstimate?: number
  assignedChwId?: string
}

type VaccineInventory = {
  vaccineId: string
  vaccineName: string
  batchNumber: string
  quantity: number
  expiryDate: string
  location: string
  status: "in-stock" | "low-stock" | "expired"
}

type NotificationDelivery = {
  id: string
  templateId: string
  recipient: string
  channel: "sms" | "email"
  status: "sent" | "failed" | "pending" | "read"
  sentAt?: string
  readAt?: string
}

type UserRole = {
  id: string
  name: string
  permissions: string[]
  description: string
}

type AuditLog = {
  id: string
  actor: string
  actorName?: string
  actorRole?: string
  action: string
  timestamp: string
  category: string
  entityType?: string
  ipAddress?: string
  userAgent?: string
}

type ReviewQueueItem = {
  conflictId: string
  queuedAt: string
  originator: string
  location: string
  payloadSummary: string
  reason: string
  linkedChildId: string | null
  followUp: string | null
  attachmentName: string | null
}

type BulkBranchOperation = {
  id: string
  name: string
  description: string
  operationType: "activate" | "deactivate" | "reassign-manager" | "add-chws"
}

type UserActivity = {
  id: string
  userId: string
  userName: string
  action: string
  resource: string
  timestamp: string
  ipAddress: string
  status: "success" | "failed"
}

type RolePermission = {
  id: string
  permission: string
  category: "users" | "branches" | "vaccines" | "analytics" | "system"
  description: string
}

type CustomRole = {
  id: string
  name: string
  description: string
  permissions: string[]
  createdAt: string
  isSystem: boolean
}

type VaccineStock = {
  id: string
  name: string
  batchNumber: string
  quantity: number
  reorderLevel: number
  expiryDate: string
  supplier: string
  totalUsed: number
  daysUntilExpiry: number
}

type NotificationDeliveryStatus = {
  id: string
  recipient: string
  channel: "sms" | "email" | "push"
  status: "sent" | "failed" | "pending" | "read"
  sentAt: string
  failureReason?: string
  messageType: "reminder" | "alert" | "confirmation"
}

type QuickAction = {
  id: string
  title: string
  description: string
  icon: string
  action: () => void
  color: "primary" | "emerald" | "amber" | "red"
}

type SystemAlert = {
  id: string
  type: "info" | "warning" | "error" | "success"
  title: string
  message: string
  timestamp: string
  dismissed: boolean
}

// Branches loaded from API via getHqBranches()
const initialBranches: Branch[] = []

// Users loaded from API via getHqUsers()
const initialUsers: UserRecord[] = []

// Vaccines loaded from API via getHqVaccines()
const initialVaccines: VaccineConfig[] = []

// Notification templates loaded from localStorage with fallback to empty array
const initialTemplates: NotificationTemplate[] = []

// Audit logs are loaded from API in useEffect
const initialAuditLogs: AuditLog[] = []

// Coverage gauge data is computed from overview stats API response
const coverageGaugeData: Array<{ name: string; value: number; fill: string }> = []

// Coverage trend and CHW productivity data are loaded from API
const coverageTrendData: Array<{ period: string; measles: number; dpt3: number }> = []
const chwProductivityData: Array<{ label: string; registrations: number; visits: number }> = []

// AEFI Feed is loaded from API via getHqAefiReports()
const aefiFeed: any[] = []

// Device sync data is loaded from API via getHqDeviceSyncStatus()
const pendingSyncDevices: any[] = []

const normalizeCommaSeparatedValues = (value: string): string[] => {
  const deduplicated = new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  )

  return Array.from(deduplicated)
}

const mapUserRoleToApiRole = (role: string): string => {
  const roleMap: Record<string, string> = {
    "HQ Admin": "hq-admin",
    "Branch Manager": "branch-manager",
    "Facility Nurse": "facility-nurse",
    "Community Health Worker": "chw",
    "Parent": "parent",
  }

  return roleMap[role] ?? role
}

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  return "Unexpected error"
}

const extractErrorCode = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null
  const maybeCode = (error as { code?: unknown }).code
  return typeof maybeCode === "string" ? maybeCode : null
}

const mapUserManagementError = (error: unknown): { tone: "warning" | "destructive"; title: string; detail: string } => {
  const code = extractErrorCode(error)
  const message = extractErrorMessage(error)
  const normalized = message.toLowerCase()

  if (code === "EMAIL_EXISTS") {
    return {
      tone: "destructive",
      title: "Email already exists",
      detail: "A user with this email already exists. Use another email or edit the existing user.",
    }
  }

  if (code === "BRANCH_NOT_FOUND") {
    return {
      tone: "warning",
      title: "Branch not found",
      detail: "Enter a valid branch code/name or leave branch empty for HQ users.",
    }
  }

  if (code === "HQ_ADMIN_ROLE_FORBIDDEN") {
    return {
      tone: "warning",
      title: "Role restricted",
      detail: "HQ Admin cannot create or assign another HQ Admin from this console.",
    }
  }

  if (code === "USER_NOT_FOUND") {
    return {
      tone: "warning",
      title: "User not found",
      detail: "Refresh user list and try again.",
    }
  }

  if (code === "SESSION_EXPIRED") {
    return {
      tone: "warning",
      title: "Session expired",
      detail: "Please login again to continue.",
    }
  }

  if (normalized.includes("already exists")) {
    return {
      tone: "destructive",
      title: "Email already exists",
      detail: "A user with this email already exists. Use another email or edit the existing user.",
    }
  }

  if (normalized.includes("branch") && normalized.includes("not found")) {
    return {
      tone: "warning",
      title: "Branch not found",
      detail: "Enter a valid branch code/name or leave branch empty for HQ users.",
    }
  }

  if (normalized.includes("not found")) {
    return {
      tone: "warning",
      title: "User not found",
      detail: "Refresh user list and try again.",
    }
  }

  return {
    tone: "destructive",
    title: "Action failed",
    detail: message,
  }
}

const previewTemplateValues: Record<string, string> = {
  guardianName: "Ama Boateng",
  childName: "Kojo Boateng",
  vaccineName: "Penta-3",
  scheduledDate: "2026-03-22",
  facilityName: "Korle Bu Teaching Hospital",
}

const sanitizeHtml = (html: string): string =>
  DOMPurify.sanitize(html)
    .replace(/javascript\s*:/gi, "")

const compileTemplatePreview = (templateContent: string) =>
  templateContent.replace(/\{([a-zA-Z0-9_]+)\}/g, (_fullMatch, token: string) => {
    const replacement = previewTemplateValues[token]
    return replacement ?? `{${token}}`
  })

export default function HqDashboardPage() {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<SectionId>("overview")
  const [userName, setUserName] = useState("")

  const [branches, setBranches] = useState(initialBranches)
  const [branchForm, setBranchForm] = useState({
    name: "",
    region: "",
    manager: "",
    catchmentAreas: "",
  })
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null)

  const [users, setUsers] = useState(initialUsers)
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    role: "Branch Manager",
    branch: "",
  })
  const [editingUserId, setEditingUserId] = useState<string | null>(null)

  const [vaccines, setVaccines] = useState(initialVaccines)
  const [vaccineForm, setVaccineForm] = useState({
    name: "",
    schedule: "",
    dueDays: "",
  })
  const [editingVaccineId, setEditingVaccineId] = useState<string | null>(null)
  const [analyticsFilters, setAnalyticsFilters] = useState({
    region: "All regions",
    branch: "All branches",
    window: "Last 6 months",
  })
  const [analyticsTrendData, setAnalyticsTrendData] = useState(coverageTrendData)
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false)
  const [isUsingAnalyticsFallback, setIsUsingAnalyticsFallback] = useState(false)
  const [isUsingUsersFallback, setIsUsingUsersFallback] = useState(false)
  const [overviewStats, setOverviewStats] = useState<HqOverviewStats | null>(null)
  const [isOverviewLoading, setIsOverviewLoading] = useState(true)
  const [aefiReports, setAefiReports] = useState(aefiFeed)
  const [isAefiLoading, setIsAefiLoading] = useState(false)
  const [deviceSyncStatus, setDeviceSyncStatus] = useState(pendingSyncDevices)
  const [isDeviceSyncLoading, setIsDeviceSyncLoading] = useState(false)

  const [templates, setTemplates] = useState(initialTemplates)
  const [activeTemplateId, setActiveTemplateId] = useState(initialTemplates[0]?.id ?? "")
  const [previewChannel, setPreviewChannel] = useState<PreviewChannel>("sms")
  const [templatePreview, setTemplatePreview] = useState<string>("")
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [isVaccineEditModalOpen, setIsVaccineEditModalOpen] = useState(false)
  const [editingVaccine, setEditingVaccine] = useState<VaccineConfig | null>(null)
  const [vaccineEditForm, setVaccineEditForm] = useState({ schedule: "", dueDays: "" })
  const [isVaccinesLoading, setIsVaccinesLoading] = useState(true)
  const [isVaccineSaving, setIsVaccineSaving] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isVaccineDeleting, setIsVaccineDeleting] = useState(false)
  const [vaccineToDelete, setVaccineToDelete] = useState<VaccineConfig | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [archivingVaccineId, setArchivingVaccineId] = useState<string | null>(null)

  const [auditLogs, setAuditLogs] = useState(initialAuditLogs)
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [activeChwBranchId, setActiveChwBranchId] = useState<string | null>(null)
  const [chwSelectedIds, setChwSelectedIds] = useState<Set<string>>(new Set())
  const [chwSearchFilter, setChwSearchFilter] = useState("")
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([])
  const [userResetStatusById, setUserResetStatusById] = useState<
    Record<string, { status: "sent" | "failed"; detail: string; time: string }>
  >({})
  const [, setUserActionNotice] = useState<
    { tone: "success" | "warning" | "destructive"; title: string; detail: string } | null
  >(null)

  // FEATURE 1: Catchment Area Management
  const [catchmentAreas, setCatchmentAreas] = useState<CatchmentArea[]>([])
  const [selectedBranchForCatchment, setSelectedBranchForCatchment] = useState<string | null>(null)
  const [isEditingCatchment, setIsEditingCatchment] = useState(false)
  const [editingCatchmentId, setEditingCatchmentId] = useState<string | null>(null)
  const [catchmentForm, setCatchmentForm] = useState({ name: "", community: "", populationEstimate: "" })

  // FEATURE 3: Bulk User CSV Import
  const [csvImportFile, setCsvImportFile] = useState<File | null>(null)
  const [isImportingCsv, setIsImportingCsv] = useState(false)
  const [csvImportResult, setCsvImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null)

  // FEATURE 4: Branch Bulk Operations
  const [bulkBranchFile, setBulkBranchFile] = useState<File | null>(null)
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)
  const [bulkOperationResult, setBulkOperationResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null)
  const [selectedBulkOperation, setSelectedBulkOperation] = useState<string>("activate")

  // FEATURE 6: Backup Management Config
  const [backupSchedule, setBackupSchedule] = useState<"daily" | "weekly" | "monthly">("weekly")
  const [retentionDays, setRetentionDays] = useState(90)
  const [isSchedulingBackup, setIsSchedulingBackup] = useState(false)

  // FEATURE 7: User Roles & Permissions
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([])
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [roleForm, setRoleForm] = useState({ name: "", description: "", permissions: [] as string[] })
  const [isEditingRole, setIsEditingRole] = useState(false)
  const [allPermissions, setAllPermissions] = useState<RolePermission[]>([])

  // FEATURE 8: User Activity Tracker
  const [userActivities, setUserActivities] = useState<UserActivity[]>([])
  const [isActivityLoading, setIsActivityLoading] = useState(false)
  const [selectedUserForActivity, setSelectedUserForActivity] = useState<string | null>(null)

  // FEATURE 9: Vaccine Inventory
  const [vaccineInventory, setVaccineInventory] = useState<VaccineStock[]>([])
  const [isInventoryLoading, setIsInventoryLoading] = useState(false)
  const [vaccineReorderForm, setVaccineReorderForm] = useState({ reorderLevel: 0, supplier: "" })

  // FEATURE 10: Notifications Delivery Status
  const [notificationDeliveries, setNotificationDeliveries] = useState<NotificationDeliveryStatus[]>([])
  const [isNotifLoading, setIsNotifLoading] = useState(false)
  const [notifStatusFilter, setNotifStatusFilter] = useState<"all" | "sent" | "failed" | "pending">("all")

  // FEATURE 11: Advanced Analytics
  const [advancedCharts, setAdvancedCharts] = useState<Array<{ id: string; title: string; type: string; data: unknown[] }>>([])
  const [selectedChartType, setSelectedChartType] = useState<string>("cohort")

  // FEATURE 12: Quick Actions & Alerts
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([])
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set<string>())

  const branchEditPanelRef = useRef<HTMLDivElement | null>(null)
  const userFormPanelRef = useRef<HTMLDivElement | null>(null)
  const vaccineFormPanelRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const appendAuditLog = useCallback(
    ({ action, category }: { action: string; category: string }) => {
      setAuditLogs((previous) => [
        {
          id: `LOG-${Math.floor(Math.random() * 9000 + 1000)}`,
          actor: userName || "HQ Admin",
          action,
          timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
          category,
        },
        ...previous,
      ])
    },
    [userName],
  )

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HQ_NOTIFICATION_TEMPLATES_STORAGE_KEY)
      if (!stored) return

      const parsed = JSON.parse(stored) as NotificationTemplate[]
      if (!Array.isArray(parsed) || !parsed.length) return

      const hasValidShape = parsed.every((template) =>
        template
        && typeof template.id === "string"
        && typeof template.label === "string"
        && typeof template.description === "string"
        && typeof template.sms === "string"
        && typeof template.email === "string",
      )

      if (!hasValidShape) return

      setTemplates(parsed)
      setActiveTemplateId((previous) => {
        if (parsed.some((template) => template.id === previous)) return previous
        return parsed[0]?.id ?? ""
      })
    } catch (error) {
      console.error("Failed to load notification templates from local storage", error)
    }
  }, [])

  useEffect(() => {
    const selectedTemplate = templates.find((template) => template.id === activeTemplateId)
    if (!selectedTemplate) {
      setTemplatePreview("")
      return
    }

    const source = previewChannel === "sms" ? selectedTemplate.sms : selectedTemplate.email
    setTemplatePreview(compileTemplatePreview(source))
  }, [activeTemplateId, previewChannel, templates])

  useEffect(() => {
    const token = localStorage.getItem("accessToken") || localStorage.getItem("authToken")
    const role = localStorage.getItem("userRole")
    const detail = localStorage.getItem("userRoleDetail")
    const name = sessionStorage.getItem("userName") || localStorage.getItem("userName")

    if (!token) {
      router.push("/auth/login")
      return
    }

    if (role !== "staff") {
      router.push("/parent/dashboard")
      return
    }

    if (detail !== "hq-admin") {
      router.push("/dashboard")
      return
    }

    setUserName(name || "Admin")
  }, [router])

  // Fetch overview stats for the National Dashboard
  useEffect(() => {
    let isMounted = true

    const loadOverviewStats = async () => {
      setIsOverviewLoading(true)
      try {
        const stats = await getHqOverviewStats()
        if (!isMounted) return
        setOverviewStats(stats)
      } catch (error) {
        console.error("Failed to load HQ overview stats", error)
        if (!isMounted) return
        // Keep overviewStats null to indicate failure
      } finally {
        if (isMounted) {
          setIsOverviewLoading(false)
        }
      }
    }

    loadOverviewStats()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadBranches = async () => {
      try {
        const remoteBranches = await getHqBranches()
        if (!isMounted) return
        if (remoteBranches.length > 0) {
          setBranches(remoteBranches)
        }
      } catch (error) {
        console.error("Failed to load HQ branches from backend", error)
        if (!isMounted) return
        setSystemMessage("Using local fallback data while branch API is unavailable.")
      }
    }

    loadBranches()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadHqAnalytics = async () => {
      if (!isMounted) return
      setIsAnalyticsLoading(true)

      try {
        const response = await getHqAnalytics({
          region: analyticsFilters.region,
          branch: analyticsFilters.branch,
          window: analyticsFilters.window,
        })

        if (!isMounted) return
        setAnalyticsTrendData(response.trend)
        setIsUsingAnalyticsFallback(false)
      } catch (error) {
        console.error("Failed to load HQ analytics data", error)
        if (!isMounted) return
        setAnalyticsTrendData(coverageTrendData)
        setIsUsingAnalyticsFallback(true)
      } finally {
        if (isMounted) {
          setIsAnalyticsLoading(false)
        }
      }
    }

    loadHqAnalytics()
    return () => {
      isMounted = false
    }
  }, [analyticsFilters.branch, analyticsFilters.region, analyticsFilters.window])

  useEffect(() => {
    let isMounted = true

    const loadUsers = async () => {
      try {
        const remoteUsers = await getHqUsers()
        if (!isMounted) return
        if (remoteUsers.length > 0) {
          setUsers(remoteUsers)
        }
        setIsUsingUsersFallback(false)
      } catch (error) {
        console.error("Failed to load HQ users from backend", error)
        if (!isMounted) return

        const errorCode = extractErrorCode(error)
        const errorMessage = extractErrorMessage(error).toLowerCase()
        if (errorCode === "SESSION_EXPIRED" || errorMessage.includes("session expired") || errorMessage.includes("unauthorized")) {
          return
        }

        setIsUsingUsersFallback(true)
      }
    }

    loadUsers()
    return () => {
      isMounted = false
    }
  }, [])

  // Pull escalations staged by data officers via localStorage until the backend wiring is ready
  const ingestQueuedConflicts = useCallback(() => {
    const rawQueue = localStorage.getItem(HQ_REVIEW_QUEUE_STORAGE_KEY)
    if (!rawQueue) return

    try {
      const parsed = JSON.parse(rawQueue) as
        | Array<{
            conflict: { id: string; originator: string; location: string; payloadSummary: string }
            payload: { reason: string; linkedChildId?: string | null; followUp?: string | null; attachmentName?: string | null }
            queuedAt: string
          }>
        | {
            conflict: { id: string; originator: string; location: string; payloadSummary: string }
            payload: { reason: string; linkedChildId?: string | null; followUp?: string | null; attachmentName?: string | null }
            queuedAt: string
          }

      const queueItems = Array.isArray(parsed) ? parsed : [parsed]

      if (queueItems.length) {
        setReviewQueue((previous) => {
          const existingIds = new Set(previous.map((item) => item.conflictId))
          const newItems: ReviewQueueItem[] = queueItems
            .filter((item) => item?.conflict?.id && !existingIds.has(item.conflict.id))
            .map((item) => ({
              conflictId: item.conflict.id,
              queuedAt: item.queuedAt,
              originator: item.conflict.originator,
              location: item.conflict.location,
              payloadSummary: item.conflict.payloadSummary,
              reason: item.payload.reason,
              linkedChildId: item.payload.linkedChildId ?? null,
              followUp: item.payload.followUp ?? null,
              attachmentName: item.payload.attachmentName ?? null,
            }))

          if (!newItems.length) return previous
          return [...newItems, ...previous]
        })
      }
    } catch (error) {
      console.error("Failed to ingest HQ review queue payload", error)
    } finally {
      localStorage.removeItem(HQ_REVIEW_QUEUE_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    ingestQueuedConflicts()

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== HQ_REVIEW_QUEUE_STORAGE_KEY) return
      ingestQueuedConflicts()
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [ingestQueuedConflicts])

  useEffect(() => {
    if (!systemMessage) return
    const timeout = window.setTimeout(() => setSystemMessage(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [systemMessage])

  // Load vaccines on mount
  useEffect(() => {
    let isMounted = true

    const loadVaccines = async () => {
      setIsVaccinesLoading(true)
      try {
        const remoteVaccines = await getHqVaccines()
        if (!isMounted) return
        if (remoteVaccines && remoteVaccines.length > 0) {
          setVaccines(remoteVaccines as any)
        }
      } catch (error) {
        console.error("Failed to load HQ vaccines from backend", error)
        if (!isMounted) return
        setSystemMessage("Using local fallback data for vaccines while API is unavailable.")
      } finally {
        if (isMounted) {
          setIsVaccinesLoading(false)
        }
      }
    }

    loadVaccines()
    return () => {
      isMounted = false
    }
  }, [])

  // Load AEFI reports for overview
  useEffect(() => {
    let isMounted = true

    const loadAefiReports = async () => {
      try {
        setIsAefiLoading(true)
        const reports = await getHqAefiReports(5) // Get top 5 AEFI reports
        if (!isMounted) return
        
        // AEFI data comes directly from backend with correct field names
        setAefiReports(reports)
      } catch (error) {
        console.error("Failed to load AEFI reports", error)
        if (!isMounted) return
        // Keep using sample data as fallback
      } finally {
        if (isMounted) {
          setIsAefiLoading(false)
        }
      }
    }

    loadAefiReports()
    return () => {
      isMounted = false
    }
  }, [])

  // Load device sync status for overview
  useEffect(() => {
    let isMounted = true

    const loadDeviceSyncStatus = async () => {
      try {
        setIsDeviceSyncLoading(true)
        const devices = await getHqDeviceSyncStatus()
        if (!isMounted) return
        
        // Device sync data comes directly from backend with correct field names
        setDeviceSyncStatus(devices)
      } catch (error) {
        console.error("Failed to load device sync status", error)
        if (!isMounted) return
        // Keep using sample data as fallback
      } finally {
        if (isMounted) {
          setIsDeviceSyncLoading(false)
        }
      }
    }

    loadDeviceSyncStatus()
    return () => {
      isMounted = false
    }
  }, [])

  // Load system settings and audit logs on mount
  useEffect(() => {
    let isMounted = true

    const loadSystemData = async () => {
      try {
        const auditLogsData = await getHqAuditLogs({ limit: 50 })

        if (!isMounted) return

        const auditLogItems = auditLogsData?.data ?? []
        if (Array.isArray(auditLogItems) && auditLogItems.length > 0) {
          const transformedLogs = auditLogItems.map((log: any) => ({
            id: log.id,
            actor: log.user_id ?? log.userId ?? "",
            action: log.action,
            category: log.category,
            entityType: log.entity_type ?? log.entityType ?? undefined,
            ipAddress: log.ip_address ?? log.ipAddress ?? undefined,
            userAgent: log.user_agent ?? log.userAgent ?? undefined,
            timestamp: new Date(log.created_at ?? log.timestamp).toISOString().slice(0, 16).replace("T", " "),
          }))
          setAuditLogs(transformedLogs as any)
        }
      } catch (error) {
        console.error("Failed to load system data from backend", error)
        if (!isMounted) return
        setSystemMessage("Using local fallback data for audit logs while API is unavailable.")
      }
    }

    loadSystemData()
    return () => {
      isMounted = false
    }
  }, [])

  // FEATURE 1: Load catchment areas on mount
  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const areas = await getHqCatchmentAreas()
        if (isMounted) setCatchmentAreas(areas)
      } catch (error) {
        console.error("Failed to load catchment areas", error)
      }
    })()
    return () => { isMounted = false }
  }, [])

  // TIER 2: Load data on mount
  useEffect(() => {
    loadUserActivity()
    loadVaccineInventory()
    loadNotificationDeliveries()
    loadAdvancedAnalytics()
    initializeSystemAlerts()
    
    // Load permissions from API
    ;(async () => {
      try {
        const permissions = await getAvailablePermissions()
        setAllPermissions(permissions)
      } catch (error) {
        console.error("Failed to load permissions", error)
      }
    })()
  }, [])

  const activeTemplate = useMemo(() => templates.find((template) => template.id === activeTemplateId) ?? null, [activeTemplateId, templates])
  const messageTone = useMemo(() => {
    if (!systemMessage) return "neutral"
    const normalized = systemMessage.toLowerCase()
    if (normalized.includes("could not") || normalized.includes("failed") || normalized.includes("error")) {
      return "error"
    }
    if (normalized.includes("fallback") || normalized.includes("saved locally")) {
      return "warning"
    }
    return "success"
  }, [systemMessage])

  const activeChwBranch = useMemo(() => {
    if (!activeChwBranchId) return null
    return branches.find((branch) => branch.id === activeChwBranchId) ?? null
  }, [activeChwBranchId, branches])

  // Map each CHW name to branches they're assigned to
  const chwBranchAssignments = useMemo(() => {
    const assignments = new Map<string, string[]>()
    branches.forEach((branch) => {
      branch.assignedChws.forEach((chwName) => {
        const existing = assignments.get(chwName) ?? []
        assignments.set(chwName, [...existing, branch.name])
      })
    })
    return assignments
  }, [branches])

  // Map user IDs to names for audit logs
  const userNameMap = useMemo(() => {
    const map = new Map<string, string>()
    users.forEach((user) => {
      map.set(user.id, user.name)
    })
    return map
  }, [users])

  const userRoleMap = useMemo(() => {
    const map = new Map<string, string>()
    users.forEach((user) => {
      map.set(user.id, user.role)
    })
    return map
  }, [users])

  // Enrich audit logs with user names
  const enrichedAuditLogs = useMemo(() => {
    return auditLogs.map((log) => ({
      ...log,
      actorName: userNameMap.get(log.actor) ?? log.actor,
      actorRole: userRoleMap.get(log.actor),
    }))
  }, [auditLogs, userNameMap, userRoleMap])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      // Add a small delay to show the spinner
      await new Promise(resolve => setTimeout(resolve, 1000))

      localStorage.removeItem("accessToken")
      localStorage.removeItem("authToken")
      localStorage.removeItem("userRole")
      localStorage.removeItem("userRoleDetail")
      localStorage.removeItem("userName")
      sessionStorage.removeItem("userName")
      router.push("/")
    } finally {
      // Note: setIsLoggingOut(false) not needed since we're navigating away
    }
  }

  const handleCleanupDuplicateChws = async () => {
    try {
      const result = await cleanupDuplicateChwAssignments()
      setSystemMessage(`✓ ${result.message}`)
      appendAuditLog({ action: `Cleaned up ${result.cleaned} duplicate CHW assignments`, category: "Branch" })

      // Refetch branches to reflect changes
      const updatedBranches = await getHqBranches()
      if (updatedBranches.length > 0) {
        setBranches(updatedBranches)
      }
    } catch (error) {
      console.error("Failed to cleanup duplicate CHWs", error)
      setSystemMessage("No duplicate CHW assignments found or cleanup failed.")
    }
  }

  const startEditingBranch = (branch: Branch) => {
    cancelChwAssignment()
    setEditingBranchId(branch.id)
    setBranchForm({
      name: branch.name,
      region: branch.region,
      manager: branch.manager,
      catchmentAreas: branch.catchmentAreas.join(", "),
    })

    window.setTimeout(() => {
      branchEditPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 80)
  }

  const cancelBranchEditing = () => {
    setEditingBranchId(null)
    setBranchForm({ name: "", region: "", manager: "", catchmentAreas: "" })
  }

  const toggleBranchStatus = async (branchId: string) => {
    const branch = branches.find((item) => item.id === branchId)
    if (!branch) return

    const nextStatus: Branch["status"] = branch.status === "active" ? "inactive" : "active"

    try {
      const updatedBranch = await updateHqBranchStatus(branch.id, nextStatus)
      setBranches((previous) => previous.map((item) => (item.id === updatedBranch.id ? updatedBranch : item)))

      setSystemMessage(`Branch "${updatedBranch.name}" ${nextStatus === "active" ? "re-activated" : "deactivated"}.`)
      appendAuditLog({
        action: `${nextStatus === "active" ? "Reactivated" : "Deactivated"} branch ${updatedBranch.name}`,
        category: "Branch",
      })
    } catch (error) {
      console.error("Failed to update branch status", error)
      setSystemMessage("Could not update branch status. Please try again.")
    }

    cancelBranchEditing()
    cancelChwAssignment()
  }

  const startChwAssignment = (branch: Branch) => {
    cancelBranchEditing()
    setActiveChwBranchId(branch.id)
    setChwSelectedIds(new Set(branch.assignedChws.map(name => {
      const user = users.find(u => u.name === name)
      return user?.id ?? name
    })))
    setChwSearchFilter("")
    setSystemMessage(`Managing CHW assignment for ${branch.name}.`)
  }

  const cancelChwAssignment = () => {
    setActiveChwBranchId(null)
    setChwSelectedIds(new Set())
    setChwSearchFilter("")
  }

  const handleChwAssignmentSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeChwBranchId) return

    const selectedChwNames = Array.from(chwSelectedIds).map(id => {
      const user = users.find(u => u.id === id)
      return user?.name ?? id
    })
    const targetBranch = branches.find((branch) => branch.id === activeChwBranchId)

    try {
      const updatedBranch = await updateHqBranchChws(activeChwBranchId, selectedChwNames)
      setBranches((previous) => previous.map((branch) => (branch.id === updatedBranch.id ? updatedBranch : branch)))
      setSystemMessage(`Assigned ${selectedChwNames.length} CHW${selectedChwNames.length === 1 ? "" : "s"} to ${updatedBranch.name}.`)
      appendAuditLog({ action: `Updated CHW assignment for ${updatedBranch.name}`, category: "Branch" })
    } catch (error) {
      console.error("Failed to update CHW assignment", error)

      if (targetBranch) {
        setBranches((previous) =>
          previous.map((branch) =>
            branch.id === targetBranch.id
              ? { ...branch, assignedChws: selectedChwNames }
              : branch,
          ),
        )

        setSystemMessage(
          `Assigned ${selectedChwNames.length} CHW${selectedChwNames.length === 1 ? "" : "s"} to ${targetBranch.name} (saved locally).`,
        )
        appendAuditLog({ action: `Updated CHW assignment for ${targetBranch.name} (local fallback)`, category: "Branch" })
      } else {
        setSystemMessage("Could not save CHW assignments. Please try again.")
      }
    }

    cancelChwAssignment()
  }

  const handleBranchSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!branchForm.name.trim() || !branchForm.region.trim()) return

    const normalizedCatchments = normalizeCommaSeparatedValues(branchForm.catchmentAreas)

    if (!normalizedCatchments.length) {
      setSystemMessage("Please provide at least one catchment area.")
      return
    }

    try {
      if (editingBranchId) {
        const updatedBranch = await updateHqBranch(editingBranchId, {
          name: branchForm.name.trim(),
          region: branchForm.region.trim(),
          manager: branchForm.manager.trim() || "Unassigned",
          catchmentAreas: normalizedCatchments,
        })

        setBranches((previous) =>
          previous.map((branch) => (branch.id === updatedBranch.id ? updatedBranch : branch)),
        )
        setSystemMessage(`Branch "${updatedBranch.name}" updated.`)
        appendAuditLog({ action: `Updated branch ${updatedBranch.name}`, category: "Branch" })
      } else {
        const createdBranch = await createHqBranch({
          name: branchForm.name.trim(),
          region: branchForm.region.trim(),
          manager: branchForm.manager.trim() || "Unassigned",
          catchmentAreas: normalizedCatchments,
        })

        setBranches((previous) => [createdBranch, ...previous])
        setSystemMessage(`Branch "${createdBranch.name}" registered.`)
        appendAuditLog({ action: `Registered branch ${createdBranch.name}`, category: "Branch" })

        // Refetch branches after creation to ensure UI is in sync with database
        try {
          const updatedBranches = await getHqBranches()
          if (updatedBranches.length > 0) {
            setBranches(updatedBranches)
          }
        } catch {
          // Branch already added to state, refetch failure is non-critical
        }
      }
    } catch (error) {
      console.error("Failed to save branch", error)
      setSystemMessage("Could not save branch details. Please try again.")
      return
    }

    setBranchForm({ name: "", region: "", manager: "", catchmentAreas: "" })
    setEditingBranchId(null)
  }

  // ===== FEATURE 1: CATCHMENT AREA HANDLERS =====
  const handleSaveCatchment = async () => {
    if (!selectedBranchForCatchment || !catchmentForm.name.trim()) {
      setSystemMessage("Please fill in all required fields.")
      return
    }
    try {
      const payload = {
        name: catchmentForm.name.trim(),
        community: catchmentForm.community.trim() || catchmentForm.name.trim(),
        populationEstimate: catchmentForm.populationEstimate ? parseInt(catchmentForm.populationEstimate) : undefined,
        branchId: selectedBranchForCatchment,
      }
      if (isEditingCatchment && editingCatchmentId) {
        await updateHqCatchmentArea(editingCatchmentId, payload)
        setSystemMessage(`✓ Catchment area updated.`)
      } else {
        await createHqCatchmentArea(payload)
        setSystemMessage(`✓ Catchment area created.`)
      }
      const areas = await getHqCatchmentAreas()
      setCatchmentAreas(areas)
      setCatchmentForm({ name: "", community: "", populationEstimate: "" })
      setIsEditingCatchment(false)
      setEditingCatchmentId(null)
      appendAuditLog({ action: `${isEditingCatchment ? "Updated" : "Created"} catchment area`, category: "Branch" })
    } catch (error) {
      console.error("Failed to save catchment area", error)
      setSystemMessage("Could not save catchment area.")
    }
  }

  const handleDeleteCatchment = async (areaId: string) => {
    if (!confirm("Delete this catchment area?")) return
    try {
      await deleteHqCatchmentArea(areaId)
      const areas = await getHqCatchmentAreas()
      setCatchmentAreas(areas)
      setSystemMessage("✓ Catchment area deleted.")
      appendAuditLog({ action: `Deleted catchment area`, category: "Branch" })
    } catch (error) {
      console.error("Failed to delete catchment area", error)
      setSystemMessage("Could not delete catchment area.")
    }
  }

  // ===== TIER 2 HANDLERS =====

  // FEATURE 4: Branch Bulk Operations
  const handleBulkBranchOperation = async () => {
    if (!bulkBranchFile) {
      setSystemMessage("Please select a CSV file.")
      return
    }
    setIsBulkProcessing(true)
    try {
      const text = await bulkBranchFile.text()
      const lines = text.split("\n").filter(l => l.trim())
      let success = 0, failed = 0
      const errors: string[] = []

      for (const line of lines.slice(1)) {
        try {
          const [branchId, operation] = line.split(",").map(v => v.trim())
          if (!branchId || !operation) continue
          
          const branch = branches.find(b => b.id === branchId)
          if (!branch) {
            failed++
            errors.push(`Branch ${branchId} not found`)
            continue
          }

          if (operation === "activate" || operation === "deactivate") {
            await updateHqBranchStatus(branchId, operation === "activate" ? "active" : "inactive")
          }
          success++
        } catch (error) {
          failed++
          errors.push(`Operation failed: ${error}`)
        }
      }

      setBulkOperationResult({ success, failed, errors: errors.slice(0, 5) })
      setSystemMessage(`✓ Bulk operation complete: ${success} succeeded, ${failed} failed.`)
      appendAuditLog({ action: `Bulk operated on ${success} branches`, category: "Branch" })
      setBulkBranchFile(null)
    } catch (error) {
      console.error("Bulk operation failed", error)
      setSystemMessage("Bulk operation failed.")
    } finally {
      setIsBulkProcessing(false)
    }
  }

  const handleExportBranches = () => {
    const csv = [
      ["ID", "Name", "Region", "Manager", "CHWs", "Status"],
      ...branches.map(b => [b.id, b.name, b.region, b.manager, b.assignedChws.length, b.status])
    ].map(row => row.join(",")).join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `branches-export-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    setSystemMessage("✓ Branches exported successfully.")
  }

  // FEATURE 6: Backup Management Config
  const configureBackupSchedule = async () => {
    setIsSchedulingBackup(true)
    try {
      await configureBackup({ frequency: backupSchedule, retentionDays })
      setSystemMessage(`✓ Backup schedule set to ${backupSchedule} with ${retentionDays} day retention.`)
      appendAuditLog({ action: `Configured backup: ${backupSchedule}, retention: ${retentionDays}d`, category: "System" })
    } catch (error) {
      console.error("Failed to configure backup", error)
      setSystemMessage("Failed to configure backup schedule.")
    } finally {
      setIsSchedulingBackup(false)
    }
  }

  // FEATURE 7: User Roles & Permissions
  const handleSaveCustomRole = async () => {
    if (!roleForm.name.trim()) {
      setSystemMessage("Role name is required.")
      return
    }
    try {
      if (editingRoleId) {
        await updateCustomRole(editingRoleId, { name: roleForm.name, description: roleForm.description, permissions: roleForm.permissions })
        const updatedRole = { ...roleForm, id: editingRoleId, createdAt: customRoles.find(r => r.id === editingRoleId)?.createdAt || new Date().toISOString(), isSystem: false }
        setCustomRoles(prev => prev.map(r => r.id === editingRoleId ? updatedRole : r))
        setSystemMessage(`✓ Role "${roleForm.name}" updated.`)
      } else {
        const result = await createCustomRole({ name: roleForm.name, description: roleForm.description, permissions: roleForm.permissions })
        const newRole = { ...roleForm, id: result.roleId, createdAt: new Date().toISOString(), isSystem: false }
        setCustomRoles(prev => [newRole, ...prev])
        setSystemMessage(`✓ Role "${roleForm.name}" created.`)
      }
      appendAuditLog({ action: `${editingRoleId ? "Updated" : "Created"} role ${roleForm.name}`, category: "System" })
      setIsEditingRole(false)
      setEditingRoleId(null)
      setRoleForm({ name: "", description: "", permissions: [] })
    } catch (error) {
      console.error("Failed to save role", error)
      setSystemMessage("Failed to save role.")
    }
  }

  const handleDeleteRole = async (roleId: string) => {
    try {
      await deleteCustomRole(roleId)
      setCustomRoles(prev => prev.filter(r => r.id !== roleId))
      setSystemMessage("✓ Role deleted.")
      appendAuditLog({ action: `Deleted role`, category: "System" })
    } catch (error) {
      console.error("Failed to delete role", error)
      setSystemMessage("Failed to delete role.")
    }
  }

  // FEATURE 8: User Activity Tracker
  const loadUserActivity = async () => {
    setIsActivityLoading(true)
    try {
      const activities = await getAuditActivity()
      setUserActivities(activities)
    } catch (error) {
      console.error("Failed to load activities", error)
    } finally {
      setIsActivityLoading(false)
    }
  }

  // FEATURE 9: Vaccine Inventory
  const loadVaccineInventory = async () => {
    setIsInventoryLoading(true)
    try {
      const vaccines = await getHqVaccines()
      const stocks: VaccineStock[] = (vaccines || []).map(v => ({
        id: v.id,
        name: v.name,
        batchNumber: v.batchNumber || `${v.code}-2025-001`,
        quantity: v.quantity || 0,
        reorderLevel: v.reorderLevel || 150,
        expiryDate: v.expiryDate || "2026-12-31",
        supplier: v.supplier || "WHO",
        totalUsed: v.totalUsed || 0,
        daysUntilExpiry: v.daysUntilExpiry || 0,
      }))
      setVaccineInventory(stocks)
    } catch (error) {
      console.error("Failed to load inventory", error)
    } finally {
      setIsInventoryLoading(false)
    }
  }

  const updateVaccineStock = async (vaccineId: string) => {
    try {
      setVaccineInventory(prev => prev.map(v => 
        v.id === vaccineId ? { ...v, reorderLevel: vaccineReorderForm.reorderLevel, supplier: vaccineReorderForm.supplier } : v
      ))
      setSystemMessage("✓ Vaccine configuration updated.")
      setEditingVaccineId(null)
      appendAuditLog({ action: `Updated vaccine stock settings`, category: "Vaccine" })
    } catch (error) {
      console.error("Failed to update stock", error)
      setSystemMessage("Failed to update vaccine.")
    }
  }

  // FEATURE 10: Notifications Delivery
  const loadNotificationDeliveries = async () => {
    setIsNotifLoading(true)
    try {
      const deliveries = await getNotificationDeliveryStatus()
      setNotificationDeliveries(deliveries)
    } catch (error) {
      console.error("Failed to load deliveries", error)
    } finally {
      setIsNotifLoading(false)
    }
  }

  const retryFailedNotificationHandler = async (notifId: string) => {
    try {
      await retryFailedNotification(notifId)
      setNotificationDeliveries(prev => prev.map(n => 
        n.id === notifId ? { ...n, status: "pending" } : n
      ))
      setSystemMessage("✓ Notification queued for retry.")
      appendAuditLog({ action: `Retried notification delivery`, category: "Notification" })
    } catch (error) {
      console.error("Failed to retry notification", error)
    }
  }

  // FEATURE 11: Advanced Analytics
  const loadAdvancedAnalytics = async () => {
    try {
      const response = await getHqAnalytics({ region: "All", branch: "All", window: "3-months" })
      const charts = [
        {
          id: "cohort",
          title: "Immunization Cohort Analysis",
          type: "cohort",
          data: response.trend || []
        },
      ]
      setAdvancedCharts(charts)
    } catch (error) {
      console.error("Failed to load advanced analytics", error)
    }
  }

  // FEATURE 12: Quick Actions & System Alerts
  const dismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]))
  }

  const initializeSystemAlerts = () => {
    // System alerts are loaded from real system state or API in the future
    // For now, initialize as empty - alerts will be populated by monitoring
    setSystemAlerts([])
  }

  // ===== FEATURE 3: BULK USER CSV IMPORT HANDLER =====
  const handleCsvImport = async () => {
    if (!csvImportFile) {
      setSystemMessage("Please select a CSV file.")
      return
    }
    setIsImportingCsv(true)
    try {
      const text = await csvImportFile.text()
      const lines = text.split("\n").filter(l => l.trim())
      const header = lines[0].split(",").map(h => h.trim().toLowerCase())
      const records = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim())
        return Object.fromEntries(header.map((k, i) => [k, values[i]]))
      })

      let success = 0, failed = 0
      const errors: string[] = []

      for (const record of records) {
        try {
          if (!record.name || !record.email || !record.role) {
            failed++
            errors.push(`Row missing required fields: ${record.name}`)
            continue
          }
          await createHqUser({
            name: record.name,
            email: record.email,
            role: record.role,
          })
          success++
        } catch (error) {
          failed++
          errors.push(`Failed to create ${record.name}: ${error}`)
        }
      }

      setCsvImportResult({ success, failed, errors: errors.slice(0, 5) })
      setSystemMessage(`✓ Import complete: ${success} created, ${failed} failed.`)
      appendAuditLog({ action: `Bulk imported ${success} users via CSV`, category: "User" })

      const updatedUsers = await getHqUsers()
      setUsers(updatedUsers)
      setCsvImportFile(null)
    } catch (error) {
      console.error("Failed to import CSV", error)
      setSystemMessage("CSV import failed.")
    } finally {
      setIsImportingCsv(false)
    }
  }

  const handleAddUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userForm.name.trim() || !userForm.email.trim()) return

    const normalizedEmail = userForm.email.trim().toLowerCase()
    const role = mapUserRoleToApiRole(userForm.role)
    const editingUser = editingUserId ? users.find((user) => user.id === editingUserId) ?? null : null
    const isEditingExistingHqAdmin = editingUser?.role === "HQ Admin"

    if (!editingUserId && role === "hq-admin") {
      setSystemMessage("HQ Admin cannot create another HQ Admin from this console.")
      setUserActionNotice({
        tone: "warning",
        title: "Role restricted",
        detail: "Choose another role or ask a Super Admin for HQ Admin provisioning.",
      })
      return
    }

    try {
      if (editingUserId) {
        const updatePayload = {
          fullName: userForm.name.trim(),
          email: normalizedEmail,
          ...(isEditingExistingHqAdmin ? {} : { role }),
          branch: userForm.branch.trim() || undefined,
        }

        const updatedUser = await updateHqUser(editingUserId, updatePayload)
        setUsers((previous) => previous.map((user) => (user.id === updatedUser.id ? updatedUser : user)))
        setSystemMessage(`User "${updatedUser.name}" profile updated.`)
        setUserActionNotice({
          tone: "success",
          title: "User profile updated",
          detail: `${updatedUser.name} was updated succesfull.`,
        })
        appendAuditLog({ action: `Updated profile for ${updatedUser.name}`, category: "User" })
      } else {
        const createPayload = {
          fullName: userForm.name.trim(),
          email: normalizedEmail,
          role,
          branch: userForm.branch.trim() || undefined,
        }

        const createdUser = await createHqUser(createPayload)
        setUsers((previous) => [createdUser, ...previous])
        setSystemMessage(`User "${createdUser.name}" created.`)
        setUserActionNotice({
          tone: "success",
          title: "User created",
          detail: `${createdUser.name} was created succesfull.`,
        })
        appendAuditLog({ action: `Provisioned user ${createdUser.name}`, category: "User" })
      }
    } catch (error) {
      console.error("Failed to save user", error)
      const notice = mapUserManagementError(error)
      setUserActionNotice(notice)
      setSystemMessage(notice.detail)
      return
    }

    setEditingUserId(null)
    setUserForm({ name: "", email: "", role: "Branch Manager", branch: "" })
  }

  const handleAddVaccine = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsedDays = Number.parseInt(vaccineForm.dueDays, 10)
    if (!vaccineForm.name.trim() || Number.isNaN(parsedDays)) return

    try {
      if (editingVaccineId) {
        // Update existing vaccine via API (only send fields accepted by backend DTO)
        await updateHqVaccine(editingVaccineId, {
          name: vaccineForm.name.trim(),
        })

        const updatedName = vaccineForm.name.trim()
        setVaccines((previous) =>
          previous.map((vaccine) => {
            if (vaccine.id !== editingVaccineId) return vaccine
            return {
              ...vaccine,
              name: vaccineForm.name.trim(),
              schedule: vaccineForm.schedule.trim() || "Custom schedule",
              dueDays: parsedDays,
            }
          }),
        )

        setSystemMessage(`Schedule for "${updatedName}" updated.`)
        appendAuditLog({ action: `Updated schedule for ${updatedName}`, category: "Schedule" })
        setEditingVaccineId(null)
        setVaccineForm({ name: "", schedule: "", dueDays: "" })
        return
      }

      // Create new vaccine via API (only send fields accepted by backend DTO)
      const generatedCode = vaccineForm.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 32)

      const newVaccine = await createHqVaccine({
        name: vaccineForm.name.trim(),
        code: generatedCode,
      })

      setVaccines((previous) => [newVaccine as any, ...previous])
      setVaccineForm({ name: "", schedule: "", dueDays: "" })
      setSystemMessage(`Vaccine "${newVaccine.name}" added to master list.`)

      // Create schedule entry for the new vaccine
      const vaccineId = (newVaccine as any).id
      if (vaccineId) {
        await createHqSchedule({
          vaccineId: vaccineId,
          doseNumber: 1,
          scheduleName: vaccineForm.schedule.trim() || "Single dose",
          dueDaysFromBirth: parsedDays,
          isMandatory: true,
          sortOrder: 0,
        })
      }

      // Add to local state with form values for schedule/dueDays
      const vaccineWithSchedule = {
        ...newVaccine,
        id: generatedCode, // Use code as ID for consistency
        schedule: vaccineForm.schedule.trim() || "Single dose",
        dueDays: parsedDays,
      }

      setVaccines((previous) => [vaccineWithSchedule as any, ...previous])
      setVaccineForm({ name: "", schedule: "", dueDays: "" })
      setSystemMessage(`Vaccine "${newVaccine.name}" added to national catalogue.`)
      appendAuditLog({ action: `Added vaccine ${newVaccine.name} to master registry`, category: "Schedule" })
    } catch (error) {
      console.error("Failed to save vaccine", error)
      setSystemMessage("Failed to save vaccine. Please try again.")
    }
  }

  const handleTemplateUpdate = () => {
    if (!activeTemplate) return

    // Get the last saved version from localStorage
    const stored = localStorage.getItem(HQ_NOTIFICATION_TEMPLATES_STORAGE_KEY)
    const savedTemplates = stored ? JSON.parse(stored) : initialTemplates
    const savedTemplate = savedTemplates.find((t: NotificationTemplate) => t.id === activeTemplate.id)

    // Check if content has actually changed
    if (savedTemplate && savedTemplate.sms === activeTemplate.sms && savedTemplate.email === activeTemplate.email) {
      setSystemMessage("No changes to save.")
      return
    }

    try {
      localStorage.setItem(HQ_NOTIFICATION_TEMPLATES_STORAGE_KEY, JSON.stringify(templates))
      setSystemMessage(`${activeTemplate.label} template saved.`)
      appendAuditLog({ action: `Updated notification template ${activeTemplate.label}`, category: "Notifications" })
    } catch (error) {
      console.error("Failed to persist notification template", error)
      setSystemMessage("Could not save template locally. Please try again.")
    }
  }

  const handleBackup = async () => {
    try {
      setSystemMessage("Triggering backup...")
      const response = await fetch(`${API_BASE_URL}/common/backup/trigger`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
      })
      const data = await response.json()
      if (response.ok) {
        setSystemMessage(`✓ ${data.message}`)
      } else {
        setSystemMessage(data.message || "Failed to trigger backup")
      }
      appendAuditLog({ action: "Triggered manual system backup", category: "System" })
    } catch (error: any) {
      console.error("Backup trigger error:", error)
      if (error.message.includes("Failed to fetch") || error.name === "TypeError") {
        setSystemMessage("Backend server is not running. Start backend to trigger backups.")
      } else {
        setSystemMessage("Failed to trigger backup. Please try again.")
      }
    }
  }

  const handleBackupDownload = () => {
    try {
      setSystemMessage("Fetching latest encrypted backup...")

      fetch(`${API_BASE_URL}/common/backup/download-latest`, {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
      })
        .then(async (response) => {
          if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.message || `HTTP error! status: ${response.status}`)
          }
          return response.blob()
        })
        .then((blob) => {
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement("a")
          link.href = url

          const timestamp = new Date().toISOString().split("T")[0]
          link.download = `cvcc-backup-encrypted-${timestamp}.bin`

          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)

          setSystemMessage("✓ Encrypted backup downloaded successfully")
          appendAuditLog({
            action: "Downloaded latest encrypted backup",
            category: "System",
          })
        })
        .catch((error) => {
          console.error("Backup download failed:", error)

          if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
            setSystemMessage(
              "Backend server is not running. Start backend to enable backup downloads."
            )
          } else {
            setSystemMessage(error.message || "Failed to download backup.")
          }

          appendAuditLog({
            action: "Backup download failed",
            category: "System",
          })
        })
    } catch (error) {
      console.error("Backup download error:", error)
      setSystemMessage("Encrypted backup endpoint ready. Backend storage configuration in progress...")
    }
  }

  const handleCoverageExport = () => {
    if (!analyticsTrendData.length) {
      setSystemMessage("No analytics data available for the selected filters.")
      return
    }

    try {
      const reportDate = new Date()
      const generatedAt = reportDate.toISOString()
      const filenameDate = generatedAt.replace(/[:.]/g, "-")
      const filename = `coverage-report-${filenameDate}.csv`

      const lines = [
        ["Report", "Coverage Report"],
        ["Generated At", generatedAt],
        ["Region Filter", analyticsFilters.region],
        ["Branch Filter", analyticsFilters.branch],
        ["Reporting Window", analyticsFilters.window],
        [],
        ["Period", "Measles", "DPT-3"],
        ...analyticsTrendData.map((row) => [row.period, row.measles, row.dpt3]),
      ]

      const csv = lines
        .map((row) =>
          row
            .map((value) => {
              const text = String(value ?? "")
              return `"${text.replace(/"/g, '""')}"`
            })
            .join(","),
        )
        .join("\n")

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.setAttribute("download", filename)
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      window.URL.revokeObjectURL(url)

      setSystemMessage(`Coverage report exported as ${filename}.`)
      appendAuditLog({ action: `Exported coverage report (${filename})`, category: "Reporting" })
    } catch (error) {
      console.error("Failed to export coverage report", error)
      setSystemMessage("Could not export coverage report. Please try again.")
    }
  }

  const handleCoveragePdfExport = async () => {
    if (!analyticsTrendData.length) {
      setSystemMessage("No analytics data available for the selected filters.")
      return
    }

    try {
      const reportDate = new Date()
      const generatedAt = reportDate.toISOString()
      const filenameDate = generatedAt.replace(/[:.]/g, "-")
      const filename = `coverage-report-${filenameDate}.pdf`

      const { jsPDF } = await import("jspdf")
      const document = new jsPDF({ unit: "pt", format: "a4" })

      let y = 48
      document.setFontSize(16)
      document.text("Coverage Report", 40, y)

      y += 24
      document.setFontSize(10)
      document.text(`Generated At: ${generatedAt}`, 40, y)
      y += 16
      document.text(`Region Filter: ${analyticsFilters.region}`, 40, y)
      y += 16
      document.text(`Branch Filter: ${analyticsFilters.branch}`, 40, y)
      y += 16
      document.text(`Reporting Window: ${analyticsFilters.window}`, 40, y)

      y += 28
      document.setFontSize(11)
      document.text("Period", 40, y)
      document.text("Measles", 200, y)
      document.text("DPT-3", 300, y)

      y += 8
      document.line(40, y, 560, y)

      document.setFontSize(10)
      analyticsTrendData.forEach((row) => {
        y += 18

        if (y > 780) {
          document.addPage()
          y = 48
          document.setFontSize(11)
          document.text("Period", 40, y)
          document.text("Measles", 200, y)
          document.text("DPT-3", 300, y)
          y += 8
          document.line(40, y, 560, y)
          document.setFontSize(10)
        }

        document.text(String(row.period), 40, y)
        document.text(String(row.measles), 200, y)
        document.text(String(row.dpt3), 300, y)
      })

      document.save(filename)

      setSystemMessage(`Coverage report exported as ${filename}.`)
      appendAuditLog({ action: `Exported coverage report (${filename})`, category: "Reporting" })
    } catch (error) {
      console.error("Failed to export coverage report PDF", error)
      setSystemMessage("Could not export coverage report PDF. Please try again.")
    }
  }

  const exportAuditLogCSV = () => {
    try {
      // Prepare CSV headers
      const headers = ["Timestamp", "Action", "Actor", "Category"]
      
      // Prepare CSV rows
      const rows = enrichedAuditLogs.map((log) => [
        log.timestamp,
        log.action,
        log.actorName,
        log.category,
      ])

      // Create CSV content
      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")),
      ].join("\n")

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `audit-log-${new Date().toISOString().split("T")[0]}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setSystemMessage("✓ Audit log exported as CSV")
      appendAuditLog({ action: "Exported audit log (CSV format)", category: "System" })
    } catch (error) {
      console.error("Failed to export audit log as CSV", error)
      setSystemMessage("Could not export audit log as CSV. Please try again.")
    }
  }

  const exportAuditLogPDF = () => {
    try {
      // Dynamic import of jsPDF
      import("jspdf").then(({ jsPDF }) => {
        const doc = new jsPDF()
        const pageWidth = doc.internal.pageSize.getWidth()
        const pageHeight = doc.internal.pageSize.getHeight()
        let yPosition = 20

        // Title
        doc.setFontSize(18)
        doc.text("System Audit Log Report", 20, yPosition)
        yPosition += 10

        // Metadata
        doc.setFontSize(10)
        doc.text(`Generated: ${new Date().toLocaleString()}`, 20, yPosition)
        yPosition += 5
        doc.text(`Total Records: ${enrichedAuditLogs.length}`, 20, yPosition)
        yPosition += 10

        // Add divider
        doc.setDrawColor(100)
        doc.line(20, yPosition, pageWidth - 20, yPosition)
        yPosition += 5

        // Table headers
        doc.setFontSize(11)
        doc.setFont("helvetica", "bold")
        const headerY = yPosition
        doc.text("Timestamp", 20, headerY)
        doc.text("Action", 70, headerY)
        doc.text("Actor", 140, headerY)
        doc.text("Category", 180, headerY)
        yPosition += 7

        // Add divider
        doc.setDrawColor(150)
        doc.line(20, yPosition, pageWidth - 20, yPosition)
        yPosition += 3

        // Table rows
        doc.setFont("helvetica", "normal")
        doc.setFontSize(9)

        enrichedAuditLogs.forEach((log) => {
          // Check if we need a new page
          if (yPosition > pageHeight - 20) {
            doc.addPage()
            yPosition = 20
            
            // Repeat headers on new page
            doc.setFont("helvetica", "bold")
            doc.text("Timestamp", 20, yPosition)
            doc.text("Action", 70, yPosition)
            doc.text("Actor", 140, yPosition)
            doc.text("Category", 180, yPosition)
            yPosition += 7
            doc.setFont("helvetica", "normal")
          }

          doc.text(log.timestamp.substring(0, 16), 20, yPosition)
          
          // Wrap action text if too long
          const actionLines = doc.splitTextToSize(log.action, 65)
          doc.text(actionLines, 70, yPosition)
          
          doc.text(log.actorName.substring(0, 35), 140, yPosition)
          doc.text(log.category, 180, yPosition)
          
          yPosition += actionLines.length > 1 ? actionLines.length * 4 + 3 : 7
        })

        // Save PDF
        doc.save(`audit-log-${new Date().toISOString().split("T")[0]}.pdf`)
        
        setSystemMessage("✓ Audit log exported as PDF")
        appendAuditLog({ action: "Exported audit log (PDF format)", category: "System" })
      })
    } catch (error) {
      console.error("Failed to export audit log as PDF", error)
      setSystemMessage("Could not export audit log as PDF. Please try again.")
    }
  }

  const handleTemplatePreview = async () => {
    if (!activeTemplate) return

    const source = previewChannel === "sms" ? activeTemplate.sms : activeTemplate.email
    const compiled = compileTemplatePreview(source)

    setTemplatePreview(compiled)
    setIsPreviewModalOpen(true)
    appendAuditLog({ action: `Previewed notification template ${activeTemplate.label}`, category: "Notifications" })
  }

  const handleUserResetPassword = async (user: UserRecord) => {
    try {
      const response = await resetHqUserPassword(user.email)
      setSystemMessage(response.message)
      setUserActionNotice(
        response.emailSent
          ? {
              tone: "success",
              title: "Reset email sent",
              detail: `Password reset email was sent to ${user.email}.`,
            }
          : {
              tone: "destructive",
              title: "Reset email failed",
              detail: response.reason || response.message,
            },
      )
      setUserResetStatusById((previous) => ({
        ...previous,
        [user.id]: {
          status: response.emailSent ? "sent" : "failed",
          detail: response.emailSent ? response.message : response.reason || response.message,
          time: new Date().toLocaleTimeString(),
        },
      }))
      appendAuditLog({ action: `Initiated password reset for ${user.name}`, category: "User" })
    } catch (error) {
      console.error("Failed to reset user password", error)
      const notice = mapUserManagementError(error)
      setUserActionNotice(notice)
      setSystemMessage(`Could not reset password for ${user.email}. ${notice.detail}`)
      setUserResetStatusById((previous) => ({
        ...previous,
        [user.id]: {
          status: "failed",
          detail: error instanceof Error ? error.message : "Request failed",
          time: new Date().toLocaleTimeString(),
        },
      }))
    }
  }

  const handleUserEditRoles = (user: UserRecord) => {
    setEditingUserId(user.id)
    setUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      branch: user.branch ?? "",
    })
    setSystemMessage(`Editing user profile for ${user.name}.`)
    setUserActionNotice(null)
    appendAuditLog({ action: `Opened user editor for ${user.name}`, category: "User" })

    window.setTimeout(() => {
      userFormPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 80)
  }

  const handleUserStatusToggle = async (userId: string) => {
    const targetUser = users.find((user) => user.id === userId)
    if (!targetUser) return

    const nextStatus: UserRecord["status"] = targetUser.status === "active" ? "inactive" : "active"

    try {
      const updatedUser = await updateHqUserStatus(userId, nextStatus)
      setUsers((previous) => previous.map((user) => (user.id === updatedUser.id ? updatedUser : user)))

      setSystemMessage(`User "${updatedUser.name}" ${nextStatus === "active" ? "re-activated" : "deactivated"}.`)
      setUserActionNotice({
        tone: "success",
        title: nextStatus === "active" ? "User activated" : "User deactivated",
        detail: `${updatedUser.name} was ${nextStatus === "active" ? "activated" : "deactivated"} succesfull.`,
      })
      appendAuditLog({ action: `${nextStatus === "active" ? "Reactivated" : "Deactivated"} user ${updatedUser.name}`, category: "User" })
    } catch (error) {
      console.error("Failed to update user status", error)
      const notice = mapUserManagementError(error)
      setUserActionNotice(notice)
      setSystemMessage(notice.detail)
    }
  }

  const cancelUserEditing = () => {
    setEditingUserId(null)
    setUserForm({ name: "", email: "", role: "Branch Manager", branch: "" })
    setUserActionNotice(null)
  }

  const cancelVaccineEditing = () => {
    setEditingVaccineId(null)
    setVaccineForm({ name: "", schedule: "", dueDays: "" })
    setSystemMessage("Vaccine schedule editing cancelled.")
  }

  const handleVaccineEdit = (vaccine: VaccineConfig) => {
    setEditingVaccine(vaccine)
    setVaccineEditForm({
      schedule: vaccine.schedule,
      dueDays: String(vaccine.dueDays),
    })
    setIsVaccineEditModalOpen(true)
  }

  const handleVaccineEditSave = async () => {
    if (!editingVaccine || isVaccineSaving) return

    const parsedDays = Number.parseInt(vaccineEditForm.dueDays, 10)
    if (Number.isNaN(parsedDays)) {
      setSystemMessage("Please enter a valid number for due days.")
      return
    }

    // Check if values have actually changed
    const hasChanges =
      editingVaccine.schedule !== (vaccineEditForm.schedule.trim() || "Custom schedule") ||
      editingVaccine.dueDays !== parsedDays

    if (!hasChanges) {
      setSystemMessage("No changes to save.")
      setIsVaccineEditModalOpen(false)
      setEditingVaccine(null)
      return
    }

    setIsVaccineSaving(true)
    try {
      // Update or create schedule in database
      const vaccineObj = vaccines.find((v) => v.id === editingVaccine.id)
      const schedules = (vaccineObj as any)?.schedules || []
      const dbId = (vaccineObj as any)?.dbId

      if (schedules.length > 0 && schedules[0].id) {
        // Update existing schedule
        await updateHqSchedule(schedules[0].id, {
          scheduleName: vaccineEditForm.schedule.trim() || "Custom schedule",
          dueDaysFromBirth: parsedDays,
        })
      } else if (dbId) {
        // Create new schedule for this vaccine
        await createHqSchedule({
          vaccineId: dbId,
          doseNumber: 1,
          scheduleName: vaccineEditForm.schedule.trim() || "Custom schedule",
          dueDaysFromBirth: parsedDays,
          isMandatory: true,
          sortOrder: 0,
        })
      }

      // Update local state
      setVaccines((previous) =>
        previous.map((vaccine) => {
          if (vaccine.id !== editingVaccine.id) return vaccine
          return {
            ...vaccine,
            schedule: vaccineEditForm.schedule.trim() || "Custom schedule",
            dueDays: parsedDays,
          }
        }),
      )

      setSystemMessage(`Timing for "${editingVaccine.name}" updated to ${parsedDays} days.`)
      appendAuditLog({ action: `Updated timing for ${editingVaccine.name} to ${parsedDays} days`, category: "Schedule" })
      setIsVaccineEditModalOpen(false)
      setEditingVaccine(null)
    } catch (error) {
      console.error("Failed to update vaccine timing", error)
      setSystemMessage("Failed to update vaccine timing. Please try again.")
    } finally {
      setIsVaccineSaving(false)
    }
  }

  const handleVaccineArchiveToggle = async (vaccineId: string) => {
    const vaccine = vaccines.find((v) => v.id === vaccineId)
    if (!vaccine) return

    const nextStatus = vaccine.status === "active" ? "archived" : "active"
    const dbId = (vaccine as any)?.dbId

    try {
      // Update status in database
      if (dbId) {
        await updateHqVaccine(dbId, { status: nextStatus })
      }

      // Update local state
      setVaccines((previous) =>
        previous.map((v) => {
          if (v.id !== vaccineId) return v
          return { ...v, status: nextStatus }
        }),
      )

      const action = nextStatus === "active" ? "Restored" : "Archived"
      setSystemMessage(`Vaccine "${vaccine.name}" ${nextStatus === "active" ? "restored to" : "removed from"} the active schedule.`)
      appendAuditLog({ action: `${action} vaccine ${vaccine.name}`, category: "Schedule" })
    } catch (error) {
      console.error("Failed to update vaccine status", error)
      setSystemMessage("Failed to update vaccine status. Please try again.")
    }
  }

  const handleVaccineDelete = (vaccine: VaccineConfig) => {
    setDeleteError(null)
    setVaccineToDelete(vaccine)
    setIsDeleteModalOpen(true)
  }

  const confirmVaccineDelete = async () => {
    if (!vaccineToDelete) return

    const vaccineId = vaccineToDelete.id
    const dbId = (vaccineToDelete as any)?.dbId

    setIsVaccineDeleting(true)
    try {
      // Actually delete from database
      if (!dbId) {
        throw new Error("No database ID found for this vaccine. Cannot delete.")
      }

      await deleteHqVaccine(dbId)

      // Remove from local state
      setVaccines((previous) => previous.filter((v) => v.id !== vaccineId))

      setSystemMessage(`Vaccine "${vaccineToDelete.name}" permanently deleted from database.`)
      appendAuditLog({ action: `Permanently deleted vaccine ${vaccineToDelete.name}`, category: "Schedule" })
      setIsDeleteModalOpen(false)
      setVaccineToDelete(null)
    } catch (error) {
      console.error("Failed to delete vaccine:", error)

      // Show error in modal
      let errorMessage = "Failed to delete vaccine. Please try again."
      if (error && typeof error === 'object') {
        if ('status' in error && error.status === 401) {
          errorMessage = "Session expired. Please log in again to delete vaccines."
        } else if ('message' in error) {
          errorMessage = (error as { message: string }).message
        }
      }

      setDeleteError(errorMessage)
    } finally {
      setIsVaccineDeleting(false)
    }
  }

  const resolveReviewItem = (conflictId: string) => {
    setReviewQueue((previous) => previous.filter((item) => item.conflictId !== conflictId))
  }

  const acknowledgeReviewItem = (item: ReviewQueueItem) => {
  // TODO: Replace with backend acknowledgement API
    console.log("Acknowledging HQ review item", item)
    resolveReviewItem(item.conflictId)
    setSystemMessage(`${item.conflictId} acknowledged. Follow up with data officer.`)
  }

  const openConflictDetails = (conflictId: string) => {
    // TODO: Replace with HQ-native conflict detail view
    router.push(`/dashboard/sync-conflicts?focus=${conflictId}`)
  }

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-primary" /> Total Branches
            </CardTitle>
            <CardDescription>Active healthcare facilities onboarded.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {isOverviewLoading ? "..." : (overviewStats?.totalBranches ?? branches.length).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Active branches in the system</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-primary" /> Total Users
            </CardTitle>
            <CardDescription>Managers, Nurses, CHWs, and Officers.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {isOverviewLoading ? "..." : (overviewStats?.totalUsers ?? users.length).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Active staff accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Children Registered
            </CardTitle>
            <CardDescription>Nationwide vaccination journeys created.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {isOverviewLoading ? "..." : (overviewStats?.childrenRegistered ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Children in vaccination program</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> CHWs Active Today
            </CardTitle>
            <CardDescription>Devices synced in the last 24 hours.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {isOverviewLoading ? "..." : (overviewStats?.chwsActiveToday ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isOverviewLoading ? "Loading..." : `${overviewStats?.chwSyncPercentage ?? 0}% of ${overviewStats?.totalChws ?? 0} total CHWs`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" /> Quick Actions
          </CardTitle>
          <CardDescription>Frequently used system operations.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <button 
              onClick={() => {
                setActiveSection("branches")
                branchEditPanelRef.current?.scrollIntoView({ behavior: "smooth" })
              }}
              className="rounded-lg border border-border bg-muted/30 p-4 hover:bg-muted/50 hover:border-primary transition text-left"
            >
              <div className="text-2xl mb-2">🏥</div>
              <p className="font-medium text-sm">Register Branch</p>
              <p className="text-xs text-muted-foreground mt-1">Add new health facility</p>
            </button>
            
            <button
              onClick={() => {
                setActiveSection("users")
                userFormPanelRef.current?.scrollIntoView({ behavior: "smooth" })
              }}
              className="rounded-lg border border-border bg-muted/30 p-4 hover:bg-muted/50 hover:border-primary transition text-left"
            >
              <div className="text-2xl mb-2">👤</div>
              <p className="font-medium text-sm">Create User</p>
              <p className="text-xs text-muted-foreground mt-1">Provision new account</p>
            </button>

            <button
              onClick={() => {
                setActiveSection("vaccines")
                vaccineFormPanelRef.current?.scrollIntoView({ behavior: "smooth" })
              }}
              className="rounded-lg border border-border bg-muted/30 p-4 hover:bg-muted/50 hover:border-primary transition text-left"
            >
              <div className="text-2xl mb-2">💉</div>
              <p className="font-medium text-sm">Add Vaccine</p>
              <p className="text-xs text-muted-foreground mt-1">Register new antigen</p>
            </button>

            <button
              onClick={handleBackup}
              className="rounded-lg border border-border bg-muted/30 p-4 hover:bg-muted/50 hover:border-primary transition text-left"
            >
              <div className="text-2xl mb-2">💾</div>
              <p className="font-medium text-sm">Backup Now</p>
              <p className="text-xs text-muted-foreground mt-1">Trigger system backup</p>
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr,1.2fr]">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gauge className="h-5 w-5 text-primary" /> National Coverage Rate
            </CardTitle>
            <CardDescription>Percentage of children fully vaccinated for the national core schedule.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {isOverviewLoading ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading coverage data...
                </span>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Coverage", value: overviewStats?.nationalCoverageRate ?? 86 },
                        { name: "Gap", value: 100 - (overviewStats?.nationalCoverageRate ?? 86) }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={0}
                      dataKey="value"
                      label={({ name, value }) => `${value}%`}
                      labelLine={false}
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#e5e7eb" />
                    </Pie>
                    <Tooltip formatter={(value) => `${value}%`} />
                  </PieChart>
                </ResponsiveContainer>
                <p className="mt-4 text-center text-sm text-muted-foreground">Target: 92% · Current: {overviewStats?.nationalCoverageRate ?? 0}%</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" /> Coverage Trend (Measles vs DPT-3)
            </CardTitle>
            <CardDescription>Month-on-month national view of critical vaccine completion.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            {isOverviewLoading ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading trend data...
                </span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analyticsTrendData && analyticsTrendData.length > 0 ? analyticsTrendData : coverageTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="period" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <YAxis domain={[70, 90]} stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                    formatter={(value) => [`${value}%`, '']}
                    labelFormatter={(label) => `${label}`}
                  />
                  <ReferenceLine y={92} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: 'Target: 92%', position: 'right', fill: '#f59e0b', fontSize: 12 }} />
                  <Area type="monotone" dataKey="measles" stroke="#2563eb" strokeWidth={2.5} fill="#2563eb" fillOpacity={0.15} name="Measles" />
                  <Area type="monotone" dataKey="dpt3" stroke="#10b981" strokeWidth={2.5} fill="#10b981" fillOpacity={0.15} name="DPT-3" />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BellRing className="h-5 w-5 text-primary" /> Adverse Events (AEFI)
            </CardTitle>
            <CardDescription>Highest priority notifications surfaced from branches.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAefiLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading AEFI feed...
              </div>
            ) : aefiReports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No adverse events reported</p>
              </div>
            ) : (
              aefiReports.map((item) => (
                <div key={item.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">{item.child}</span>
                    <Badge variant="destructive">{item.priority}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.vaccine} • {item.branch}
                  </p>
                  <p className="text-xs text-muted-foreground/80 mt-2">Reported {item.reportedAt}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ServerCog className="h-5 w-5 text-primary" /> CHW Devices Pending Sync
            </CardTitle>
            <CardDescription>Monitor field data lag before it becomes a reporting gap.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isDeviceSyncLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading device status...
              </div>
            ) : deviceSyncStatus.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>All devices synced</p>
              </div>
            ) : (
              deviceSyncStatus.map((device) => (
                <div key={device.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">{device.name}</span>
                    <Badge variant="secondary">{device.pending} forms</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{device.branch}</p>
                  <p className="text-xs text-muted-foreground/80 mt-2">Last sync {device.lastSync}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {reviewQueue.length > 0 ? (
        <Card className="border-amber-500/60 bg-amber-50/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-amber-800">
              <ShieldAlert className="h-5 w-5" /> Conflicts escalated by Data Officers
            </CardTitle>
            <CardDescription className="text-xs text-amber-800/90">
              Sync collisions awaiting HQ resolution after being queued from the field.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {reviewQueue.map((item) => (
              <div key={item.conflictId} className="rounded-lg border border-amber-400/70 bg-white/90 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-amber-900">{item.conflictId}</span>
                  <span className="text-xs text-amber-700">Queued {new Date(item.queuedAt).toLocaleString()}</span>
                </div>
                <p className="mt-2 text-xs text-amber-900/80">
                  {item.payloadSummary} · {item.location} · {item.originator}
                </p>
                <p className="mt-1 text-[11px] text-amber-900/70">Suggested action: {item.reason}</p>
                {item.followUp ? (
                  <p className="mt-1 text-[11px] text-amber-900/70">Follow up: {item.followUp}</p>
                ) : null}
                {item.linkedChildId ? (
                  <p className="mt-1 text-[11px] text-amber-900/70">Linked record: {item.linkedChildId}</p>
                ) : null}
                {item.attachmentName ? (
                  <p className="mt-1 text-[11px] text-amber-900/70">Attachment: {item.attachmentName}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" className="gap-2 bg-amber-600 text-white hover:bg-amber-700" onClick={() => acknowledgeReviewItem(item)}>
                    <CheckCircle2 className="h-4 w-4" /> Mark as acknowledged
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 border-amber-400 text-amber-800 hover:bg-amber-100"
                    onClick={() => openConflictDetails(item.conflictId)}
                  >
                    <ListChecks className="h-4 w-4" /> Open conflict details
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {systemAlerts.length > 0 && (
        <Card className="border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5 text-amber-600" /> System Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {systemAlerts
              .filter(a => !dismissedAlerts.has(a.id))
              .map(alert => (
                <div key={alert.id} className={`rounded-lg border p-3 flex items-start justify-between gap-3 ${
                  alert.type === "error" ? "border-destructive bg-destructive/5" :
                  alert.type === "warning" ? "border-amber-300 bg-amber-50 dark:bg-amber-900/30" :
                  alert.type === "success" ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30" :
                  "border-blue-300 bg-blue-50 dark:bg-blue-900/30"
                }`}>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{alert.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">{alert.timestamp}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => dismissAlert(alert.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  )

  const renderBranches = () => (
    <div className="space-y-6">
      <Card ref={branchEditPanelRef} className="border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" /> {editingBranchId ? "Edit Branch Profile" : "Register New Branch"}
          </CardTitle>
          <CardDescription>Capture essential branch details and assign leadership.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleBranchSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="branchName">Branch name</Label>
              <Input
                id="branchName"
                placeholder="e.g. Kasoa Polyclinic"
                value={branchForm.name}
                onChange={(event) => setBranchForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branchRegion">Region</Label>
              <Input
                id="branchRegion"
                placeholder="Greater Accra"
                value={branchForm.region}
                onChange={(event) => setBranchForm((prev) => ({ ...prev, region: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branchManager">Branch manager</Label>
              <Input
                id="branchManager"
                placeholder="Manager full name"
                value={branchForm.manager}
                onChange={(event) => setBranchForm((prev) => ({ ...prev, manager: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="catchmentAreas">Catchment areas (comma separated)</Label>
              <Input
                id="catchmentAreas"
                placeholder="e.g. Kasoa Central, Ofaakor, Amanfrom"
                value={branchForm.catchmentAreas}
                onChange={(event) => setBranchForm((prev) => ({ ...prev, catchmentAreas: event.target.value }))}
              />
            </div>
            <div className="md:col-span-2 flex flex-wrap justify-end gap-2">
              {editingBranchId ? (
                <Button type="button" variant="ghost" onClick={cancelBranchEditing}>
                  Cancel edit
                </Button>
              ) : null}
              <Button type="submit" className="gap-2">
                <MapPinned className="h-4 w-4" /> {editingBranchId ? "Save branch" : "Register branch"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Branch Directory</CardTitle>
              <CardDescription>Review existing facilities and their assigned territories.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCleanupDuplicateChws}
              className="gap-2"
            >
              <Layers className="h-4 w-4" /> Clean up duplicates
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {branches.map((branch) => {
            const isInactive = branch.status === "inactive"
            return (
              <div
                key={branch.id}
                className={`rounded-lg border border-border p-4 transition ${
                  isInactive ? "bg-muted/60" : "bg-background"
                }`}
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-base font-semibold text-foreground">{branch.name}</p>
                    <p className="text-sm text-muted-foreground">{branch.region}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">ID: {branch.id}</Badge>
                    <Badge variant={isInactive ? "destructive" : "outline"}>{isInactive ? "Inactive" : "Active"}</Badge>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Manager:</span> {branch.manager}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Catchment areas:</span> {branch.catchmentAreas.join(", ") || "Pending assignment"}
                  </p>
                  <p className="text-sm text-muted-foreground md:col-span-2">
                    <span className="font-medium text-foreground">Assigned CHWs:</span> {branch.assignedChws.length ? branch.assignedChws.join(", ") : "None assigned yet"}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEditingBranch(branch)}>
                    Edit profile
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => startChwAssignment(branch)}>
                    {branch.assignedChws.length ? "Update CHWs" : "Assign CHWs"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={isInactive ? "text-foreground" : "text-destructive"}
                    onClick={() => toggleBranchStatus(branch.id)}
                  >
                    {isInactive ? "Activate" : "Deactivate"}
                  </Button>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" /> Catchment Area Management
              </CardTitle>
              <CardDescription>Define and manage geographical service areas for branches.</CardDescription>
            </div>
            {selectedBranchForCatchment && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedBranchForCatchment(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedBranchForCatchment ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">Select a branch to manage its catchment areas:</p>
              <div className="grid gap-2 md:grid-cols-2">
                {branches.map((branch) => (
                  <Button
                    key={branch.id}
                    variant="outline"
                    className="h-auto justify-start"
                    onClick={() => {
                      setSelectedBranchForCatchment(branch)
                      setCatchmentForm({ name: "", population: "", boundaries: "" })
                      setIsEditingCatchment(false)
                    }}
                  >
                    <div className="text-left">
                      <p className="font-medium">{branch.name}</p>
                      <p className="text-xs text-muted-foreground">{branch.region}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> {selectedBranchForCatchment.name} - Catchment Areas
                </h3>
              </div>

              {!isEditingCatchment && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Current catchment areas:</p>
                  {catchmentAreas.length > 0 ? (
                    <div className="space-y-2">
                      {catchmentAreas.map((area) => (
                        <div key={area.id} className="flex items-start justify-between rounded-lg border border-border bg-muted/30 p-3">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{area.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">Population: ~{area.population}</p>
                            <p className="text-xs text-muted-foreground">Boundaries: {area.boundaries}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setIsEditingCatchment(true)
                                setEditingCatchmentId(area.id)
                                setCatchmentForm({
                                  name: area.name,
                                  population: area.population.toString(),
                                  boundaries: area.boundaries,
                                })
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteCatchment(area.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">No catchment areas defined yet.</p>
                  )}
                  <Button
                    size="sm"
                    className="gap-2 w-full mt-4"
                    onClick={() => {
                      setIsEditingCatchment(true)
                      setEditingCatchmentId(null)
                      setCatchmentForm({ name: "", population: "", boundaries: "" })
                    }}
                  >
                    <Plus className="h-4 w-4" /> Add new catchment area
                  </Button>
                </div>
              )}

              {isEditingCatchment && (
                <form onSubmit={(e) => { e.preventDefault(); handleSaveCatchment() }} className="space-y-3 p-3 rounded-lg border border-primary/40 bg-primary/5">
                  <p className="font-medium text-sm">{editingCatchmentId ? "Edit" : "New"} catchment area</p>
                  <div className="space-y-2">
                    <Label htmlFor="catchmentName">Area name</Label>
                    <Input
                      id="catchmentName"
                      placeholder="e.g. Kasoa Central"
                      value={catchmentForm.name}
                      onChange={(e) => setCatchmentForm((prev) => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="catchmentPop">Population (estimated)</Label>
                    <Input
                      id="catchmentPop"
                      type="number"
                      placeholder="5000"
                      value={catchmentForm.population}
                      onChange={(e) => setCatchmentForm((prev) => ({ ...prev, population: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="catchmentBound">Boundaries</Label>
                    <Input
                      id="catchmentBound"
                      placeholder="e.g. From Main Street to Railway Road"
                      value={catchmentForm.boundaries}
                      onChange={(e) => setCatchmentForm((prev) => ({ ...prev, boundaries: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsEditingCatchment(false)
                        setEditingCatchmentId(null)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" className="gap-2">
                      <Check className="h-3.5 w-3.5" /> Save area
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {activeChwBranch ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Assign Community Health Workers</CardTitle>
                  <CardDescription className="mt-1">{activeChwBranch.name} • {activeChwBranch.region}</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={cancelChwAssignment}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChwAssignmentSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="chwSearch">Search CHWs</Label>
                  <Input
                    id="chwSearch"
                    placeholder="Search by name..."
                    value={chwSearchFilter}
                    onChange={(e) => setChwSearchFilter(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Available CHWs</Label>
                  <div className="max-h-60 space-y-2 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
                    {users
                      .filter((user) => user.role === "Community Health Worker" || user.role === "chw")
                      .filter((user) => user.name.toLowerCase().includes(chwSearchFilter.toLowerCase()))
                      .map((chw) => {
                        const assignments = chwBranchAssignments.get(chw.name) ?? []
                        const assignedToOtherBranch = assignments.length > 0 && !assignments.includes(activeChwBranch?.name ?? "")
                        const isCurrentlySelected = chwSelectedIds.has(chw.id)

                        return (
                          <div key={chw.id} className={`flex items-start space-x-2 p-2 rounded ${assignedToOtherBranch ? "bg-red-50 dark:bg-red-900/20" : ""}`}>
                            <input
                              type="checkbox"
                              id={`chw-${chw.id}`}
                              checked={isCurrentlySelected}
                              disabled={assignedToOtherBranch && !isCurrentlySelected}
                              onChange={(e) => {
                                const newSelected = new Set(chwSelectedIds)
                                if (e.target.checked) {
                                  newSelected.add(chw.id)
                                } else {
                                  newSelected.delete(chw.id)
                                }
                                setChwSelectedIds(newSelected)
                              }}
                              className="h-4 w-4 rounded border-border mt-1"
                            />
                            <div className="flex-1">
                              <Label htmlFor={`chw-${chw.id}`} className={`cursor-pointer ${assignedToOtherBranch && !isCurrentlySelected ? "opacity-50" : ""}`}>
                                {chw.name}
                                <span className="text-xs text-muted-foreground ml-1">({chw.email})</span>
                              </Label>
                              {assignedToOtherBranch && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                                  ⚠ Already assigned to {assignments.join(", ")}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    {users.filter((user) => user.role === "Community Health Worker" || user.role === "chw").length === 0 && (
                      <p className="text-sm text-muted-foreground py-4 text-center">No CHWs found in the system</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={cancelChwAssignment}>
                    Cancel
                  </Button>
                  <Button type="submit" className="gap-2">
                    <ListChecks className="h-4 w-4" /> Save ({chwSelectedIds.size})
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Bulk Branch Operations
          </CardTitle>
          <CardDescription>Perform batch operations on multiple branches.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="operationType">Operation type</Label>
            <select
              id="operationType"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={selectedBulkOperation}
              onChange={(e) => setSelectedBulkOperation(e.target.value)}
            >
              <option value="activate">Activate branches</option>
              <option value="deactivate">Deactivate branches</option>
              <option value="reassign-manager">Reassign managers</option>
              <option value="add-chws">Add CHWs to branches</option>
            </select>
          </div>

          <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setBulkBranchFile(e.target.files?.[0] ?? null)}
              className="hidden"
              ref={fileInputRef}
            />
            <Button
              variant="outline"
              onClick={() => {const input = document.createElement('input'); input.type = 'file'; input.accept = '.csv'; input.onchange = () => {if(input.files?.[0]) setBulkBranchFile(input.files[0])}; input.click()}}
              className="gap-2"
            >
              <Upload className="h-4 w-4" /> {bulkBranchFile ? bulkBranchFile.name : "Choose CSV file"}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">Format: branch_id, operation</p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleBulkBranchOperation}
              disabled={!bulkBranchFile || isBulkProcessing}
              className="gap-2 flex-1"
            >
              {isBulkProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Processing...
                </>
              ) : (
                <>
                  <Layers className="h-4 w-4" /> Execute bulk operation
                </>
              )}
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleExportBranches}>
              <ArrowDownToLine className="h-4 w-4" /> Export all branches
            </Button>
          </div>

          {bulkOperationResult && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
              <p className="font-medium text-sm">Operation Summary</p>
              <div className="grid gap-2 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Succeeded</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{bulkOperationResult.success}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Failed</p>
                  <p className="text-lg font-bold text-destructive">{bulkOperationResult.failed}</p>
                </div>
              </div>
              {bulkOperationResult.errors.length > 0 && (
                <div className="mt-2 space-y-1 max-h-[150px] overflow-y-auto">
                  <p className="text-xs font-medium text-muted-foreground">Errors:</p>
                  {bulkOperationResult.errors.map((err, idx) => (
                    <p key={idx} className="text-xs text-destructive">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
  const renderUsers = () => (
    <div className="space-y-6">
      {(() => {
        const editingUser = editingUserId ? users.find((user) => user.id === editingUserId) ?? null : null
        const lockRoleSelection = editingUser?.role === "HQ Admin"

        return (
      <Card ref={userFormPanelRef} className="border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UsersIcon className="h-5 w-5 text-primary" /> {editingUserId ? "Edit User Profile" : "Create or Assign User"}
          </CardTitle>
          <CardDescription>Provision HQ, branch, and supervisory accounts.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddUser} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="userName">Full name</Label>
              <Input
                id="userName"
                placeholder="Akua Aidoo"
                value={userForm.name}
                onChange={(event) => setUserForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userEmail">Official email</Label>
              <Input
                id="userEmail"
                type="email"
                placeholder="user@health.gov.gh"
                value={userForm.email}
                onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userRole">Role</Label>
              <select
                id="userRole"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={userForm.role}
                onChange={(event) => setUserForm((prev) => ({ ...prev, role: event.target.value }))}
                disabled={lockRoleSelection}
              >
                {lockRoleSelection ? <option>HQ Admin</option> : null}
                <option>Branch Manager</option>
                <option>Facility Nurse</option>
                <option>Community Health Worker</option>
                <option>Parent</option>
              </select>
              {lockRoleSelection ? (
                <p className="text-xs text-muted-foreground">HQ Admin role assignment is restricted in this console.</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="userBranch">Branch (optional)</Label>
              <Input
                id="userBranch"
                placeholder="Assign branch"
                value={userForm.branch}
                onChange={(event) => setUserForm((prev) => ({ ...prev, branch: event.target.value }))}
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              {editingUserId ? (
                <Button type="button" variant="ghost" onClick={cancelUserEditing}>
                  Cancel edit
                </Button>
              ) : null}
              <Button type="submit" className="gap-2">
                <Shield className="h-4 w-4" /> {editingUserId ? "Save user" : "Provision user"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
        )
      })()}

      <Card>
        <CardHeader>
          <CardTitle>System Users</CardTitle>
          <CardDescription>Search, review and manage nationwide accounts.</CardDescription>
          {isUsingUsersFallback ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Live user directory is temporarily unavailable. Showing fallback data.
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {users.map((user) => (
            <div key={user.id} className="rounded-lg border border-border bg-background p-4">
              {(() => {
                const resetStatus = userResetStatusById[user.id]

                return (
                  <>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-base font-semibold text-foreground">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <Badge variant={user.status === "active" ? "secondary" : "destructive"}>{user.status === "active" ? "Active" : "Inactive"}</Badge>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Role:</span> {user.role}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Branch:</span> {user.branch ?? "HQ"}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => handleUserResetPassword(user)}>
                  Reset password
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleUserEditRoles(user)}>
                  Edit roles
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className={user.status === "active" ? "text-destructive" : "text-emerald-600"}
                  onClick={() => handleUserStatusToggle(user.id)}
                >
                  {user.status === "active" ? "Deactivate" : "Activate"}
                </Button>
              </div>
              {resetStatus ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <p className={`text-xs ${resetStatus.status === "sent" ? "text-emerald-700" : "text-destructive"}`}>
                    {resetStatus.status === "sent" ? "Email sent" : "Email failed"} at {resetStatus.time}: {resetStatus.detail}
                  </p>
                  {resetStatus.status === "failed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(resetStatus.detail)
                          setSystemMessage(`Copied email failure reason for ${user.email}.`)
                        } catch (error) {
                          console.error("Failed to copy reset error", error)
                          setSystemMessage("Could not copy error message. Please copy it manually.")
                        }
                      }}
                    >
                      Copy error
                    </Button>
                  ) : null}
                </div>
              ) : null}
                  </>
                )
              })()}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" /> Bulk User Import
          </CardTitle>
          <CardDescription>Upload a CSV file to create multiple users at once.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              CSV format: <code className="bg-muted px-2 py-1 rounded text-xs font-mono">name, email, role, branch</code>
            </p>
            <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => setCsvImportFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" /> {csvImportFile ? csvImportFile.name : "Choose CSV file"}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                {csvImportFile ? `${csvImportFile.size} bytes` : "Max 5MB"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCsvImport}
                disabled={!csvImportFile || isImportingCsv}
                className="gap-2 flex-1"
              >
                {isImportingCsv ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" /> Import users
                  </>
                )}
              </Button>
              {csvImportFile && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setCsvImportFile(null)
                    setCsvImportResult(null)
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {csvImportResult && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
              <p className="font-medium text-sm">Import Summary</p>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Successfully created</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{csvImportResult.success}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Failed to import</p>
                  <p className="text-lg font-bold text-destructive">{csvImportResult.failed}</p>
                </div>
              </div>
              {csvImportResult.errors && csvImportResult.errors.length > 0 && (
                <div className="mt-3 space-y-1 max-h-[200px] overflow-y-auto">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Errors:</p>
                  {csvImportResult.errors.map((error, idx) => (
                    <p key={idx} className="text-xs text-destructive">{error}</p>
                  ))}
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCsvImportResult(null)}
                className="w-full mt-2"
              >
                Dismiss
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Custom Roles & Permissions
          </CardTitle>
          <CardDescription>Define role-based access control for your organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEditingRole ? (
            <div className="space-y-3">
              <Button onClick={() => setIsEditingRole(true)} className="gap-2 w-full">
                <Plus className="h-4 w-4" /> Create new role
              </Button>
              {customRoles.length > 0 ? (
                <div className="space-y-2">
                  {customRoles.map(role => (
                    <div key={role.id} className="flex items-start justify-between rounded-lg border border-border bg-muted/30 p-3">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{role.name}</p>
                        <p className="text-xs text-muted-foreground">{role.permissions.length} permissions</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => {setEditingRoleId(role.id); setRoleForm(role); setIsEditingRole(true)}}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDeleteRole(role.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No custom roles created yet.</p>
              )}
            </div>
          ) : (
            <form onSubmit={(e) => {e.preventDefault(); handleSaveCustomRole()}} className="space-y-3 p-3 rounded-lg border border-primary/40 bg-primary/5">
              <p className="font-medium text-sm">{editingRoleId ? "Edit" : "New"} role</p>
              <div className="space-y-2">
                <Label htmlFor="roleName">Role name</Label>
                <Input
                  id="roleName"
                  placeholder="e.g. Data Analyst"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm(prev => ({...prev, name: e.target.value}))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="max-h-[150px] space-y-2 overflow-y-auto rounded-md border border-border bg-background p-2">
                  {allPermissions.map(perm => (
                    <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={roleForm.permissions.includes(perm.permission)} onChange={(e) => {
                        setRoleForm(prev => ({
                          ...prev,
                          permissions: e.target.checked ?
                            [...prev.permissions, perm.permission] :
                            prev.permissions.filter(p => p !== perm.permission)
                        }))
                      }} className="w-4 h-4" />
                      <span className="text-sm">{perm.permission}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => {setIsEditingRole(false); setEditingRoleId(null)}}>Cancel</Button>
                <Button type="submit" size="sm">Save role</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> User Activity Tracker
          </CardTitle>
          <CardDescription>Monitor user actions and access patterns across the system.</CardDescription>
        </CardHeader>
        <CardContent>
          {isActivityLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {userActivities.map(activity => (
                <div key={activity.id} className="flex items-start justify-between rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{activity.userName}</p>
                    <p className="text-xs text-muted-foreground">{activity.action} • {activity.resource}</p>
                    <p className="text-xs text-muted-foreground mt-1">{activity.timestamp} • {activity.ipAddress}</p>
                  </div>
                  <Badge variant={activity.status === "success" ? "secondary" : "destructive"}>
                    {activity.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const renderVaccines = () => (
    <div className="space-y-6">
      <Card ref={vaccineFormPanelRef} className="border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" /> Add New Vaccine Type
          </CardTitle>
          <CardDescription>
            Register a new vaccine type in the national system (e.g., for new diseases or vaccine formulations).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddVaccine} className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="vaccineName">Vaccine name</Label>
              <Input
                id="vaccineName"
                placeholder="e.g. IPV-1"
                value={vaccineForm.name}
                onChange={(event) => setVaccineForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vaccineSchedule">Schedule descriptor</Label>
              <Input
                id="vaccineSchedule"
                placeholder="e.g. 10 weeks"
                value={vaccineForm.schedule}
                onChange={(event) => setVaccineForm((prev) => ({ ...prev, schedule: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vaccineDays">Due in days</Label>
              <Input
                id="vaccineDays"
                type="number"
                min={0}
                placeholder="e.g. 70"
                value={vaccineForm.dueDays}
                onChange={(event) => setVaccineForm((prev) => ({ ...prev, dueDays: event.target.value }))}
                required
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" className="gap-2">
                <CheckCircle2 className="h-4 w-4" /> Add vaccine to schedule
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>National Vaccination Catalogue</CardTitle>
          <CardDescription>Vaccine types and timing configured for the national immunization program.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isVaccinesLoading ? (
            // Loading skeleton
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="rounded-lg border border-border bg-background p-4 animate-pulse">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="h-5 bg-muted rounded w-1/3"></div>
                      <div className="h-4 bg-muted rounded w-1/4"></div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="h-6 bg-muted rounded w-36"></div>
                      <div className="h-6 bg-muted rounded w-16"></div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <div className="h-8 bg-muted rounded w-24"></div>
                    <div className="h-8 bg-muted rounded w-20"></div>
                  </div>
                </div>
              ))}
            </>
          ) : vaccines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No vaccines configured yet.</p>
              <p className="text-sm">Add your first vaccine type using the form above.</p>
            </div>
          ) : (
            vaccines.map((vaccine) => {
              const isArchived = vaccine.status === "archived"
              return (
                <div key={vaccine.id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-base font-semibold text-foreground">{vaccine.name}</p>
                      <p className="text-sm text-muted-foreground">{vaccine.schedule}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">Due {vaccine.dueDays} days post birth</Badge>
                      <Badge variant={isArchived ? "outline" : "secondary"}>{isArchived ? "Archived" : "Active"}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleVaccineEdit(vaccine)}>
                      Edit timing
                    </Button>
                    <Button
                      size="sm"
                      variant={isArchived ? "ghost" : "outline"}
                      onClick={() => handleVaccineArchiveToggle(vaccine.id)}
                      disabled={archivingVaccineId === vaccine.id}
                    >
                      {archivingVaccineId === vaccine.id ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" /> {isArchived ? "Restoring..." : "Archiving..."}
                        </>
                      ) : (
                        <>{isArchived ? "Restore" : "Archive"}</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleVaccineDelete(vaccine)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {isVaccineEditModalOpen && editingVaccine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader className="flex flex-row items-center justify-between border-b">
              <div>
                <CardTitle>Edit Timing</CardTitle>
                <CardDescription>{editingVaccine.name}</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsVaccineEditModalOpen(false)
                  setEditingVaccine(null)
                }}
                disabled={isVaccineSaving}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="space-y-2">
                <Label htmlFor="edit-schedule">Schedule Name</Label>
                <Input
                  id="edit-schedule"
                  placeholder="e.g. 9 months"
                  value={vaccineEditForm.schedule}
                  onChange={(e) => setVaccineEditForm((prev) => ({ ...prev, schedule: e.target.value }))}
                  disabled={isVaccineSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-due-days">Due Days (from birth)</Label>
                <Input
                  id="edit-due-days"
                  type="number"
                  placeholder="e.g. 270"
                  value={vaccineEditForm.dueDays}
                  onChange={(e) => setVaccineEditForm((prev) => ({ ...prev, dueDays: e.target.value }))}
                  disabled={isVaccineSaving}
                />
                <p className="text-xs text-muted-foreground">
                  Current: {editingVaccine.dueDays} days ({Math.round(editingVaccine.dueDays / 30)} months)
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsVaccineEditModalOpen(false)
                    setEditingVaccine(null)
                  }}
                  disabled={isVaccineSaving}
                >
                  Cancel
                </Button>
                <Button onClick={handleVaccineEditSave} disabled={isVaccineSaving}>
                  {isVaccineSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && vaccineToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <CardTitle className="text-lg">Delete Vaccine</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    This action cannot be undone
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-800 dark:text-red-200">
                  Are you sure you want to permanently delete <span className="font-semibold">"{vaccineToDelete.name}"</span>?
                </p>
                <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                  This will remove the vaccine from all schedules and cannot be undone.
                </p>
              </div>
              {deleteError && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Cannot Delete Vaccine
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        {deleteError}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDeleteModalOpen(false)
                    setVaccineToDelete(null)
                    setDeleteError(null)
                  }}
                  disabled={isVaccineDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmVaccineDelete}
                  disabled={isVaccineDeleting}
                >
                  {isVaccineDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 mr-2" /> Delete Permanently
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-primary" /> Vaccine Inventory Management
              </CardTitle>
              <CardDescription>Track stock levels and manage reorder points.</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={loadVaccineInventory} disabled={isInventoryLoading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isInventoryLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isInventoryLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Vaccine</th>
                      <th className="px-4 py-2 text-center font-medium">Quantity</th>
                      <th className="px-4 py-2 text-center font-medium">Reorder Level</th>
                      <th className="px-4 py-2 text-center font-medium">Days to Expiry</th>
                      <th className="px-4 py-2 text-center font-medium">Status</th>
                      <th className="px-4 py-2 text-center font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vaccineInventory.map(stock => {
                      const isLowStock = stock.quantity < stock.reorderLevel
                      const isExpiringSoon = stock.daysUntilExpiry < 60
                      return (
                        <tr key={stock.id} className={`border-b border-border hover:bg-muted/30 transition ${isExpiringSoon ? "bg-amber-50 dark:bg-amber-900/20" : isLowStock ? "bg-red-50 dark:bg-red-900/20" : ""}`}>
                          <td className="px-4 py-3 font-medium">{stock.name}</td>
                          <td className="px-4 py-3 text-center">{stock.quantity}</td>
                          <td className="px-4 py-3 text-center">{stock.reorderLevel}</td>
                          <td className="px-4 py-3 text-center">{stock.daysUntilExpiry}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={isExpiringSoon ? "destructive" : isLowStock ? "secondary" : "outline"}>
                              {isExpiringSoon ? "Expiring Soon" : isLowStock ? "Low Stock" : "In Stock"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button size="sm" variant="ghost" onClick={() => {setEditingVaccineId(stock.id); setVaccineReorderForm({reorderLevel: stock.reorderLevel, supplier: stock.supplier})}}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {editingVaccineId && (
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-3">
                  <p className="font-medium text-sm">Edit vaccine configuration</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="reorderLevel">Reorder level</Label>
                      <Input
                        id="reorderLevel"
                        type="number"
                        value={vaccineReorderForm.reorderLevel}
                        onChange={(e) => setVaccineReorderForm(prev => ({...prev, reorderLevel: parseInt(e.target.value)}))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="supplier">Supplier</Label>
                      <Input
                        id="supplier"
                        value={vaccineReorderForm.supplier}
                        onChange={(e) => setVaccineReorderForm(prev => ({...prev, supplier: e.target.value}))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingVaccineId(null)}>Cancel</Button>
                    <Button size="sm" onClick={() => updateVaccineStock(editingVaccineId)}>Save</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const renderAnalytics = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Coverage Report</CardTitle>
          <CardDescription>Filter by region, branch, and reporting window.</CardDescription>
          {isUsingAnalyticsFallback ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Live analytics is temporarily unavailable. Showing fallback trend data.
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={analyticsFilters.region}
              onChange={(event) => setAnalyticsFilters((previous) => ({ ...previous, region: event.target.value }))}
            >
              <option>All regions</option>
              <option>Greater Accra</option>
              <option>Ashanti</option>
              <option>Northern</option>
            </select>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={analyticsFilters.branch}
              onChange={(event) => setAnalyticsFilters((previous) => ({ ...previous, branch: event.target.value }))}
            >
              <option>All branches</option>
              {branches.map((branch) => (
                <option key={branch.id}>{branch.name}</option>
              ))}
            </select>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={analyticsFilters.window}
              onChange={(event) => setAnalyticsFilters((previous) => ({ ...previous, window: event.target.value }))}
            >
              <option>Last 6 months</option>
              <option>Last 12 months</option>
              <option>Custom range</option>
            </select>
          </div>
          <div className="h-[300px]">
            {isAnalyticsLoading ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
                Loading filtered analytics...
              </div>
            ) : analyticsTrendData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-4 text-center text-sm text-muted-foreground">
                No coverage data found for the selected filters.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="measles" fill="#2563eb" name="Measles" />
                  <Bar dataKey="dpt3" fill="#10b981" name="DPT-3" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={handleCoverageExport} disabled={isAnalyticsLoading}>
              <ArrowDownToLine className="h-4 w-4" /> Export coverage report (CSV)
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleCoveragePdfExport} disabled={isAnalyticsLoading}>
              <ArrowDownToLine className="h-4 w-4" /> Export coverage report (PDF)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dropout Rate & CHW Performance</CardTitle>
          <CardDescription>Monitor programme gaps and frontline productivity.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="h-[260px]">
            {isAnalyticsLoading || analyticsTrendData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
                {isAnalyticsLoading ? "Loading trend..." : "No dropout trend data for selected filters."}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analyticsTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="measles" stroke="#f59e0b" fill="#fbbf24" name="Measles" />
                  <Area type="monotone" dataKey="dpt3" stroke="#ef4444" fill="#f87171" name="DPT-3" />
                </AreaChart>
              </ResponsiveContainer>
            )}
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Dropout spikes indicate follow-up campaigns needed.
            </p>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chwProductivityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="registrations" fill="#2563eb" name="Registrations" />
                <Bar dataKey="visits" fill="#10b981" name="Visits logged" />
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Productivity trending upward after refresher training.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe2 className="h-5 w-5 text-primary" /> Advanced Analytics
          </CardTitle>
          <CardDescription>Deep-dive insights into immunization patterns and program performance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="chartType">Analysis type</Label>
            <select
              id="chartType"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={selectedChartType}
              onChange={(e) => setSelectedChartType(e.target.value)}
            >
              <option value="cohort">Immunization Cohort Analysis</option>
              <option value="dropout">Dropout Prevention Timeline</option>
              <option value="supply">Supply Chain Optimization</option>
              <option value="equity">Equity & Coverage Disparity</option>
            </select>
          </div>

          {selectedChartType === "cohort" && (
            <div className="space-y-2">
              <p className="font-medium text-sm">Cohort Performance 2024</p>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left">Cohort</th>
                      <th className="px-3 py-2 text-center">On-Time %</th>
                      <th className="px-3 py-2 text-center">Delayed %</th>
                      <th className="px-3 py-2 text-center">Defaulted %</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border hover:bg-muted/50">
                      <td className="px-3 py-2">Jan 2024</td>
                      <td className="px-3 py-2 text-center text-emerald-600">92%</td>
                      <td className="px-3 py-2 text-center text-amber-600">6%</td>
                      <td className="px-3 py-2 text-center text-red-600">2%</td>
                    </tr>
                    <tr className="border-b border-border hover:bg-muted/50">
                      <td className="px-3 py-2">Feb 2024</td>
                      <td className="px-3 py-2 text-center text-emerald-600">94%</td>
                      <td className="px-3 py-2 text-center text-amber-600">4%</td>
                      <td className="px-3 py-2 text-center text-red-600">2%</td>
                    </tr>
                    <tr className="border-b border-border hover:bg-muted/50">
                      <td className="px-3 py-2">Mar 2024</td>
                      <td className="px-3 py-2 text-center text-emerald-600">91%</td>
                      <td className="px-3 py-2 text-center text-amber-600">7%</td>
                      <td className="px-3 py-2 text-center text-red-600">2%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedChartType === "dropout" && (
            <div className="rounded-lg border border-border bg-amber-50 dark:bg-amber-900/20 p-4 text-sm">
              <p className="font-medium mb-2">Dropout Risk Indicators</p>
              <ul className="space-y-2 text-muted-foreground">
                <li>• DPT-3 dropout rates peaked at 8% in Q2 (seasonal pattern)</li>
                <li>• Remote areas show 15% higher default rates</li>
                <li>• SMS reminders reduce dropout by 23%</li>
                <li>• CHW follow-up effectiveness: 89% recall rate</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const renderNotifications = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Notification Templates</CardTitle>
          <CardDescription>Edit SMS and email content sent to guardians and staff.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[240px,1fr]">
            <div className="space-y-2">
              <Label htmlFor="templateSelect">Select template</Label>
              <select
                id="templateSelect"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={activeTemplateId}
                onChange={(event) => setActiveTemplateId(event.target.value)}
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
              {activeTemplate ? (
                <p className="text-xs text-muted-foreground">{activeTemplate.description}</p>
              ) : null}
            </div>
            {activeTemplate ? (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="previewChannel">Preview channel</Label>
                  <select
                    id="previewChannel"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm md:w-56"
                    value={previewChannel}
                    onChange={(event) => setPreviewChannel(event.target.value as PreviewChannel)}
                  >
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Tokens supported: {"{guardianName}"}, {"{childName}"}, {"{vaccineName}"}, {"{scheduledDate}"}, {"{facilityName}"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smsContent">SMS content</Label>
                  <textarea
                    id="smsContent"
                    className="w-full min-h-[120px] rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={activeTemplate.sms}
                    onChange={(event) =>
                      setTemplates((previous) =>
                        previous.map((template) =>
                          template.id === activeTemplate.id ? { ...template, sms: event.target.value } : template,
                        ),
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailContent">Email HTML content</Label>
                  <textarea
                    id="emailContent"
                    className="w-full min-h-[160px] rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                    value={activeTemplate.email}
                    onChange={(event) =>
                      setTemplates((previous) =>
                        previous.map((template) =>
                          template.id === activeTemplate.id ? { ...template, email: event.target.value } : template,
                        ),
                      )
                    }
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" className="gap-2" onClick={handleTemplatePreview}>
                    <ListChecks className="h-4 w-4" /> Preview delivery
                  </Button>
                  <Button type="button" onClick={handleTemplateUpdate} className="gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Save template
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
                Select a template to edit SMS and email content.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-2xl">
            <CardHeader className="flex flex-row items-center justify-between border-b">
              <div>
                <CardTitle>Preview: {activeTemplate?.label}</CardTitle>
                <CardDescription>Channel: {previewChannel.toUpperCase()}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsPreviewModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {previewChannel === "sms" ? (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-foreground mb-2">SMS Preview</p>
                  <div className="bg-background p-4 rounded border border-border">
                    <p className="text-sm whitespace-pre-wrap">{templatePreview}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-foreground mb-2">Email Preview</p>
                  <div className="bg-background p-4 rounded border border-border max-h-96 overflow-auto">
                    <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(templatePreview) }} />
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsPreviewModalOpen(false)}>
                  Close
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(templatePreview)
                      setSystemMessage("Preview copied to clipboard.")
                    } catch (error) {
                      console.error("Failed to copy preview", error)
                      setSystemMessage("Could not copy preview.")
                    }
                  }}
                >
                  Copy preview
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-primary" /> Notification Delivery Status
              </CardTitle>
              <CardDescription>Monitor SMS and email delivery success rates.</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={loadNotificationDeliveries} disabled={isNotifLoading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isNotifLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              {(["all", "sent", "failed", "pending"] as const).map(status => (
                <Button
                  key={status}
                  variant={notifStatusFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNotifStatusFilter(status)}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>

            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-left">Recipient</th>
                    <th className="px-4 py-2 text-center">Channel</th>
                    <th className="px-4 py-2 text-center">Type</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-center">Time</th>
                    <th className="px-4 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {notificationDeliveries
                    .filter(n => notifStatusFilter === "all" || n.status === notifStatusFilter)
                    .map(notif => (
                    <tr key={notif.id} className={`border-b border-border hover:bg-muted/30 transition ${notif.status === "failed" ? "bg-red-50 dark:bg-red-900/20" : ""}`}>
                      <td className="px-4 py-3">{notif.recipient}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline">{notif.channel.toUpperCase()}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-sm">{notif.messageType}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={notif.status === "sent" ? "secondary" : notif.status === "failed" ? "destructive" : "outline"}>
                          {notif.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-muted-foreground">{notif.sentAt}</td>
                      <td className="px-4 py-3 text-center">
                        {notif.status === "failed" && (
                          <Button size="sm" variant="ghost" onClick={() => retryFailedNotificationHandler(notif.id)}>
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-2 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Total Sent</p>
                <p className="text-xl font-bold text-emerald-600">{notificationDeliveries.filter(n => n.status === "sent").length}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-xl font-bold text-destructive">{notificationDeliveries.filter(n => n.status === "failed").length}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-xl font-bold text-amber-600">{notificationDeliveries.filter(n => n.status === "pending").length}</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Success Rate</p>
                <p className="text-xl font-bold text-primary">
                  {notificationDeliveries.length > 0 ? 
                    Math.round((notificationDeliveries.filter(n => n.status === "sent").length / notificationDeliveries.length) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const renderSystem = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-primary" /> System Audit Log
              </CardTitle>
              <CardDescription>Recent critical actions — tap an entry to view full details.</CardDescription>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={exportAuditLogCSV}>
                <ArrowDownToLine className="h-4 w-4" /> CSV
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={exportAuditLogPDF}>
                <ArrowDownToLine className="h-4 w-4" /> PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {enrichedAuditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No audit log entries yet.</p>
          ) : (
            enrichedAuditLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="rounded-lg border border-border bg-background p-4 hover:bg-muted/40 transition-colors">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">{log.category}</Badge>
                    {log.entityType && (
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{log.entityType}</Badge>
                    )}
                  </div>
                  <time className="text-[11px] tabular-nums text-muted-foreground">{log.timestamp}</time>
                </div>
                <p className="mt-2 text-sm font-semibold text-foreground leading-snug">{log.action}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UsersIcon className="h-3 w-3 shrink-0" />
                    {log.actorName ?? log.actor}
                  </span>
                  {log.actorRole && (
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      {log.actorRole}
                    </Badge>
                  )}
                  {log.ipAddress && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                      <Globe2 className="h-3 w-3 shrink-0" />
                      {log.ipAddress}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
          {enrichedAuditLogs.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 mt-1"
              onClick={() => window.open("/hq/audit-log", "_self")}
            >
              <FileText className="h-4 w-4" />
              View full audit log ({enrichedAuditLogs.length}+ entries)
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle>Backup Management</CardTitle>
          <CardDescription>Trigger or download encrypted backups of the full system.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            Last successful backup completed <span className="font-medium text-foreground">2 hours ago</span>. Secure vault storage available for manual download.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={handleBackupDownload}>
              <ArrowDownToLine className="h-4 w-4" /> Download latest backup
            </Button>
            <Button className="gap-2" onClick={handleBackup}>
              <ShieldCheck className="h-4 w-4" /> Trigger new backup
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Backup Schedule & Retention
          </CardTitle>
          <CardDescription>Configure automated backup policies for data protection.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="backupFreq">Backup frequency</Label>
              <select
                id="backupFreq"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={backupSchedule}
                onChange={(e) => setBackupSchedule(e.target.value as "daily" | "weekly" | "monthly")}
              >
                <option value="daily">Every 24 hours</option>
                <option value="weekly">Weekly (Sunday 2 AM)</option>
                <option value="monthly">Monthly (1st of month)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="retentionDays">Retention period (days)</Label>
              <Input
                id="retentionDays"
                type="number"
                value={retentionDays}
                onChange={(e) => setRetentionDays(parseInt(e.target.value))}
                min={7}
                max={365}
              />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-sm text-muted-foreground">
              <strong>Policy:</strong> Backups will be retained for {retentionDays} days, older backups will be automatically deleted. Schedule: {backupSchedule}.
            </p>
          </div>
          <Button onClick={configureBackupSchedule} disabled={isSchedulingBackup} className="gap-2 w-full">
            {isSchedulingBackup ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving schedule...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" /> Save backup configuration
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  const renderContent = () => {
    switch (activeSection) {
      case "overview":
        return renderOverview()
      case "branches":
        return renderBranches()
      case "users":
        return renderUsers()
      case "vaccines":
        return renderVaccines()
      case "analytics":
        return renderAnalytics()
      case "notifications":
        return renderNotifications()
      case "system":
        return renderSystem()
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
              <p className="text-sm text-muted-foreground">HQ Administration Console</p>
              <p className="text-xl font-semibold text-foreground">Child Vaccination Command Center</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="flex flex-col items-end">
              <span className="text-sm text-muted-foreground">Welcome, {userName}</span>
              <span className="text-xs text-muted-foreground/80">Role: HQ Admin</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2" disabled={isLoggingOut}>
              {isLoggingOut ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Logging out...
                </>
              ) : (
                "Logout"
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="lg:w-72">
            <div className="rounded-xl border border-border bg-background/80 shadow-sm lg:sticky lg:top-24">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Command Modules</p>
                <p className="text-xs text-muted-foreground">Switch between HQ workflows.</p>
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
            {renderContent()}
          </section>
        </div>
      </main>

      {systemMessage ? (
        <div className="pointer-events-none fixed bottom-5 right-5 z-[70] w-full max-w-sm">
          <div
            role="status"
            aria-live="polite"
            className={`pointer-events-auto rounded-xl border bg-background/95 px-4 py-3 text-foreground shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/90 ${
              messageTone === "success"
                ? "border-emerald-500/50"
                : messageTone === "warning"
                ? "border-amber-500/50"
                : "border-red-500/50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 ${
                  messageTone === "success"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : messageTone === "warning"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {messageTone === "success" ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : messageTone === "warning" ? (
                  <ShieldAlert className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1">
                <p
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    messageTone === "success"
                      ? "text-emerald-700 dark:text-emerald-300"
                      : messageTone === "warning"
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-red-700 dark:text-red-300"
                  }`}
                >
                  {messageTone === "success"
                    ? "Succesfull"
                    : messageTone === "warning"
                    ? "Needs Attention"
                    : "Action Failed"}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-foreground/90">{systemMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => setSystemMessage(null)}
                className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
