"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CalendarCheck, Check, Home, Loader2, Phone, User } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import * as facilityApi from "@/lib/api/facility"

export default function TodaysAppointmentsPage() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<facilityApi.TodayAppointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [facilityId, setFacilityId] = useState<string | undefined>(undefined)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirmNotes, setConfirmNotes] = useState("")
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchAppointments = useCallback(async (facilityId?: string) => {
    try {
      const data = await facilityApi.getTodaysAppointments(facilityId)
      setAppointments(data)
    } catch (error) {
      console.error("Failed to fetch today's appointments:", error)
      toast.error("Failed to load today's appointments")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleConfirm = async (appointmentId: string) => {
    if (confirmingId !== appointmentId) {
      setConfirmingId(appointmentId)
      setConfirmNotes("")
      return
    }

    setActionLoading(appointmentId)
    try {
      const result = await facilityApi.updateAppointmentStatus(appointmentId, "confirmed", {
        notes: confirmNotes || undefined,
      })
      toast.success(result.message)
      setConfirmingId(null)
      await fetchAppointments(facilityId)
    } catch (error) {
      console.error("Failed to confirm appointment:", error)
      toast.error("Failed to confirm appointment")
    } finally {
      setActionLoading(null)
    }
  }

  useEffect(() => {
    const role = localStorage.getItem("userRole")
    const detail = localStorage.getItem("userRoleDetail")

    if (role !== "staff" || detail !== "facility-nurse") {
      router.push("/auth/login")
      return
    }

    const resolvedFacilityId = localStorage.getItem("branchId") || undefined
    setFacilityId(resolvedFacilityId)
    fetchAppointments(resolvedFacilityId)
  }, [router, fetchAppointments])

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
            <h1 className="text-lg font-bold">Today&apos;s appointments</h1>
            <p className="text-xs text-muted-foreground">
              All scheduled and confirmed appointments for today.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarCheck className="h-5 w-5 text-primary" /> Daily clinic queue
              </CardTitle>
              <CardDescription>Contact guardians quickly and keep patient flow moving.</CardDescription>
            </div>
            <Badge variant="outline">{appointments.length} total</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading appointments...
              </div>
            ) : appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments scheduled for today.</p>
            ) : (
              appointments.map((appointment, index) => {
                const isChwVisit = appointment.visitPreference === "chw"
                const isScheduled = appointment.status === "scheduled"

                return (
                  <div key={`${appointment.id}-${appointment.childId}-${index}`} className="space-y-3">
                    <div
                      className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${
                        isChwVisit
                          ? "border-amber-300 bg-amber-50/40"
                          : "border-border bg-background/80"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-foreground">{appointment.childName}</p>
                        <p className="text-xs text-muted-foreground">Guardian: {appointment.caregiver}</p>
                        <p className="text-xs text-muted-foreground">{appointment.vaccine}</p>
                      </div>

                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <div className="flex flex-wrap items-center gap-2">
                          {isChwVisit ? (
                            <Badge className="gap-1 border-amber-200 bg-amber-100 text-amber-800">
                              <Home className="h-3.5 w-3.5" /> CHW home visit
                            </Badge>
                          ) : null}
                          <Badge variant="outline">{appointment.scheduledTime}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/facility/child/${appointment.childId}`}>
                              <User className="mr-1.5 h-4 w-4" /> Open chart
                            </Link>
                          </Button>
                          {appointment.contact && appointment.contact !== "N/A" ? (
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`tel:${appointment.contact.replace(/\s+/g, "")}`}>
                                <Phone className="mr-1.5 h-4 w-4" /> Call
                              </Link>
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" disabled>
                              <Phone className="mr-1.5 h-4 w-4" /> No phone
                            </Button>
                          )}
                          {isChwVisit && isScheduled ? (
                            <Button
                              size="sm"
                              className="gap-1"
                              onClick={() => handleConfirm(appointment.id)}
                              disabled={actionLoading === appointment.id}
                            >
                              {actionLoading === appointment.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                              {confirmingId === appointment.id ? "Send confirm" : "Confirm CHW"}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {isChwVisit && isScheduled && confirmingId === appointment.id ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                        <p className="text-xs font-semibold text-amber-800">Confirmation note (optional)</p>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <Input
                            placeholder="e.g. CHW will arrive between 10-11am"
                            value={confirmNotes}
                            onChange={(event) => setConfirmNotes(event.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleConfirm(appointment.id)}
                              disabled={actionLoading === appointment.id}
                            >
                              {actionLoading === appointment.id ? (
                                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="mr-1.5 h-4 w-4" />
                              )}
                              Confirm & notify
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmingId(null)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null}
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
