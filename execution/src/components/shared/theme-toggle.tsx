"use client"

// Justification for "use client":
// - Reads and sets current theme via next-themes useTheme hook

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

interface ThemeToggleProps {
  /** "icon" = compact icon-only button (topbar). "full" = labeled button (account page). */
  variant?: "icon" | "full"
}

export function ThemeToggle({ variant = "icon" }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  // Avoid hydration mismatch — don't render icon until mounted
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    // Reserve space without rendering icon
    return (
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        aria-label="Toggle theme"
        disabled
      >
        <span className="h-5 w-5" />
      </Button>
    )
  }

  const isDark = resolvedTheme === "dark"

  function toggle() {
    setTheme(isDark ? "light" : "dark")
  }

  if (variant === "full") {
    return (
      <button
        onClick={toggle}
        className="flex items-center gap-2 rounded-md border border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-100 transition-colors"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? (
          <>
            <Sun className="h-4 w-4 text-warning-500" />
            <span>Light mode</span>
          </>
        ) : (
          <>
            <Moon className="h-4 w-4 text-neutral-500" />
            <span>Dark mode</span>
          </>
        )}
        <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500">
          {theme === "system" ? "System" : isDark ? "Dark" : "Light"}
        </span>
      </button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-9 w-9 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </Button>
  )
}
