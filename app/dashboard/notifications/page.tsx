"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Filter, Mail, RefreshCw, Smartphone } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

const channels = [
  { id: "sms", label: "SMS", icon: Smartphone },
  { id: "email", label: "Email", icon: Mail },
]

const notificationEvents = [
  {
    id: "NF-55221",
    channel: "SMS",
    template: "Overdue reminder",
    recipient: "+233 24 000 1122",
    status: "Failed",
    reason: "Network unreachable",
    timestamp: "11 Nov 2025 · 08:42",
  },
  {
    id: "NF-55220",
    channel: "SMS",
    template: "Outreach mission",
    recipient: "+233 20 889 3312",
    status: "Sent",
    reason: "Queued at telco",
    timestamp: "11 Nov 2025 · 08:35",
  },
  {
    id: "NF-55219",
    channel: "Email",
    template: "Certificate download",
    recipient: "abena@example.com",
    status: "Delivered",
    reason: "",
    timestamp: "11 Nov 2025 · 08:30",
  },
]

const statusFilters = ["All", "Failed", "Sent", "Delivered", "Pending"]

export default function NotificationAuditLogPage() {
  const router = useRouter()
  const [channelFilter, setChannelFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState("Failed")
  const [searchTerm, setSearchTerm] = useState("")
  const [isExporting, setIsExporting] = useState(false)

  const visibleEvents = useMemo(() => {
    return notificationEvents.filter((event) => {
      const matchesChannel = channelFilter === "All" || event.channel === channelFilter
      const matchesStatus = statusFilter === "All" || event.status === statusFilter
      const matchesSearch = !searchTerm.trim() || `${event.recipient} ${event.template}`.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesChannel && matchesStatus && matchesSearch
    })
  }, [channelFilter, statusFilter, searchTerm])

  const statusTheme = useMemo(
    () => ({
      Failed: {
        card: "border-rose-500/70 bg-rose-100 text-rose-950",
        badge: "bg-rose-600 text-white border-rose-700",
        icon: "text-rose-700",
        reason: "text-rose-700",
        title: "text-rose-900",
        meta: "text-rose-800",
      },
      Sent: {
        card: "border-amber-300 bg-amber-50 text-amber-900",
        badge: "bg-amber-500 text-amber-950 border-amber-600",
        icon: "text-amber-600",
        reason: "text-amber-700",
        title: "text-amber-900",
        meta: "text-amber-700",
      },
      Delivered: {
        card: "border-emerald-300 bg-emerald-50 text-emerald-900",
        badge: "bg-emerald-500 text-emerald-950 border-emerald-600",
        icon: "text-emerald-600",
        reason: "text-emerald-700",
        title: "text-emerald-900",
        meta: "text-emerald-700",
      },
      Pending: {
        card: "border-slate-300 bg-slate-100 text-slate-900",
        badge: "bg-slate-500 text-white border-slate-600",
        icon: "text-slate-600",
        reason: "text-slate-700",
        title: "text-slate-900",
        meta: "text-slate-700",
      },
      default: {
        card: "border-border bg-background/90",
        badge: "bg-primary/15 text-primary border-primary/40",
        icon: "text-primary",
        reason: "text-muted-foreground",
        title: "text-foreground",
        meta: "text-muted-foreground",
      },
    }),
    [],
  )

  const handleExportLog = async () => {
    setIsExporting(true)

    const exportPayload = {
      filters: {
        channel: channelFilter,
        status: statusFilter,
        searchTerm: searchTerm.trim() || null,
      },
      resultCount: visibleEvents.length,
      totalCount: notificationEvents.length,
      exportedAt: new Date().toISOString(),
      events: visibleEvents.map((event) => ({
        id: event.id,
        channel: event.channel,
        template: event.template,
        recipient: event.recipient,
        status: event.status,
        reason: event.reason || null,
        timestamp: event.timestamp,
      })),
    }

  // TODO: Replace with export API call
  // Example: POST /api/notifications/export with exportPayload
    console.log("Exporting notification log", exportPayload)

    try {
      await new Promise((resolve) => setTimeout(resolve, 800))
      toast.success(`Export ready · ${visibleEvents.length} events · ${channelFilter} channel · ${statusFilter} status`)
    } catch (error) {
      toast.error("Failed to export notification log. Please retry.")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 text-sm">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-muted-foreground transition hover:text-foreground"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-4 w-4 text-primary" /> Log updated 1 min ago
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr,1.2fr]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">Filters</CardTitle>
            <CardDescription>Slice the notification log by channel, status, or recipient.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Channel</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setChannelFilter("All")}
                  className={`rounded-md border px-3 py-2 text-sm transition ${channelFilter === "All" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"}`}
                >
                  All
                </button>
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setChannelFilter(channel.label)}
                    className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition ${channelFilter === channel.label ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"}`}
                  >
                    <channel.icon className="h-4 w-4" /> {channel.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
              <div className="grid grid-cols-3 gap-2">
                {statusFilters.map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`rounded-md border px-3 py-2 text-sm transition ${statusFilter === status ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"}`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipient-search" className="text-xs uppercase tracking-wide text-muted-foreground">
                Search recipient or template
              </Label>
              <Input
                id="recipient-search"
                placeholder="e.g. +233 24 000 1122 or reminder"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Quick actions</Label>
              <div className="grid gap-2">
                <Button variant="outline" className="w-full gap-2 text-sm" onClick={handleExportLog} disabled={isExporting}>
                  <Download className="h-4 w-4" /> {isExporting ? "Exporting…" : "Export filtered log"}
                </Button>
                <Link href="/dashboard/deduplication" className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm transition hover:border-primary/40">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> Jump to deduplication
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="self-start border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">Notification audit log</CardTitle>
            <CardDescription>Track every outbound contact attempt for compliance and caregiver support.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {visibleEvents.length === 0 ? (
              <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-6 text-center text-xs text-muted-foreground">
                <Filter className="mx-auto mb-2 h-4 w-4" /> No notification events match the current filters.
              </div>
            ) : (
              visibleEvents.map((event) => {
                const theme = statusTheme[event.status as keyof typeof statusTheme] ?? statusTheme.default
                return (
                  <div key={event.id} className={`rounded-lg border p-4 text-sm transition ${theme.card}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        {event.channel === "SMS" ? <Smartphone className={`h-4 w-4 ${theme.icon}`} /> : <Mail className={`h-4 w-4 ${theme.icon}`} />}
                        <span className={`font-semibold ${theme.title}`}>{event.template}</span>
                    </div>
                      <span className={`text-xs ${theme.meta}`}>{event.id}</span>
                  </div>
                    <p className={`mt-2 text-xs ${theme.meta}`}>{event.timestamp}</p>
                    <p className={`mt-2 text-xs ${theme.meta}`}>Recipient: {event.recipient}</p>
                    <Badge variant="outline" className={`mt-2 inline-flex items-center gap-2 border ${theme.badge}`}>
                      Status: {event.status}
                    </Badge>
                    {event.reason && (
                      <p className={`mt-2 text-xs ${theme.reason}`}>
                        <AlertTriangle className={`mr-1 inline-block h-3 w-3 ${theme.icon}`} /> {event.reason}
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
