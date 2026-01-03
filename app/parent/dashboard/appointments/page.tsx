"use client"

import { useMemo, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useParentDashboard } from "../dashboard-context"
import { CalendarDays, CheckCircle2, FileText, Loader2, MapPin, PhoneCall, PlusCircle } from "lucide-react"

export default function AppointmentsPage() {
  const { appointments, isLoading } = useParentDashboard()
  const [isBookingOpen, setIsBookingOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [expandedAppointmentId, setExpandedAppointmentId] = useState<string | null>(null)

  const facilityOptions = useMemo(() => {
    const unique = new Set<string>()
    unique.add("Any participating clinic")
    appointments.forEach((appointment) => {
      if (appointment.facilityName) {
        unique.add(appointment.facilityName)
      }
    })
    return Array.from(unique)
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

      {confirmation ? (
        <Alert role="status" className="border-primary/40 bg-primary/10 text-primary-foreground">
          <CheckCircle2 className="size-5 text-primary" />
          <AlertTitle className="text-foreground">Request received</AlertTitle>
          <AlertDescription className="text-foreground/80">{confirmation}</AlertDescription>
        </Alert>
      ) : null}

      {isBookingOpen ? (
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
      ) : null}

      {isLoading ? (
        <Card className="flex items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin text-primary" />
        </Card>
      ) : appointments.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No appointments scheduled. Click "Book new appointment" to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {appointments.map((appointment) => {
            const appointmentId = appointment.id
            const isExpanded = expandedAppointmentId === appointmentId

            return (
              <Card key={appointmentId} className="border border-border">
                <CardHeader>
                  <CardTitle className="text-lg">{appointment.purpose}</CardTitle>
                  <CardDescription>
                    {appointment.scheduledDate} at {appointment.scheduledTime}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 text-foreground">
                    <MapPin className="size-4 text-primary" />
                    {appointment.facilityName}
                  </div>
                  {isExpanded ? (
                    <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-foreground">
                      <p className="font-semibold">Preparation checklist</p>
                      <p className="text-sm text-muted-foreground">{appointment.notes || "No special instructions."}</p>
                      <p className="text-xs text-muted-foreground">
                        Detailed instructions will sync here once the clinic publishes them in the backend system.
                      </p>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => toggleInstructions(appointmentId)}
                      aria-expanded={isExpanded}
                    >
                      <FileText className="size-4" /> {isExpanded ? "Hide instructions" : "View instructions"}
                    </Button>
                    <Button asChild variant="secondary" size="sm" className="gap-2">
                      <a href="tel:+233301234567" aria-label="Call the facility">
                        <PhoneCall className="size-4" /> Contact facility
                      </a>
                    </Button>
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
