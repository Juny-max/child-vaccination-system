import Image from "next/image"
import Link from "next/link"
import { AlertTriangle, BellRing, RefreshCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"

const informationHighlights = [
  {
    id: "duplicate-resolution",
    title: "Duplicate Resolution",
    summary: "When two records feel like the same child, this workspace steps through evidence before anything merges.",
    detail: [
      "Similarity scoring, mother identifiers and clinic history sit side by side so reviewers can trace why the system raised a flag.",
      "Merging policies mirror national data standards; every decision leaves an immutable breadcrumb for HQ auditors.",
    ],
    href: "/dashboard/deduplication",
    accent: "from-amber-200/60 via-orange-100/40 to-orange-50/30",
    icon: RefreshCcw,
    metricLabel: "12 investigations queued",
    focus: [
      "Side-by-side child timelines clarify immunisation chronology",
      "Suggested outcomes guide reviewers toward merge, link or dismiss"
    ],
  },
  {
    id: "sync-conflicts",
    title: "Sync Conflicts",
    summary: "Field uploads sometimes collide with HQ changes; this room helps negotiate a trustworthy version of truth.",
    detail: [
      "Offline packets land with contextual notes so facilitators can replay exactly what the CHW saw in the community.",
      "Resolution wizards translate technical errors into plain tasks, keeping supervisors confident under tight reporting deadlines.",
    ],
    href: "/dashboard/sync-conflicts",
    accent: "from-purple-200/60 via-purple-100/40 to-purple-50/30",
    icon: AlertTriangle,
    metricLabel: "Median resolution: 11 minutes",
    focus: [
      "Conflict stories retain GPS, device and network traces",
      "Escalation paths feed directly into branch and HQ alerting"
    ],
  },
  {
    id: "system-notifications",
    title: "System Notifications",
    summary: "Every guardian message lives here, from clinic reminders to certificate sharing receipts.",
    detail: [
      "Clay counters separate alerts, nudges and campaign blasts so communication teams can spot fatigue before it hits conversion.",
      "Delivery receipts and telco failure codes translate into ready-to-share reports for the regional health directorates.",
    ],
    href: "/dashboard/notifications",
    accent: "from-rose-200/60 via-rose-100/40 to-rose-50/30",
    icon: BellRing,
    metricLabel: "Live delivery health",
    focus: [
      "Guardian feedback threads sync with parent portal history",
      "Retry cadences honour GHS quiet hours and escalation rules"
    ],
  },
]

export default function InformationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/50 to-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <header className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div className="flex items-center gap-3 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 shadow-[8px_8px_24px_rgba(15,23,42,0.12),_-6px_-6px_20px_rgba(255,255,255,0.16)]">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-primary/30 bg-background/90">
              <Image src="/images/cvcc-logo.png" alt="Child Vaccination Command Center logo" fill sizes="40px" className="object-cover" priority />
            </div>
            <span className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">CVCC Insights</span>
          </div>
          <Badge variant="outline" className="border-primary/40 bg-background/60 text-primary">
            Quality guardianship
          </Badge>
        </header>

        <main className="mt-12 flex flex-1 flex-col">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Information hubs that keep data stories accountable</h1>
            <p className="mt-4 text-lg text-foreground/75">
              Each clay tile explains what the module protects, how teams investigate issues and the assurance trail it leaves for national reporting.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {informationHighlights.map(({ id, title, summary, detail, href, accent, icon: Icon, metricLabel, focus }) => (
              <div
                key={title}
                id={id}
                className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-[2rem] border border-white/10 bg-background/85 p-8 shadow-[12px_12px_36px_rgba(15,23,42,0.16),_-12px_-12px_30px_rgba(255,255,255,0.20)] transition hover:-translate-y-1 hover:shadow-[16px_16px_40px_rgba(15,23,42,0.18),_-14px_-14px_32px_rgba(255,255,255,0.22)]`}
              >
                <div className={`absolute inset-0 -z-10 opacity-60 blur-3xl bg-gradient-to-br ${accent}`} />
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-6 text-2xl font-semibold">{title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/75">{summary}</p>
                  <div className="mt-4 space-y-3 text-sm text-foreground/75">
                    {detail.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </div>
                <div className="mt-8 space-y-3 text-sm text-foreground/70">
                  <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-background/60 px-3 py-1">
                    {metricLabel}
                  </span>
                  <ul className="space-y-2">
                    {focus.map((item) => (
                      <li key={item} className="leading-relaxed">{item}</li>
                    ))}
                  </ul>
                  <p className="pt-2 text-xs uppercase tracking-[0.3em] text-foreground/60">
                    Console path
                    <span className="pl-2 text-foreground/80">
                      <Link href={href} className="underline decoration-dotted underline-offset-4">
                        {href}
                      </Link>
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
