"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"

type MorphNavbarItem = {
  label: string
  href: string
}

type MorphNavbarProps = {
  brand?: React.ReactNode
  items?: MorphNavbarItem[]
  cta?: React.ReactNode
  mobileMenuUtility?: React.ReactNode
  className?: string
}

const DEFAULT_ITEMS: MorphNavbarItem[] = [
  { label: "Overview", href: "#" },
  { label: "Features", href: "#" },
  { label: "Safety", href: "#" },
]

const TRANSITION = {
  duration: 0.4,
  ease: "easeInOut" as const,
}

export function MorphNavbar({
  brand = <span className="text-sm font-semibold">Child Vaccination System</span>,
  items = DEFAULT_ITEMS,
  cta,
  mobileMenuUtility,
  className,
}: MorphNavbarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const lastYRef = useRef(0)
  const tickingRef = useRef(false)

  const transition = {
    ...TRANSITION,
    duration: isMobile ? 0.28 : TRANSITION.duration,
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)")

    const onMediaChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches)
      if (!event.matches) {
        setMobileMenuOpen(false)
      }
    }

    setIsMobile(mediaQuery.matches)
    mediaQuery.addEventListener("change", onMediaChange)

    return () => mediaQuery.removeEventListener("change", onMediaChange)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const handleScroll = () => {
      if (tickingRef.current) {
        return
      }

      tickingRef.current = true

      window.requestAnimationFrame(() => {
        const y = window.scrollY
        const prevY = lastYRef.current
        const delta = y - prevY

        const nextDirection = delta > 0 ? "down" : "up"

        if (y <= 8) {
          setCollapsed(false)
        } else if (nextDirection === "down" && y > (isMobile ? 22 : 28)) {
          setCollapsed(true)
        } else if (nextDirection === "up" && y < (isMobile ? 72 : 90)) {
          setCollapsed(false)
        }

        lastYRef.current = y
        tickingRef.current = false
      })
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [isMobile])

  return (
    <motion.header
      className={cn("fixed inset-x-0 top-0 z-50", className)}
      style={{
        ["--nav-py" as string]: isMobile ? "0.75rem" : "0.75rem",
        ["--nav-px" as string]: isMobile ? "1rem" : "1.25rem",
      }}
      animate={{
        ["--nav-py" as string]: isMobile ? (collapsed ? "0.75rem" : "0.875rem") : collapsed ? "0.95rem" : "0.75rem",
        ["--nav-px" as string]: isMobile ? "1rem" : "1.25rem",
      }}
      transition={transition}
    >
      <motion.div
        className="mx-auto flex justify-center"
        layout
        animate={{
          paddingTop: collapsed ? (isMobile ? 8 : 10) : 0,
          paddingLeft: collapsed ? (isMobile ? 0 : 14) : 0,
          paddingRight: collapsed ? (isMobile ? 0 : 14) : 0,
        }}
        transition={transition}
      >
        <motion.nav
          layout
          className={cn(
            "text-foreground",
            isMobile
              ? "w-[95%] rounded-2xl border border-border bg-background/85 shadow-[0_2px_10px_rgba(0,0,0,0.06)] backdrop-blur-[8px]"
              : collapsed
                ? "w-full max-w-[980px] rounded-[28px] border border-border bg-background/80 shadow-[0_4px_16px_rgba(0,0,0,0.08)] backdrop-blur-[12px]"
                : "w-full max-w-none rounded-none border-b border-border bg-background shadow-none"
          )}
          animate={{
            borderRadius: isMobile ? 20 : collapsed ? 28 : 0,
            scale: isMobile ? (collapsed ? 0.998 : 1) : collapsed ? 0.992 : 1,
            y: collapsed ? (isMobile ? 0.5 : 1) : 0,
            opacity: collapsed ? (isMobile ? 0.995 : 0.985) : 1,
          }}
          transition={transition}
        >
          <div className="flex items-center justify-between gap-3 px-[var(--nav-px)] py-[var(--nav-py)] md:hidden">
            <div className="flex min-w-0 flex-1 items-center overflow-hidden [&_p]:hidden">
              {brand}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2.5 whitespace-nowrap [&>*]:shrink-0">
              {cta ?? (
                <Link
                  href="/auth/login"
                  className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Portal Login
                </Link>
              )}

              <button
                type="button"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/90 text-foreground transition-colors hover:bg-muted"
              >
                {mobileMenuOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          <motion.div
            className="overflow-hidden border-t border-border/70 md:hidden"
            initial={false}
            animate={{
              height: mobileMenuOpen ? "auto" : 0,
              opacity: mobileMenuOpen ? 1 : 0,
            }}
            transition={transition}
          >
            <div className="flex flex-col items-start gap-4 px-5 py-5">
              {mobileMenuUtility ? <div className="shrink-0 [&>*]:shrink-0">{mobileMenuUtility}</div> : null}

              <ul className="flex w-full flex-col items-start gap-4">
              {items.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex h-10 w-full items-center justify-start rounded-xl px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            </div>
          </motion.div>

          <motion.div
            layout
            className={cn(
              "hidden items-center md:grid",
              collapsed
                ? "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-6 px-[var(--nav-px)] py-[var(--nav-py)]"
                : "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-8 px-[var(--nav-px)] py-[var(--nav-py)]"
            )}
            transition={transition}
          >
            <div className="flex min-w-0 items-center justify-start">
              {brand}
            </div>

            <ul className="hidden items-center justify-center gap-7 md:flex">
              {items.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-end gap-2.5 whitespace-nowrap">
              {cta ?? (
                <Link
                  href="/auth/login"
                  className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Portal Login
                </Link>
              )}
            </div>
          </motion.div>
        </motion.nav>
      </motion.div>
    </motion.header>
  )
}
