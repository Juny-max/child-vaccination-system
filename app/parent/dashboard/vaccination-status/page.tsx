'use client'

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { vaccinationRecords } from "../data"
import { AlertTriangle, CalendarPlus, CheckCircle2, Clock3, Syringe } from "lucide-react"

export default function VaccinationStatusPage() {
  const [isBookingOpen, setIsBookingOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  const complete = vaccinationRecords.filter((record) => record.status === "Complete")
  const onTrack = vaccinationRecords.filter((record) => record.status === "On Track")
  const upcoming = vaccinationRecords.filter((record) => record.status === "Upcoming")

  const handleLaunchBooking = () => {
    setIsBookingOpen(true)
    setConfirmation(null)
  }

  const handleBookingSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const formData = new FormData(formElement)
    const preferredDate = formData.get("preferredDate")?.toString() ?? ""
    const preferredTime = formData.get("preferredTime")?.toString() ?? ""

    setIsSubmitting(true)

    window.setTimeout(() => {
      setIsSubmitting(false)
      setIsBookingOpen(false)
      setConfirmation(`Request sent for ${preferredDate || "your chosen date"} at ${preferredTime || "your chosen time"}. The clinic will confirm soon.`)
      formElement.reset()
    }, 700)
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Syringe className="size-5" /> Vaccination timeline
          </CardTitle>
          <CardDescription>Review your child&apos;s completed, ongoing, and upcoming vaccinations.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Stats label="Completed" value={`${complete.length}`} icon={<CheckCircle2 className="size-5 text-primary" />} />
          <Stats label="On track" value={`${onTrack.length}`} icon={<Clock3 className="size-5 text-secondary" />} />
          <Stats label="Upcoming" value={`${upcoming.length}`} icon={<CalendarPlus className="size-5 text-muted-foreground" />} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Timeline</CardTitle>
          <CardDescription>Each entry includes completion status and due dates.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {vaccinationRecords.map((record) => (
            <div
              key={`${record.vaccine}-${record.dose}`}
              className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-base font-semibold text-foreground">{record.vaccine}</p>
                <p className="text-xs text-muted-foreground">Dose {record.dose}</p>
              </div>
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-6">
                <Badge className="capitalize" variant={getStatusVariant(record.status)}>
                  {record.status}
                </Badge>
                <p className="text-xs text-muted-foreground">{record.date}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-destructive">
            <AlertTriangle className="size-5" /> Upcoming dose notice
          </CardTitle>
          <CardDescription>Make sure your child receives the pending MMR dose to unlock the digital certificate.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              MMR (Dose 1/2) is still pending. Schedule an appointment or inform your nurse if your child is unwell.
            </p>
          </div>
          <Button className="gap-2" variant="secondary" onClick={handleLaunchBooking}>
            <CalendarPlus className="size-4" /> Book appointment
          </Button>
        </CardContent>
        {isBookingOpen ? (
          <CardContent className="border-t border-border bg-muted/40">
            <form className="space-y-4" onSubmit={handleBookingSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground" htmlFor="preferredDate">
                    Preferred date
                  </label>
                  <Input id="preferredDate" name="preferredDate" type="date" required />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground" htmlFor="preferredTime">
                    Preferred time
                  </label>
                  <Input id="preferredTime" name="preferredTime" type="time" required />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="contactNumber">
                  Contact number
                </label>
                <Input id="contactNumber" name="contactNumber" type="tel" placeholder="e.g. +233 24 123 4567" required />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="notes">
                  Notes for the nurse (optional)
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Mention recent symptoms or preferred facility"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" className="gap-2" disabled={isSubmitting}>
                  <CalendarPlus className="size-4" /> {isSubmitting ? "Submitting..." : "Submit request"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setIsBookingOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        ) : null}
        {confirmation ? (
          <CardContent className="border-t border-primary/20 bg-primary/5 text-sm text-foreground">
            {confirmation}
          </CardContent>
        ) : null}
      </Card>
    </div>
  )
}

type StatsProps = {
  label: string
  value: string
  icon: React.ReactNode
}

function Stats({ label, value, icon }: StatsProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
      <div className="flex size-10 items-center justify-center rounded-md bg-muted/70">{icon}</div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold text-foreground">{value}</p>
      </div>
    </div>
  )
}

function getStatusVariant(status: string) {
  if (status === "Complete") return "default" as const
  if (status === "On Track") return "secondary" as const
  return "outline" as const
}
