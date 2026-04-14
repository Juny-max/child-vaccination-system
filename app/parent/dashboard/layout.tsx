'use client'

import type { ComponentType } from "react"
import { Suspense, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import Lottie from "lottie-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  Award,
  Baby,
  CalendarDays,
  Home,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  Syringe,
  User,
  X,
} from "lucide-react"
import { ParentDashboardProvider, useParentDashboard } from "./dashboard-context"
import { ThemeToggle } from "@/components/theme-toggle"
import loadingAnimation from "@/public/animations/loading.json"

type DashboardLayoutProps = {
  children: React.ReactNode
}

type NavItem = {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
  badge?: string
}

const navItems: NavItem[] = [
  { label: "Overview", href: "/parent/dashboard", icon: Home },
  { label: "Certificates", href: "/parent/dashboard/certificates", icon: Award },
  { label: "Vaccination status", href: "/parent/dashboard/vaccination-status", icon: Syringe },
  { label: "Missed vaccinations", href: "/parent/dashboard/missed-vaccinations", icon: AlertTriangle },
  { label: "Child details", href: "/parent/dashboard/child-details", icon: Baby },
  { label: "Mother details", href: "/parent/dashboard/mother-details", icon: User },
  { label: "Appointments", href: "/parent/dashboard/appointments", icon: CalendarDays },
  { label: "Support", href: "/parent/dashboard/support", icon: MessageCircle },
]

function DashboardLayoutContent({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const { userName, greeting, isLoading, error, retryFetch, logout, missedVaccinations } = useParentDashboard()
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const currentNavItems = useMemo(() => navItems, [])
  const missedVaccinationCount = missedVaccinations.length
  const missedVaccinationBadge = missedVaccinationCount > 99 ? "99+" : `${missedVaccinationCount}`

  useEffect(() => {
    setIsMobileNavOpen(false)
  }, [pathname])

  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      await retryFetch()
    } finally {
      setIsRetrying(false)
    }
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await logout()
    } catch (error) {
      console.error('Logout failed:', error)
      setIsLoggingOut(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <div className="flex flex-col items-center gap-4">
          <div className="size-48">
            <Lottie animationData={loadingAnimation} loop />
          </div>
          <p className="text-sm text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <div className="flex max-w-md flex-col items-center gap-6 rounded-lg border border-destructive/30 bg-background p-8 text-center shadow-lg">
          <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Unable to Load Dashboard</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleRetry} disabled={isRetrying} className="gap-2">
              {isRetrying ? (
                <>
                  <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Retrying...
                </>
              ) : (
                'Try Again'
              )}
            </Button>
            <Button variant="outline" onClick={handleLogout} disabled={isLoggingOut} className="gap-2">
              {isLoggingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
              Back to Login
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            If the problem persists, please contact support or try again later.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-4">
          <div className="flex items-center justify-between gap-3 lg:gap-4">
            <div className="flex items-center gap-2.5 lg:items-start lg:gap-3">
              <div className="relative size-9 overflow-hidden rounded-lg border border-border bg-background shadow-sm lg:size-10">
                <Image
                  src="/images/cvcc-logo.png"
                  alt="Child Vaccination Command Center logo"
                  fill
                  sizes="40px"
                  className="object-contain p-1"
                  priority
                />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground lg:text-xs">Mother dashboard</p>
                <h1 className="text-base font-semibold leading-tight sm:text-lg lg:text-xl">
                  {greeting}, {userName}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <Button
                variant="outline"
                size="icon"
                className="size-9"
                onClick={() => setIsMobileNavOpen(true)}
                aria-label="Open navigation menu"
              >
                <Menu className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="size-9"
                aria-label="Logout"
              >
                {isLoggingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
              </Button>
            </div>
          </div>
          <div className="hidden items-center gap-3 lg:flex">
            <ThemeToggle />
            <span className="text-sm text-muted-foreground">Signed in as {userName}</span>
            <Button variant="outline" size="sm" onClick={handleLogout} disabled={isLoggingOut} className="gap-2">
              {isLoggingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
              Logout
            </Button>
          </div>
        </div>
      </header>

      {isMobileNavOpen ? (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 flex w-72 max-w-[82vw] flex-col border-l border-border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-3 py-3">
              <div className="flex items-center gap-2 text-sm">
                <div className="relative size-8 overflow-hidden rounded-md border border-border bg-background">
                  <Image
                    src="/images/cvcc-logo.png"
                    alt="Child Vaccination Command Center logo"
                    fill
                    sizes="32px"
                    className="object-contain p-1.5"
                  />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Parent dashboard</p>
                  <p className="text-sm font-semibold text-foreground">Signed in as {userName}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setIsMobileNavOpen(false)}
                aria-label="Close navigation menu"
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Theme</p>
                <ThemeToggle />
              </div>
              <nav className="space-y-1.5">
                {currentNavItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  const badge =
                    item.href === "/parent/dashboard/missed-vaccinations" && missedVaccinationCount > 0
                      ? missedVaccinationBadge
                      : item.badge
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileNavOpen(false)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md border px-3 py-1.5 text-[13px] transition-colors",
                        isActive
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-transparent bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      <Icon className="size-3.5" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {badge ? <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">{badge}</Badge> : null}
                    </Link>
                  )
                })}
              </nav>
            </div>
            <div className="border-t border-border p-3">
              <Button onClick={handleLogout} disabled={isLoggingOut} variant="outline" className="h-9 w-full gap-2 text-sm">
                {isLoggingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                Logout
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {missedVaccinationCount > 0 ? (
        <div className="mx-auto w-full max-w-7xl px-4 pt-4 lg:pt-6">
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-destructive">
                    Alert: {missedVaccinationCount} missed vaccination{missedVaccinationCount > 1 ? "s" : ""} need attention
                  </p>
                  <p className="text-xs text-destructive/90 sm:text-sm">
                    Some doses are overdue. Open the missed vaccinations page to book a make-up visit.
                  </p>
                </div>
              </div>
              <Button asChild variant="destructive" size="sm" className="w-full sm:w-auto">
                <Link href="/parent/dashboard/missed-vaccinations">Review now</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-7xl flex-1 px-4 py-6 lg:py-10">
        <aside className="relative hidden w-64 shrink-0 pr-8 lg:block">
          <nav className="sticky top-24 space-y-2">
            {currentNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              const badge =
                item.href === "/parent/dashboard/missed-vaccinations" && missedVaccinationCount > 0
                  ? missedVaccinationBadge
                  : item.badge
              return (
                <Button
                  key={item.href}
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  asChild
                  className={cn(
                    "w-full justify-start gap-3",
                    isActive ? "shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Link href={item.href}>
                    <Icon className="size-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {badge ? <Badge variant="destructive">{badge}</Badge> : null}
                  </Link>
                </Button>
              )
            })}
          </nav>
        </aside>
        <main className="w-full space-y-6 pb-10 lg:space-y-8">
          {children}
        </main>
      </div>
    </div>
  )
}

function DashboardSearchParamsFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="flex flex-col items-center gap-4">
        <div className="size-48">
          <Lottie animationData={loadingAnimation} loop />
        </div>
        <p className="text-sm text-muted-foreground">Preparing your dashboard...</p>
      </div>
    </div>
  )
}

export default function ParentDashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <Suspense fallback={<DashboardSearchParamsFallback />}>
      <ParentDashboardProvider>
        <DashboardLayoutContent>{children}</DashboardLayoutContent>
      </ParentDashboardProvider>
    </Suspense>
  )
}
