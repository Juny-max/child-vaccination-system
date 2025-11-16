'use client'

import type { ComponentType } from "react"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  Award,
  Baby,
  CalendarDays,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  ShieldCheck,
  Syringe,
  User,
  X,
} from "lucide-react"
import { ParentDashboardProvider } from "./dashboard-context"
import { ThemeToggle } from "@/components/theme-toggle"

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
  { label: "Missed vaccinations", href: "/parent/dashboard/missed-vaccinations", icon: AlertTriangle, badge: "Alert" },
  { label: "Child details", href: "/parent/dashboard/child-details", icon: Baby },
  { label: "Mother details", href: "/parent/dashboard/mother-details", icon: User },
  { label: "Appointments", href: "/parent/dashboard/appointments", icon: CalendarDays },
  { label: "Support", href: "/parent/dashboard/support", icon: MessageCircle },
]

export default function ParentDashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [userName, setUserName] = useState("User")
  const [greeting, setGreeting] = useState("Welcome")
  const [isReady, setIsReady] = useState(false)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("authToken")
    const role = localStorage.getItem("userRole")
    const name = localStorage.getItem("userName")

    if (!token) {
      router.push("/auth/login")
      return
    }

    if (role !== "parent") {
      router.push("/dashboard")
      return
    }

    const storedName = name || "Mother"
    setUserName(storedName)

    const hours = new Date().getHours()
    if (hours < 12) {
      setGreeting("Good morning")
    } else if (hours < 17) {
      setGreeting("Good afternoon")
    } else {
      setGreeting("Good evening")
    }

    setIsReady(true)
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("authToken")
    localStorage.removeItem("userRole")
    localStorage.removeItem("userRoleDetail")
    localStorage.removeItem("userName")
    router.push("/")
  }

  const currentNavItems = useMemo(() => navItems, [])

  useEffect(() => {
    setIsMobileNavOpen(false)
  }, [pathname])

  if (!isReady) {
    return null
  }

  return (
    <ParentDashboardProvider value={{ userName, greeting }}>
      <div className="min-h-screen bg-muted/40">
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Mother dashboard</p>
                <h1 className="text-xl font-semibold">
                  {greeting}, {userName}
                </h1>
                <p className="text-sm text-muted-foreground">Manage your children&apos;s vaccinations, appointments, and support tools.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden"
                onClick={() => setIsMobileNavOpen(true)}
                aria-label="Open navigation menu"
              >
                <Menu className="size-5" />
              </Button>
              <div className="hidden items-center gap-3 lg:flex">
                <ThemeToggle />
                <span className="text-sm text-muted-foreground">Signed in as {userName}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
                <LogOut className="size-4" /> Logout
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
            <div className="fixed inset-y-0 right-0 z-50 flex w-80 max-w-[85vw] flex-col border-l border-border bg-background shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-4">
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <ShieldCheck className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Parent dashboard</p>
                    <p className="font-semibold text-foreground">Signed in as {userName}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsMobileNavOpen(false)}
                  aria-label="Close navigation menu"
                >
                  <X className="size-5" />
                </Button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
                <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/40 p-4 text-center">
                  <ThemeToggle />
                  <p className="text-xs text-muted-foreground">Toggle clinic mode for brighter rooms or night feeds.</p>
                </div>
                <nav className="space-y-2">
                  {currentNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMobileNavOpen(false)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
                          isActive
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-transparent bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        )}
                      >
                        <Icon className="size-4" />
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.badge ? <Badge variant="destructive">{item.badge}</Badge> : null}
                      </Link>
                    )
                  })}
                </nav>
              </div>
              <div className="border-t border-border p-4">
                <Button onClick={handleLogout} variant="outline" className="w-full gap-2">
                  <LogOut className="size-4" /> Logout
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
                      {item.badge ? <Badge variant="destructive">{item.badge}</Badge> : null}
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
    </ParentDashboardProvider>
  )
}
