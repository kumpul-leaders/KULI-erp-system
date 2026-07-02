"use client"

/**
 * MonthCalendar — Generic month grid component.
 *
 * Accepts items with optional date strings and a render function.
 * Items without a date are collected and rendered in a collapsible
 * "Tanpa tanggal" row below the grid.
 *
 * "use client" required: month navigation state + collapsible state.
 */

import React, { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CalendarItem {
  /** YYYY-MM-DD or null (undated) */
  date: string | null
  render: () => React.ReactNode
}

interface MonthCalendarProps {
  items: CalendarItem[]
  /** Label for the "undated" collapsible row. Defaults to "Tanpa tanggal" */
  undatedLabel?: string
  /** Extra class on the root container */
  className?: string
}

// ── Day names ─────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayString(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`
}

function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  })
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function startDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay() // 0 = Sunday
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MonthCalendar({
  items,
  undatedLabel = "Tanpa tanggal",
  className,
}: MonthCalendarProps) {
  const todayStr = todayString()
  const todayYear = new Date().getFullYear()
  const todayMonth = new Date().getMonth()

  const [year, setYear] = useState(todayYear)
  const [month, setMonth] = useState(todayMonth)
  const [undatedOpen, setUndatedOpen] = useState(false)

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }

  function goToday() {
    setYear(todayYear)
    setMonth(todayMonth)
  }

  // Group items by date string within current month
  const itemsByDate = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`
    const map = new Map<string, CalendarItem[]>()
    for (const item of items) {
      if (item.date?.startsWith(prefix)) {
        const existing = map.get(item.date) ?? []
        existing.push(item)
        map.set(item.date, existing)
      }
    }
    return map
  }, [items, year, month])

  const undatedItems = useMemo(
    () => items.filter((i) => i.date === null),
    [items]
  )

  // Build grid cells
  const numDays = daysInMonth(year, month)
  const startDay = startDayOfMonth(year, month) // 0–6
  const totalCells = Math.ceil((startDay + numDays) / 7) * 7

  const cells: Array<number | null> = []
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= numDays; d++) cells.push(d)
  while (cells.length < totalCells) cells.push(null)

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Month nav */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={prevMonth}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 transition-colors"
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <h2 className="flex-1 text-center text-sm font-semibold text-neutral-800 capitalize">
          {formatMonthLabel(year, month)}
        </h2>

        <button
          type="button"
          onClick={nextMonth}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 transition-colors"
          aria-label="Bulan berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={goToday}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
        >
          Hari ini
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-px">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="py-1.5 text-center text-xs font-semibold text-neutral-400 uppercase tracking-wide"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden border border-neutral-200 bg-neutral-200">
        {cells.map((day, idx) => {
          if (!day) {
            return (
              <div
                key={`empty-${idx}`}
                className="min-h-[80px] bg-neutral-50 p-1"
              />
            )
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
          const dayItems = itemsByDate.get(dateStr) ?? []
          const isToday = dateStr === todayStr

          return (
            <div
              key={dateStr}
              className="min-h-[80px] bg-white p-1.5 flex flex-col gap-1"
            >
              {/* Day number */}
              <span
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center self-start rounded-full text-xs font-medium",
                  isToday
                    ? "bg-accent-600 text-white"
                    : "text-neutral-500"
                )}
              >
                {day}
              </span>

              {/* Items */}
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayItems.slice(0, 4).map((item, i) => (
                  <div key={i}>{item.render()}</div>
                ))}
                {dayItems.length > 4 && (
                  <span className="text-[10px] text-neutral-400 font-medium px-1">
                    +{dayItems.length - 4} lainnya
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Undated items */}
      {undatedItems.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setUndatedOpen((o) => !o)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            {undatedOpen ? (
              <ChevronUp className="h-4 w-4 text-neutral-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-neutral-400" />
            )}
            {undatedLabel}
            <span className="ml-auto text-xs font-normal text-neutral-400">
              {undatedItems.length}
            </span>
          </button>

          {undatedOpen && (
            <div className="border-t border-neutral-100 px-4 py-3 flex flex-col gap-2">
              {undatedItems.map((item, i) => (
                <div key={i}>{item.render()}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
