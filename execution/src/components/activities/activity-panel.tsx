"use client"

/**
 * ActivityPanel — "Planned Activities" panel for record detail pages.
 *
 * Displays open activities for a given leadId or clientId.
 * Each row: type icon, subject, due date (colored), assignee
 * Row actions: Done (mark completed), Reschedule (date picker popover), Cancel
 * Top action: "+ Activity" opens a sheet to create a new activity
 * After marking Done: dialog "Schedule next activity?" with same form
 *
 * Data flow:
 *   - Mount: fetch GET /api/activities?leadId=X&status=open (or clientId=Y)
 *   - Mutations: PATCH /api/activities/[id] (action mode) or POST /api/activities
 *   - After mutation: router.refresh() + local state update for optimistic feel
 */

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Phone,
  Mail,
  Users,
  CheckSquare,
  CalendarDays,
  Check,
  X,
  Plus,
  CalendarIcon,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  getActivityStatus,
  ACTIVITY_STATUS_CLASSES,
  formatActivityDate,
} from "@/components/activities/activity-status"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActivityType = "call" | "email" | "meeting" | "todo" | "deadline"

export interface SerializedActivity {
  id: string
  type: ActivityType
  subject: string
  note: string | null
  dueDate: string // YYYY-MM-DD
  status: "open" | "done" | "canceled"
  doneAt: string | null
  leadId: string | null
  clientId: string | null
  assignedTo: string
  createdBy: string
  createdAt: string
  updatedAt: string
  lead: { id: string; client: { name: string } } | null
  client: { id: string; name: string } | null
  assignee: { id: string; name: string }
}

interface ActivityPanelProps {
  /** Pass one of these depending on context */
  leadId?: string
  clientId?: string
  /** The logged-in user's DB id — defaults assignee in form */
  currentUserId: string
  /** All users available as assignee options */
  assigneeOptions: Array<{ id: string; name: string }>
}

// ── Icon map ──────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<ActivityType, React.ReactNode> = {
  call: <Phone className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  meeting: <Users className="h-3.5 w-3.5" />,
  todo: <CheckSquare className="h-3.5 w-3.5" />,
  deadline: <CalendarDays className="h-3.5 w-3.5" />,
}

const TYPE_LABELS: Record<ActivityType, string> = {
  call: "Telepon",
  email: "Email",
  meeting: "Meeting",
  todo: "To-Do",
  deadline: "Deadline",
}

// ── Activity Form (reused in Sheet + post-done dialog) ────────────────────────

interface ActivityFormState {
  type: ActivityType
  subject: string
  dueDate: Date | undefined
  assignedTo: string
  note: string
}

function emptyForm(currentUserId: string): ActivityFormState {
  return {
    type: "call",
    subject: "",
    dueDate: undefined,
    assignedTo: currentUserId,
    note: "",
  }
}

interface ActivityFormProps {
  form: ActivityFormState
  onChange: (next: Partial<ActivityFormState>) => void
  assigneeOptions: Array<{ id: string; name: string }>
}

function ActivityForm({ form, onChange, assigneeOptions }: ActivityFormProps) {
  return (
    <div className="space-y-4">
      {/* Type */}
      <div>
        <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
          Tipe <span className="text-danger-500">*</span>
        </label>
        <Select
          value={form.type}
          onValueChange={(v) => onChange({ type: v as ActivityType })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pilih tipe..." />
          </SelectTrigger>
          <SelectContent>
            {(["call", "email", "meeting", "todo", "deadline"] as ActivityType[]).map((t) => (
              <SelectItem key={t} value={t}>
                <span className="flex items-center gap-2">
                  {TYPE_ICONS[t]}
                  {TYPE_LABELS[t]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Subject */}
      <div>
        <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
          Subjek <span className="text-danger-500">*</span>
        </label>
        <input
          type="text"
          value={form.subject}
          onChange={(e) => onChange({ subject: e.target.value })}
          placeholder="e.g. Follow-up proposal Q3"
          maxLength={200}
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 placeholder:text-neutral-400"
        />
      </div>

      {/* Due date */}
      <div>
        <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
          Due Date <span className="text-danger-500">*</span>
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "w-full flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500 text-left",
                !form.dueDate && "text-neutral-400"
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
              {form.dueDate ? format(form.dueDate, "d MMM yyyy") : "Pilih tanggal..."}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={form.dueDate}
              onSelect={(d) => onChange({ dueDate: d })}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Assignee */}
      <div>
        <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
          Ditugaskan ke <span className="text-danger-500">*</span>
        </label>
        <Select
          value={form.assignedTo}
          onValueChange={(v) => onChange({ assignedTo: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pilih assignee..." />
          </SelectTrigger>
          <SelectContent>
            {assigneeOptions.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Note */}
      <div>
        <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1.5">
          Catatan <span className="text-neutral-400 font-normal">(opsional)</span>
        </label>
        <Textarea
          value={form.note}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="Detail tambahan..."
          rows={2}
          className="resize-none text-sm"
        />
      </div>
    </div>
  )
}

// ── Reschedule popover ─────────────────────────────────────────────────────────

interface ReschedulePopoverProps {
  activityId: string
  currentDueDate: string
  onRescheduled: () => void
}

function ReschedulePopover({ activityId, currentDueDate, onRescheduled }: ReschedulePopoverProps) {
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
      onRescheduled()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="rounded p-1 text-neutral-400 hover:text-accent-600 hover:bg-accent-50 transition-colors"
                aria-label="Reschedule"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Reschedule
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
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

// ── Main panel ─────────────────────────────────────────────────────────────────

export function ActivityPanel({
  leadId,
  clientId,
  currentUserId,
  assigneeOptions,
}: ActivityPanelProps) {
  const router = useRouter()
  const [activities, setActivities] = useState<SerializedActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [form, setForm] = useState<ActivityFormState>(() => emptyForm(currentUserId))
  const [submitting, setSubmitting] = useState(false)

  // Post-done: "schedule next" dialog
  const [nextDialogOpen, setNextDialogOpen] = useState(false)
  const [nextForm, setNextForm] = useState<ActivityFormState>(() => emptyForm(currentUserId))
  const [nextSubmitting, setNextSubmitting] = useState(false)

  // ── Fetch activities ────────────────────────────────────────────────────────

  const fetchActivities = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: "open" })
      if (leadId) params.set("leadId", leadId)
      if (clientId) params.set("clientId", clientId)
      const res = await fetch(`/api/activities?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch activities")
      const data = (await res.json()) as { activities: SerializedActivity[] }
      setActivities(data.activities)
    } catch {
      toast.error("Gagal memuat activities")
    } finally {
      setLoading(false)
    }
  }, [leadId, clientId])

  useEffect(() => {
    void fetchActivities()
  }, [fetchActivities])

  // ── Mark done ───────────────────────────────────────────────────────────────

  async function handleDone(activityId: string) {
    try {
      const res = await fetch(`/api/activities/${activityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "done" }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Gagal menyelesaikan activity")
      }
      toast.success("Activity selesai")
      // Optimistic remove from list
      setActivities((prev) => prev.filter((a) => a.id !== activityId))
      router.refresh()
      // Open next-activity dialog
      setNextForm(emptyForm(currentUserId))
      setNextDialogOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan")
    }
  }

  // ── Cancel ──────────────────────────────────────────────────────────────────

  async function handleCancel(activityId: string) {
    try {
      const res = await fetch(`/api/activities/${activityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Gagal membatalkan activity")
      }
      toast.success("Activity dibatalkan")
      setActivities((prev) => prev.filter((a) => a.id !== activityId))
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan")
    }
  }

  // ── Create activity (from sheet) ─────────────────────────────────────────────

  async function handleCreate() {
    if (!form.subject.trim()) {
      toast.error("Subjek wajib diisi")
      return
    }
    if (!form.dueDate) {
      toast.error("Due date wajib diisi")
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        type: form.type,
        subject: form.subject.trim(),
        dueDate: format(form.dueDate, "yyyy-MM-dd"),
        assignedTo: form.assignedTo,
        note: form.note.trim() || null,
      }
      if (leadId) body.leadId = leadId
      if (clientId) body.clientId = clientId

      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Gagal membuat activity")
      }
      const data = (await res.json()) as { activity: SerializedActivity }
      toast.success("Activity dibuat")
      setActivities((prev) =>
        [...prev, data.activity].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      )
      setSheetOpen(false)
      setForm(emptyForm(currentUserId))
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Create next activity (from post-done dialog) ──────────────────────────────

  async function handleCreateNext() {
    if (!nextForm.subject.trim()) {
      toast.error("Subjek wajib diisi")
      return
    }
    if (!nextForm.dueDate) {
      toast.error("Due date wajib diisi")
      return
    }
    setNextSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        type: nextForm.type,
        subject: nextForm.subject.trim(),
        dueDate: format(nextForm.dueDate, "yyyy-MM-dd"),
        assignedTo: nextForm.assignedTo,
        note: nextForm.note.trim() || null,
      }
      if (leadId) body.leadId = leadId
      if (clientId) body.clientId = clientId

      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Gagal membuat activity")
      }
      const data = (await res.json()) as { activity: SerializedActivity }
      toast.success("Activity berikutnya dijadwalkan")
      setActivities((prev) =>
        [...prev, data.activity].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      )
      setNextDialogOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setNextSubmitting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-neutral-800">Planned Activities</h2>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => {
              setForm(emptyForm(currentUserId))
              setSheetOpen(true)
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Activity
          </Button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-neutral-400 py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat...
          </div>
        ) : activities.length === 0 ? (
          <p className="text-sm text-neutral-400 italic py-4">
            Tidak ada activity open. Klik &ldquo;+ Activity&rdquo; untuk menjadwalkan.
          </p>
        ) : (
          <ul className="space-y-2">
            {activities.map((activity) => {
              const status = getActivityStatus(activity.dueDate)
              const classes = ACTIVITY_STATUS_CLASSES[status]

              return (
                <li
                  key={activity.id}
                  className="flex items-start gap-3 rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2.5 group"
                >
                  {/* Type icon */}
                  <span className="mt-0.5 text-neutral-400 flex-shrink-0">
                    {TYPE_ICONS[activity.type]}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-800 truncate">
                      {activity.subject}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn("text-xs font-medium", classes.text)}>
                        {formatActivityDate(activity.dueDate)}
                      </span>
                      <span className="text-xs text-neutral-400">
                        {activity.assignee.name}
                      </span>
                    </div>
                    {activity.note && (
                      <p className="text-xs text-neutral-500 mt-0.5 truncate">
                        {activity.note}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Done */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => void handleDone(activity.id)}
                            className="rounded p-1 text-neutral-400 hover:text-success-700 hover:bg-success-50 transition-colors"
                            aria-label="Selesai"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          Tandai selesai
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Reschedule */}
                    <ReschedulePopover
                      activityId={activity.id}
                      currentDueDate={activity.dueDate}
                      onRescheduled={() => void fetchActivities()}
                    />

                    {/* Cancel */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => void handleCancel(activity.id)}
                            className="rounded p-1 text-neutral-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                            aria-label="Batalkan"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          Batalkan activity
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Create activity sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full max-w-md">
          <SheetHeader>
            <SheetTitle>Tambah Activity</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <ActivityForm
              form={form}
              onChange={(next) => setForm((prev) => ({ ...prev, ...next }))}
              assigneeOptions={assigneeOptions}
            />
            <div className="flex gap-2 justify-end mt-6">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSheetOpen(false)}
                disabled={submitting}
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={() => void handleCreate()}
                disabled={submitting}
                className="gap-1.5"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {submitting ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Schedule next activity dialog (shown after marking done) */}
      <AlertDialog open={nextDialogOpen} onOpenChange={setNextDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Jadwalkan activity berikutnya?</AlertDialogTitle>
            <AlertDialogDescription>
              Activity selesai. Ingin menjadwalkan follow-up berikutnya?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <ActivityForm
              form={nextForm}
              onChange={(next) => setNextForm((prev) => ({ ...prev, ...next }))}
              assigneeOptions={assigneeOptions}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNextDialogOpen(false)}>
              Tidak perlu
            </AlertDialogCancel>
            <Button
              size="sm"
              onClick={() => void handleCreateNext()}
              disabled={nextSubmitting}
              className="gap-1.5"
            >
              {nextSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {nextSubmitting ? "Menyimpan..." : "Jadwalkan"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
