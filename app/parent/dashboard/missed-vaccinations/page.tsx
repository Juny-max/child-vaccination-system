'use client'

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, Loader2, PhoneCall } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"
import { useParentDashboard } from "../dashboard-context"
import * as parentApi from "@/lib/api/parent"
import { toast } from "sonner"

type VisitPreference = "facility" | "chw"
type MissedVaccination = parentApi.MissedVaccination

export default function MissedVaccinationsPage() {
  const { children, missedVaccinations, isLoading } = useParentDashboard()
  const primaryChild = children[0]

  const monthsOld = useMemo(() => calculateMonthsOld(primaryChild?.dateOfBirth), [primaryChild?.dateOfBirth])
  const isCHWRecommended = monthsOld !== null && monthsOld <= 24

  const [selectedVaccine, setSelectedVaccine] = useState<MissedVaccination | null>(null)
  const [visitPreference, setVisitPreference] = useState<VisitPreference>(isCHWRecommended ? "chw" : "facility")
  const [preferredFacility, setPreferredFacility] = useState(primaryChild?.facilityName ?? "Nearest district clinic")
  const [preferredDate, setPreferredDate] = useState<Date | undefined>(undefined)
  const [preferredTime, setPreferredTime] = useState<string>("")
  const [contactNumber, setContactNumber] = useState("")
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedVaccine) {
      return
    }

    const recommended = isCHWRecommended && selectedVaccine.daysOverdue >= 10 ? "chw" : "facility"
    setVisitPreference(recommended)
    setPreferredFacility(primaryChild?.facilityName ?? "Nearest district clinic")
    setPreferredDate(undefined)
    setPreferredTime("")
    setContactNumber("")
    setReason("")
    setConfirmation(null)
    setError(null)
  }, [selectedVaccine, isCHWRecommended, primaryChild?.facilityName])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedVaccine || !primaryChild) return

    if (!preferredDate || !preferredTime) {
      toast.error("Please select both date and time")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Validate childId exists
      if (!selectedVaccine.childId) {
        throw new Error('Child ID is missing from selected vaccine')
      }

      // Format date to YYYY-MM-DD (local date, timezone-safe)
      const year = preferredDate.getFullYear()
      const month = String(preferredDate.getMonth() + 1).padStart(2, '0')
      const day = String(preferredDate.getDate()).padStart(2, '0')
      const formattedDate = `${year}-${month}-${day}`

      // Create appointment via API
      // Store contact phone separately so the system can send SMS to this number
      await parentApi.createAppointment({
        childId: selectedVaccine.childId,
        facilityId: primaryChild.facilityId,
        scheduledDate: formattedDate,
        scheduledTime: preferredTime,
        purpose: `Make-up dose: ${selectedVaccine.vaccine}`,
        contactPhone: contactNumber || undefined,
        notes: `Visit preference: ${visitPreference}. Additional notes: ${reason || 'None'}`,
      })

      setIsSubmitting(false)
      const successMessage =
        `Your child's ${selectedVaccine.vaccine} make-up dose request has been saved and sent to ${
          visitPreference === "facility" ? preferredFacility : "the community health outreach coordinator"
        }. We will confirm the schedule via SMS once a nurse reviews it.`
      setConfirmation(successMessage)
      setSelectedVaccine(null)
      setIsConfirmationModalOpen(true)
    } catch (err) {
      setIsSubmitting(false)
      setError(err instanceof Error ? err.message : 'Failed to schedule appointment. Please try again.')
      console.error('Failed to create appointment:', err)
    }
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-destructive">
            <AlertTriangle className="size-5" /> Missed vaccinations
          </CardTitle>
          <CardDescription>
            These vaccines are overdue. Please schedule a visit as soon as possible to keep your child fully protected.
          </CardDescription>
        </CardHeader>
      </Card>

      {isLoading ? (
        <Card className="flex items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin text-primary" />
        </Card>
      ) : missedVaccinations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            🎉 Great news! Your children have no missed vaccinations. Keep up the good work!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {missedVaccinations.map((item) => (
            <Card key={`${item.childId}-${item.vaccine}`} className="border border-dashed border-destructive/40">
              <CardHeader>
                <CardTitle className="text-lg">{item.vaccine}</CardTitle>
                <CardDescription>
                  {item.childName} • Due on {item.dueDate}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-destructive/10 px-3 py-2">
                  <Badge variant="destructive">{item.daysOverdue} days overdue</Badge>
                  <span className="text-xs text-muted-foreground">Notify your nurse</span>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Ensure your child is not running a fever before the make-up dose.</p>
                  <p>• Have the child's digital health record ready for updates.</p>
                  <p>• Notify staff if your child had a reaction to previous doses.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button className="gap-2" variant="secondary" onClick={() => setSelectedVaccine(item)}>
                    <CalendarDays className="size-4" /> Schedule visit
                  </Button>
                  <Button asChild className="gap-2" variant="outline">
                    <a href="tel:+233301234567" aria-label="Call your nurse">
                      <PhoneCall className="size-4" /> Call nurse
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(selectedVaccine)}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) {
            setSelectedVaccine(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg">Schedule make-up dose</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedVaccine?.vaccine || "Selected vaccine"} • overdue by {selectedVaccine?.daysOverdue || 0} days. Complete this form to route the request to your facility team.
            </p>
          </DialogHeader>

          {selectedVaccine ? (
            <form className="mt-4 flex min-h-0 flex-1 flex-col gap-4" onSubmit={handleSubmit}>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
                <div className="rounded-lg border border-border bg-background/80 p-4 text-sm text-muted-foreground">
                  {isCHWRecommended ? (
                    <p>
                      Your child is {monthsOld} months old, so a community health worker (CHW) home visit is allowed for make-up doses.
                      Choose the option that best suits your family.
                    </p>
                  ) : (
                    <p>
                      CHW home visits are reserved for infants under 24 months or special cases. Our records recommend a facility visit
                      for this request.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">Visit preference</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="flex flex-1 items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:border-primary/40">
                      <input
                        type="radio"
                        name="visit-preference"
                        value="facility"
                        checked={visitPreference === "facility"}
                        onChange={() => setVisitPreference("facility")}
                        className="size-4"
                      />
                      <div>
                        <p className="font-medium text-foreground">Facility visit</p>
                        <p className="text-xs text-muted-foreground">Arrive at the clinic for the make-up dose.</p>
                      </div>
                    </label>
                    <label
                      className={`flex flex-1 items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                        isCHWRecommended ? "border-border bg-background hover:border-primary/40" : "border-border/60 bg-muted"
                      }`}
                    >
                      <input
                        type="radio"
                        name="visit-preference"
                        value="chw"
                        checked={visitPreference === "chw"}
                        onChange={() => setVisitPreference("chw")}
                        className="size-4"
                        disabled={!isCHWRecommended}
                      />
                      <div>
                        <p className="font-medium text-foreground">Request CHW home visit</p>
                        <p className="text-xs text-muted-foreground">
                          {isCHWRecommended
                            ? "A CHW will be dispatched with the vaccine cold-box to your home."
                            : "Available for infants under 24 months or special medical cases."}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {visitPreference === "facility" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground" htmlFor="facility">
                      Facility
                    </label>
                    <select
                      id="facility"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={preferredFacility}
                      onChange={(event) => setPreferredFacility(event.target.value)}
                    >
                      <option value={primaryChild?.facilityName}>{primaryChild?.facilityName || "Primary Facility"}</option>
                      <option value="Korle Bu Teaching Hospital">Korle Bu Teaching Hospital</option>
                      <option value="Ga Central Mobile Outreach Clinic">Ga Central Mobile Outreach Clinic</option>
                    </select>
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">
                      Preferred date
                    </label>
                    <DatePicker
                      date={preferredDate}
                      onDateChange={setPreferredDate}
                      placeholder="Pick a date"
                      minDate={new Date()}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">
                      Preferred time
                    </label>
                    <TimePicker
                      time={preferredTime}
                      onTimeChange={setPreferredTime}
                      placeholder="Select time"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground" htmlFor="contactNumber">
                    Reachable phone number
                  </label>
                  <Input
                    id="contactNumber"
                    type="tel"
                    placeholder="e.g. +233 24 123 4567"
                    required
                    value={contactNumber}
                    onChange={(event) => setContactNumber(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground" htmlFor="reason">
                    Notes for the nurse
                  </label>
                  <textarea
                    id="reason"
                    rows={3}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Share any recent symptoms or logistics concerns"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </div>
              </div>

              {error ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                  ⚠️ {error}
                </div>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row shrink-0">
                <Button type="submit" className="gap-2" disabled={isSubmitting}>
                  <CalendarDays className="size-4" /> {isSubmitting ? "Submitting..." : "Submit request"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setSelectedVaccine(null)} disabled={isSubmitting}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isConfirmationModalOpen} onOpenChange={setIsConfirmationModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="sr-only">Request saved</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="rounded-full bg-emerald-100 p-3">
              <CheckCircle2 className="size-10 text-emerald-600 animate-bounce" />
            </div>
            <p className="text-sm text-foreground">✓ {confirmation}</p>
            <Button onClick={() => setIsConfirmationModalOpen(false)} className="mt-1">
              Okay
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="size-5" /> How to catch up
          </CardTitle>
          <CardDescription>Follow these steps to bring your child&apos;s schedule back on track.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          <Step
            number="01"
            title="Book a make-up visit"
            description="Choose the next available slot that works for your family."
          />
          <Step
            number="02"
            title="Prepare your child"
            description="Ensure your child is well rested, hydrated, and has eaten lightly."
          />
          <Step number="03" title="Prepare records" description="Have the child's digital health record and any recent lab results ready." />
          <Step
            number="04"
            title="Monitor after the shot"
            description="Keep an eye on your child for 48 hours and follow the nurse's advice."
          />
        </CardContent>
      </Card>
    </div>
  )
}

type StepProps = {
  number: string
  title: string
  description: string
}

function calculateMonthsOld(dateString?: string) {
  if (!dateString) return null
  const dob = new Date(dateString)
  if (Number.isNaN(dob.getTime())) return null

  const now = new Date()
  let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth())
  if (now.getDate() < dob.getDate()) {
    months -= 1
  }
  return Math.max(months, 0)
}

function Step({ number, title, description }: StepProps) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs font-semibold text-primary">Step {number}</p>
      <p className="mt-2 text-base font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
