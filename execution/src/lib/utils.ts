import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency as IDR — full format per confirmed decision.
 * Output: "Rp 847.000.000"
 */
export function formatIDR(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—"
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "—"
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

/**
 * Format currency as compact IDR — shortened for dense UI like kanban column headers.
 * Output: "Rp 847jt" | "Rp 1,2M" | "Rp 500rb"
 */
export function formatIDRCompact(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—"
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "—"
  if (num === 0) return "Rp 0"
  const abs = Math.abs(num)
  const sign = num < 0 ? "-" : ""
  if (abs >= 1_000_000_000) {
    return `${sign}Rp ${(abs / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}M`
  }
  if (abs >= 1_000_000) {
    return `${sign}Rp ${(abs / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`
  }
  if (abs >= 1_000) {
    return `${sign}Rp ${(abs / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 0 })}rb`
  }
  return `${sign}Rp ${abs.toLocaleString("id-ID")}`
}

/**
 * Returns days remaining from today to a given date.
 * Negative means already past.
 */
export function daysUntil(date: Date | string): number {
  const target = typeof date === "string" ? new Date(date) : date
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Contract expiry urgency level based on days remaining.
 */
export function contractUrgency(
  daysRemaining: number
): "critical" | "warning" | "notice" | "none" {
  if (daysRemaining <= 30) return "critical"
  if (daysRemaining <= 60) return "warning"
  if (daysRemaining <= 90) return "notice"
  return "none"
}

/**
 * Returns user initials from a full name string.
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("")
}

/**
 * Generates an inclusive array of billing plan strings in "YY-MM" format
 * from start to end, handling year rollover.
 *
 * generateBillingPlanRange("26-01", "26-06") → ["26-01","26-02","26-03","26-04","26-05","26-06"]
 * generateBillingPlanRange("25-11", "26-02") → ["25-11","25-12","26-01","26-02"]
 *
 * Returns [] if format is invalid or end < start.
 */
export function generateBillingPlanRange(start: string, end: string): string[] {
  const startMatch = start.match(/^(\d{2})-(\d{2})$/)
  const endMatch = end.match(/^(\d{2})-(\d{2})$/)
  if (!startMatch || !endMatch) return []

  const startYear = parseInt(startMatch[1], 10)
  const startMonth = parseInt(startMatch[2], 10)
  const endYear = parseInt(endMatch[1], 10)
  const endMonth = parseInt(endMatch[2], 10)

  if (startMonth < 1 || startMonth > 12) return []
  if (endMonth < 1 || endMonth > 12) return []

  // Convert to an ordinal for comparison: year * 12 + (month - 1)
  const startOrdinal = startYear * 12 + (startMonth - 1)
  const endOrdinal = endYear * 12 + (endMonth - 1)

  if (endOrdinal < startOrdinal) return []

  const result: string[] = []
  for (let ord = startOrdinal; ord <= endOrdinal; ord++) {
    const yr = Math.floor(ord / 12)
    const mo = (ord % 12) + 1
    const yrStr = String(yr).padStart(2, "0")
    const moStr = String(mo).padStart(2, "0")
    result.push(`${yrStr}-${moStr}`)
  }
  return result
}

const INDONESIAN_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
]

/**
 * Converts a "YY-MM" billing plan string to a human-readable Indonesian label.
 *
 * billingPlanToLabel("26-01") → "Jan 2026"
 * billingPlanToLabel("26-12") → "Des 2026"
 *
 * Returns "" if the input is invalid.
 */
export function billingPlanToLabel(bp: string): string {
  const match = bp.match(/^(\d{2})-(\d{2})$/)
  if (!match) return ""
  const year = 2000 + parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  if (month < 1 || month > 12) return ""
  return `${INDONESIAN_MONTHS[month - 1]} ${year}`
}
