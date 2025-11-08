'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { appointments } from "../data"
import { CalendarDays, FileText, MapPin, PhoneCall, PlusCircle } from "lucide-react"

export default function AppointmentsPage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CalendarDays className="size-5" /> Appointments
            </CardTitle>
            <CardDescription>Review upcoming and past appointments for Ama.</CardDescription>
          </div>
          <Button variant="secondary" size="sm" className="gap-2">
            <PlusCircle className="size-4" /> Book new appointment
          </Button>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {appointments.map((appointment) => (
          <Card key={`${appointment.title}-${appointment.date}`} className="border border-border">
            <CardHeader>
              <CardTitle className="text-lg">{appointment.title}</CardTitle>
              <CardDescription>{appointment.date} at {appointment.time}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 text-foreground">
                <MapPin className="size-4 text-primary" />
                {appointment.location}
              </div>
              <p>{appointment.notes}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" size="sm" className="gap-2">
                  <FileText className="size-4" /> View instructions
                </Button>
                <Button variant="secondary" size="sm" className="gap-2">
                  <PhoneCall className="size-4" /> Contact facility
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
            "Ensure Ama eats a light meal before the visit",
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
