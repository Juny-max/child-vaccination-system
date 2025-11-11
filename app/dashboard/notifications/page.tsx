"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Filter, Mail, RefreshCw, Smartphone } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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

  const visibleEvents = useMemo(() => {
    return notificationEvents.filter((event) => {
      const matchesChannel = channelFilter === "All" || event.channel === channelFilter
      const matchesStatus = statusFilter === "All" || event.status === statusFilter
      const matchesSearch = !searchTerm.trim() || `${event.recipient} ${event.template}`.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesChannel && matchesStatus && matchesSearch
    })
  }, [channelFilter, statusFilter, searchTerm])

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
                <Button variant="outline" className="w-full gap-2 text-sm">
                  <Download className="h-4 w-4" /> Export filtered log
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
              visibleEvents.map((event) => (
                <div key={event.id} className={`rounded-lg border p-4 text-sm transition ${event.status === "Failed" ? "border-rose-400/60 bg-rose-50/80" : "border-border bg-background/80"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {event.channel === "SMS" ? <Smartphone className="h-4 w-4 text-primary" /> : <Mail className="h-4 w-4 text-primary" />}
                      <span className="font-semibold text-foreground">{event.template}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{event.id}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{event.timestamp}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Recipient: {event.recipient}</p>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
                    Status: {event.status}
                  </div>
                  {event.reason && (
                    <p className="mt-2 text-xs text-rose-600">
                      <AlertTriangle className="mr-1 inline-block h-3 w-3" /> {event.reason}
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
