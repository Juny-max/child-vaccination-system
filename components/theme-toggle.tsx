"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { motion, AnimatePresence, type Transition } from "framer-motion"

const spring: Transition = {
  type: "spring",
  stiffness: 200,
  damping: 20,
}

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleToggle = () => {
    const currentTheme = (theme === "system" ? resolvedTheme : theme) || "light"
    setTheme(currentTheme === "dark" ? "light" : "dark")
  }

  const activeTheme = mounted ? (theme === "system" ? resolvedTheme : theme) || "light" : "light"
  const isDark = activeTheme === "dark"

  return (
    <motion.button
      type="button"
      onClick={handleToggle}
      className="relative flex h-10 w-16 items-center overflow-hidden rounded-full border border-border px-1 shadow-sm transition-colors hover:border-primary"
      aria-label="Toggle theme"
      layout
      transition={spring}
      whileTap={{ scale: 0.96 }}
      animate={{
        boxShadow: isDark
          ? "0 10px 25px rgba(15, 23, 42, 0.35)"
          : "0 10px 25px rgba(59, 130, 246, 0.25)",
      }}
    >
      <span className="sr-only">Toggle light and dark mode</span>
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={{
          background: isDark
            ? "linear-gradient(135deg, rgba(15,23,42,0.85), rgba(30,64,175,0.8))"
            : "linear-gradient(135deg, rgba(244,244,245,0.9), rgba(224,242,254,0.9))",
        }}
        transition={{ duration: 0.5, ease: [0.215, 0.61, 0.355, 1] }}
      />
      {mounted ? (
        <AnimatePresence initial={false} mode="wait">
          {isDark ? (
            <motion.span
              key="sun"
              initial={{ opacity: 0, scale: 0.5, x: "-40%" }}
              animate={{ opacity: 1, scale: 1, x: "0%" }}
              exit={{ opacity: 0, scale: 0.5, x: "40%" }}
              transition={spring}
              className="absolute left-1 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
            >
              <Sun className="size-4" />
            </motion.span>
          ) : (
            <motion.span
              key="moon"
              initial={{ opacity: 0, scale: 0.5, x: "40%" }}
              animate={{ opacity: 1, scale: 1, x: "0%" }}
              exit={{ opacity: 0, scale: 0.5, x: "-40%" }}
              transition={spring}
              className="absolute right-1 flex size-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow"
            >
              <Moon className="size-4" />
            </motion.span>
          )}
        </AnimatePresence>
      ) : null}
    </motion.button>
  )
}
