"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  BookOpen,
  Database,
  Layers,
  LayoutList,
  Link2,
  ListChecks,
  LogOut,
  Search,
  ServerOff,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"

function formatRoleLabel(role?: string | null) {
  if (!role) return "Staff"
  return role
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

export default function Dashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState("")
  const [roleDetail, setRoleDetail] = useState("")
  const [kpis] = useState({
    duplicates: 12,
    syncConflicts: 2,
    missingChildData: 0.08,
    notificationFailures: 15,
    securityAlerts: 1,
    downtimeMinutes: 6,
  })

  useEffect(() => {
    const token = localStorage.getItem("authToken")
    const role = localStorage.getItem("userRole")
    const name = localStorage.getItem("userName")
    const detail = localStorage.getItem("userRoleDetail")

    if (!token) {
      router.push("/auth/login")
      return
    }

    if (role !== "staff") {
      router.push("/parent/dashboard")
      return
    }

    if (!detail || detail !== "data-officer") {
      if (detail === "hq-admin") {
        router.push("/hq/dashboard")
        return
      }
      if (detail === "branch-manager") {
        router.push("/branch/dashboard")
        return
      }
      if (detail === "facility-nurse") {
        router.push("/facility/dashboard")
        return
      }
      if (detail === "chw") {
        router.push("/chw/dashboard")
        return
      }
      router.push("/")
      return
    }

    setUserName(name || "Data Officer")
    setRoleDetail(detail)
  }, [router])

  const actionQueues = useMemo(
    () => [
      {
        label: "Go to Deduplication Queue",
        description: "12 potential duplicates awaiting manual review",
        href: "/dashboard/deduplication",
        countLabel: "12 pending",
        icon: Layers,
      },
      {
        label: "Go to Sync Conflict Resolver",
        description: "Resolve mobile sync collisions before end of day",
        href: "/dashboard/sync-conflicts",
        countLabel: "2 pending",
        icon: Link2,
      },
      {
        label: "Go to Notification Log",
        description: "Audit failed SMS or email deliveries",
        href: "/dashboard/notifications",
        countLabel: "15 failed",
        icon: TriangleAlert,
      },
      {
        label: "Open Security Watchboard",
        description: "Monitor breach attempts and downtime escalations",
        href: "#security-watch",
        countLabel: "1 alert",
        icon: ShieldAlert,
      },
    ],
    [],
  )

  const duplicatePreview = useMemo(
    () => [
  { id: "DQ-4472", childName: "Esi Mensah", similarity: "92% match", fields: "DOB + Mother Phone" },
      { id: "DQ-4473", childName: "Kojo Mensima", similarity: "88% match", fields: "Name + CHW catchment" },
      { id: "DQ-4474", childName: "Afia Nyarko", similarity: "83% match", fields: "Mother name" },
    ],
    [],
  )

  const conflictPreview = useMemo(
    () => [
      {
        id: "SC-982",
        headline: "Vaccination event orphaned",
        detail: "CHW_Kofi recorded MR1 for child CH-991, but record merged yesterday",
        recommended: "Re-link to CH-558",
      },
      {
        id: "SC-976",
        headline: "Deleted child reference",
  detail: "Field upload references child CH-702 removed by Nurse Addo",
        recommended: "Review before discard",
      },
    ],
    [],
  )

  const notificationSnapshot = useMemo(
    () => [
      {
        id: "NF-55221",
        timestamp: "11 Nov 2025 · 08:42",
        channel: "SMS",
        template: "Overdue reminder",
        recipient: "+233 24 000 1122",
        status: "Failed",
      },
      {
        id: "NF-55219",
        timestamp: "11 Nov 2025 · 08:30",
        channel: "Email",
        template: "Certificate download",
        recipient: "abena@example.com",
        status: "Delivered",
      },
      {
        id: "NF-55218",
        timestamp: "11 Nov 2025 · 08:05",
        channel: "SMS",
        template: "Clinic appointment",
        recipient: "+233 27 889 3201",
        status: "Sent",
      },
    ],
    [],
  )

  const securityIncidents = useMemo(
    () => [
      {
        id: "SEC-771",
        headline: "Blocked login burst",
        detail: "15 failed attempts from 196.44.21.18 auto-blocked · Parent portal",
        severity: "High",
        detectedAt: "11 Nov 2025 · 07:15",
        status: "Investigating",
      },
      {
        id: "SEC-768",
        headline: "Unhandled API token",
        detail: "Expired staff token used against /hq endpoints · access denied",
        severity: "Medium",
        detectedAt: "11 Nov 2025 · 05:02",
        status: "Resolved",
      },
    ],
    [],
  )

  const infrastructureSignals = useMemo(
    () => [
      {
        id: "api",
        service: "Core API",
        status: "operational",
        detail: "Latency 230ms · No errors",
      },
      {
        id: "auth",
        service: "Identity & MFA",
        status: "degraded",
        detail: "OTP vendor timeout spike (3 min)",
      },
      {
        id: "sync",
        service: "Offline Sync Broker",
        status: "offline",
        detail: "Northern region broker unreachable since 08:22",
      },
    ],
    [],
  )

  const severityVariant = (severity: string) => {
    switch (severity) {
      case "High":
        return "destructive" as const
      case "Medium":
        return "default" as const
      default:
        return "secondary" as const
    }
  }

  const statusVariant = (status: string) => {
    switch (status) {
      case "offline":
        return "destructive" as const
      case "degraded":
        return "default" as const
      default:
        return "secondary" as const
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("authToken")
    localStorage.removeItem("userRole")
    localStorage.removeItem("userRoleDetail")
    localStorage.removeItem("userName")
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-primary/30 bg-primary/5">
                <Image
                  src="/images/cvcc-logo.png"
                  alt="Child Vaccination Command Center logo"
                  fill
                  sizes="40px"
                  className="object-cover"
                  priority
                />
              </div>
              <div className="leading-tight">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Child Vaccination Command Center</p>
                <p className="text-sm font-semibold text-foreground">Data Quality Mission Control</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 sm:flex-nowrap sm:justify-end">
              <ThemeToggle />
              <div className="flex flex-col items-end text-right">
                <span className="text-sm text-muted-foreground">Welcome, {userName}</span>
                <span className="text-xs text-muted-foreground/80">{formatRoleLabel(roleDetail)}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 bg-transparent">
                <LogOut size={16} />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPI Cards */}
  <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card className="border-primary/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending duplicates</CardTitle>
              <CardDescription className="text-xs text-muted-foreground/80">Records to confirm before EOD</CardDescription>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <p className="text-3xl font-bold text-primary">{kpis.duplicates}</p>
              <Layers className="h-7 w-7 text-primary" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sync conflicts</CardTitle>
              <CardDescription className="text-xs text-muted-foreground/80">Offline batches needing intervention</CardDescription>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <p className="text-3xl font-bold text-amber-500">{kpis.syncConflicts}</p>
              <Link2 className="h-7 w-7 text-amber-500" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Missing data (children)</CardTitle>
              <CardDescription className="text-xs text-muted-foreground/80">Profiles missing DOB or mother link</CardDescription>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <p className="text-3xl font-bold text-orange-500">{(kpis.missingChildData * 100).toFixed(1)}%</p>
              <Database className="h-7 w-7 text-orange-500" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notification failures (24h)</CardTitle>
              <CardDescription className="text-xs text-muted-foreground/80">SMS / email retries needed</CardDescription>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <p className="text-3xl font-bold text-rose-500">{kpis.notificationFailures}</p>
              <TriangleAlert className="h-7 w-7 text-rose-500" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Security alerts (24h)</CardTitle>
              <CardDescription className="text-xs text-muted-foreground/80">Breach attempts and abnormal access</CardDescription>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <p className="text-3xl font-bold text-destructive">{kpis.securityAlerts}</p>
              <ShieldAlert className="h-7 w-7 text-destructive" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Downtime (last 24h)</CardTitle>
              <CardDescription className="text-xs text-muted-foreground/80">Minutes of core service outage</CardDescription>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <p className="text-3xl font-bold text-blue-600">{kpis.downtimeMinutes}</p>
              <ServerOff className="h-7 w-7 text-blue-600" />
            </CardContent>
          </Card>
        </div>

        {/* Action queues */}
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {actionQueues.map(({ label, description, href, countLabel, icon: Icon }) => (
            <Card key={label} className="border-border/60 bg-background/80">
              <CardHeader className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-foreground">{label}</CardTitle>
                  <BadgePill>{countLabel}</BadgePill>
                </div>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={href} className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-primary/30 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10">
                  <Icon className="h-4 w-4" />
                  Open module
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>

  <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <Card className="border-primary/30">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers className="h-5 w-5 text-primary" /> Deduplication fires to review
              </CardTitle>
              <CardDescription>Highest-risk duplicate clusters flagged overnight by the similarity service.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {duplicatePreview.map((item) => (
                <div key={item.id} className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.childName}</p>
                      <p className="text-xs text-muted-foreground">Similarity: {item.similarity}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">Signals: {item.fields}</span>
                  </div>
                  <Link href="/dashboard/deduplication" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    <Search className="h-3 w-3" /> Review in merge tool
                  </Link>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Queue sorted by highest similarity first. Resolve before 17:00 to unblock HQ analytics.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Link2 className="h-5 w-5 text-amber-500" /> Sync conflicts feed
              </CardTitle>
              <CardDescription>Latest mobile sync collisions that need manual routing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {conflictPreview.map((conflict) => (
                <div key={conflict.id} className="rounded-lg border border-border bg-background/80 p-3 text-sm text-muted-foreground">
                  <p className="flex items-center justify-between text-foreground">
                    <span className="font-semibold">{conflict.headline}</span>
                    <span className="text-xs text-muted-foreground">{conflict.id}</span>
                  </p>
                  <p className="mt-1 text-xs leading-snug">{conflict.detail}</p>
                  <p className="mt-2 text-xs font-medium text-amber-600">Suggested: {conflict.recommended}</p>
                  <Link href="/dashboard/sync-conflicts" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    <ListChecks className="h-3 w-3" /> Resolve conflict
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

  <section className="mt-8 grid gap-6 lg:grid-cols-[1fr,1fr]">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5 text-primary" /> Notification spot check
              </CardTitle>
              <CardDescription>Filter failures quickly before caregivers escalate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-rose-400 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600">
                  {notificationSnapshot.filter((entry) => entry.status === "Failed").length} failed in last sync
                </span>
                <Link href="/dashboard/notifications" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <Search className="h-3 w-3" /> Open full audit log
                </Link>
              </div>
              <div className="space-y-2">
                {notificationSnapshot.map((log) => (
                  <div key={log.id} className="rounded-lg border border-border bg-background/80 p-3 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{log.template}</span>
                      <span>{log.status}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <span>{log.timestamp}</span>
                      <span>·</span>
                      <span>{log.channel}</span>
                      <span>·</span>
                      <span>{log.recipient}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed border-primary/40 bg-primary/5">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" /> Quick export reminder
              </CardTitle>
              <CardDescription>Build ad-hoc coverage extracts using the custom report generator.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Select a data source, choose columns, apply filters, then export as CSV, Excel, or PDF.</p>
              <p className="text-xs text-muted-foreground">Common saved report: &ldquo;Accra North · Measles 1 backlog · Last 14 days&rdquo;.</p>
              <Link href="/dashboard/reports" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                <LayoutList className="h-4 w-4" /> Launch report generator
              </Link>
            </CardContent>
          </Card>
        </section>

        <section id="security-watch" className="mt-8 grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <Card className="border-destructive/40">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldAlert className="h-5 w-5 text-destructive" /> Security incident center
              </CardTitle>
              <CardDescription>Track breach attempts and escalation workflow status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {securityIncidents.map((incident) => (
                <div key={incident.id} className="rounded-lg border border-border bg-background/90 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{incident.headline}</p>
                    <Badge variant={severityVariant(incident.severity)}>{incident.severity}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{incident.detail}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>{incident.detectedAt}</span>
                    <span>·</span>
                    <span>Status: {incident.status}</span>
                    <span>·</span>
                    <span>ID: {incident.id}</span>
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Work with HQ security to close items marked &ldquo;Investigating&rdquo; before close of business.</p>
            </CardContent>
          </Card>

          <Card className="border border-primary/30">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5 text-primary" /> Infrastructure heartbeat
              </CardTitle>
              <CardDescription>Surface downtime and degradation affecting data pipelines.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {infrastructureSignals.map((signal) => (
                <div key={signal.id} className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{signal.service}</p>
                    <Badge variant={statusVariant(signal.status)} className="capitalize">
                      {signal.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{signal.detail}</p>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">If a service is &ldquo;offline&rdquo;, sync with IT operations and post an advisory to branches.</p>
            </CardContent>
          </Card>
        </section>

        <Alert className="mt-10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Keep the deduplication queue below five items daily. High duplicate counts block HQ analytics and SMS reminders.
          </AlertDescription>
        </Alert>
      </main>
    </div>
  )
}

function BadgePill({ children }: { children: string }) {
  return <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">{children}</span>
}
