"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Fredoka } from "next/font/google"
import { useTheme } from "next-themes"
import { DotLottieReact } from "@lottiefiles/dotlottie-react"
import { MorphNavbar } from "@/components/morph-navbar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, ArrowUp, BellRing, Check, QrCode, ShieldCheck, Syringe, TrendingUp, X } from "lucide-react"

const heroMedia = {
  light: "https://www.edc-ent.com/wp-content/uploads/2021/07/343434.jpg",
  dark: "https://www.edc-ent.com/wp-content/uploads/2021/07/343434.jpg",
}

const platformCapabilities = [
  {
    label: "Multi-facility coordination",
    icon: TrendingUp,
    detail: "Vaccine stock levels, cold-chain logs and appointment rosters across every registered facility are visible from one command centre — no spreadsheets, no gaps.",
  },
  {
    label: "Offline-first field tools",
    icon: Syringe,
    detail: "Community health workers capture geo-tagged visits and defaulter follow-ups in areas with no signal, then sync automatically when connectivity returns.",
  },
  {
    label: "Guardian engagement engine",
    icon: BellRing,
    detail: "Automated SMS and email reminders keep caregivers aligned with national dosing schedules — no manual follow-up required from clinic staff.",
  },
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
    description: "Daily coverage insights highlight gaps so national teams and regions act before drop-offs grow.",
    icon: TrendingUp,
  },
  {
    title: "Tamper-proof records",
    description: "Role-based access and QR validation ensure confidence in every vaccination certificate.",
    icon: ShieldCheck,
  },
]

const childMomentsSlides = [
  {
    src: "/images/Image_fx (10).png",
    alt: "Children building colorful blocks together",
    caption: "Play, learn and grow with confidence.",
    frameTone: "bg-emerald-100/60",
  },
  {
    src: "/images/Image_fx (11).png",
    alt: "Children smiling while playing with toy cars",
    caption: "Protection keeps every little adventure moving.",
    frameTone: "bg-amber-100/60",
  },
  {
    src: "/images/Image_fx (9).png",
    alt: "Two children sharing playtime in a colorful room",
    caption: "Routine care helps brighter childhood moments.",
    frameTone: "bg-lime-100/60",
  },
]

const playfulHeadingFont = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
})

const topNavItems = [
  { label: "Insights", href: "#insights" },
  { label: "Pillars", href: "#pillars" },
  { label: "Contact", href: "#contact" },
]

const topNavMobileItems = [
  { label: "Verify Certificate", href: "/verify" },
  ...topNavItems,
]

const withAuthRedirect = (path: string) => `/auth/login?redirect=${encodeURIComponent(path)}`

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [activeMoment, setActiveMoment] = useState(0)
  const [navCollapsed, setNavCollapsed] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 300)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = previewOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [previewOpen])

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMoment((current) => (current + 1) % childMomentsSlides.length)
    }, 6800)

    return () => clearInterval(interval)
  }, [])

  const isDark = useMemo(() => resolvedTheme === "dark", [resolvedTheme])

  const moveMoment = (direction: "prev" | "next") => {
    setActiveMoment((current) => {
      if (direction === "prev") {
        return (current - 1 + childMomentsSlides.length) % childMomentsSlides.length
      }

      return (current + 1) % childMomentsSlides.length
    })
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MorphNavbar
        items={topNavItems}
        mobileItems={topNavMobileItems}
        onCollapsedChange={setNavCollapsed}
        brand={
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-primary/30 bg-primary/5">
              <Image src="/images/cvcc-logo.png" alt="Child Vaccination Command Center logo" fill sizes="40px" className="object-cover" />
            </div>
            <p className="hidden text-sm font-semibold md:block md:text-base">Child Vaccination Command Center</p>
          </div>
        }
        mobileMenuUtility={<ThemeToggle />}
        cta={
          <div className="flex items-center gap-2">
            <div className="hidden md:inline-flex">
              <ThemeToggle />
            </div>
            <Link href="/verify" className="hidden sm:inline-flex">
              <Button variant="outline" className={navCollapsed ? "px-2.5" : "gap-2"} aria-label="Verify Certificate">
                <QrCode className="h-4 w-4" />
                {!navCollapsed && <span>Verify Certificate</span>}
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button className="gap-2">
                Portal Login
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        }
      />

      <div className="pt-20">
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
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-sm font-semibold uppercase tracking-[0.3em] text-primary dark:border-white/40 dark:bg-white/10 dark:text-white">
              Protecting every child
            </span>
            <h1 className="text-balance text-4xl font-semibold leading-tight sm:text-5xl md:text-6xl">
              A professional command platform for nationwide child immunisation
            </h1>
            <p className="text-pretty text-lg text-muted-foreground md:text-xl">
              Coordinate multi-facility vaccination drives, empower community health workers with offline tools and keep
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
                    <p className="text-base font-medium uppercase text-foreground">Today's focus</p>
                    <p className="text-xl font-semibold">Care spotlight • Child wellness</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm shadow-sm">
                  <p className="font-semibold text-primary">Why routine vaccines matter</p>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-muted-foreground">
                    <div>
                      <p className="text-sm uppercase">Stronger immunity</p>
                      <p className="text-base font-medium text-foreground">Build protection early</p>
                    </div>
                    <div>
                      <p className="text-sm uppercase">Healthier communities</p>
                      <p className="text-base font-medium text-foreground">Prevent disease spread</p>
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
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-sm font-semibold uppercase tracking-[0.3em] text-primary">
              What CVCC enables
            </span>
            <h2 className="mt-4 text-3xl font-semibold text-foreground md:text-4xl">Built for every level of Ghana&apos;s vaccination programme</h2>
            <p className="mt-4 text-lg text-foreground/80">
              From national coordinators to community health workers, CVCC brings every part of the immunisation workflow into one secure, connected system.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {platformCapabilities.map((cap) => (
              <div
                key={cap.label}
                className="rounded-3xl border border-primary/20 bg-background/70 p-6 shadow-lg backdrop-blur-xl transition hover:border-primary/40"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <cap.icon className="h-6 w-6" />
                </div>
                <p className="text-lg font-semibold text-foreground">{cap.label}</p>
                <p className="mt-2 text-base text-foreground/75">{cap.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background py-20 sm:py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-8 left-8 h-20 w-20 rounded-full border-2 border-dashed border-primary/35" />
          <div className="absolute top-16 right-10 h-10 w-10 rounded-full bg-amber-100/70" />
          <div className="absolute bottom-16 left-[10%] h-14 w-14 rounded-[1.2rem] border-2 border-primary/25 bg-lime-100/65 rotate-12" />
          <svg viewBox="0 0 200 70" className="absolute bottom-6 right-[14%] h-10 w-40 text-primary/35">
            <path d="M4 58C30 18 58 18 79 58C98 24 122 20 140 56C156 30 176 32 196 50" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg viewBox="0 0 100 100" className="absolute top-14 left-[36%] h-8 w-8 text-yellow-400/80">
            <path d="M50 4L59 34L92 34L65 53L75 84L50 65L25 84L35 53L8 34L41 34Z" fill="currentColor" />
          </svg>
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8">
          <div className="rounded-[2.25rem] border border-primary/20 bg-background/80 p-8 shadow-xl backdrop-blur-xl sm:p-10">
            <span className={`${playfulHeadingFont.className} inline-flex items-center rounded-full border border-primary/35 bg-primary/10 px-4 py-1 text-sm font-semibold uppercase tracking-[0.22em] text-primary`}>
              Childhood care
            </span>
            <h2 className={`${playfulHeadingFont.className} mt-6 text-balance text-3xl font-semibold leading-tight text-foreground sm:text-4xl`}>
              Healthy childhoods start with the right protection.
            </h2>
            <p className="mt-4 text-base text-foreground/80 sm:text-lg">
              Routine vaccination keeps children safer as they learn, play, and discover the world around them.
            </p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-foreground/70">
              Every timely dose builds stronger immunity, helps families avoid preventable illness, and supports healthier communities where children can grow with confidence.
            </p>
            <div className="mt-8">
              <Link href="/information">
                <Button
                  size="lg"
                  className="rounded-full border border-primary/40 bg-primary/90 px-7 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary"
                >
                  Learn more
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[430px] pb-4 pt-2 sm:pb-6 sm:pt-4 sm:max-w-[500px]">
            <div className="relative h-[380px] sm:h-[450px]">
              {[-1, 0, 1].map((offset) => {
                const slideIndex = (activeMoment + offset + childMomentsSlides.length) % childMomentsSlides.length
                const slide = childMomentsSlides[slideIndex]
                const isFront = offset === 0

                return (
                  <article
                    key={slide.src}
                    className={`absolute transition-all duration-700 ease-in-out ${
                      isFront
                        ? "left-1/2 top-2 z-30 w-[76%] -translate-x-1/2 rotate-[-2deg] sm:top-1 sm:w-[74%]"
                        : offset < 0
                          ? "left-0 top-12 z-10 w-[60%] -translate-x-[22%] rotate-[-10deg] opacity-95 sm:w-[56%] sm:-translate-x-[28%]"
                          : "right-0 top-12 z-10 w-[60%] translate-x-[22%] rotate-[10deg] opacity-95 sm:w-[56%] sm:translate-x-[28%]"
                    }`}
                  >
                    <div className={`relative rounded-[2rem] border-2 border-dashed border-primary/40 p-3 shadow-[0_18px_38px_-20px_hsl(var(--foreground)/0.45)] ${slide.frameTone}`}>
                      <div className="relative overflow-hidden rounded-[1.4rem] border border-primary/20 bg-background aspect-[4/5]">
                        <Image
                          src={slide.src}
                          alt={slide.alt}
                          fill
                          sizes="(max-width: 768px) 70vw, 300px"
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/35 bg-background/70 px-3 py-2 text-sm font-medium text-foreground/80 backdrop-blur-md">
                          {slide.caption}
                        </div>
                      </div>

                      <span className="pointer-events-none absolute -left-3 -top-3 h-7 w-7 rounded-full border-2 border-primary/35 bg-yellow-100/80" />
                      <span className="pointer-events-none absolute -bottom-2 right-4 h-6 w-12 rounded-full border-2 border-primary/30 bg-background/80" />
                      <svg viewBox="0 0 120 40" className="pointer-events-none absolute -bottom-3 left-4 h-6 w-24 text-primary/45">
                        <path d="M4 26C18 6 30 7 40 24C50 8 62 7 72 23C84 9 94 12 112 22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </article>
                )
              })}
            </div>

            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                type="button"
                aria-label="Previous child photo"
                onClick={() => moveMoment("prev")}
                className="group inline-flex h-12 w-12 items-center justify-center rounded-full border border-primary/35 bg-background/90 text-primary shadow-md transition hover:-translate-y-0.5 hover:bg-primary/10"
              >
                <svg viewBox="0 0 28 28" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 14L20 22" />
                  <path d="M17 6C13 9 11 11 9 14C11 17 13 19 17 22" className="opacity-75" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted/30 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
              <div className="mb-12 text-center">
                <h2 className="text-3xl font-semibold text-foreground md:text-4xl">Operational clarity across child vaccination</h2>
                <p className="mt-3 text-lg text-foreground/80">
                  Facility sessions, outreach visits, and certificate workflows run in one shared system so teams can coordinate faster and keep every child on schedule.
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
                    <p className="mt-3 text-base text-foreground/80">{story.description}</p>
                    <ul className="mt-5 space-y-2 text-base text-foreground/75">
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
          <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="group relative w-full cursor-pointer overflow-hidden rounded-[2rem] border border-primary/20 bg-muted/20 shadow-xl backdrop-blur-xl transition hover:border-primary/40 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="View full certificate"
            >
              <Image
                src="/images/certificate-preview.png"
                alt="Digital vaccination certificate"
                width={800}
                height={600}
                className="w-full h-auto p-2"
              />
              <div className="absolute inset-x-0 bottom-0 flex justify-center pb-3 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="rounded-full bg-background/90 px-4 py-2 text-sm font-medium text-foreground shadow-lg backdrop-blur-sm">
                  Tap to view full size
                </span>
              </div>
            </button>
            <div className="rounded-[2rem] border border-primary/20 bg-background/70 p-8 shadow-xl backdrop-blur-2xl">
              <Badge variant="outline" className="border-primary/40 text-primary">
                Digital certificates
              </Badge>
              <h3 className="mt-6 text-3xl font-semibold text-foreground sm:text-4xl">Scan-ready proof in seconds</h3>
              <p className="mt-4 text-base text-foreground/80">
                Every certificate carries secure QR validation so parents, schools and clinicians trust the record instantly.
              </p>
              <ul className="mt-6 space-y-2 text-base text-foreground/75">
                {certificateBenefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="pillars" className="bg-muted/20 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-semibold text-foreground md:text-4xl">Pillars that support vaccination delivery</h2>
            <p className="mt-3 text-lg text-foreground/80">
              Core pillars present supply, coverage and record-integrity workflows in translucent panels so facility, outreach and national teams see exact responsibilities and act quickly to keep every child on schedule.
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
                <h3 className="text-2xl font-semibold text-foreground">{pillar.title}</h3>
                <p className="mt-3 text-base text-foreground/75">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="relative overflow-hidden py-20 sm:py-24">
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
                <Link href="/verify" className="transition hover:text-foreground">
                  Verify Certificate
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
                  National Command Center
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

      {/* Back to top */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        style={{
          opacity: showBackToTop ? 1 : 0,
          transform: showBackToTop ? "translateY(0) scale(1)" : "translateY(20px) scale(0.8)",
          pointerEvents: showBackToTop ? "auto" : "none",
        }}
        className="group fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 ring-2 ring-primary/20 transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label="Back to top"
      >
        <ArrowUp className="h-5 w-5 transition-transform duration-200 group-hover:-translate-y-0.5" />
      </button>
    </div>
  )
}
