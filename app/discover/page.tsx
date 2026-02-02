import Image from "next/image"
import Link from "next/link"
import { BarChart3, Building2, MapPin } from "lucide-react"

import { Badge } from "@/components/ui/badge"

const discoverDestinations = [
  {
    id: "chw-mission-control",
    title: "CHW Mission Control",
    summary: "Field nurses and volunteers coordinate door-to-door rounds, defaulter recovery runs and school visits from this canvas.",
    detail: [
      "It plots each mission on a soft geospatial layer so supervisors can prove coverage for hard-to-reach communities.",
      "Offline capture blends with health education notes, ensuring synchronized follow-up when connectivity returns.",
    ],
    href: "/chw/dashboard",
    accent: "from-green-200/60 via-green-100/40 to-green-50/30",
    icon: MapPin,
    contextLabel: "Offline-first navigators",
    focus: [
      "Mission briefs translate central targets into daily household lists",
      "CHW wellness tracker keeps leadership informed about burnout risk"
    ],
  },
  {
    id: "hq-command-center",
    title: "HQ Command Center",
    summary: "National leads keep their pulse on stock, coverage, escalations and partner coordination here.",
    detail: [
      "Clay layers juxtapose vaccine availability with cold-chain status, so redistribution decisions happen with confidence.",
      "Escalation maps highlight districts that need surge support or communication reinforcement before campaign weekends.",
    ],
    href: "/hq/dashboard",
    accent: "from-cyan-200/60 via-cyan-100/40 to-cyan-50/30",
    icon: Building2,
    contextLabel: "Strategic oversight",
    focus: [
      "Cross-ministry alerts surface inside the same decision board",
      "Scenario planning modules rehearse responses to supply disruption"
    ],
  },
  {
    id: "national-reports",
    title: "National Reports",
    summary: "Policy shapers and partners compare districts, campaigns and birth cohorts in this analytical gallery.",
    detail: [
      "Charts rest on translucent clay pedestals, balancing depth with export-ready clarity for cabinet briefings.",
      "Drill-through narratives explain why metrics shift, referencing events, outreach pushes and supply interventions.",
    ],
    href: "/pha/reports",
    accent: "from-indigo-200/60 via-indigo-100/40 to-indigo-50/30",
    icon: BarChart3,
    contextLabel: "Executive-ready visuals",
    focus: [
      "Region filters respect administrative boundaries and partner funding lines",
      "Audit trail tags link each visual to the underlying data refresh"
    ],
  },
]

export default function DiscoverPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-16 pt-12 sm:px-6 lg:px-8">
        <header className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div className="flex items-center gap-3 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 shadow-[8px_8px_24px_rgba(15,23,42,0.12),_-6px_-6px_20px_rgba(255,255,255,0.16)]">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-primary/30 bg-background/90">
              <Image src="/images/cvcc-logo.png" alt="Child Vaccination Command Center logo" fill sizes="40px" className="object-cover" priority />
            </div>
            <span className="text-sm font-semibold uppercase tracking-[0.25em] text-primary">CVCC Discover</span>
          </div>
          <Badge variant="outline" className="border-primary/40 bg-background/60 text-primary">
            Journey briefings
          </Badge>
        </header>

        <main className="mt-12 flex flex-1 flex-col">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Discover the workrooms championing national coordination</h1>
            <p className="mt-4 text-lg text-foreground/75">
              Explore how each destination supports the teams steering community action, national planning and executive reporting.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {discoverDestinations.map(({ id, title, summary, detail, href, accent, icon: Icon, contextLabel, focus }) => (
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
                    {contextLabel}
                  </span>
                  <ul className="space-y-2">
                    {focus.map((item) => (
                      <li key={item} className="leading-relaxed">{item}</li>
                    ))}
                  </ul>
                  <p className="pt-2 text-xs uppercase tracking-[0.3em] text-foreground/60">
                    Workspace address
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
