"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence, type Transition } from "framer-motion"

const spring: Transition = {
  type: "spring",
  stiffness: 250,
  damping: 22,
}

type ThemeToggleProps = {
  className?: string
  showLabel?: boolean
}

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false)
  const [themePulse, setThemePulse] = useState<{ id: number; x: number; y: number } | null>(null)
  const { theme, setTheme, resolvedTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    const currentTheme = (theme === "system" ? resolvedTheme : theme) || "light"
    setTheme(currentTheme === "dark" ? "light" : "dark")

    setThemePulse({ id: Date.now(), x: event.clientX, y: event.clientY })
    window.setTimeout(() => setThemePulse(null), 820)
  }

  const activeTheme = mounted ? (theme === "system" ? resolvedTheme : theme) || "light" : "light"
  const isDark = activeTheme === "dark"

  return (
    <>
      <motion.button
        type="button"
        onClick={handleToggle}
        className={cn(
          "relative inline-flex h-11 items-center gap-3 overflow-hidden rounded-full border border-border bg-muted/50 px-1.5 shadow-sm backdrop-blur-sm",
          "transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          showLabel ? "w-44 justify-start" : "w-20 justify-center",
          className,
        )}
        aria-label="Toggle theme"
        layout
        transition={spring}
        whileTap={{ scale: 0.97 }}
      >
        <span className="sr-only">Toggle light and dark mode</span>

        <motion.div
          className="absolute inset-0"
          initial={false}
          animate={{
            opacity: isDark ? 0.45 : 0.75,
          }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="absolute inset-y-1 left-1/2 w-20 -translate-x-1/2 rounded-full bg-primary/20 blur-xl"
            animate={{
              x: isDark ? 18 : -18,
              scale: isDark ? 1.25 : 1,
            }}
            transition={spring}
          />
        </motion.div>

        <div className={cn("relative z-10 flex w-full items-center", showLabel ? "justify-between pr-2" : "justify-center")}>
          <div className="relative h-8 w-[4.25rem] shrink-0">
            <motion.div
              className="absolute top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-background shadow"
              animate={{
                left: isDark ? "calc(100% - 2rem)" : "0rem",
              }}
              transition={spring}
            >
            <motion.div
              className="absolute inset-0"
              animate={{ rotate: isDark ? 180 : 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <AnimatePresence initial={false} mode="wait">
                {isDark ? (
                  <motion.span
                    key="dark-moon"
                    className="absolute inset-0 flex items-center justify-center text-foreground"
                    initial={{ opacity: 0, scale: 0.6, rotate: -30 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.7, rotate: 20 }}
                    transition={{ duration: 0.35 }}
                  >
                    <Moon className="size-4" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="light-sun"
                    className="absolute inset-0 flex items-center justify-center text-foreground"
                    initial={{ opacity: 0, scale: 0.6, rotate: 30 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.7, rotate: -20 }}
                    transition={{ duration: 0.35 }}
                  >
                    <Sun className="size-4" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>

              <motion.span
                className="absolute -right-1 top-1/2 h-1.5 w-1.5 rounded-full bg-primary/70"
                animate={{
                  y: isDark ? -10 : -4,
                  opacity: isDark ? 1 : 0,
                  scale: isDark ? 1 : 0.2,
                }}
                transition={{ duration: 0.45 }}
              />
              <motion.span
                className="absolute -left-1 top-1/2 h-1.5 w-1.5 rounded-full bg-primary/60"
                animate={{
                  y: isDark ? 8 : 2,
                  opacity: isDark ? 0.9 : 0,
                  scale: isDark ? 1 : 0.2,
                }}
                transition={{ duration: 0.45, delay: 0.05 }}
              />
            </motion.div>
          </div>
        </div>

        {showLabel ? (
          <motion.span
            className="relative z-10 text-sm font-medium text-foreground"
            key={isDark ? "label-dark" : "label-light"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            {isDark ? "Dark mode" : "Light mode"}
          </motion.span>
        ) : null}
      </motion.button>

      <AnimatePresence>
        {themePulse ? (
          <motion.div key={themePulse.id} className="pointer-events-none fixed inset-0 z-[90] overflow-hidden">
            <motion.div
              className="absolute h-8 w-8 rounded-full bg-primary/25"
              style={{ left: themePulse.x - 16, top: themePulse.y - 16 }}
              initial={{ scale: 0, opacity: 0.7 }}
              animate={{ scale: 34, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
