"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Baby, CalendarDays, ClipboardList, Stethoscope, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { childProfiles, healthReminders, type ChildProfile } from "../data"

export default function ChildDetailsPage() {
  const [activeChildId, setActiveChildId] = useState(childProfiles[0]?.id ?? "")
  const activeChild = childProfiles.find((child) => child.id === activeChildId) ?? childProfiles[0]

  const formattedAge = useMemo(() => {
    if (!activeChild) return "--"
    return formatAge(activeChild.dateOfBirth)
  }, [activeChild])

  return (
    <div className="space-y-6 lg:space-y-8">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="relative size-16 overflow-hidden rounded-full border border-primary/30">
              {activeChild?.profilePhoto ? (
                <Image
                  src={activeChild.profilePhoto}
                  alt={`${activeChild.name} profile photo`}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center bg-primary/10 text-sm text-primary">
                  {activeChild?.name?.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Baby className="size-5" /> {activeChild?.name || "Child profile"}
              </CardTitle>
              <CardDescription>
                Review key information about {activeChild?.name?.split(" ")[0] || "your child"}&apos;s health record.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Child ID: {activeChild?.id}</Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="size-3" /> {childProfiles.length} registered child{childProfiles.length > 1 ? "ren" : ""}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {childProfiles.length > 1 ? (
            <div className="flex flex-wrap gap-3">
              {childProfiles.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setActiveChildId(child.id)}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${child.id === activeChildId ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:border-primary/40"}`}
                >
                  <div className="relative size-10 overflow-hidden rounded-full border border-border/60">
                    {child.profilePhoto ? (
                      <Image src={child.profilePhoto} alt={`${child.name} avatar`} fill sizes="40px" className="object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center bg-muted text-xs font-semibold uppercase">
                        {child.name.slice(0, 2)}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{child.name}</p>
                    <p className="text-xs text-muted-foreground">{child.relationship}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {activeChild ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Full name" value={activeChild.name} />
              <Detail label="Age" value={formattedAge} />
              <Detail label="Height" value={activeChild.height} />
              <Detail label="Date of birth" value={formatDate(activeChild.dateOfBirth)} />
              <Detail label="Birth weight" value={activeChild.birthWeight} />
              <Detail label="Blood type" value={activeChild.bloodType} />
              <Detail label="Primary facility" value={activeChild.primaryFacility} />
              <Detail label="Relationship" value={activeChild.relationship} />
              <Detail label="National ID" value={`${activeChild.id}-GHS`} hint="Linked to Ghana Health Service" />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="size-5" /> Health journal
            </CardTitle>
            <CardDescription>Daily notes captured during clinic visits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <JournalEntry
              date="Jan 20, 2025"
              notes="DPT (2nd dose) administered. Mild fever recorded in the evening; resolved with paracetamol."
            />
            <JournalEntry
              date="Dec 19, 2024"
              notes="DPT (1st dose) administered. No adverse reactions. Growth chart updated."
            />
            <JournalEntry
              date="Dec 5, 2024"
              notes="BCG and Polio (1st dose) recorded. Mother educated on post-shot care and hydration."
            />
            <Button asChild variant="outline" className="gap-2">
              <Link href="/parent/dashboard/vaccination-status">
                View vaccination history
                <CalendarDays className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Stethoscope className="size-5" /> Care reminders
            </CardTitle>
            <CardDescription>Shared by your nurse after recent visits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {healthReminders.map((reminder) => (
              <div key={reminder} className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2">
                {reminder}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

type DetailProps = {
  label: string
  value: string
  hint?: string
}

function Detail({ label, value, hint }: DetailProps) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

type JournalEntryProps = {
  date: string
  notes: string
}

function JournalEntry({ date, notes }: JournalEntryProps) {
  return (
    <div className="rounded-lg border border-border bg-background p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{date}</p>
      <p className="mt-2 leading-relaxed text-foreground">{notes}</p>
    </div>
  )
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) {
    return dateString
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function formatAge(dateString: string) {
  const dob = new Date(dateString)
  if (Number.isNaN(dob.getTime())) {
    return "--"
  }

  const now = new Date()
  const diffMs = now.getTime() - dob.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  const years = Math.floor(diffDays / 365)
  const months = Math.floor((diffDays % 365) / 30)

  if (years >= 1) {
    if (months > 0) {
      return `${years} ${years === 1 ? "year" : "years"} ${months} month${months === 1 ? "" : "s"}`
    }
    return `${years} ${years === 1 ? "year" : "years"}`
  }

  return `${Math.max(months, 0)} month${months === 1 ? "" : "s"}`
}
