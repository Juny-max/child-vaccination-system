"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, CheckCircle2, FileWarning, ListChecks, MapPin, RefreshCw, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const conflicts = [
  {
    id: "SC-982",
    capturedAt: "10 Nov 2025 · 21:44",
    originator: "CHW_Kofi",
    location: "Ga East Outreach",
    issue: "Vaccination event references merged child",
    payloadSummary: "MR1 dose for CH-991"
  },
  {
    id: "SC-976",
    capturedAt: "10 Nov 2025 · 19:03",
    originator: "CHW_Esi",
    location: "Madina Clinic",
    issue: "Child deleted while offline",
    payloadSummary: "Growth monitoring for CH-702"
  },
]

const resolutionTemplates = [
  "Relink event to surviving child record",
  "Discard event and notify CHW",
  "Hold until HQ review",
]

export default function SyncConflictResolverPage() {
  const router = useRouter()
  const [selectedConflictId, setSelectedConflictId] = useState(conflicts[0]?.id ?? "")
  const selectedConflict = conflicts.find((conflict) => conflict.id === selectedConflictId) ?? conflicts[0]

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 text-sm">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-muted-foreground transition hover:text-foreground"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-4 w-4 text-primary" /> Conflicts refreshed 3 minutes ago
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr,1.1fr]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">Sync conflicts</CardTitle>
            <CardDescription>Events blocked from landing because of record changes while offline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {conflicts.map((conflict) => (
              <button
                key={conflict.id}
                onClick={() => setSelectedConflictId(conflict.id)}
                className={`w-full rounded-lg border p-3 text-left transition ${selectedConflictId === conflict.id ? "border-amber-500 bg-amber-50" : "border-border bg-background/70 hover:border-amber-400/60"}`}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground">{conflict.issue}</span>
                  <span className="text-xs text-muted-foreground">{conflict.id}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{conflict.location}</span>
                  <span>·</span>
                  <span>{conflict.originator}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="self-start border-amber-400/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> {selectedConflict?.id}
            </CardTitle>
            <CardDescription>Decide how to re-route the incoming data payload.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-sm">
            <div className="rounded-lg border border-dashed border-amber-400/50 bg-amber-50/60 p-4">
              <dl className="grid gap-1 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <dt className="font-semibold text-foreground">Captured</dt>
                  <dd>{selectedConflict?.capturedAt}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="font-semibold text-foreground">Originator</dt>
                  <dd>{selectedConflict?.originator}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="font-semibold text-foreground">Location</dt>
                  <dd className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {selectedConflict?.location}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="font-semibold text-foreground">Payload</dt>
                  <dd>{selectedConflict?.payloadSummary}</dd>
                </div>
              </dl>
            </div>

            <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
              <div className="grid gap-3">
                <Label htmlFor="resolution-template">Resolution template</Label>
                <select id="resolution-template" className="rounded-md border border-border bg-background px-3 py-2 text-sm" defaultValue="" required>
                  <option value="" disabled>
                    Select an action
                  </option>
                  {resolutionTemplates.map((template) => (
                    <option key={template} value={template}>
                      {template}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3">
                <Label htmlFor="link-to-child">Link to child record (optional)</Label>
                <Input id="link-to-child" placeholder="CH-558" className="text-sm" />
                <p className="text-xs text-muted-foreground">Provide a valid child ID if rerouting to a new survivor record.</p>
              </div>

              <div className="grid gap-3">
                <Label htmlFor="upload-attachment">Attach supporting file</Label>
                <Input id="upload-attachment" type="file" className="cursor-pointer" />
                <p className="text-xs text-muted-foreground">Attach CHW notes or spreadsheets that justify the decision.</p>
              </div>

              <div className="grid gap-3">
                <Label htmlFor="follow-up">Follow up with CHW (optional)</Label>
                <select id="follow-up" className="rounded-md border border-border bg-background px-3 py-2 text-sm" defaultValue="">
                  <option value="" disabled>
                    Choose follow-up action
                  </option>
                  <option value="notify">Notify CHW about resolution</option>
                  <option value="assign">Assign to supervisor</option>
                  <option value="none">No follow-up required</option>
                </select>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="submit" className="flex-1 gap-2 bg-amber-500 text-white hover:bg-amber-600">
                  <ListChecks className="h-4 w-4" /> Apply resolution
                </Button>
                <Button type="button" variant="outline" className="flex-1 gap-2">
                  <Upload className="h-4 w-4" /> Queue for HQ review
                </Button>
              </div>
            </form>

            <div className="rounded-lg border border-border bg-background/70 p-4 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Audit note</p>
              <p className="mt-1 leading-relaxed">
                All conflict resolutions are recorded with your user ID and timestamp. Any rerouted events will appear instantly on the relevant child timeline.
              </p>
              <Link href="/dashboard/deduplication" className="mt-3 inline-flex items-center gap-1 font-medium text-primary hover:underline">
                <CheckCircle2 className="h-3 w-3" /> Jump to deduplication module
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
