"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  Activity,
  ArrowDownToLine,
  BellRing,
  Building2,
  CheckCircle2,
  FileText,
  Gauge,
  Globe2,
  Layers,
  ListChecks,
  MapPinned,
  Megaphone,
  ServerCog,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
  Users as UsersIcon,
} from "lucide-react"
import { ResponsiveContainer, RadialBarChart, RadialBar, Legend, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LineChart, Line, AreaChart, Area } from "recharts"

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
} from "@/lib/api/hq-branches"
import {
  createHqUser,
  getHqUsers,
  resetHqUserPassword,
  updateHqUser,
  updateHqUserStatus,
} from "@/lib/api/hq-users"
import { getHqAnalytics } from "@/lib/api/hq-analytics"

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

type SystemStatus = {
  id: string
  name: string
  status: "operational" | "degraded" | "offline"
  detail: string
}

type AuditLog = {
  id: string
  actor: string
  action: string
  timestamp: string
  category: string
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

const initialBranches: Branch[] = [
  {
    id: "BR-001",
    name: "Accra Central Hospital",
    region: "Greater Accra",
    manager: "Yaa Boakye",
    catchmentAreas: ["Adabraka", "Osu", "Jamestown"],
    status: "active",
    assignedChws: ["Mabel Owusu", "Kwesi Antwi"],
  },
  {
    id: "BR-014",
    name: "Tamale Teaching Hospital",
    region: "Northern",
    manager: "Haruna Yakubu",
    catchmentAreas: ["Tamale Central", "Sagnarigu", "Kumbungu"],
    status: "active",
    assignedChws: ["Zeinab Yakubu", "Haruna Adam"],
  },
]

const initialUsers: UserRecord[] = [
  {
    id: "USR-101",
    name: "Akua Aidoo",
    email: "akua.aidoo@health.gov.gh",
    role: "Branch Manager",
    branch: "Accra Central Hospital",
    status: "active",
  },
  {
    id: "USR-207",
    name: "Kofi Antwi",
    email: "kofi.antwi@health.gov.gh",
    role: "Data Officer",
    branch: "Tamale Teaching Hospital",
    status: "active",
  },
  {
    id: "USR-309",
    name: "Akua Mensimah",
    email: "akua.mensimah@health.gov.gh",
    role: "HQ Admin",
    status: "active",
  },
]

const initialVaccines: VaccineConfig[] = [
  { id: "VAC-BCG", name: "BCG", schedule: "At birth", dueDays: 0, status: "active" },
  { id: "VAC-OPV1", name: "OPV-1", schedule: "6 weeks", dueDays: 42, status: "active" },
  { id: "VAC-DPT3", name: "DPT-3", schedule: "14 weeks", dueDays: 98, status: "active" },
]

const initialTemplates: NotificationTemplate[] = [
  {
    id: "pre_due",
    label: "Upcoming Dose Reminder",
    description: "Sent 3 days before a scheduled vaccination",
    sms: "Hello {guardianName}, {childName} is due for {vaccineName} on {scheduledDate}. Please visit {facilityName}.",
    email:
      "<p>Dear {guardianName},</p><p>This is a reminder that {childName} is due for {vaccineName} on {scheduledDate}.</p><p>Facility: {facilityName}</p>",
  },
  {
    id: "overdue",
    label: "Overdue Alert",
    description: "Sent when a vaccine is 3 days overdue",
    sms: "{childName} has missed the {vaccineName} dose scheduled for {scheduledDate}. Please contact {facilityName} immediately.",
    email:
      "<p>Dear {guardianName},</p><p>{childName} has missed the {vaccineName} dose scheduled for {scheduledDate}. Kindly reach out to {facilityName} to reschedule.</p>",
  },
  {
    id: "certificate",
    label: "Certificate Issued",
    description: "Sent when a child completes the national schedule",
    sms: "Congratulations! {childName}'s vaccination certificate is ready. Access it via the Parent Portal or visit {facilityName}.",
    email:
      "<p>Dear {guardianName},</p><p>Congratulations! {childName} has completed the national immunisation schedule. The digital certificate is now available.</p>",
  },
]

const initialSystemStatus: SystemStatus[] = [
  {
    id: "db",
    name: "Database",
    status: "operational",
    detail: "Primary cluster healthy · last backup 3h ago",
  },
  {
    id: "queue",
    name: "Redis / BullMQ",
    status: "operational",
    detail: "Job queue draining normally · avg latency 320ms",
  },
  {
    id: "messaging",
    name: "SMS & Email Gateway",
    status: "degraded",
    detail: "SMS delivery latency elevated (+1.2s)",
  },
]

const initialAuditLogs: AuditLog[] = [
  {
    id: "LOG-9921",
    actor: "Akua Mensimah",
    action: "Updated vaccine schedule for DPT-3",
    timestamp: "2025-11-09 18:42",
    category: "Schedule",
  },
  {
    id: "LOG-9918",
    actor: "Kofi Antwi",
    action: "Exported national dropout report (CSV)",
    timestamp: "2025-11-09 17:55",
    category: "Reporting",
  },
  {
    id: "LOG-9904",
    actor: "Akua Aidoo",
    action: "Created branch profile for Kasoa Polyclinic",
    timestamp: "2025-11-09 15:21",
    category: "Branch",
  },
]

const coverageGaugeData = [{ name: "Coverage", value: 86, fill: "#10b981" }]

const coverageTrendData = [
  { period: "Jan", measles: 78, dpt3: 72 },
  { period: "Feb", measles: 80, dpt3: 74 },
  { period: "Mar", measles: 82, dpt3: 76 },
  { period: "Apr", measles: 84, dpt3: 78 },
  { period: "May", measles: 85, dpt3: 79 },
  { period: "Jun", measles: 86, dpt3: 81 },
]

const chwProductivityData = [
  { label: "Week 1", registrations: 432, visits: 318 },
  { label: "Week 2", registrations: 489, visits: 362 },
  { label: "Week 3", registrations: 501, visits: 344 },
  { label: "Week 4", registrations: 476, visits: 388 },
]

const aefiFeed = [
  {
    id: "AEFI-221",
    child: "Esi Asare",
    vaccine: "DPT-2",
    branch: "Tema Polyclinic",
    reportedAt: "5 mins ago",
    priority: "High",
  },
  {
    id: "AEFI-219",
    child: "Yaw Mensah",
    vaccine: "MMR",
    branch: "Kumasi South",
    reportedAt: "28 mins ago",
    priority: "High",
  },
  {
    id: "AEFI-214",
    child: "Abena Koomson",
    vaccine: "BCG",
    branch: "Bolga Regional",
    reportedAt: "1 hr ago",
    priority: "Medium",
  },
]

const pendingSyncDevices = [
  { id: "CHW-045", name: "Mabel Owusu", branch: "Ho Municipal", lastSync: "3 hours ago", pending: 14 },
  { id: "CHW-112", name: "Kwesi Adjei", branch: "Sekondi Takoradi", lastSync: "6 hours ago", pending: 29 },
  { id: "CHW-304", name: "Zeinab Yakubu", branch: "Wa Central", lastSync: "22 hours ago", pending: 8 },
]

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
    "Data Officer": "data-officer",
    "Public Health Authority": "pha",
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

  const [templates, setTemplates] = useState(initialTemplates)
  const [activeTemplateId, setActiveTemplateId] = useState(initialTemplates[0]?.id ?? "")
  const [previewChannel, setPreviewChannel] = useState<PreviewChannel>("sms")
  const [templatePreview, setTemplatePreview] = useState<string>("")

  const [systemStatus, setSystemStatus] = useState(initialSystemStatus)
  const [auditLogs, setAuditLogs] = useState(initialAuditLogs)
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [activeChwBranchId, setActiveChwBranchId] = useState<string | null>(null)
  const [chwFormNames, setChwFormNames] = useState("")
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([])
  const [userResetStatusById, setUserResetStatusById] = useState<
    Record<string, { status: "sent" | "failed"; detail: string; time: string }>
  >({})
  const [, setUserActionNotice] = useState<
    { tone: "success" | "warning" | "destructive"; title: string; detail: string } | null
  >(null)
  const branchEditPanelRef = useRef<HTMLDivElement | null>(null)
  const userFormPanelRef = useRef<HTMLDivElement | null>(null)
  const vaccineFormPanelRef = useRef<HTMLDivElement | null>(null)
  const chwAssignmentPanelRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    if (activeSection !== "analytics") return

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
  }, [activeSection, analyticsFilters.branch, analyticsFilters.region, analyticsFilters.window])

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
  }, [activeSection])

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

  const handleLogout = () => {
    localStorage.removeItem("accessToken")
    localStorage.removeItem("authToken")
    localStorage.removeItem("userRole")
    localStorage.removeItem("userRoleDetail")
    localStorage.removeItem("userName")
    sessionStorage.removeItem("userName")
    router.push("/")
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
    setChwFormNames(branch.assignedChws.join(", "))
    setSystemMessage(`Managing CHW assignment for ${branch.name}.`)

    window.setTimeout(() => {
      chwAssignmentPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 80)
  }

  const cancelChwAssignment = () => {
    setActiveChwBranchId(null)
    setChwFormNames("")
  }

  const handleChwAssignmentSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeChwBranchId) return

    const normalized = normalizeCommaSeparatedValues(chwFormNames)
    const targetBranch = branches.find((branch) => branch.id === activeChwBranchId)

    try {
      const updatedBranch = await updateHqBranchChws(activeChwBranchId, normalized)
      setBranches((previous) => previous.map((branch) => (branch.id === updatedBranch.id ? updatedBranch : branch)))
      setSystemMessage(`Assigned ${normalized.length} CHW${normalized.length === 1 ? "" : "s"} to ${updatedBranch.name}.`)
      appendAuditLog({ action: `Updated CHW assignment for ${updatedBranch.name}`, category: "Branch" })
    } catch (error) {
      console.error("Failed to update CHW assignment", error)

      if (targetBranch) {
        setBranches((previous) =>
          previous.map((branch) =>
            branch.id === targetBranch.id
              ? { ...branch, assignedChws: normalized }
              : branch,
          ),
        )

        setSystemMessage(
          `Assigned ${normalized.length} CHW${normalized.length === 1 ? "" : "s"} to ${targetBranch.name} (saved locally).`,
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
      }
    } catch (error) {
      console.error("Failed to save branch", error)
      setSystemMessage("Could not save branch details. Please try again.")
      return
    }

    setBranchForm({ name: "", region: "", manager: "", catchmentAreas: "" })
    setEditingBranchId(null)
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

  const handleAddVaccine = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsedDays = Number.parseInt(vaccineForm.dueDays, 10)
    if (!vaccineForm.name.trim() || Number.isNaN(parsedDays)) return

    if (editingVaccineId) {
      let updatedName = ""

      setVaccines((previous) =>
        previous.map((vaccine) => {
          if (vaccine.id !== editingVaccineId) return vaccine
          updatedName = vaccineForm.name.trim()
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

    const nextVaccine: VaccineConfig = {
      id: `VAC-${Math.floor(Math.random() * 900 + 100)}`,
      name: vaccineForm.name.trim(),
      schedule: vaccineForm.schedule.trim() || "Custom schedule",
      dueDays: parsedDays,
      status: "active",
    }

    setVaccines((previous) => [nextVaccine, ...previous])
    setVaccineForm({ name: "", schedule: "", dueDays: "" })
    setSystemMessage(`Vaccine "${nextVaccine.name}" added to master list.`)
    appendAuditLog({ action: `Added vaccine ${nextVaccine.name} to master registry`, category: "Schedule" })
  }

  const handleTemplateUpdate = () => {
    if (!activeTemplate) return

    try {
      localStorage.setItem(HQ_NOTIFICATION_TEMPLATES_STORAGE_KEY, JSON.stringify(templates))
      setSystemMessage(`${activeTemplate.label} template saved.`)
      appendAuditLog({ action: `Updated notification template ${activeTemplate.label}`, category: "Notifications" })
    } catch (error) {
      console.error("Failed to persist notification template", error)
      setSystemMessage("Could not save template locally. Please try again.")
    }
  }

  const handleBackup = () => {
  setSystemMessage("Backup job queued. You'll receive an email when complete.")
    appendAuditLog({ action: "Triggered manual system backup", category: "System" })
  }

  const handleBackupDownload = () => {
    setSystemMessage("Encrypted backup download will start once backend endpoints are wired.")
    appendAuditLog({ action: "Requested latest backup download", category: "System" })
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

  const handleAuditExport = () => {
    setSystemMessage("Audit log export queued. Watch for the download notification.")
    appendAuditLog({ action: "Queued audit log export", category: "System" })
  }

  const handleTemplatePreview = () => {
    if (!activeTemplate) return

    const source = previewChannel === "sms" ? activeTemplate.sms : activeTemplate.email
    const compiled = compileTemplatePreview(source)

    setTemplatePreview(compiled)
    setSystemMessage(`Preview generated for ${activeTemplate.label} (${previewChannel.toUpperCase()}).`)
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
    setEditingVaccineId(vaccine.id)
    setVaccineForm({
      name: vaccine.name,
      schedule: vaccine.schedule,
      dueDays: String(vaccine.dueDays),
    })
    setSystemMessage(`Editing schedule for ${vaccine.name}.`)
    appendAuditLog({ action: `Opened schedule editor for ${vaccine.name}`, category: "Schedule" })

    window.setTimeout(() => {
      vaccineFormPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 80)
  }

  const handleVaccineArchiveToggle = (vaccineId: string) => {
    let targetName = ""
    let resultingStatus: VaccineConfig["status"] = "active"

    setVaccines((previous) =>
      previous.map((vaccine) => {
        if (vaccine.id !== vaccineId) return vaccine
        const nextStatus = vaccine.status === "active" ? "archived" : "active"
        targetName = vaccine.name
        resultingStatus = nextStatus
        return { ...vaccine, status: nextStatus }
      }),
    )

    if (targetName) {
      const action = resultingStatus === "active" ? "Restored" : "Archived"
      setSystemMessage(`Vaccine "${targetName}" ${resultingStatus === "active" ? "restored to" : "removed from"} the active schedule.`)
      appendAuditLog({ action: `${action} vaccine ${targetName}`, category: "Schedule" })
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
            <p className="text-3xl font-semibold">128</p>
            <p className="text-xs text-muted-foreground mt-1">+6 branches added this quarter</p>
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
            <p className="text-3xl font-semibold">9,842</p>
            <p className="text-xs text-muted-foreground mt-1">+412 activated last 30 days</p>
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
            <p className="text-3xl font-semibold">1,234,550</p>
            <p className="text-xs text-muted-foreground mt-1">+18,904 this month</p>
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
            <p className="text-3xl font-semibold">1,104</p>
            <p className="text-xs text-muted-foreground mt-1">82% of total CHWs synced so far today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,1.2fr]">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gauge className="h-5 w-5 text-primary" /> National Coverage Rate
            </CardTitle>
            <CardDescription>Percentage of children fully vaccinated for the national core schedule.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ResponsiveContainer width="100%" height={280}>
              <RadialBarChart innerRadius="60%" outerRadius="110%" data={coverageGaugeData} startAngle={90} endAngle={-270}>
                <RadialBar background cornerRadius={18} dataKey="value" />
                <Legend
                  iconSize={12}
                  layout="vertical"
                  verticalAlign="middle"
                  align="right"
                  formatter={() => "National coverage"}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <p className="mt-4 text-center text-sm text-muted-foreground">Target: 92% · Last month: 84%</p>
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
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={coverageTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis domain={[70, 90]} />
                <Tooltip />
                <Line type="monotone" dataKey="measles" stroke="#2563eb" strokeWidth={2} />
                <Line type="monotone" dataKey="dpt3" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
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
            {aefiFeed.map((item) => (
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
            ))}
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
            {pendingSyncDevices.map((device) => (
              <div key={device.id} className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground">{device.name}</span>
                  <Badge variant="secondary">{device.pending} forms</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{device.branch}</p>
                <p className="text-xs text-muted-foreground/80 mt-2">Last sync {device.lastSync}</p>
              </div>
            ))}
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
          <CardTitle>Branch Directory</CardTitle>
          <CardDescription>Review existing facilities and their assigned territories.</CardDescription>
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

      {activeChwBranch ? (
        <div ref={chwAssignmentPanelRef} className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-base font-semibold text-foreground">Assign Community Health Workers</p>
              <p className="text-sm text-muted-foreground">
                {activeChwBranch.name} • {activeChwBranch.region}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={cancelChwAssignment}>
              Close
            </Button>
          </div>
          <form className="mt-4 space-y-4" onSubmit={handleChwAssignmentSubmit}>
            <div className="space-y-2">
              <Label htmlFor="chwNames">CHW names (comma separated)</Label>
              <textarea
                id="chwNames"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                rows={4}
                value={chwFormNames}
                onChange={(event) => setChwFormNames(event.target.value)}
                placeholder="e.g. Akua Aidoo, Kofi Antwi"
              />
              <p className="text-xs text-muted-foreground">These names will appear in branch dashboards and sync rosters.</p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={cancelChwAssignment}>
                Cancel
              </Button>
              <Button type="submit" className="gap-2">
                <ListChecks className="h-4 w-4" /> Save assignments
              </Button>
            </div>
          </form>
        </div>
      ) : null}
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
                <option>Data Officer</option>
                <option>Community Health Worker</option>
                <option>Public Health Authority</option>
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
    </div>
  )

  const renderVaccines = () => (
    <div className="space-y-6">
      <Card ref={vaccineFormPanelRef} className="border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" /> {editingVaccineId ? "Edit Vaccine Schedule" : "Master Vaccine Registry"}
          </CardTitle>
          <CardDescription>
            {editingVaccineId
              ? "Update vaccine name and timing, then save changes."
              : "Centralise vaccine metadata before syncing to branches."}
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
            <div className="md:col-span-3 flex justify-end gap-2">
              {editingVaccineId ? (
                <Button type="button" variant="ghost" onClick={cancelVaccineEditing}>
                  Cancel edit
                </Button>
              ) : null}
              <Button type="submit" className="gap-2">
                <CheckCircle2 className="h-4 w-4" /> {editingVaccineId ? "Save schedule" : "Add vaccine to schedule"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>National Schedule Overview</CardTitle>
          <CardDescription>Active vaccines synchronised to branch systems.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {vaccines.map((vaccine) => {
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
                  >
                    {isArchived ? "Restore" : "Archive"}
                  </Button>
                </div>
              </div>
            )
          })}
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
                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">Live preview ({previewChannel.toUpperCase()})</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(templatePreview)
                          setSystemMessage("Preview copied to clipboard.")
                        } catch (error) {
                          console.error("Failed to copy preview", error)
                          setSystemMessage("Could not copy preview. Please copy it manually.")
                        }
                      }}
                    >
                      Copy preview
                    </Button>
                  </div>
                  <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-xs text-foreground">
                    {templatePreview || "Preview will appear here."}
                  </pre>
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
    </div>
  )

  const renderSystem = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>Monitor infrastructure health at a glance.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {systemStatus.map((service) => (
            <div key={service.id} className="rounded-lg border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ServerCog className="h-4 w-4 text-primary" /> {service.name}
              </p>
              <Badge
                className="mt-2"
                variant={service.status === "operational" ? "secondary" : service.status === "degraded" ? "outline" : "destructive"}
              >
                {service.status === "operational" ? "Operational" : service.status === "degraded" ? "Degraded" : "Offline"}
              </Badge>
              <p className="mt-2 text-xs text-muted-foreground">{service.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Audit Log</CardTitle>
          <CardDescription>Trace critical actions for accountability.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {auditLogs.map((log) => (
            <div key={log.id} className="rounded-lg border border-border bg-background p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{log.action}</p>
                  <p className="text-xs text-muted-foreground">By {log.actor}</p>
                </div>
                <Badge variant="outline">{log.category}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{log.timestamp}</p>
            </div>
          ))}
          <Button variant="outline" className="gap-2" onClick={handleAuditExport}>
            <ArrowDownToLine className="h-4 w-4" /> Export audit log
          </Button>
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
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
              Logout
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
