"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowRight,
  BellRing,
  Check,
  HeartPulse,
  Lock,
  Menu,
  MoonStar,
  QrCode,
  ShieldCheck,
  Sun,
  Syringe,
  TrendingUp,
  UserPlus,
  X,
} from "lucide-react"

const heroMedia = {
  light: "https://www.edc-ent.com/wp-content/uploads/2021/07/343434.jpg",
  dark: "https://www.edc-ent.com/wp-content/uploads/2021/07/343434.jpg",
}

const impactMetrics = [
  { label: "Children Registered", value: "1.2M+", detail: "Across 100+ districts" },
  { label: "Daily Reminders", value: "45K", detail: "SMS & Email alerts sent" },
  { label: "Cold Chain Incidents", value: "<1%", detail: "Tracked with real-time alerts" },
]

const workflowSteps = [
  {
    title: "Child Enrolment",
    description: "Capture biometrics, guardian consent, GPS and issue secure QR IDs in under 60 seconds.",
    icon: UserPlus,
  },
  {
    title: "Clinic & Field Vaccinations",
    description: "Record doses, batch numbers, signatures and sync automatically when connectivity returns.",
    icon: Syringe,
  },
  {
    title: "Digital Certificates",
    description: "Generate tamper-proof certificates with QR verification the moment a schedule is complete.",
    icon: ShieldCheck,
  },
  {
    title: "Guardian Engagement",
    description: "Deliver bilingual reminders, AEFI alerts and wellness tips by SMS and Email simultaneously.",
    icon: BellRing,
  },
]

const galleryImages = [
  {
    src: "https://www.unicef.org/ghana/sites/unicef.org.ghana/files/styles/media_large_image/public/EQ7A6829.webp?itok=RvV6Ti0A",
    alt: "Nurse administering vaccine to child",
  },
  {
    src: "/images/medic-looking-tablet-screen-healthcare-system.jpg",
    alt: "Healthcare worker reviewing vaccination records on tablet",
  },
  {
    src: "https://jacarandahealth.org/ypoagriw/2023/10/unnamed34.png",
    alt: "Mother receiving vaccination reminder on mobile phone",
  },
]

const highlights = [
  {
    title: "Clinical Grade Security",
    description: "Full audit trails, role-based branch controls, device binding and TLS 1.3 for every request.",
    icon: Lock,
  },
  {
    title: "Population Analytics",
    description: "Dynamic dashboards track coverage, drop-out risk and CHW productivity in real time.",
    icon: TrendingUp,
  },
  {
    title: "AEFI Rapid Response",
    description: "Any adverse event instantly pages the branch nurse and doctor with actionable playbooks.",
    icon: HeartPulse,
  },
  {
    title: "QR Verification Everywhere",
    description: "Hospitals and schools can verify certificates securely using the built-in QR scanner.",
    icon: QrCode,
  },
]

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground">
              CV
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
            <Link href="/auth/parent-login">
              <Button variant="outline" className="hover:bg-muted hover:text-foreground dark:hover:bg-muted/60 dark:hover:text-foreground">
                Parent Portal
              </Button>
            </Link>
            <Link href="/auth/staff-login">
              <Button>Staff Sign In</Button>
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
              <Link href="/auth/parent-login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full hover:bg-muted hover:text-foreground dark:hover:bg-muted/60 dark:hover:text-foreground">
                  Parent Portal
                </Button>
              </Link>
              <Link href="/auth/staff-login" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full">Staff Sign In</Button>
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
              <Link href="/auth/staff-login">
                <Button size="lg" className="w-full gap-2 sm:w-auto">
                  Explore Staff Console
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/auth/parent-login">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Access Parent Records
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
              <div className="absolute inset-0 bg-linear-to-t from-background/95 via-background/60 to-transparent" />
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
                      <p className="text-xs uppercase">Ama Asante</p>
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

      <section className="bg-background py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 rounded-3xl border border-border bg-card p-6 shadow-sm sm:grid-cols-3 sm:p-10">
            {impactMetrics.map((metric) => (
              <div key={metric.label} className="space-y-2">
                <p className="text-sm uppercase tracking-wider text-muted-foreground">{metric.label}</p>
                <p className="text-3xl font-semibold md:text-4xl">{metric.value}</p>
                <p className="text-sm text-muted-foreground">{metric.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/40 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl space-y-3">
              <h2 className="text-3xl font-semibold md:text-4xl">End-to-end vaccination workflow built for Ghana</h2>
              <p className="text-lg text-muted-foreground">
                Every module is tuned with frontline teams to tackle real operational bottlenecks—from remote community
                enrolment to national reporting dashboards.
              </p>
            </div>
            <Link href="/dashboard">
              <Button variant="outline" className="gap-2">
                View Operational Console
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {workflowSteps.map((step) => (
              <Card key={step.title} className="h-full border-border/70 bg-card/80 shadow-none">
                <CardHeader>
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base text-muted-foreground">{step.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl space-y-3">
              <h2 className="text-3xl font-semibold md:text-4xl">Designed with frontline teams</h2>
              <p className="text-lg text-muted-foreground">
                Authentic visuals from Ghanaian clinics, community outreaches and parent engagements keep your teams
                connected to the mission.
              </p>
            </div>
            <Link href="/auth/staff-login">
              <Button>Book a guided demo</Button>
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {galleryImages.map((image) => (
              <div key={image.src} className="group relative overflow-hidden rounded-3xl border border-border/60">
                <Image
                  src={image.src}
                  alt={image.alt}
                  width={520}
                  height={520}
                  className="h-64 w-full object-cover sm:h-80"
                />
                <div className="absolute inset-0 bg-linear-to-t from-background/95 via-background/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="absolute bottom-5 left-5 right-5 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="text-sm text-muted-foreground">{image.alt}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/30 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-14 space-y-3 text-center">
            <h2 className="text-3xl font-semibold md:text-4xl">What sets this national platform apart</h2>
            <p className="text-lg text-muted-foreground">
              Built hand-in-hand with Ghana Health Service to meet WHO Expanded Programme on Immunization standards.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {highlights.map((item) => (
              <Card key={item.title} className="border-border/70 bg-card/90 shadow-sm">
                <CardHeader>
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-xl">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base text-muted-foreground">{item.description}</CardDescription>
                  <div className="mt-5 flex flex-col gap-2 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-primary" />
                      <span>Continuous supervision dashboards for HQ and regions.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-primary" />
                      <span>Secure integrations ready for DHIS2 and OpenHIE pipelines.</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background py-20">
  <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 rounded-3xl border border-border bg-linear-to-r from-primary/85 via-primary/70 to-primary/80 px-6 py-12 text-center text-primary-foreground shadow-lg sm:px-8 sm:py-14">
          <p className="text-sm uppercase tracking-[0.3em]">Unified national rollout</p>
          <h2 className="max-w-3xl text-balance text-3xl font-semibold md:text-4xl">
            Ready to accelerate Ghana's child immunisation outcomes?
          </h2>
          <p className="max-w-2xl text-base md:text-lg">
            Deploy within weeks, equip every branch and CHW with the same intelligent toolkit, and deliver verified
            digital certificates to parents across the country.
          </p>
          <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
            <Link href="/auth/staff-login">
              <Button
                size="lg"
                variant="default"
                className="w-full bg-primary text-white shadow-lg transition duration-150 ease-out hover:-translate-y-1 hover:bg-primary/90 hover:shadow-2xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/50 sm:w-auto"
              >
                Launch Staff Portal
              </Button>
            </Link>
            <Link href="/auth/parent-login">
              <Button
                size="lg"
                variant="outline"
                className="w-full border-primary-foreground/80 text-primary dark:text-primary-foreground hover:bg-primary-foreground/5 sm:w-auto"
              >
                Parent Access
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-muted/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 text-sm text-muted-foreground sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row sm:items-start">
            <div className="text-center sm:text-left">
              <p className="font-semibold text-foreground">Ghana Child Vaccination System</p>
              <p>Ministry of Health • Expanded Programme on Immunization</p>
            </div>
            <div className="flex flex-wrap justify-center gap-4 sm:justify-end">
              <Link href="/auth/staff-login" className="transition hover:text-foreground">
                Staff Portal
              </Link>
              <Link href="/auth/parent-login" className="transition hover:text-foreground">
                Parent Portal
              </Link>
              <Link href="/dashboard/reports" className="transition hover:text-foreground">
                Reporting Suite
              </Link>
            </div>
          </div>
          <p className="text-center sm:text-left">© {new Date().getFullYear()} Ghana Health Service. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
