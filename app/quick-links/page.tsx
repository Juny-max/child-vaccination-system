import Image from "next/image"
import Link from "next/link"
import { ShieldCheck, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"

const quickLinkEntries = [
  {
    id: "portal-login",
    title: "Portal Login",
    summary: "National staff start here to authenticate, review notices and step into their assigned workspace.",
    narrative: [
      "Credential flows mirror Ghana Health Service policy so everyone experiences the same language on resets, handovers and multi-factor prompts.",
      "Branch administrators can highlight advisories or planned maintenance windows before users proceed.",
    ],
    href: "/auth/login",
    highlight: "Single sign-on ready",
    focusPoints: [
      "Role-aware welcome screens brief teams on the day's duties",
      "Regional officers monitor activation trends from audit trails",
    ],
    accent: "from-primary/20 via-primary/10 to-primary/5",
  },
  {
    id: "staff-dashboard",
    title: "Staff Dashboard",
    summary: "Data officers, supervisors and HQ analysts review workloads, exceptions and broadcast alerts.",
    narrative: [
      "Clay tiles surface duplicate queues, sync issues and security notices without overwhelming first-time viewers.",
      "Case fragments, audit insights and escalation paths live in one stream so handovers feel deliberate.",
    ],
    href: "/dashboard",
    highlight: "Real-time telemetry",
    focusPoints: [
      "Snapshot KPIs blend clinic, CHW and HQ signals",
      "Queues map directly to nightly batch jobs and outreach scripts",
    ],
    accent: "from-emerald-200/60 via-emerald-100/50 to-emerald-50/40",
  },
  {
    id: "facility-console",
    title: "Facility Console",
    summary: "Clinic teams guide caregivers, reconcile stock and brief outreach squads from one fluid console.",
    narrative: [
      "Rotations, cold-chain checks and discharge notes sit inside softly separated layers so nurses can act quickly even during surges.",
      "Offline packets sync quietly in the background, while supervisors trace history from contextual breadcrumbs.",
    ],
    href: "/facility/dashboard",
    highlight: "Designed for clinics",
    focusPoints: [
      "Household lookups blend QR scans with manual search",
      "Stock ledgers and wastage forms mirror national templates",
    ],
    accent: "from-sky-200/70 via-sky-100/50 to-sky-50/40",
  },
]

export default function QuickLinksPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/40 to-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <header className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div className="flex items-center gap-3 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 shadow-[8px_8px_24px_rgba(15,23,42,0.12),_-6px_-6px_20px_rgba(255,255,255,0.16)]">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-primary/30 bg-background/90">
              <Image src="/images/cvcc-logo.png" alt="Child Vaccination Command Center logo" fill sizes="40px" className="object-cover" priority />
            </div>
            <span className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">CVCC Access</span>
          </div>
          <Badge variant="outline" className="border-primary/40 bg-background/60 text-primary">
            Mission entry brief
          </Badge>
        </header>

        <main className="mt-12 flex flex-1 flex-col">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Quick links carved for everyday duty shifts</h1>
            <p className="mt-4 text-lg text-foreground/75">
              These soft clay canvases explain who each workspace serves, the rhythms it supports and why Ghana&apos;s teams depend on it daily.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {quickLinkEntries.map((entry) => (
              <div
                key={entry.title}
                id={entry.id}
                className={`group relative overflow-hidden rounded-[2rem] border border-white/10 bg-background/80 p-8 shadow-[12px_12px_36px_rgba(15,23,42,0.16),_-12px_-12px_30px_rgba(255,255,255,0.20)] transition hover:-translate-y-1 hover:shadow-[16px_16px_40px_rgba(15,23,42,0.18),_-14px_-14px_32px_rgba(255,255,255,0.22)]`}
              >
                <div className={`absolute inset-0 -z-10 opacity-60 blur-3xl bg-gradient-to-br ${entry.accent}`} />
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h2 className="mt-6 text-2xl font-semibold">{entry.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-foreground/75">{entry.summary}</p>
                <div className="mt-5 space-y-3 text-sm text-foreground/75">
                  {entry.narrative.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                <div className="mt-6 space-y-3 text-sm text-foreground/70">
                  <div className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-background/60 px-3 py-1">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    {entry.highlight}
                  </div>
                  <ul className="space-y-2">
                    {entry.focusPoints.map((point) => (
                      <li key={point} className="leading-relaxed">{point}</li>
                    ))}
                  </ul>
                  <p className="pt-2 text-xs uppercase tracking-[0.3em] text-foreground/60">
                    Access via
                    <span className="pl-2 text-foreground/80">
                      <Link href={entry.href} className="underline decoration-dotted underline-offset-4">
                        {entry.href}
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
