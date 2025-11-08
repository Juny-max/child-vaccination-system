'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useParentDashboard } from "../dashboard-context"
import { motherDetailsTemplate } from "../data"
import { Edit3, MapPin, Phone, ShieldCheck, User } from "lucide-react"

export default function MotherDetailsPage() {
  const { userName } = useParentDashboard()
  const motherDetails = { ...motherDetailsTemplate, name: userName }

  return (
    <div className="space-y-6 lg:space-y-8">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <User className="size-5" /> Mother profile
            </CardTitle>
            <CardDescription>Keep your contact and emergency information up to date.</CardDescription>
          </div>
          <Button variant="secondary" size="sm" className="gap-2">
            <Edit3 className="size-4" /> Update details
          </Button>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact information</CardTitle>
            <CardDescription>Used by your care team for reminders and follow ups.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Info label="Full name" value={motherDetails.name} icon={<User className="size-4 text-primary" />} />
            <Info label="Phone" value={motherDetails.phone} icon={<Phone className="size-4 text-primary" />} />
            <Info label="Email" value={motherDetails.email} icon={<ShieldCheck className="size-4 text-primary" />} />
            <Info label="Address" value={motherDetails.address} icon={<MapPin className="size-4 text-primary" />} />
          </CardContent>
        </Card>

        <Card className="border border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">Care coordinator</CardTitle>
            <CardDescription>Your assigned nurse and next planned visit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-primary">Assigned nurse</p>
              <p className="text-base font-semibold text-foreground">{motherDetails.primaryNurse}</p>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-primary">Next visit</p>
              <p className="text-base font-semibold text-foreground">{motherDetails.nextVisit}</p>
            </div>
            <p>
              Keep this information updated to ensure the clinic can reach you for schedule changes, reminders, or urgent
              follow-ups.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Emergency contacts</CardTitle>
          <CardDescription>Add trusted contacts who can bring Ama for appointments when needed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold text-foreground">Kwame Asante</p>
              <p>Father • +233 24 555 8899</p>
            </div>
            <Badge variant="secondary">Primary</Badge>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold text-foreground">Ama Serwaa</p>
              <p>Sister • +233 20 111 2233</p>
            </div>
            <Button variant="outline" size="sm">Edit</Button>
          </div>
          <Button variant="ghost" size="sm" className="self-start">
            + Add another contact
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

type InfoProps = {
  label: string
  value: string
  icon: React.ReactNode
}

function Info({ label, value, icon }: InfoProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-4">
      <div className="mt-1 flex size-7 items-center justify-center rounded-md bg-primary/10">{icon}</div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-base font-semibold text-foreground">{value}</p>
      </div>
    </div>
  )
}
