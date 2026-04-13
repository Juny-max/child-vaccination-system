"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, Loader2, Phone, User } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import * as facilityApi from "@/lib/api/facility"

const FOLLOW_UP_WINDOW_DAYS = 14

export default function MissedAppointmentsPage() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<facilityApi.MissedAppointmentReminder[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const role = localStorage.getItem("userRole")
    const detail = localStorage.getItem("userRoleDetail")

    if (role !== "staff" || detail !== "facility-nurse") {
      router.push("/auth/login")
      return
    }

    const facilityId = localStorage.getItem("branchId") || undefined

    const fetchMissedAppointments = async () => {
      try {
        const data = await facilityApi.getMissedAppointments(
          facilityId,
          FOLLOW_UP_WINDOW_DAYS,
        )
        setAppointments(data)
      } catch (error) {
        console.error("Failed to fetch missed appointments:", error)
        toast.error("Failed to load missed appointments")
      } finally {
        setIsLoading(false)
      }
    }

    fetchMissedAppointments()
  }, [router])

  const recentAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.daysSinceMissed <= FOLLOW_UP_WINDOW_DAYS),
    [appointments],
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-amber-50/20 dark:to-amber-950/10">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/facility/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-bold">Missed appointment follow-ups</h1>
            <p className="text-xs text-muted-foreground">
              Missed appointments from the last {FOLLOW_UP_WINDOW_DAYS} days.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Card className="border-amber-300/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" /> Follow-up queue
              </CardTitle>
              <CardDescription>Call and support guardians to rebook as quickly as possible.</CardDescription>
            </div>
            <Badge variant="outline">{recentAppointments.length} total</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading missed appointments...
              </div>
            ) : recentAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No missed appointments in the recent follow-up window.</p>
            ) : (
              recentAppointments.map((appointment, index) => (
                <div
                  key={`${appointment.id}-${appointment.childId}-${appointment.scheduledDate}-${index}`}
                  className="flex flex-col gap-3 rounded-lg border border-amber-200/70 bg-amber-50/40 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/40 dark:bg-amber-950/20"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{appointment.childName}</p>
                    <p className="text-xs text-muted-foreground">Guardian: {appointment.caregiver}</p>
                    <p className="text-xs text-muted-foreground">
                      Missed on {appointment.scheduledDate || "Unknown date"} at {appointment.scheduledTime} • {appointment.vaccine}
                    </p>
                  </div>

                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <Badge variant="outline" className="border-amber-400/60 text-amber-700 dark:text-amber-300">
                      {appointment.daysSinceMissed} day{appointment.daysSinceMissed === 1 ? "" : "s"} ago
                    </Badge>
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
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
