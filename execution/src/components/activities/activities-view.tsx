"use client"

/**
 * ActivitiesView — My Activities page content.
 *
 * Groups open activities into: Overdue / Hari Ini / Mendatang.
 * Each row: dot, type icon, subject, lead/client link, due date, quick actions (Done, Reschedule).
 * "Semua tim" toggle for admin/commercial_director.
 * Optimistic mutations + router.refresh() after Done/Reschedule.
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import {
  Phone,
  Mail,
  Users,
  CheckSquare,
  CalendarDays,
  Check,
  RefreshCw,
  CalendarIcon,
  Loader2,
} from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { ActivityDot } from "@/components/activities/activity-dot"
import {
  getActivityStatus,
  ACTIVITY_STATUS_CLASSES,
  formatActivityDate,
} from "@/components/activities/activity-status"
import { cn } from "@/lib/utils"
import type { SerializedPageActivity } from "@/app/(dashboard)/activities/page"

// ── Type icons ────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<SerializedPageActivity["type"], React.ReactNode> = {
  call: <Phone className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  meeting: <Users className="h-3.5 w-3.5" />,
  todo: <CheckSquare className="h-3.5 w-3.5" />,
  deadline: <CalendarDays className="h-3.5 w-3.5" />,
}

const TYPE_LABELS: Record<SerializedPageActivity["type"], string> = {
  call: "Telepon",
  email: "Email",
  meeting: "Meeting",
  todo: "To-Do",
  deadline: "Deadline",
}

// ── Reschedule inline popover ──────────────────────────────────────────────────

interface RescheduleInlineProps {
  activityId: string
  currentDueDate: string
  onDone: () => void
}

function RescheduleInline({ activityId, currentDueDate, onDone }: RescheduleInlineProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Date | undefined>(
    new Date(currentDueDate + "T00:00:00")
  )
  const [saving, setSaving] = useState(false)

  async function handleConfirm() {
    if (!selected) return
    setSaving(true)
    try {
      const dueDate = format(selected, "yyyy-MM-dd")
      const res = await fetch(`/api/activities/${activityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Gagal reschedule")
      }
      toast.success("Activity dijadwalkan ulang")
      setOpen(false)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-neutral-500 border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
          aria-label="Reschedule"
        >
          <RefreshCw className="h-3 w-3" />
          Reschedule
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 border-b border-neutral-100">
          <p className="text-xs font-semibold text-neutral-700">Jadwalkan ulang</p>
        </div>
        <Calendar
          mode="single"
          selected={selected}
          onSelect={setSelected}
        />
        <div className="flex justify-end gap-2 p-3 border-t border-neutral-100">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={saving}
            className="h-7 px-2 text-xs"
          >
            Batal
          </Button>
          <Button
            size="sm"
            onClick={() => void handleConfirm()}
            disabled={!selected || saving}
            className="h-7 px-2 text-xs"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Simpan"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── Activity row ───────────────────────────────────────────────────────────────

interface ActivityRowProps {
  activity: SerializedPageActivity
  onMarkDone: (id: string) => Promise<void>
  onRescheduled: () => void
}

function ActivityRow({ activity, onMarkDone, onRescheduled }: ActivityRowProps) {
  const [marking, setMarking] = useState(false)

  const status = getActivityStatus(activity.dueDate)
  const classes = ACTIVITY_STATUS_CLASSES[status]

  const contextLink = activity.lead
    ? { href: `/pipeline/${activity.lead.id}`, label: activity.lead.client.name }
    : activity.client
    ? { href: `/clients/${activity.client.id}`, label: activity.client.name }
    : null

  async function handleDone() {
    setMarking(true)
    try {
      await onMarkDone(activity.id)
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-neutral-100 bg-white px-4 py-3 hover:border-neutral-200 transition-colors group">
      {/* Activity dot */}
      <ActivityDot
        nextActivityAt={activity.dueDate ? `${activity.dueDate}T00:00:00.000Z` : null}
        subject={activity.subject}
      />

      {/* Type icon */}
      <span
        className="text-neutral-400 flex-shrink-0"
        title={TYPE_LABELS[activity.type]}
      >
        {TYPE_ICONS[activity.type]}
      </span>

      {/* Subject + context */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-800 truncate">{activity.subject}</p>
        {contextLink && (
          <Link
            href={contextLink.href}
            className="text-xs text-accent-600 hover:text-accent-700 hover:underline truncate block"
            onClick={(e) => e.stopPropagation()}
          >
            {contextLink.label}
          </Link>
        )}
      </div>

      {/* Assignee (team view) */}
      <span className="text-xs text-neutral-400 flex-shrink-0 hidden md:block">
        {activity.assignee.name}
      </span>

      {/* Due date */}
      <span className={cn("text-xs font-medium flex-shrink-0", classes.text)}>
        {formatActivityDate(activity.dueDate)}
      </span>

      {/* Quick actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => void handleDone()}
          disabled={marking}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs bg-success-50 text-success-700 border border-success-200 hover:bg-success-100 transition-colors disabled:opacity-50"
        >
          {marking ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
          Done
        </button>

        <RescheduleInline
          activityId={activity.id}
          currentDueDate={activity.dueDate}
          onDone={onRescheduled}
        />
      </div>
    </div>
  )
}

// ── Group header ──────────────────────────────────────────────────────────────

interface GroupHeaderProps {
  label: string
  count: number
  variant: "overdue" | "today" | "upcoming"
}

function GroupHeader({ label, count, variant }: GroupHeaderProps) {
  const colors = {
    overdue: "text-danger-600 border-danger-200 bg-danger-50",
    today: "text-warning-700 border-warning-200 bg-warning-50",
    upcoming: "text-success-700 border-success-200 bg-success-50",
  }

  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-semibold uppercase tracking-wide", colors[variant])}>
      {label}
      <span className="inline-flex items-center justify-center rounded-full h-4 w-4 text-[10px] bg-white bg-opacity-60 font-bold">
        {count}
      </span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface ActivitiesViewProps {
  activities: SerializedPageActivity[]
  /** Logged-in user DB id — reserved for future "assign to me" shortcut */
  currentUserId: string
  /** All assignee options — reserved for future inline create form */
  assigneeOptions: Array<{ id: string; name: string }>
  canViewAllTeam: boolean
  showAllTeam: boolean
}

export function ActivitiesView({
  activities: initialActivities,
  currentUserId: _currentUserId,
  assigneeOptions: _assigneeOptions,
  canViewAllTeam,
  showAllTeam,
}: ActivitiesViewProps) {
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

  // Group by due status
  const overdue = activities.filter((a) => getActivityStatus(a.dueDate) === "overdue")
  const today = activities.filter((a) => getActivityStatus(a.dueDate) === "today")
  const upcoming = activities.filter((a) => getActivityStatus(a.dueDate) === "upcoming")

  const isEmpty = activities.length === 0

  return (
    <div className="max-w-4xl">
      {/* Team toggle */}
      {canViewAllTeam && (
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams()
              if (!showAllTeam) params.set("team", "1")
              router.replace(`/activities?${params.toString()}`)
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border transition-colors",
              showAllTeam
                ? "bg-accent-600 text-white border-accent-600"
                : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50"
            )}
          >
            {showAllTeam ? "Semua Tim" : "Hanya Saya"}
          </button>
          {showAllTeam && (
            <p className="text-xs text-neutral-500">Menampilkan activities semua anggota tim</p>
          )}
        </div>
      )}

      {/* Empty state */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-12 w-12 rounded-full bg-success-50 flex items-center justify-center mb-4">
            <Check className="h-6 w-6 text-success-500" />
          </div>
          <p className="text-base font-medium text-neutral-700 mb-1">
            Pipeline bersih
          </p>
          <p className="text-sm text-neutral-400">
            Tidak ada activity open{showAllTeam ? " untuk seluruh tim" : ""}.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue */}
          {overdue.length > 0 && (
            <section>
              <div className="mb-3">
                <GroupHeader label="Terlambat" count={overdue.length} variant="overdue" />
              </div>
              <div className="space-y-2">
                {overdue.map((a) => (
                  <ActivityRow
                    key={a.id}
                    activity={a}
                    onMarkDone={handleMarkDone}
                    onRescheduled={handleRescheduled}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Today */}
          {today.length > 0 && (
            <section>
              <div className="mb-3">
                <GroupHeader label="Hari Ini" count={today.length} variant="today" />
              </div>
              <div className="space-y-2">
                {today.map((a) => (
                  <ActivityRow
                    key={a.id}
                    activity={a}
                    onMarkDone={handleMarkDone}
                    onRescheduled={handleRescheduled}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <section>
              <div className="mb-3">
                <GroupHeader label="Mendatang" count={upcoming.length} variant="upcoming" />
              </div>
              <div className="space-y-2">
                {upcoming.map((a) => (
                  <ActivityRow
                    key={a.id}
                    activity={a}
                    onMarkDone={handleMarkDone}
                    onRescheduled={handleRescheduled}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

