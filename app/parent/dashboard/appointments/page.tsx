"use client"

import { useMemo, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useParentDashboard } from "../dashboard-context"
import {
  Baby,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MapPin,
  PhoneCall,
  PlusCircle,
  Syringe,
  XCircle,
  AlertCircle,
} from "lucide-react"

// Status configuration for visual display
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  scheduled: {
    label: "Pending Review",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10 border-yellow-500/30",
    icon: <Clock className="size-4" />,
  },
  confirmed: {
    label: "Confirmed",
    color: "text-green-400",
    bgColor: "bg-green-500/10 border-green-500/30",
    icon: <CheckCircle2 className="size-4" />,
  },
  completed: {
    label: "Completed",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/30",
    icon: <CheckCircle2 className="size-4" />,
  },
  cancelled: {
    label: "Rejected",
    color: "text-red-400",
    bgColor: "bg-red-500/10 border-red-500/30",
    icon: <XCircle className="size-4" />,
  },
  missed: {
    label: "Missed",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10 border-orange-500/30",
    icon: <AlertCircle className="size-4" />,
  },
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "Not set"
  try {
    const date = new Date(dateStr + "T00:00:00")
    return date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  } catch {
    return dateStr
  }
}

function formatTime(timeStr: string): string {
  if (!timeStr || timeStr === "TBD") return "Time TBD"
  try {
    const parts = timeStr.split(":")
    const hours = parseInt(parts[0], 10)
    const minutes = parts[1] || "00"
    const ampm = hours >= 12 ? "PM" : "AM"
    const displayHour = hours % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  } catch {
    return timeStr
  }
}

export default function AppointmentsPage() {
  const { appointments, isLoading } = useParentDashboard()
  const [isBookingOpen, setIsBookingOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [expandedAppointmentId, setExpandedAppointmentId] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>("all")

  const facilityOptions = useMemo(() => {
    const unique = new Set<string>()
    unique.add("Any participating clinic")
    appointments.forEach((appointment) => {
      if (appointment.facilityName && appointment.facilityName !== "Not assigned yet" && appointment.facilityName !== "Not assigned") {
        unique.add(appointment.facilityName)
      }
    })
    return Array.from(unique)
  }, [appointments])

  const filteredAppointments = useMemo(() => {
    if (filter === "all") return appointments
    return appointments.filter((a) => a.status === filter)
  }, [appointments, filter])

  // Sort: confirmed first, then scheduled, then others
  const sortedAppointments = useMemo(() => {
    const priority: Record<string, number> = {
      confirmed: 0,
      scheduled: 1,
      missed: 2,
      cancelled: 3,
      completed: 4,
    }
    return [...filteredAppointments].sort((a, b) => {
      const pa = priority[a.status] ?? 5
      const pb = priority[b.status] ?? 5
      if (pa !== pb) return pa - pb
      return new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()
    })
  }, [filteredAppointments])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: appointments.length }
    appointments.forEach((a) => {
      counts[a.status] = (counts[a.status] || 0) + 1
    })
    return counts
  }, [appointments])

  const toggleInstructions = (appointmentId: string) => {
    setExpandedAppointmentId((previous) => (previous === appointmentId ? null : appointmentId))
  }

  const handleOpenBooking = () => {
    setConfirmation(null)
    setIsBookingOpen(true)
  }

  const handleCancelBooking = () => {
    setIsBookingOpen(false)
  }

  const handleBookingSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const formData = new FormData(formElement)
    const preferredDate = formData.get("preferredDate")?.toString() ?? ""
    const preferredTime = formData.get("preferredTime")?.toString() ?? ""
    const selectedFacility = formData.get("facility")?.toString() ?? "the selected facility"

    setIsSubmitting(true)

    window.setTimeout(() => {
      setIsSubmitting(false)
      setIsBookingOpen(false)
      setConfirmation(
        `Appointment request sent for ${preferredDate || "your chosen date"} at ${preferredTime || "your chosen time"}. ${selectedFacility} will confirm via SMS shortly.`,
      )
      formElement.reset()
    }, 700)
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CalendarDays className="size-5" /> Appointments
            </CardTitle>
            <CardDescription>Review upcoming and past appointments for your child.</CardDescription>
          </div>
          <Button variant="secondary" size="sm" className="gap-2" onClick={handleOpenBooking}>
            <PlusCircle className="size-4" /> Book new appointment
          </Button>
        </CardHeader>
      </Card>

      {/* Status filter tabs */}
      {appointments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "All" },
            { key: "confirmed", label: "Confirmed" },
            { key: "scheduled", label: "Pending" },
            { key: "completed", label: "Completed" },
            { key: "cancelled", label: "Rejected" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
              {(statusCounts[key] || 0) > 0 && (
                <span className="ml-1.5 text-xs opacity-70">({statusCounts[key]})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {confirmation && (
        <Alert role="status" className="border-primary/40 bg-primary/10 text-primary-foreground">
          <CheckCircle2 className="size-5 text-primary" />
          <AlertTitle className="text-foreground">Request received</AlertTitle>
          <AlertDescription className="text-foreground/80">{confirmation}</AlertDescription>
        </Alert>
      )}

      {isBookingOpen && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-lg">Request a new appointment</CardTitle>
            <CardDescription>Share your preferred schedule and we&apos;ll notify the clinic instantly.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleBookingSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground" htmlFor="preferredDate">
                    Preferred date
                  </label>
                  <Input id="preferredDate" name="preferredDate" type="date" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground" htmlFor="preferredTime">
                    Preferred time
                  </label>
                  <Input id="preferredTime" name="preferredTime" type="time" required />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="facility">
                  Facility
                </label>
                <select
                  id="facility"
                  name="facility"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  defaultValue={facilityOptions[0]}
                >
                  {facilityOptions.map((facility, index) => (
                    <option key={`facility-${index}-${facility}`} value={facility}>
                      {facility}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="contactNumber">
                  Reachable phone number
                </label>
                <Input id="contactNumber" name="contactNumber" type="tel" placeholder="e.g. +233 24 123 4567" required />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground" htmlFor="notes">
                  Notes for the nurse (optional)
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Share recent symptoms or preferred visit window"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" className="gap-2" disabled={isSubmitting}>
                  <CalendarDays className="size-4" /> {isSubmitting ? "Submitting..." : "Submit request"}
                </Button>
                <Button type="button" variant="ghost" onClick={handleCancelBooking}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card className="flex items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin text-primary" />
        </Card>
      ) : sortedAppointments.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {filter === "all"
              ? 'No appointments scheduled. Click "Book new appointment" to create one.'
              : `No ${filter} appointments found.`}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sortedAppointments.map((appointment) => {
            const appointmentId = appointment.id
            const isExpanded = expandedAppointmentId === appointmentId
            const statusInfo = STATUS_CONFIG[appointment.status] || STATUS_CONFIG.scheduled

            return (
              <Card key={appointmentId} className={`border ${statusInfo.bgColor} transition-all`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Syringe className="size-4 text-primary" />
                        {appointment.purpose}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Baby className="size-3.5" />
                        <span>
                          {appointment.childName}
                          {appointment.childCvccId && (
                            <span className="ml-1 text-xs opacity-70">({appointment.childCvccId})</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusInfo.bgColor} ${statusInfo.color}`}
                    >
                      {statusInfo.icon}
                      {statusInfo.label}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {/* Date & Time */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <div className="flex items-center gap-1.5 text-foreground">
                      <CalendarDays className="size-4 text-primary/70" />
                      <span className="font-medium">{formatDate(appointment.scheduledDate)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="size-3.5" />
                      <span>{formatTime(appointment.scheduledTime)}</span>
                    </div>
                  </div>

                  {/* Facility */}
                  <div className="flex items-start gap-1.5 text-sm">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary/70" />
                    <div>
                      <span className="font-medium text-foreground">{appointment.facilityName}</span>
                      {appointment.facilityAddress && (
                        <p className="text-xs text-muted-foreground">{appointment.facilityAddress}</p>
                      )}
                    </div>
                  </div>

                  {/* Nurse notes (shows when nurse confirmed/rejected with a note) */}
                  {appointment.notes && appointment.notes.includes("Nurse:") && (
                    <div className="rounded-md border border-border bg-muted/30 p-2.5 text-sm">
                      <p className="mb-0.5 text-xs font-semibold text-primary">Nurse&apos;s note</p>
                      <p className="text-muted-foreground">
                        {appointment.notes
                          .split("---")
                          .pop()
                          ?.replace(/^[\s]*Nurse:\s*/i, "")
                          .trim() || appointment.notes}
                      </p>
                    </div>
                  )}

                  {/* Expandable details */}
                  {isExpanded && (
                    <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-foreground">
                      <p className="text-sm font-semibold">Preparation checklist</p>
                      <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
                        <li>Carry the child health record booklet</li>
                        <li>Arrive 15 minutes early</li>
                        <li>Note any reactions since the previous dose</li>
                        <li>Ensure your child has eaten a light meal</li>
                      </ul>
                      {appointment.notes && !appointment.notes.includes("Nurse:") && (
                        <div className="mt-2 border-t border-border pt-2">
                          <p className="text-xs font-medium text-muted-foreground">Your notes:</p>
                          <p className="text-sm text-muted-foreground">{appointment.notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => toggleInstructions(appointmentId)}
                      aria-expanded={isExpanded}
                    >
                      <FileText className="size-3.5" />
                      {isExpanded ? "Hide details" : "View details"}
                    </Button>
                    {appointment.facilityPhone && (
                      <Button asChild variant="secondary" size="sm" className="gap-1.5 text-xs">
                        <a href={`tel:${appointment.facilityPhone}`} aria-label="Call the facility">
                          <PhoneCall className="size-3.5" /> Call facility
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Appointment checklist</CardTitle>
          <CardDescription>Prepare ahead of every visit.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          {[
            "Carry the child health record booklet",
            "Pack extra diapers and a change of clothes",
            "Note any reactions since the previous dose",
            "Ensure your child eats a light meal before the visit",
          ].map((item) => (
            <div key={item} className="rounded-lg border border-border bg-background p-4">
              {item}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
