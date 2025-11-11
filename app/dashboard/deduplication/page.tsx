"use client"

import type { ChangeEvent, FormEvent } from "react"
import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, FileWarning, Link2, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const pairs = [
  {
    id: "DQ-4472",
    similarityScore: "92%",
    childA: {
      id: "CH-558",
      name: "Ama Mensah",
      dob: "12 Mar 2024",
      mother: "Akosua Mensah",
      lastVisit: "05 Nov 2025 · Dome Clinic",
    },
    childB: {
      id: "CH-991",
      name: "Ama Mensah",
      dob: "14 Mar 2024",
      mother: "Akosua Mensah",
      lastVisit: "11 Nov 2025 · Outreach",
    },
    signals: ["Exact mother phone", "Matching catchment", "Vaccinations 4 days apart"],
  },
  {
    id: "DQ-4473",
    similarityScore: "88%",
    childA: {
      id: "CH-612",
      name: "Kojo Mensima",
      dob: "02 Jun 2023",
      mother: "Efua Mensima",
      lastVisit: "02 Nov 2025 · Osu Clinic",
    },
    childB: {
      id: "CH-640",
      name: "Kojo Mensah",
      dob: "05 Jun 2023",
      mother: "Efia Mensah",
      lastVisit: "09 Nov 2025 · Outreach",
    },
    signals: ["Name similarity", "Catchment overlap", "Same CHW"],
  },
]

const mergeReasons = [
  "Same caregiver phone across both records",
  "Duplicates created by offline registration",
  "One record is empty placeholder from HQ import",
]

export default function DeduplicationQueuePage() {
  const router = useRouter()
  const [selectedPairId, setSelectedPairId] = useState(pairs[0]?.id ?? "")
  const [note, setNote] = useState("")

  const selectedPair = useMemo(() => pairs.find((pair) => pair.id === selectedPairId) ?? pairs[0], [selectedPairId])

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="border-b bg-background/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 text-sm">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-muted-foreground transition hover:text-foreground"
            aria-label="Go back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileWarning className="h-4 w-4 text-primary" /> Queue synced at 08:10 · {pairs.length} pairs loaded
          </div>
        </div>
      </div>
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr,1.1fr]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">Potential duplicates</CardTitle>
            <CardDescription>Review clustered records and decide whether to merge or dismiss.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pairs.map((pair) => (
              <button
                key={pair.id}
                onClick={() => setSelectedPairId(pair.id)}
                className={`w-full rounded-lg border p-3 text-left transition ${selectedPairId === pair.id ? "border-primary bg-primary/10" : "border-border bg-background/70 hover:border-primary/60"}`}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground">{pair.childA.name} · {pair.childB.name}</span>
                  <span className="text-xs text-muted-foreground">{pair.id}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Similarity {pair.similarityScore}</span>
                  <span>{pair.signals[0]}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="self-start border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="h-5 w-5 text-primary" /> {selectedPair?.id}
            </CardTitle>
            <CardDescription>Confirm which record should be the survivor when merging.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-sm">
            <div className="grid gap-4 rounded-lg border border-border bg-background/70 p-4 md:grid-cols-2">
              <ProfileBlock title="Record A" child={selectedPair?.childA} />
              <ProfileBlock title="Record B" child={selectedPair?.childB} />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Signals flagged</h3>
              <ul className="space-y-2 text-xs text-muted-foreground">
                {selectedPair?.signals.map((signal) => (
                  <li key={signal} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-primary" /> {signal}
                  </li>
                ))}
              </ul>
            </div>

            <form className="space-y-4" onSubmit={(event: FormEvent<HTMLFormElement>) => event.preventDefault()}>
              <div className="grid gap-3">
                <Label htmlFor="preferred-record">Keep which record?</Label>
                <select
                  id="preferred-record"
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  defaultValue=""
                  required
                >
                  <option value="" disabled>
                    Select active record
                  </option>
                  <option value={selectedPair?.childA.id}>{selectedPair?.childA.id} · {selectedPair?.childA.name}</option>
                  <option value={selectedPair?.childB.id}>{selectedPair?.childB.id} · {selectedPair?.childB.name}</option>
                </select>
              </div>

              <div className="grid gap-3">
                <Label htmlFor="merge-reason">Reason for merge</Label>
                <select id="merge-reason" className="rounded-md border border-border bg-background px-3 py-2 text-sm" defaultValue="">
                  <option value="" disabled>
                    Choose a reason
                  </option>
                  {mergeReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                  <option value="other">Other · add note below</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="merge-note">Decision note</Label>
                <Textarea
                  id="merge-note"
                  placeholder="Why are we merging these records?"
                  value={note}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNote(event.target.value)}
                  className="min-h-[120px]"
                />
                <p className="text-xs text-muted-foreground">This note appears in the audit log for this merge event.</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="submit" className="flex-1 gap-2">
                  <Link2 className="h-4 w-4" /> Merge and archive duplicate
                </Button>
                <Button type="button" variant="outline" className="flex-1 gap-2">
                  <FileWarning className="h-4 w-4" /> Dismiss as not duplicate
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

function ProfileBlock({
  title,
  child,
}: {
  title: string
  child:
    | {
        id: string
        name: string
        dob: string
        mother: string
        lastVisit: string
      }
    | undefined
}) {
  if (!child) return null

  return (
    <div className="space-y-1 rounded-md border border-dashed border-primary/40 bg-primary/5 p-3 text-xs text-muted-foreground">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="font-medium text-foreground">{child.name}</p>
      <p>ID: {child.id}</p>
      <p>DOB: {child.dob}</p>
      <p>Mother: {child.mother}</p>
      <p>Last visit: {child.lastVisit}</p>
    </div>
  )
}
