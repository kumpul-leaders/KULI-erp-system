/**
 * activity-status.ts
 *
 * Pure helper — no JSX, safe in both Server and Client Components.
 * Computes the status of an activity relative to today based on dueDate.
 */

export type ActivityStatusColor = "overdue" | "today" | "upcoming"

/**
 * Returns the display status for an activity based on its ISO date string (YYYY-MM-DD).
 * Overdue: dueDate < today
 * Today:   dueDate === today
 * Upcoming: dueDate > today
 */
export function getActivityStatus(dueDate: string): ActivityStatusColor {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const due = new Date(dueDate + "T00:00:00")

  if (due < today) return "overdue"
  if (due.getTime() === today.getTime()) return "today"
  return "upcoming"
}

/**
 * Maps ActivityStatusColor to Tailwind token classes.
 * Uses design system tokens: success (green), warning (orange/yellow), danger (red).
 */
export const ACTIVITY_STATUS_CLASSES: Record<
  ActivityStatusColor,
  { dot: string; text: string; badge: string }
> = {
  upcoming: {
    dot: "bg-success-500",
    text: "text-success-700",
    badge: "bg-success-50 text-success-700 border-success-200",
  },
  today: {
    dot: "bg-warning-500",
    text: "text-warning-700",
    badge: "bg-warning-50 text-warning-700 border-warning-200",
  },
  overdue: {
    dot: "bg-danger-500",
    text: "text-danger-600",
    badge: "bg-danger-50 text-danger-600 border-danger-200",
  },
}

/**
 * Formats a YYYY-MM-DD date string for display (e.g. "2 Jul 2026").
 */
export function formatActivityDate(dueDate: string): string {
  return new Date(dueDate + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}
