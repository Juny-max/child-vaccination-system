"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
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
  MapPin,
  MessageSquareWarning,
  Radio,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react"
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
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

const SECTIONS = [
  { id: "overview", label: "Branch Overview", icon: Activity },
  { id: "actions", label: "Action Centre", icon: AlertTriangle },
  { id: "staff", label: "Staff Supervision", icon: Users },
  { id: "analytics", label: "Coverage Analytics", icon: BarChart3 },
  { id: "modules", label: "Key Modules", icon: ClipboardList },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

type StockAlert = {
  vaccine: string
  remaining: number
  status: "critical" | "low" | "healthy"
}

type AlertItem = {
  id: string
  child: string
  detail: string
  status?: string
  timestamp: string
  type?: string
}

type StaffMember = {
  id: string
  name: string
  role: "Nurse" | "CHW"
  catchment?: string
  lastActive: string
}

const kpiData = {
  childrenRegistered: 1842,
  vaccinationsToday: 96,
  chwsActiveToday: 14,
  pendingSyncs: 3,
}

const branchCoverage = [{ name: "Coverage", value: 84, fill: "#2563eb" }]

const coverageTrend = [
  { day: "Mon", measles: 80 },
  { day: "Tue", measles: 82 },
  { day: "Wed", measles: 83 },
  { day: "Thu", measles: 84 },
  { day: "Fri", measles: 84 },
  { day: "Sat", measles: 85 },
]

const stockAlerts: StockAlert[] = [
  { vaccine: "BCG", remaining: 18, status: "low" },
  { vaccine: "OPV-1", remaining: 6, status: "critical" },
  { vaccine: "MMR", remaining: 45, status: "healthy" },
]

const overdueVaccinations: AlertItem[] = [
  { id: "OV-112", child: "Demo Agyeman", detail: "DPT-3 overdue by 5 days", timestamp: "10 mins ago" },
  { id: "OV-108", child: "Yaw Mensah", detail: "Measles overdue by 2 days", timestamp: "25 mins ago" },
  { id: "OV-099", child: "Efua Arhin", detail: "OPV-3 overdue by 1 day", timestamp: "1 hr ago" },
]

const aefiEvents: AlertItem[] = [
  { id: "AEFI-52", child: "Kojo Sarfo", detail: "Fever and swelling reported", status: "Under review", timestamp: "15 mins ago" },
  { id: "AEFI-46", child: "Akosua Boateng", detail: "Rash observed post MMR", status: "New", timestamp: "44 mins ago" },
]

const syncErrors: AlertItem[] = [
  { id: "SYNC-21", child: "N/A", detail: "Data conflict on outreach form (CHW: Demo Aidoo)", timestamp: "12 mins ago" },
  { id: "SYNC-17", child: "N/A", detail: "Offline form failed to upload (CHW: Kwesi Antwi)", timestamp: "1 hr ago" },
]

const notificationFailures: AlertItem[] = [
  { id: "SMS-98", child: "Agnes Owusu", detail: "SMS reminder failed (invalid number)", timestamp: "18 mins ago" },
  { id: "EMAIL-21", child: "Baffour Mensah", detail: "Email bounced (mailbox full)", timestamp: "36 mins ago" },
]

const staffRoster: StaffMember[] = [
  { id: "STF-201", name: "Demo Aidoo", role: "Nurse", lastActive: "Today · 09:45" },
  { id: "STF-238", name: "Kwesi Antwi", role: "CHW", catchment: "Jakpa North", lastActive: "Today · 08:58" },
  { id: "STF-244", name: "Mabel Owusu", role: "CHW", catchment: "Jakpa South", lastActive: "Yesterday · 18:12" },
  { id: "STF-259", name: "Yaw Mensah", role: "Nurse", lastActive: "Today · 07:30" },
]

const chwProductivityData = [
  { name: "Kwesi Antwi", registrations: 18, vaccinations: 26 },
  { name: "Mabel Owusu", registrations: 14, vaccinations: 22 },
  { name: "Zeinab Yakubu", registrations: 9, vaccinations: 18 },
  { name: "Haruna Adam", registrations: 11, vaccinations: 16 },
]

const heatmapCatchments = [
  { name: "Jakpa North", coverage: 88, status: "High" },
  { name: "Jakpa South", coverage: 72, status: "Moderate" },
  { name: "Sanza", coverage: 64, status: "Low" },
  { name: "Kalba", coverage: 58, status: "Critical" },
]

const dropoutData = [
  { vaccine: "DPT", series1: 286, series3: 231 },
  { vaccine: "OPV", series1: 304, series3: 248 },
  { vaccine: "Pneumococcal", series1: 298, series3: 242 },
]

const branchMeta = {
  name: "Jakpa District Health Centre",
  region: "Savannah Region",
}

type HeatStatus = "High" | "Moderate" | "Low" | "Critical"

const heatClassMap: Record<HeatStatus, string> = {
  High: "from-emerald-500/80 via-emerald-500/40 to-transparent",
  Moderate: "from-sky-500/80 via-sky-500/30 to-transparent",
  Low: "from-amber-500/80 via-amber-500/40 to-transparent",
  Critical: "from-rose-500/80 via-rose-500/40 to-transparent",
}

export default function BranchDashboardPage() {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<SectionId>("overview")
  const [userName, setUserName] = useState("")
  const [systemMessage, setSystemMessage] = useState<string | null>(null)

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

    if (detail !== "branch-manager") {
      if (detail === "hq-admin") {
        router.push("/hq/dashboard")
        return
      }
      router.push("/dashboard")
      return
    }

    setUserName(name || "Branch Manager")
  }, [router])

  useEffect(() => {
    if (!systemMessage) return
    const timeout = window.setTimeout(() => setSystemMessage(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [systemMessage])

  const activeStockAlerts = useMemo(() => stockAlerts.filter((alert) => alert.status !== "healthy"), [])

  const handleExportReports = () => {
    setSystemMessage("Branch analytics export queued. You will receive an email when it is ready to download.")
  }

  const handleOpenModule = (module: "users" | "child-records" | "field-stock" | "chw-log") => {
    const messages: Record<typeof module, string> = {
      users: "Branch user management will open once backend routes are integrated.",
      "child-records": "Child record search coming soon. Connect API to enable lookups.",
      "field-stock": "Field stock management pending inventory service.",
      "chw-log": "CHW visit log viewer will load once data sync is wired.",
    }
    setSystemMessage(messages[module])
  }

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Children Registered</CardTitle>
            <CardDescription>Total children under this branch</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{kpiData.childrenRegistered.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">+124 in the last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Vaccinations today</CardTitle>
            <CardDescription>Doses recorded since 00:00</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{kpiData.vaccinationsToday}</p>
            <p className="text-xs text-muted-foreground mt-1">Clinic sessions active since 07:30</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">CHWs active today</CardTitle>
            <CardDescription>Sync activity in the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{kpiData.chwsActiveToday}</p>
            <p className="text-xs text-muted-foreground mt-1">81% of deployed CHWs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Data syncs pending</CardTitle>
            <CardDescription>CHW devices offline &gt; 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{kpiData.pendingSyncs}</p>
            <p className="text-xs text-muted-foreground mt-1">Escalate to CHW leads</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,1fr]">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gauge className="h-5 w-5 text-primary" /> Branch coverage rate
            </CardTitle>
            <CardDescription>Measles coverage across all registered children</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ResponsiveContainer width="100%" height={280}>
              <RadialBarChart innerRadius="60%" outerRadius="110%" data={branchCoverage} startAngle={90} endAngle={-270}>
                <RadialBar background cornerRadius={18} dataKey="value" />
              </RadialBarChart>
            </ResponsiveContainer>
            <p className="mt-4 text-center text-sm text-muted-foreground">Target: 90% · Last week: 82%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" /> 7-day coverage trend
            </CardTitle>
            <CardDescription>Daily measles coverage completion</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={coverageTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis domain={[70, 90]} />
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
          <CardDescription>Monitor cold chain and outreach stock at a glance</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {stockAlerts.map((alert) => (
            <div key={alert.vaccine} className="rounded-lg border border-border bg-background p-4">
              <p className="text-sm font-semibold text-foreground">{alert.vaccine}</p>
              <p className="mt-2 text-2xl font-semibold">{alert.remaining} vials</p>
              <Badge
                className="mt-3"
                variant={alert.status === "critical" ? "destructive" : alert.status === "low" ? "secondary" : "outline"}
              >
                {alert.status === "critical" ? "Critical" : alert.status === "low" ? "Low" : "Healthy"}
              </Badge>
              <p className="mt-2 text-xs text-muted-foreground">Update via Field Stock Management</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )

  const renderActions = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Overdue vaccinations</CardTitle>
          <CardDescription>Reach out to guardians and schedule immediate follow-ups.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {overdueVaccinations.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground">{item.child}</p>
                <Badge variant="secondary">{item.id}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
              <p className="mt-2 text-xs text-muted-foreground">{item.timestamp}</p>
            </div>
          ))}
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
            {aefiEvents.map((event) => (
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
            {syncErrors.map((error) => (
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
            {notificationFailures.map((failure) => (
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
          <CardTitle>Staff roster</CardTitle>
          <CardDescription>Monitor nurse and CHW activity across catchments.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Catchment / Unit</th>
                <th className="py-2 pr-4 font-medium">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {staffRoster.map((staff) => (
                <tr key={staff.id} className="text-foreground">
                  <td className="py-2 pr-4 font-medium">{staff.name}</td>
                  <td className="py-2 pr-4">
                    <Badge variant={staff.role === "Nurse" ? "secondary" : "outline"}>{staff.role}</Badge>
                  </td>
                  <td className="py-2 pr-4">{staff.role === "CHW" ? staff.catchment ?? "Unassigned" : "Clinic"}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{staff.lastActive}</td>
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
            <BarChart data={chwProductivityData}>
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
          <Button variant="outline" onClick={() => handleOpenModule("chw-log")}>Open CHW visit log</Button>
          <Button variant="ghost" asChild>
            <Link href="#">Download latest visit summary</Link>
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
            <MapPin className="h-5 w-5 text-primary" /> Coverage heatmap by catchment
          </CardTitle>
          <CardDescription>Identify cold spots requiring additional CHW support.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {heatmapCatchments.map((catchment) => (
              <div
                key={catchment.name}
                className={`relative overflow-hidden rounded-xl border border-border bg-background p-4`}
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${heatClassMap[catchment.status as HeatStatus]}`} />
                <div className="relative">
                  <p className="text-sm font-semibold text-foreground">{catchment.name}</p>
                  <p className="mt-1 text-2xl font-semibold">{catchment.coverage}%</p>
                  <Badge className="mt-2" variant="outline">{catchment.status} coverage</Badge>
                  <p className="mt-3 text-xs text-muted-foreground">Data synced from CHW mobile app</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Map overlay will switch to a full GIS view once geospatial services are connected.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="h-5 w-5 text-primary" /> Dropout analysis (Dose 1 vs Dose 3)
          </CardTitle>
          <CardDescription>Track follow-up needs for incomplete vaccination series.</CardDescription>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dropoutData}>
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
          <CardDescription>Update vaccine and supply balances after outreach.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={() => handleOpenModule("field-stock")} className="gap-2">
            <Compass className="h-4 w-4" /> Manage stock
          </Button>
          <p className="text-xs text-muted-foreground">Log issues, returns, and usage per session.</p>
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
              <p className="text-xl font-semibold text-foreground">{branchMeta.name}</p>
              <p className="text-xs text-muted-foreground">{branchMeta.region}</p>
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
              onClick={() => {
                localStorage.removeItem("authToken")
                localStorage.removeItem("userRole")
                localStorage.removeItem("userRoleDetail")
                localStorage.removeItem("userName")
                router.push("/")
              }}
            >
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
            {renderContent()}
          </section>
        </div>
      </main>
    </div>
  )
}
