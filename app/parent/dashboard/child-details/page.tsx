'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { childInfo, healthReminders } from "../data"
import { Baby, CalendarDays, ClipboardList, Stethoscope } from "lucide-react"
import Link from "next/link"

export default function ChildDetailsPage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Baby className="size-5" /> Ama&apos;s profile
            </CardTitle>
            <CardDescription>Review key information about Ama&apos;s health record.</CardDescription>
          </div>
          <Badge variant="secondary">Child ID: {childInfo.id}</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Full name" value={childInfo.name} />
          <Detail label="Age" value={childInfo.age} />
          <Detail label="Birth weight" value={childInfo.birthWeight} />
          <Detail label="Blood type" value={childInfo.bloodType} />
          <Detail label="Primary facility" value={childInfo.primaryFacility} />
          <Detail label="National ID" value="GHA-549232" hint="Linked to Ghana Health Service" />
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
