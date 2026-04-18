'use client'

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useParentDashboard } from "../dashboard-context"
import { PhoneCall, ShieldCheck } from "lucide-react"

export default function SupportPage() {
  const { userName, dashboard, children, missedVaccinations, appointments } = useParentDashboard()

  const childrenSummary = useMemo(() => {
    return dashboard?.children.map(child => ({
      id: child.id,
      name: child.name,
      age: child.age,
      completionPercentage: child.vaccinationProgress.percentage,
      hasMissedVaccinations: child.hasMissedVaccinations,
    })) || children.map(child => ({
      id: child.id,
      name: child.name,
      age: child.age,
      completionPercentage: 0,
      hasMissedVaccinations: false,
    }))
  }, [dashboard, children])

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-secondary/10 to-muted">
        <CardHeader>
          <CardTitle className="text-2xl">Support &amp; Guidance</CardTitle>
          <CardDescription>
            Information about your children&apos;s vaccinations and how to contact your clinic.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Info Cards */}
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What we can help with</CardTitle>
            <CardDescription>Guidance for your child&apos;s vaccination needs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="font-semibold text-foreground">📊 Vaccination status</p>
              <p>Check which vaccines your children have completed and what&apos;s coming next.</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="font-semibold text-foreground">💉 Post-vaccination care</p>
              <p>Advice on managing fever, swelling, or other common side effects after a dose.</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="font-semibold text-foreground">📅 Appointments &amp; reminders</p>
              <p>Information about upcoming appointments and what to bring to the clinic.</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="font-semibold text-foreground">📚 Vaccine information</p>
              <p>Learn about Ghana&apos;s immunization schedule and why each vaccine matters.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">Your children&apos;s summary</CardTitle>
            <CardDescription>Quick overview of vaccination status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {childrenSummary.length > 0 ? (
              childrenSummary.map((child) => (
                <div key={child.id} className="rounded-lg border border-border bg-background p-3">
                  <p className="font-semibold text-foreground">{child.name}</p>
                  <p className="text-xs text-muted-foreground">{child.age}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${child.completionPercentage}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium">{child.completionPercentage}%</span>
                  </div>
                  {child.hasMissedVaccinations && (
                    <Badge variant="destructive" className="mt-2 text-xs">
                      Has missed doses
                    </Badge>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No children registered yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Human Support Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="size-5" /> Contact your clinic
          </CardTitle>
          <CardDescription>Reach your primary care team directly for urgent matters.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-semibold text-foreground">Nungua Health Centre</p>
            <p>Support line: +233 302 711 234 (Mon – Fri, 8:00 AM – 5:00 PM)</p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <a href="tel:+233302711234" aria-label="Call the clinic">
              <PhoneCall className="size-4" /> Call the clinic
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
