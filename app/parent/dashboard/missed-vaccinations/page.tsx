'use client'

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CalendarDays, ClipboardList, PhoneCall } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { childProfiles, missedVaccinations, type MissedVaccination } from "../data"

type VisitPreference = "facility" | "chw"

export default function MissedVaccinationsPage() {
  const primaryChild = childProfiles[0]

  const monthsOld = useMemo(() => calculateMonthsOld(primaryChild?.dateOfBirth), [primaryChild?.dateOfBirth])
  const isCHWRecommended = monthsOld !== null && monthsOld <= 24

  const [selectedVaccine, setSelectedVaccine] = useState<MissedVaccination | null>(null)
  const [visitPreference, setVisitPreference] = useState<VisitPreference>(isCHWRecommended ? "chw" : "facility")
  const [preferredFacility, setPreferredFacility] = useState(primaryChild?.primaryFacility ?? "Nearest district clinic")
  const [preferredDate, setPreferredDate] = useState("")
  const [preferredTime, setPreferredTime] = useState("")
  const [contactNumber, setContactNumber] = useState("")
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedVaccine) {
      return
    }

    const recommended = isCHWRecommended && selectedVaccine.daysOverdue >= 10 ? "chw" : "facility"
    setVisitPreference(recommended)
    setPreferredFacility(primaryChild?.primaryFacility ?? "Nearest district clinic")
    setPreferredDate("")
    setPreferredTime("")
    setContactNumber("")
    setReason("")
    setConfirmation(null)
  }, [selectedVaccine, isCHWRecommended, primaryChild?.primaryFacility])

  const minDate = useMemo(() => new Date().toISOString().split("T")[0], [])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedVaccine) return

    setIsSubmitting(true)

    window.setTimeout(() => {
      setIsSubmitting(false)
      setConfirmation(
        `Your child's ${selectedVaccine.vaccine} make-up dose request has been sent to ${
          visitPreference === "facility" ? preferredFacility : "the community health outreach coordinator"
        }. We will confirm the schedule via SMS once a nurse reviews it.`,
      )
    }, 800)
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

      <div className="grid gap-6 lg:grid-cols-2">
        {missedVaccinations.map((item) => (
          <Card key={item.vaccine} className="border border-dashed border-destructive/40">
            <CardHeader>
              <CardTitle className="text-lg">{item.vaccine}</CardTitle>
              <CardDescription>Due on {item.due}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-destructive/10 px-3 py-2">
                <Badge variant="destructive">{item.daysOverdue} days overdue</Badge>
                <span className="text-xs text-muted-foreground">Notify your nurse</span>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• Ensure your child is not running a fever before the make-up dose.</p>
                <p>• Bring the child health record booklet for updates.</p>
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

      {selectedVaccine ? (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">Schedule make-up dose</CardTitle>
            <CardDescription>
              {selectedVaccine.vaccine} • overdue by {selectedVaccine.daysOverdue} days. Complete this form to route the
              request to your facility team.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
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
                    <option value={primaryChild?.primaryFacility}>{primaryChild?.primaryFacility}</option>
                    <option value="Korle Bu Teaching Hospital">Korle Bu Teaching Hospital</option>
                    <option value="Ga Central Mobile Outreach Clinic">Ga Central Mobile Outreach Clinic</option>
                  </select>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground" htmlFor="preferredDate">
                    Preferred date
                  </label>
                  <Input
                    id="preferredDate"
                    type="date"
                    min={minDate}
                    required
                    value={preferredDate}
                    onChange={(event) => setPreferredDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground" htmlFor="preferredTime">
                    Preferred time
                  </label>
                  <Input
                    id="preferredTime"
                    type="time"
                    required
                    value={preferredTime}
                    onChange={(event) => setPreferredTime(event.target.value)}
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

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" className="gap-2" disabled={isSubmitting}>
                  <CalendarDays className="size-4" /> {isSubmitting ? "Submitting..." : "Submit request"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setSelectedVaccine(null)}>
                  Cancel
                </Button>
              </div>

              {confirmation ? (
                <div className="rounded-md border border-primary/40 bg-primary/10 p-4 text-sm text-foreground">
                  {confirmation}
                </div>
              ) : null}
            </form>
          </CardContent>
        </Card>
      ) : null}

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
          <Step number="03" title="Bring documentation" description="Carry the health record booklet and any recent lab results." />
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
