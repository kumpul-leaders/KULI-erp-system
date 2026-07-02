"use client"

/**
 * ActivitiesCalendarView — Month grid for activities.
 *
 * Reuses MonthCalendar generic grid.
 * Each activity chip shows: type icon, subject, dot colored by due status.
 * Click chip → opens mark-done popover (mirrors ActivityRow in activities-view.tsx).
 * Activities without dueDate (edge case) appear in "Tanpa tanggal" collapsible.
 *
 * Optimistic done + toast pattern matching existing activities-view.tsx.
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Phone,
  Mail,
  Users,
  CheckSquare,
  CalendarDays,
  Check,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { MonthCalendar, type CalendarItem } from "@/components/shared/month-calendar"
import {
  getActivityStatus,
  ACTIVITY_STATUS_CLASSES,
} from "@/components/activities/activity-status"
import { cn } from "@/lib/utils"
import type { SerializedPageActivity } from "@/app/(dashboard)/activities/page"

// ── Type icons ────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<SerializedPageActivity["type"], React.ReactNode> = {
  call:     <Phone className="h-3 w-3 flex-shrink-0" />,
  email:    <Mail className="h-3 w-3 flex-shrink-0" />,
  meeting:  <Users className="h-3 w-3 flex-shrink-0" />,
  todo:     <CheckSquare className="h-3 w-3 flex-shrink-0" />,
  deadline: <CalendarDays className="h-3 w-3 flex-shrink-0" />,
}

// ── Activity chip ─────────────────────────────────────────────────────────────

interface ActivityChipProps {
  activity: SerializedPageActivity
  onMarkDone: (id: string) => Promise<void>
  onRescheduled: () => void
}

function ActivityChip({ activity, onMarkDone, onRescheduled }: ActivityChipProps) {
  const [donePopoverOpen, setDonePopoverOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [marking, setMarking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(activity.dueDate + "T00:00:00")
  )

  const status = getActivityStatus(activity.dueDate)
  const classes = ACTIVITY_STATUS_CLASSES[status]

  const contextLink = activity.lead
    ? { href: `/pipeline/${activity.lead.id}`, label: activity.lead.client.name }
    : activity.client
    ? { href: `/clients/${activity.client.id}`, label: activity.client.name }
    : null

  async function handleMarkDone() {
    setMarking(true)
    try {
      await onMarkDone(activity.id)
      setDonePopoverOpen(false)
    } finally {
      setMarking(false)
    }
  }

  async function handleReschedule() {
    if (!selectedDate) return
    setSaving(true)
    try {
      const dueDate = format(selectedDate, "yyyy-MM-dd")
      const res = await fetch(`/api/activities/${activity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Gagal reschedule")
      }
      toast.success("Activity dijadwalkan ulang")
      setRescheduleOpen(false)
      onRescheduled()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={donePopoverOpen} onOpenChange={setDonePopoverOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full text-left rounded border px-1.5 py-0.5 text-[10px] font-medium leading-tight",
            "flex items-center gap-1 transition-opacity hover:opacity-80",
            classes.badge
          )}
          title={activity.subject}
        >
          {/* Status dot */}
          <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", classes.dot)} />
          {/* Type icon */}
          <span className="flex-shrink-0 opacity-70">{TYPE_ICONS[activity.type]}</span>
          {/* Subject */}
          <span className="truncate">{activity.subject}</span>
        </button>
      </PopoverTrigger>

      {/* Done / Reschedule popover */}
      <PopoverContent className="w-64 p-3" align="start">
        <p className="text-xs font-semibold text-neutral-700 mb-1 truncate">
          {activity.subject}
        </p>
        {contextLink && (
          <Link
            href={contextLink.href}
            className="text-[10px] text-accent-600 hover:underline mb-3 block truncate"
          >
            {contextLink.label}
          </Link>
        )}

        <div className="flex flex-col gap-2">
          {/* Mark done */}
          <button
            type="button"
            onClick={() => void handleMarkDone()}
            disabled={marking}
            className="inline-flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs bg-success-50 text-success-700 border border-success-200 hover:bg-success-100 transition-colors disabled:opacity-50"
          >
            {marking ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Tandai Selesai
          </button>

          {/* Reschedule inline */}
          <Popover open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs text-neutral-500 border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Jadwalkan Ulang
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-2 border-b border-neutral-100">
                <p className="text-xs font-semibold text-neutral-700">Pilih tanggal baru</p>
              </div>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
              />
              <div className="flex justify-end gap-2 p-2 border-t border-neutral-100">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRescheduleOpen(false)}
                  disabled={saving}
                  className="h-7 px-2 text-xs"
                >
                  Batal
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleReschedule()}
                  disabled={!selectedDate || saving}
                  className="h-7 px-2 text-xs"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Simpan"}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface ActivitiesCalendarViewProps {
  activities: SerializedPageActivity[]
}

export function ActivitiesCalendarView({ activities: initialActivities }: ActivitiesCalendarViewProps) {
  const router = useRouter()
  const [activities, setActivities] = useState(initialActivities)

  async function handleMarkDone(id: string) {
    const res = await fetch(`/api/activities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "done" }),
    })
    if (!res.ok) {
      const data = (await res.json()) as { error?: string }
      throw new Error(data.error ?? "Gagal menyelesaikan activity")
    }
    toast.success("Activity selesai")
    // Optimistic remove
    setActivities((prev) => prev.filter((a) => a.id !== id))
    router.refresh()
  }

  function handleRescheduled() {
    router.refresh()
  }

  const items: CalendarItem[] = activities.map((activity) => ({
    date: activity.dueDate ?? null,
    render: () => (
      <ActivityChip
        activity={activity}
        onMarkDone={handleMarkDone}
        onRescheduled={handleRescheduled}
      />
    ),
  }))

  return (
    <MonthCalendar
      items={items}
      undatedLabel="Activities tanpa due date"
    />
  )
}
