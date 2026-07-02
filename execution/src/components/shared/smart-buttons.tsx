"use client"

/**
 * SmartButtons — Odoo-style contextual nav row for record detail pages.
 *
 * Renders a horizontal row of compact badge-buttons showing counts and links.
 * Each button is either:
 *   - A Next.js Link (external navigation)
 *   - A scroll-to-section anchor (smooth scroll within page)
 *
 * Usage:
 *   <SmartButtons buttons={[...]} />
 *
 * "use client" is required because scroll-to-section buttons use onClick
 * with scrollIntoView. Link-only buttons could be server-rendered, but
 * co-locating both variants in one component keeps the API clean.
 */

import Link from "next/link"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface SmartButtonBase {
  /** Icon element (Lucide or any ReactNode) */
  icon?: React.ReactNode
  /** Primary count or value displayed prominently */
  count?: number | string
  /** Label shown after the count */
  label: string
  /** Optional tooltip / aria-label */
  title?: string
}

interface SmartButtonLink extends SmartButtonBase {
  type: "link"
  href: string
}

interface SmartButtonScroll extends SmartButtonBase {
  type: "scroll"
  /** `id` of the target element to scroll to */
  targetId: string
}

/** Static info badge — no interaction, just displays a value */
interface SmartButtonBadge extends SmartButtonBase {
  type: "badge"
}

export type SmartButtonConfig =
  | SmartButtonLink
  | SmartButtonScroll
  | SmartButtonBadge

interface SmartButtonsProps {
  buttons: SmartButtonConfig[]
  className?: string
}

// ── Shared button visual shell ────────────────────────────────────────────────

const buttonBase =
  "inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-card transition-colors hover:bg-neutral-50 hover:border-neutral-300 shrink-0 whitespace-nowrap"

const badgeBase =
  "inline-flex items-center gap-1.5 rounded-md border border-neutral-100 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-600 shrink-0 whitespace-nowrap cursor-default"

// ── Component ─────────────────────────────────────────────────────────────────

export function SmartButtons({ buttons, className }: SmartButtonsProps) {
  function handleScroll(targetId: string) {
    const el = document.getElementById(targetId)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide",
        className
      )}
      aria-label="Quick navigation"
    >
      {buttons.map((btn, i) => {
        const inner = (
          <>
            {btn.icon && (
              <span className="text-neutral-400 [&>svg]:h-3.5 [&>svg]:w-3.5">
                {btn.icon}
              </span>
            )}
            {btn.count !== undefined && (
              <span className="font-semibold tabular-nums text-neutral-900">
                {btn.count}
              </span>
            )}
            <span>{btn.label}</span>
          </>
        )

        if (btn.type === "link") {
          return (
            <Link
              key={i}
              href={btn.href}
              className={buttonBase}
              title={btn.title}
            >
              {inner}
            </Link>
          )
        }

        if (btn.type === "scroll") {
          return (
            <button
              key={i}
              type="button"
              className={buttonBase}
              title={btn.title}
              onClick={() => handleScroll(btn.targetId)}
            >
              {inner}
            </button>
          )
        }

        // type === "badge"
        return (
          <span key={i} className={badgeBase} title={btn.title}>
            {inner}
          </span>
        )
      })}
    </div>
  )
}
