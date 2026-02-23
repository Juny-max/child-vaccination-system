"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CalendarCheck,
  Check,
  Clock,
  Filter,
  Loader2,
  Phone,
  User,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TimePicker } from "@/components/ui/time-picker"
import * as facilityApi from "@/lib/api/facility"

type TabFilter = "scheduled" | "confirmed" | "cancelled" | "completed"

type ParsedAppointmentNotes = {
  contactPhone?: string
  preferredFacility?: string
  parentNotes?: string
  plainNotes?: string
}

function parseAppointmentNotes(notes?: string | null): ParsedAppointmentNotes {
  if (!notes) return {}

  let working = notes

  const contactMatch = working.match(/\[CONTACT_PHONE:([^\]]+)\]/i)
  const contactPhone = contactMatch?.[1]?.trim()
  if (contactMatch) {
    working = working.replace(contactMatch[0], "").trim()
  }

  const preferredFacilityMatch = working.match(/Preferred facility:\s*([^\.]+)(?:\.|$)/i)
  const preferredFacility = preferredFacilityMatch?.[1]?.trim()
  if (preferredFacilityMatch) {
    working = working.replace(preferredFacilityMatch[0], "").trim()
  }

  const parentNotesMatch = working.match(/Parent notes:\s*(.+)$/i)
  const parentNotes = parentNotesMatch?.[1]?.trim()
  if (parentNotesMatch) {
    working = working.replace(parentNotesMatch[0], "").trim()
  }

  const plainNotes = working.replace(/^\.+|\.+$/g, "").trim()

  return {
    contactPhone,
    preferredFacility,
    parentNotes,
    plainNotes: plainNotes || undefined,
  }
}

export default function AppointmentRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<facilityApi.AppointmentRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabFilter>("scheduled")
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Confirm modal state
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirmDate, setConfirmDate] = useState("")
  const [confirmTime, setConfirmTime] = useState("")
  const [confirmNotes, setConfirmNotes] = useState("")

  // Reject modal state
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState("")

  useEffect(() => {
    const role = localStorage.getItem("userRole")
    const detail = localStorage.getItem("userRoleDetail")

    if (role !== "staff" || detail !== "facility-nurse") {
      router.push("/auth/login")
      return
    }

    fetchRequests(activeTab)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRequests = async (status: TabFilter) => {
    setIsLoading(true)
    try {
      // Get the nurse's facility (branchId) so they only see their own appointments
      const facilityId = localStorage.getItem("branchId") || undefined
      const data = await facilityApi.getAppointmentRequests(facilityId, status)
      setRequests(data)
    } catch (error) {
      console.error("Failed to fetch appointment requests:", error)
      toast.error("Failed to load appointment requests")
    } finally {
      setIsLoading(false)
    }
  }

  const handleTabChange = (tab: TabFilter) => {
    setActiveTab(tab)
    fetchRequests(tab)
  }

  const handleConfirm = async (appointmentId: string) => {
    // If confirm form is not yet open, open it pre-filled with the request's date/time
    if (confirmingId !== appointmentId) {
      const req = requests.find((r) => r.id === appointmentId)
      setConfirmingId(appointmentId)
      setConfirmDate(req?.scheduledDate || "")
      setConfirmTime(req?.scheduledTime !== "—" ? req?.scheduledTime ?? "" : "")
      setConfirmNotes("")
      return
    }

    // Actually confirm
    setActionLoading(appointmentId)
    try {
      const result = await facilityApi.updateAppointmentStatus(appointmentId, "confirmed", {
        confirmedDate: confirmDate || undefined,
        confirmedTime: confirmTime || undefined,
        notes: confirmNotes || undefined,
      })
      toast.success(result.message)
      setConfirmingId(null)
      fetchRequests(activeTab)
    } catch (error) {
      toast.error("Failed to confirm appointment")
      console.error(error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (appointmentId: string) => {
    // If reject form is not yet open, open it
    if (rejectingId !== appointmentId) {
      setRejectingId(appointmentId)
      setRejectNotes("")
      return
    }

    // Actually reject
    setActionLoading(appointmentId)
    try {
      const result = await facilityApi.updateAppointmentStatus(appointmentId, "cancelled", {
        notes: rejectNotes || undefined,
      })
      toast.success(result.message)
      setRejectingId(null)
      fetchRequests(activeTab)
    } catch (error) {
      toast.error("Failed to reject appointment")
      console.error(error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleComplete = async (appointmentId: string) => {
    setActionLoading(appointmentId)
    try {
      const result = await facilityApi.updateAppointmentStatus(appointmentId, "completed")
      toast.success(result.message)
      fetchRequests(activeTab)
    } catch (error) {
      toast.error("Failed to complete appointment")
      console.error(error)
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    } catch {
      return dateStr
    }
  }

  const formatCreatedAt = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      const now = new Date()
      const diffMs = now.getTime() - d.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffHours < 1) return "Just now"
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays < 7) return `${diffDays}d ago`
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    } catch {
      return ""
    }
  }

  const getStatusTime = (req: facilityApi.AppointmentRequest) => {
    if (req.status === "scheduled") return req.createdAt
    return req.updatedAt || req.createdAt
  }

  const tabs: { key: TabFilter; label: string; color: string }[] = [
    { key: "scheduled", label: "Pending", color: "text-amber-600" },
    { key: "confirmed", label: "Confirmed", color: "text-green-600" },
    { key: "completed", label: "Completed", color: "text-blue-600" },
    { key: "cancelled", label: "Rejected", color: "text-red-600" },
  ]

  const minDate = new Date()

  const toDateObject = (dateValue: string): Date | undefined => {
    if (!dateValue) return undefined
    const parsed = new Date(`${dateValue}T00:00:00`)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }

  const toDateString = (dateValue?: Date): string => {
    if (!dateValue) return ""
    const year = dateValue.getFullYear()
    const month = String(dateValue.getMonth() + 1).padStart(2, "0")
    const day = String(dateValue.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/facility/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-bold">Appointment requests</h1>
            <p className="text-xs text-muted-foreground">
              Review and manage make-up dose requests from parents
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {/* Tab filters */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "outline"}
              size="sm"
              onClick={() => handleTabChange(tab.key)}
              className="gap-2 whitespace-nowrap"
            >
              <Filter className="h-3 w-3" />
              {tab.label}
              {activeTab === tab.key && requests.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  {requests.length}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Loading state */}
        {isLoading ? (
          <Card className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading requests...</span>
          </Card>
        ) : requests.length === 0 ? (
          <Card className="p-12 text-center">
            <CalendarCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              No {activeTab === "scheduled" ? "pending" : activeTab} appointment requests
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeTab === "scheduled"
                ? "When parents request make-up doses, they will appear here for your review."
                : "Switch tabs to view other appointment statuses."}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => (
              <Card key={req.id} className="overflow-hidden">
                <CardContent className="p-0">
                  {(() => {
                    const parsedNotes = parseAppointmentNotes(req.notes)
                    return (
                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                    {/* Left: Child & Guardian info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold">{req.childName}</h3>
                        <Badge
                          variant={
                            req.status === "scheduled"
                              ? "secondary"
                              : req.status === "confirmed"
                              ? "default"
                              : req.status === "completed"
                              ? "outline"
                              : "destructive"
                          }
                        >
                          {req.status === "scheduled" ? "Pending" : req.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatCreatedAt(getStatusTime(req))}
                        </span>
                      </div>

                      <div className="grid gap-2 text-sm sm:grid-cols-2">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-3.5 w-3.5 shrink-0" />
                          <span>{req.guardianName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <Link
                            href={`tel:${req.guardianPhone.replace(/\s+/g, "")}`}
                            className="text-primary hover:underline"
                          >
                            {req.guardianPhone}
                          </Link>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          <span>Preferred: {formatDate(req.scheduledDate)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          <span>Time: {req.scheduledTime}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {req.vaccine}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">
                          {req.childCvccId}
                        </span>
                      </div>

                      {(parsedNotes.contactPhone || parsedNotes.preferredFacility || parsedNotes.parentNotes || parsedNotes.plainNotes) && (
                        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
                          <p className="font-semibold text-foreground">Parent request details</p>

                          {parsedNotes.contactPhone ? (
                            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                              <span className="font-medium text-foreground">Contact phone:</span>
                              <Link
                                href={`tel:${parsedNotes.contactPhone.replace(/\s+/g, "")}`}
                                className="text-primary hover:underline"
                              >
                                {parsedNotes.contactPhone}
                              </Link>
                            </div>
                          ) : null}

                          {parsedNotes.preferredFacility ? (
                            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                              <span className="font-medium text-foreground">Preferred facility:</span>
                              <Badge variant="outline" className="text-[10px]">
                                {parsedNotes.preferredFacility}
                              </Badge>
                            </div>
                          ) : null}

                          {parsedNotes.parentNotes ? (
                            <div className="text-muted-foreground">
                              <span className="font-medium text-foreground">Parent notes:</span>{" "}
                              {parsedNotes.parentNotes}
                            </div>
                          ) : null}

                          {parsedNotes.plainNotes ? (
                            <div className="text-muted-foreground">{parsedNotes.plainNotes}</div>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {/* Right: Action buttons */}
                    {activeTab === "scheduled" && (
                      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                        <Button
                          size="sm"
                          className="gap-2"
                          disabled={actionLoading === req.id}
                          onClick={() => handleConfirm(req.id)}
                        >
                          {actionLoading === req.id && confirmingId === req.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-2"
                          disabled={actionLoading === req.id}
                          onClick={() => handleReject(req.id)}
                        >
                          {actionLoading === req.id && rejectingId === req.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                          Reject
                        </Button>
                      </div>
                    )}

                    {activeTab === "confirmed" && (
                      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          disabled={actionLoading === req.id}
                          onClick={() => handleComplete(req.id)}
                        >
                          {actionLoading === req.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CalendarCheck className="h-3.5 w-3.5" />
                          )}
                          Mark completed
                        </Button>
                      </div>
                    )}
                  </div>
                    )
                  })()}

                  {/* Confirm form (inline) */}
                  {confirmingId === req.id && (
                    <div className="border-t bg-green-50/50 p-5 dark:bg-green-950/20">
                      <p className="mb-3 text-sm font-medium text-green-700 dark:text-green-400">
                        Confirm appointment details
                      </p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <Label className="text-xs">Confirmed date</Label>
                          <DatePicker
                            date={toDateObject(confirmDate)}
                            onDateChange={(selectedDate) => setConfirmDate(toDateString(selectedDate))}
                            minDate={minDate}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Confirmed time</Label>
                          <TimePicker time={confirmTime} onTimeChange={setConfirmTime} />
                        </div>
                        <div>
                          <Label className="text-xs">Notes (optional)</Label>
                          <Input
                            placeholder="e.g. Bring health record book"
                            value={confirmNotes}
                            onChange={(e) => setConfirmNotes(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleConfirm(req.id)}
                          disabled={actionLoading === req.id || !confirmDate}
                        >
                          {actionLoading === req.id ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="mr-2 h-3.5 w-3.5" />
                          )}
                          Confirm & notify parent via SMS
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Reject form (inline) */}
                  {rejectingId === req.id && (
                    <div className="border-t bg-red-50/50 p-5 dark:bg-red-950/20">
                      <p className="mb-3 text-sm font-medium text-red-700 dark:text-red-400">
                        Reason for rejection (optional, will be sent to parent)
                      </p>
                      <Input
                        placeholder="e.g. Vaccine not in stock, please try next week"
                        value={rejectNotes}
                        onChange={(e) => setRejectNotes(e.target.value)}
                      />
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(req.id)}
                          disabled={actionLoading === req.id}
                        >
                          {actionLoading === req.id ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="mr-2 h-3.5 w-3.5" />
                          )}
                          Reject & notify parent
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRejectingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
