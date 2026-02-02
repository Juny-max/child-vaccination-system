"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, BellRing, Check, Menu, MoonStar, QrCode, ShieldCheck, Sun, Syringe, TrendingUp, X } from "lucide-react"

const heroMedia = {
  light: "https://www.edc-ent.com/wp-content/uploads/2021/07/343434.jpg",
  dark: "https://www.edc-ent.com/wp-content/uploads/2021/07/343434.jpg",
}

const pulseMetrics = [
  { label: "Children safeguarded", value: "1.24M", detail: "Active immunisation records across Ghana" },
  { label: "Appointments this month", value: "38,214", detail: "Synced from 428 public facilities" },
  { label: "Cold-chain compliance", value: "99.1%", detail: "Alerts resolved within national SLA" },
]

const focusStories = [
  {
    title: "Clinic command operations",
    description: "Facility teams supervise rosters, vaccine stock and cold-chain telemetry from a single pane of glass.",
    image: "/images/greater-accra-hospital.jpg",
    highlights: ["Live session dashboards", "Batch validation workflows"],
  },
  {
    title: "Community outreach moments",
    description: "Community health workers sync geo-tagged visits and defaulter recoveries even after offline missions.",
    image: "/images/mother-child-outreach.jpg",
    highlights: ["Offline-first data capture", "Real-time follow-up queues"],
  },
]

const certificateBenefits = [
  "Parents download verified records instantly",
  "QR codes validated at clinics, schools and borders",
  "Audit-ready history for every issuance",
]

const platformPillars = [
  {
    title: "Guardian engagement",
    description: "Automated SMS and email journeys keep caregivers aligned with national dosing schedules.",
    icon: BellRing,
  },
  {
    title: "Coverage intelligence",
    description: "Daily coverage insights highlight gaps so HQ and regions act before drop-offs grow.",
    icon: TrendingUp,
  },
  {
    title: "Tamper-proof records",
    description: "Role-based access and QR validation ensure confidence in every vaccination certificate.",
    icon: ShieldCheck,
  },
]

const withAuthRedirect = (path: string) => `/auth/login?redirect=${encodeURIComponent(path)}`

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    document.body.style.overflow = previewOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [previewOpen])

  const isDark = useMemo(() => resolvedTheme === "dark", [resolvedTheme])

  if (!mounted) {
    return null
  }

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark")
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-primary/30 bg-primary/5">
              <Image src="/images/cvcc-logo.png" alt="Child Vaccination Command Center logo" fill sizes="48px" className="object-cover" />
            </div>
            <div>
              <p className="text-base font-semibold">Child Vaccination Command Center</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-3 md:flex">
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center rounded-lg border border-border bg-transparent p-2 transition-colors hover:bg-muted"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <MoonStar className="h-5 w-5" />}
            </button>
            <Link href="/auth/login">
              <Button className="gap-2">
                Portal Login
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex items-center justify-center rounded-lg border border-border bg-transparent p-2 transition-colors hover:bg-muted md:hidden"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-border bg-background/95 px-4 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              <button
                onClick={toggleTheme}
                className="flex w-full items-center justify-center rounded-lg border border-border bg-transparent p-2 transition-colors hover:bg-muted"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="h-5 w-5" /> : <MoonStar className="h-5 w-5" />}
                <span className="ml-2">{isDark ? "Light Mode" : "Dark Mode"}</span>
              </button>
              <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full gap-2">
                  Portal Login
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            key={isDark ? "hero-dark" : "hero-light"}
            src={isDark ? heroMedia.dark : heroMedia.light}
            alt="Healthcare heroes supporting vaccination"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-b from-background/20 via-background/80 to-background" />
          <div className="absolute inset-0 bg-gradient-radial from-primary/10 via-transparent to-transparent" />
        </div>

        <div className="relative mx-auto flex min-h-[85vh] max-w-7xl flex-col items-center justify-center gap-12 px-4 py-20 text-center sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:px-8 lg:text-left">
          <div className="max-w-2xl space-y-8 text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              Protecting every child
            </span>
            <h1 className="text-balance text-4xl font-semibold leading-tight sm:text-5xl md:text-6xl">
              A professional command platform for nationwide child immunisation
            </h1>
            <p className="text-pretty text-lg text-muted-foreground md:text-xl">
              Coordinate multi-branch vaccination drives, empower community health workers with offline tools and keep
              guardians informed through a unified SMS and Email engagement engine.
            </p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:gap-4 sm:justify-start">
              <Link href="/auth/login">
                <Button size="lg" className="w-full gap-2 sm:w-auto">
                  Portal Login
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="#insights">
                <Button variant="outline" size="lg" className="w-full gap-2 sm:w-auto">
                  Explore Insights
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="flex w-full flex-col gap-6 pt-4 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-8">
              <div className="text-center sm:text-left">
                <p className="font-semibold text-foreground">99.5% uptime SLA</p>
                <p>Monitored 24/7 with automated incident response</p>
              </div>
              <div className="text-center sm:text-left">
                <p className="font-semibold text-foreground">Offline-first readiness</p>
                <p>Works seamlessly across low-connectivity districts</p>
              </div>
            </div>
          </div>

          <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-background/80 shadow-2xl backdrop-blur sm:mx-auto lg:mx-0">
            <div className="relative h-full min-h-[480px]">
              <Image
                src="https://www.unicef.org/ghana/sites/unicef.org.ghana/files/styles/media_large_image/public/EQ7A6817.webp?itok=qPon5owv"
                alt="Child receiving vaccination in clinic"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-t from-background/85 via-background/45 to-transparent dark:from-background/95 dark:via-background/60" />
              <div className="absolute bottom-0 left-0 right-0 space-y-4 p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
                    <Syringe className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium uppercase text-muted-foreground">Live session</p>
                    <p className="text-lg font-semibold">Jakpa Branch • Under-five clinic</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm shadow-sm">
                  <p className="font-semibold text-primary">Next due vaccines</p>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-muted-foreground">
                    <div>
                      <p className="text-xs uppercase">Esi Asante</p>
                      <p className="text-sm font-medium text-foreground">MMR • 12 Feb 2025</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase">Yaw Mensah</p>
                      <p className="text-sm font-medium text-foreground">Polio (Dose 3) • 18 Feb 2025</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="insights" className="relative overflow-hidden bg-background py-20 sm:py-24">
        <div className="absolute inset-0 bg-linear-to-b from-primary/10 via-transparent to-transparent dark:from-primary/5" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              National pulse
            </span>
            <h2 className="mt-4 text-3xl font-semibold text-foreground md:text-4xl">A clear view of Ghana&apos;s vaccination network</h2>
            <p className="mt-4 text-lg text-foreground/80">
              Transparent glass panels surface the essentials so health leaders can read readiness in one glance.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {pulseMetrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-3xl border border-primary/20 bg-background/70 p-6 shadow-lg backdrop-blur-xl transition hover:border-primary/40"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-primary/80">{metric.label}</p>
                <p className="mt-4 text-3xl font-semibold text-foreground md:text-4xl">{metric.value}</p>
                <p className="mt-2 text-sm text-foreground/75">{metric.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/30 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
              <div className="mb-12 text-center">
                <h2 className="text-3xl font-semibold text-foreground md:text-4xl">Operational clarity across child vaccination</h2>
                <p className="mt-3 text-lg text-foreground/80">
                  Facility clinics, outreach missions and certificate teams share one calm canvas so planners keep every child on schedule.
                </p>
          </div>
          <div className="grid gap-10 md:grid-cols-2">
            {focusStories.map((story) => (
              <div key={story.title} className="group relative h-[360px] overflow-hidden rounded-[2rem]">
                <Image src={story.image} alt={story.title} fill className="object-cover transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/20 dark:bg-black/40" />
                <div className="absolute inset-x-6 bottom-6">
                  <div className="rounded-3xl border border-white/15 bg-background/75 p-6 shadow-xl backdrop-blur-2xl dark:bg-background/70">
                    <h3 className="text-2xl font-semibold text-foreground">{story.title}</h3>
                    <p className="mt-3 text-sm text-foreground/80">{story.description}</p>
                    <ul className="mt-5 space-y-2 text-sm text-foreground/75">
                      {story.highlights.map((item) => (
                        <li key={item} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-[0.85fr_1.15fr] md:items-center">
            <div className="relative h-[340px] overflow-hidden rounded-[2rem] border border-primary/20 bg-background/70 shadow-xl backdrop-blur-xl">
              <Image src="/images/certificate-preview.png" alt="Digital vaccination certificate" fill className="object-cover" />
              <div className="absolute inset-0 bg-linear-to-t from-background/85 via-background/40 to-transparent" />
            </div>
            <div className="rounded-[2rem] border border-primary/20 bg-background/70 p-8 shadow-xl backdrop-blur-2xl">
              <Badge variant="outline" className="border-primary/40 text-primary">
                Digital certificates
              </Badge>
              <h3 className="mt-6 text-3xl font-semibold text-foreground sm:text-4xl">Scan-ready proof in seconds</h3>
              <p className="mt-4 text-base text-foreground/80">
                Every certificate carries secure QR validation so parents, schools and clinicians trust the record instantly.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-foreground/75">
                {certificateBenefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Button size="lg" className="gap-2" onClick={() => setPreviewOpen(true)}>
                  Preview certificate
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted/20 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-semibold text-foreground md:text-4xl">Pillars that support vaccination delivery</h2>
            <p className="mt-3 text-lg text-foreground/80">
              Core pillars present supply, coverage and record-integrity workflows in translucent panels so facility, outreach and HQ teams see exact responsibilities and act quickly to keep every child on schedule.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {platformPillars.map((pillar) => (
              <div
                key={pillar.title}
                className="rounded-3xl border border-primary/15 bg-background/65 p-6 shadow-lg backdrop-blur-xl"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <pillar.icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">{pillar.title}</h3>
                <p className="mt-3 text-sm text-foreground/75">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden py-20 sm:py-24">
        <div className="absolute inset-0 bg-linear-to-r from-primary/20 via-transparent to-primary/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.35),_transparent_65%)] dark:bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.55),_transparent_65%)]" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-primary/20 bg-background/70 p-10 text-center shadow-2xl backdrop-blur-2xl">
            <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">Ready to run a calmer command center?</h2>
            <p className="mt-4 text-base text-foreground/80">
              Log in to orchestrate clinics, outreach teams and certificates from one trusted workspace.
            </p>
            <div className="mt-6 flex justify-center">
              <Link href="/auth/login">
                <Button size="lg" className="gap-2">
                  Portal Login
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {previewOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 backdrop-blur-xl p-4 md:p-10"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="relative flex w-full max-w-4xl flex-col items-center overflow-hidden rounded-[2rem] border border-white/20 bg-background/85 shadow-2xl backdrop-blur-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close certificate preview"
              className="absolute right-6 top-6 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-border/40 bg-background/80 text-foreground/80 transition hover:text-foreground"
              onClick={() => setPreviewOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="w-full px-6 pt-14 pb-6 sm:px-10">
              <div className="relative mx-auto w-full max-w-3xl rounded-[1.75rem] border border-border/60 bg-gradient-to-br from-background via-background/70 to-muted/50 p-6 shadow-[12px_12px_36px_rgba(15,23,42,0.20),_-10px_-10px_30px_rgba(255,255,255,0.08)]">
                <div className="relative aspect-[3/4] w-full sm:aspect-[4/3]">
                  <Image src="/images/certificate-preview.png" alt="Sample digital vaccination certificate" fill className="object-contain" sizes="(max-width: 768px) 85vw, 60vw" priority />
                </div>
              </div>
            </div>
            <div className="w-full border-t border-border/60 bg-background/80 p-6 text-center text-sm text-foreground/70">
              Example certificate for demonstration purposes.
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-16 text-sm text-muted-foreground sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <p className="text-lg font-semibold text-foreground">Ghana Child Vaccination System</p>
              <p className="mt-3 max-w-sm">
                Production-ready infrastructure for nationwide immunisation, operated with Ghana Health Service and district partners.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={withAuthRedirect("/dashboard/reports")} prefetch={false} className="transition hover:text-foreground">
                  Impact Reports
                </Link>
                <Link href={withAuthRedirect("/pha/dashboard")} prefetch={false} className="transition hover:text-foreground">
                  PHA Console
                </Link>
                <Link href={withAuthRedirect("/parent/dashboard")} prefetch={false} className="transition hover:text-foreground">
                  Parent Portal
                </Link>
              </div>
            </div>
            <div>
              <p className="font-semibold text-foreground">Quick links</p>
              <div className="mt-3 grid gap-2">
                    <Link href="/quick-links#portal-login" className="transition hover:text-foreground">
                  Portal Login
                </Link>
                    <Link href="/quick-links#staff-dashboard" className="transition hover:text-foreground">
                  Staff Dashboard
                </Link>
                    <Link href="/quick-links#facility-console" className="transition hover:text-foreground">
                  Facility Console
                </Link>
              </div>
            </div>
            <div>
              <p className="font-semibold text-foreground">Information</p>
              <div className="mt-3 grid gap-2">
                    <Link href="/information#duplicate-resolution" className="transition hover:text-foreground">
                  Duplicate Resolution
                </Link>
                    <Link href="/information#sync-conflicts" className="transition hover:text-foreground">
                  Sync Conflicts
                </Link>
                    <Link href="/information#system-notifications" className="transition hover:text-foreground">
                  System Notifications
                </Link>
              </div>
            </div>
            <div>
              <p className="font-semibold text-foreground">Discover</p>
              <div className="mt-3 grid gap-2">
                    <Link href="/discover#chw-mission-control" className="transition hover:text-foreground">
                  CHW Mission Control
                </Link>
                    <Link href="/discover#hq-command-center" className="transition hover:text-foreground">
                  HQ Command Center
                </Link>
                    <Link href="/discover#national-reports" className="transition hover:text-foreground">
                  National Reports
                </Link>
              </div>
            </div>
          </div>
          <p className="mt-10 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Ghana Health Service. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
