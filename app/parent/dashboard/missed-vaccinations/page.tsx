'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { missedVaccinations } from "../data"
import { AlertTriangle, CalendarDays, ClipboardList, PhoneCall } from "lucide-react"

export default function MissedVaccinationsPage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-destructive">
            <AlertTriangle className="size-5" /> Missed vaccinations
          </CardTitle>
          <CardDescription>
            These vaccines are overdue. Please schedule a visit as soon as possible to keep Ama fully protected.
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
                <p>• Ensure Ama is not running a fever before the make-up dose.</p>
                <p>• Bring the child health record booklet for updates.</p>
                <p>• Notify staff if Ama had a reaction to previous doses.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="gap-2" variant="secondary">
                  <CalendarDays className="size-4" /> Schedule visit
                </Button>
                <Button className="gap-2" variant="outline">
                  <PhoneCall className="size-4" /> Call nurse
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="size-5" /> How to catch up
          </CardTitle>
          <CardDescription>Follow these steps to bring Ama&apos;s schedule back on track.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          <Step number="01" title="Book a make-up visit" description="Choose the next available slot that works for your family." />
          <Step number="02" title="Prepare Ama" description="Ensure Ama is well rested, hydrated, and has eaten lightly." />
          <Step number="03" title="Bring documentation" description="Carry the health record booklet and any recent lab results." />
          <Step number="04" title="Monitor after the shot" description="Keep an eye on Ama for 48 hours and follow the nurse&apos;s advice." />
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

function Step({ number, title, description }: StepProps) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs font-semibold text-primary">Step {number}</p>
      <p className="mt-2 text-base font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
