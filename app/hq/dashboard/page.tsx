"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
  Users as UsersIcon,
} from "lucide-react"
import { ResponsiveContainer, RadialBarChart, RadialBar, Legend, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LineChart, Line, AreaChart, Area } from "recharts"

import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

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
    name: "Ama Aidoo",
    email: "ama.aidoo@health.gov.gh",
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
    actor: "Ama Aidoo",
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
    child: "Ama Asare",
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

  const [vaccines, setVaccines] = useState(initialVaccines)
  const [vaccineForm, setVaccineForm] = useState({
    name: "",
    schedule: "",
    dueDays: "",
  })

  const [templates, setTemplates] = useState(initialTemplates)
  const [activeTemplateId, setActiveTemplateId] = useState(initialTemplates[0]?.id ?? "")

  const [systemStatus, setSystemStatus] = useState(initialSystemStatus)
  const [auditLogs, setAuditLogs] = useState(initialAuditLogs)
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [activeChwBranchId, setActiveChwBranchId] = useState<string | null>(null)
  const [chwFormNames, setChwFormNames] = useState("")
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([])

  useEffect(() => {
    const token = localStorage.getItem("authToken")
    const role = localStorage.getItem("userRole")
    const detail = localStorage.getItem("userRoleDetail")
    const name = localStorage.getItem("userName")

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
  const activeChwBranch = useMemo(() => {
    if (!activeChwBranchId) return null
    return branches.find((branch) => branch.id === activeChwBranchId) ?? null
  }, [activeChwBranchId, branches])

  const handleLogout = () => {
    localStorage.removeItem("authToken")
    localStorage.removeItem("userRole")
    localStorage.removeItem("userRoleDetail")
    localStorage.removeItem("userName")
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
  }

  const cancelBranchEditing = () => {
    setEditingBranchId(null)
    setBranchForm({ name: "", region: "", manager: "", catchmentAreas: "" })
  }

  const toggleBranchStatus = (branchId: string) => {
    let targetName = ""
    let resultingStatus: Branch["status"] = "active"

    setBranches((previous) =>
      previous.map((branch) => {
        if (branch.id !== branchId) return branch
        const nextStatus = branch.status === "active" ? "inactive" : "active"
        targetName = branch.name
        resultingStatus = nextStatus
        return { ...branch, status: nextStatus }
      }),
    )

    if (targetName) {
      setSystemMessage(`Branch “${targetName}” ${resultingStatus === "active" ? "re-activated" : "deactivated"}.`)
    }

    cancelBranchEditing()
    cancelChwAssignment()
  }

  const startChwAssignment = (branch: Branch) => {
    cancelBranchEditing()
    setActiveChwBranchId(branch.id)
    setChwFormNames(branch.assignedChws.join(", "))
  }

  const cancelChwAssignment = () => {
    setActiveChwBranchId(null)
    setChwFormNames("")
  }

  const handleChwAssignmentSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeChwBranchId) return

    const normalized = chwFormNames
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)

    let targetName = ""

    setBranches((previous) =>
      previous.map((branch) => {
        if (branch.id !== activeChwBranchId) return branch
        targetName = branch.name
        return { ...branch, assignedChws: normalized }
      }),
    )

    if (targetName) {
      setSystemMessage(`Assigned ${normalized.length} CHW${normalized.length === 1 ? "" : "s"} to ${targetName}.`)
    }

    cancelChwAssignment()
  }

  const handleBranchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!branchForm.name.trim() || !branchForm.region.trim()) return

    const normalizedCatchments = branchForm.catchmentAreas
      .split(",")
      .map((area) => area.trim())
      .filter(Boolean)

    if (editingBranchId) {
      setBranches((previous) =>
        previous.map((branch) =>
          branch.id === editingBranchId
            ? {
                ...branch,
                name: branchForm.name.trim(),
                region: branchForm.region.trim(),
                manager: branchForm.manager.trim() || "Unassigned",
                catchmentAreas: normalizedCatchments,
              }
            : branch,
        ),
      )
      setSystemMessage(`Branch “${branchForm.name.trim()}” updated.`)
    } else {
      const nextBranch: Branch = {
        id: `BR-${Math.floor(Math.random() * 900 + 100)}`,
        name: branchForm.name.trim(),
        region: branchForm.region.trim(),
        manager: branchForm.manager.trim() || "Unassigned",
        catchmentAreas: normalizedCatchments,
        status: "active",
        assignedChws: [],
      }
      setBranches((previous) => [nextBranch, ...previous])
      setSystemMessage(`Branch “${nextBranch.name}” registered.`)
    }

    setBranchForm({ name: "", region: "", manager: "", catchmentAreas: "" })
    setEditingBranchId(null)
  }

  const handleAddUser = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!userForm.name.trim() || !userForm.email.trim()) return

    const nextUser: UserRecord = {
      id: `USR-${Math.floor(Math.random() * 900 + 100)}`,
      name: userForm.name.trim(),
      email: userForm.email.trim().toLowerCase(),
      role: userForm.role,
      branch: userForm.branch.trim() || undefined,
      status: "active",
    }

    setUsers((previous) => [nextUser, ...previous])
    setUserForm({ name: "", email: "", role: "Branch Manager", branch: "" })
    setSystemMessage(`User “${nextUser.name}” created.`)
  }

  const handleAddVaccine = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsedDays = Number.parseInt(vaccineForm.dueDays, 10)
    if (!vaccineForm.name.trim() || Number.isNaN(parsedDays)) return

    const nextVaccine: VaccineConfig = {
      id: `VAC-${Math.floor(Math.random() * 900 + 100)}`,
      name: vaccineForm.name.trim(),
      schedule: vaccineForm.schedule.trim() || "Custom schedule",
      dueDays: parsedDays,
      status: "active",
    }

    setVaccines((previous) => [nextVaccine, ...previous])
    setVaccineForm({ name: "", schedule: "", dueDays: "" })
    setSystemMessage(`Vaccine “${nextVaccine.name}” added to master list.`)
  }

  const handleTemplateUpdate = () => {
    if (!activeTemplate) return
    setTemplates((previous) =>
      previous.map((template) =>
        template.id === activeTemplate.id
          ? {
              ...template,
              sms: activeTemplate.sms,
              email: activeTemplate.email,
            }
          : template,
      ),
    )
    setSystemMessage(`${activeTemplate.label} template saved.`)
  }

  const handleBackup = () => {
    setSystemMessage("Backup job queued. You’ll receive an email when complete.")
    setAuditLogs((previous) => [
      {
        id: `LOG-${Math.floor(Math.random() * 9000 + 1000)}`,
        actor: userName || "HQ Admin",
        action: "Triggered manual system backup",
        timestamp: new Date().toISOString().slice(0, 16).replace("T", " "),
        category: "System",
      },
      ...previous,
    ])
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
      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" /> Register New Branch
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
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
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
                placeholder="e.g. Ama Aidoo, Kofi Antwi"
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
      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UsersIcon className="h-5 w-5 text-primary" /> Create or Assign User
          </CardTitle>
          <CardDescription>Provision HQ, branch, and supervisory accounts.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddUser} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="userName">Full name</Label>
              <Input
                id="userName"
                placeholder="Ama Aidoo"
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
              >
                <option>Branch Manager</option>
                <option>Data Officer</option>
                <option>Community Health Worker</option>
                <option>Public Health Authority</option>
                <option>HQ Admin</option>
              </select>
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
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" className="gap-2">
                <Shield className="h-4 w-4" /> Provision user
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Users</CardTitle>
          <CardDescription>Search, review and manage nationwide accounts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {users.map((user) => (
            <div key={user.id} className="rounded-lg border border-border bg-background p-4">
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
                <Button size="sm" variant="outline">Reset password</Button>
                <Button size="sm" variant="outline">Edit roles</Button>
                <Button size="sm" variant="ghost" className="text-destructive">
                  {user.status === "active" ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )

  const renderVaccines = () => (
    <div className="space-y-6">
      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" /> Master Vaccine Registry
          </CardTitle>
          <CardDescription>Centralise vaccine metadata before syncing to branches.</CardDescription>
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
          <CardTitle>National Schedule Overview</CardTitle>
          <CardDescription>Active vaccines synchronised to branch systems.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {vaccines.map((vaccine) => (
            <div key={vaccine.id} className="rounded-lg border border-border bg-background p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-base font-semibold text-foreground">{vaccine.name}</p>
                  <p className="text-sm text-muted-foreground">{vaccine.schedule}</p>
                </div>
                <Badge variant="secondary">Due {vaccine.dueDays} days post birth</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline">Edit timing</Button>
                <Button size="sm" variant="outline">Archive</Button>
              </div>
            </div>
          ))}
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
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option>All regions</option>
              <option>Greater Accra</option>
              <option>Ashanti</option>
              <option>Northern</option>
            </select>
            <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option>All branches</option>
              {branches.map((branch) => (
                <option key={branch.id}>{branch.name}</option>
              ))}
            </select>
            <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
              <option>Last 6 months</option>
              <option>Last 12 months</option>
              <option>Custom range</option>
            </select>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={coverageTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="measles" fill="#2563eb" name="Measles" />
                <Bar dataKey="dpt3" fill="#10b981" name="DPT-3" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Button variant="outline" className="gap-2">
            <ArrowDownToLine className="h-4 w-4" /> Export coverage report (CSV)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dropout Rate & CHW Performance</CardTitle>
          <CardDescription>Monitor programme gaps and frontline productivity.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={coverageTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="measles" stroke="#f59e0b" fill="#fbbf24" name="Measles" />
                <Area type="monotone" dataKey="dpt3" stroke="#ef4444" fill="#f87171" name="DPT-3" />
              </AreaChart>
            </ResponsiveContainer>
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
                  <Button type="button" variant="outline" className="gap-2">
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
      {systemMessage ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{systemMessage}</AlertDescription>
        </Alert>
      ) : null}

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
          <Button variant="outline" className="gap-2">
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
            <Button variant="outline" className="gap-2">
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
            {systemMessage && activeSection !== "system" ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{systemMessage}</AlertDescription>
              </Alert>
            ) : null}
            {renderContent()}
          </section>
        </div>
      </main>
    </div>
  )
}
