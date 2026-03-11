"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { LayoutDashboard, FileText, ShieldCheck, LogOut, Menu, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/pha/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pha/reports", label: "Reports", icon: FileText },
  { href: "/pha/verify-certificate", label: "Verify Certificate", icon: ShieldCheck },
]

export function PHASidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    localStorage.removeItem("authToken")
    localStorage.removeItem("accessToken")
    localStorage.removeItem("userRole")
    localStorage.removeItem("userRoleDetail")
    localStorage.removeItem("userId")
    localStorage.removeItem("userProfile")
    localStorage.removeItem("phaSession")
    sessionStorage.removeItem("userName")
    router.replace("/auth/login")
  }

  const navLinks = navItems.map(({ href, label, icon: Icon }) => (
    <Link
      key={href}
      href={href}
      onClick={() => setMobileOpen(false)}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
        pathname === href
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  ))

  return (
    <>
      {/* ── Desktop sidebar (hidden on mobile) ─────────────────── */}
      <aside className="hidden lg:flex h-screen w-56 shrink-0 flex-col border-r bg-background">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b px-4 py-5">
          <div className="relative h-9 w-9 overflow-hidden rounded-lg border border-primary/30 bg-primary/5">
            <Image src="/images/cvcc-logo.png" alt="CVCC" fill sizes="36px" className="object-cover" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight">National Health</p>
            <p className="text-xs text-muted-foreground">PHA · Ghana</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 px-2 py-4">
          {navLinks}
        </nav>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-4 py-4">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* ── Mobile top bar (hidden on desktop) ─────────────────── */}
      <header className="flex items-center justify-between border-b bg-background px-4 py-3 lg:hidden sticky top-0 z-30">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-2">
          <div className="relative h-7 w-7 overflow-hidden rounded-md border border-primary/30 bg-primary/5">
            <Image src="/images/cvcc-logo.png" alt="CVCC" fill sizes="28px" className="object-cover" />
          </div>
          <span className="text-sm font-semibold">PHA · Ghana</span>
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ── Mobile drawer overlay ───────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer panel */}
          <div className="absolute left-0 top-0 h-full w-64 bg-background shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="relative h-7 w-7 overflow-hidden rounded-md border border-primary/30 bg-primary/5">
                  <Image src="/images/cvcc-logo.png" alt="CVCC" fill sizes="28px" className="object-cover" />
                </div>
                <span className="text-sm font-semibold">National Health</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <nav className="flex-1 space-y-0.5 px-2 py-4">
              {navLinks}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
