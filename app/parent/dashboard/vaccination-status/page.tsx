'use client'

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useParentDashboard } from "../dashboard-context"
import * as parentApi from "@/lib/api/parent"
import { AlertTriangle, CalendarPlus, CheckCircle2, Clock3, Loader2, Syringe, User } from "lucide-react"

export default function VaccinationStatusPage() {
  const { children, getChildVaccinations, isLoading: isLoadingContext } = useParentDashboard()
  const [selectedChildId, setSelectedChildId] = useState<string>('')
  const [vaccinations, setVaccinations] = useState<parentApi.VaccinationRecord[]>([])
  const [isLoadingVaccinations, setIsLoadingVaccinations] = useState(false)
  const [isBookingOpen, setIsBookingOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  // Set initial selected child
  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id)
    }
  }, [children, selectedChildId])

  // Load vaccinations for selected child
  useEffect(() => {
    async function loadVaccinations() {
      if (!selectedChildId) return
      setIsLoadingVaccinations(true)
      try {
        const data = await getChildVaccinations(selectedChildId)
        setVaccinations(data)
      } catch (error) {
        console.error('Failed to load vaccinations:', error)
      } finally {
        setIsLoadingVaccinations(false)
      }
    }
    loadVaccinations()
  }, [selectedChildId, getChildVaccinations])

  const complete = vaccinations.filter((record) => record.status === "Completed")
  const scheduled = vaccinations.filter((record) => record.status === "Scheduled")
  const missed = vaccinations.filter((record) => record.status === "Missed")

  const isLoading = isLoadingContext || isLoadingVaccinations

  const selectedChild = children.find(child => child.id === selectedChildId)

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
      {/* Child Selector */}
      {children.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="size-5" /> Select Child
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {children.map((child) => (
                <Button
                  key={child.id}
                  variant={selectedChildId === child.id ? "default" : "outline"}
                  onClick={() => setSelectedChildId(child.id)}
                  className="flex items-center gap-2"
                >
                  {child.name} ({child.age})
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Syringe className="size-5" /> Vaccination timeline
            {selectedChild && <span className="text-sm font-normal text-muted-foreground">- {selectedChild.name}</span>}
          </CardTitle>
          <CardDescription>Review your child&apos;s completed, ongoing, and upcoming vaccinations.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Stats label="Completed" value={`${complete.length}`} icon={<CheckCircle2 className="size-5 text-primary" />} />
          <Stats label="Scheduled" value={`${scheduled.length}`} icon={<Clock3 className="size-5 text-secondary" />} />
          <Stats label="Missed" value={`${missed.length}`} icon={<AlertTriangle className="size-5 text-destructive" />} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Timeline</CardTitle>
          <CardDescription>Each entry includes completion status and due dates.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          ) : vaccinations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No vaccination records found. Records will appear here after your child receives their first vaccine.
            </div>
          ) : (
            vaccinations.map((record) => (
              <div
                key={record.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-base font-semibold text-foreground">{record.vaccine}</p>
                  <p className="text-xs text-muted-foreground">
                    Dose {record.doseNumber} • {record.facilityName}
                  </p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-6">
                  <Badge className="capitalize" variant={getStatusVariant(record.status)}>
                    {record.status}
                  </Badge>
                  <p className="text-xs text-muted-foreground">{record.administeredDate}</p>
                </div>
              </div>
            ))
          )}
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
  if (status === "Completed") return "default" as const
  if (status === "Scheduled") return "secondary" as const
  if (status === "Missed") return "destructive" as const
  return "outline" as const
}
