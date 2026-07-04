"use client"

/**
 * RecordTimeline — Odoo-style chatter for lead/client detail pages.
 *
 * Merges 4 event streams into one chronological feed (desc):
 *   1. Comments  (fetch GET /api/comments)
 *   2. Field history (prop — already serialized by server)
 *   3. Stage history (prop — lead only, already serialized by server)
 *   4. Done activities (fetch GET /api/activities?status=done)
 *
 * Composer: textarea + mention picker (@-trigger opens Command popover)
 * Followers: follow/unfollow + avatar strip (max 5 + "+N" overflow)
 * Optimistic insert for new comments; error toast + rollback on failure.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  MessageSquare,
  History,
  ArrowRightLeft,
  CheckCircle2,
  Pencil,
  Trash2,
  UserPlus,
  UserMinus,
  Loader2,
  AtSign,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn, getInitials } from "@/lib/utils"
import type { PipelineStage } from "@/types"

// ── Types ─────────────────────────────────────────────────────────────────────

interface SerializedComment {
  id: string
  body: string
  mentions: string[]
  leadId: string | null
  clientId: string | null
  authorId: string
  author: { id: string; name: string }
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
}

interface SerializedActivity {
  id: string
  type: string
  subject: string
  doneAt: string | null
  assignee: { id: string; name: string }
}

interface FieldHistoryEntry {
  id: string
  field: string
  oldValue: string | null
  newValue: string | null
  changedAt: string
  changer?: { id: string; name: string }
}

interface StageHistoryEntry {
  id: string
  fromStage: PipelineStage
  toStage: PipelineStage
  changedAt: string
  changer?: { id: string; name: string }
}

interface Follower {
  id: string
  userId: string
  user: { id: string; name: string }
}

interface UserOption {
  id: string
  name: string
}

export interface RecordTimelineProps {
  /** Pass exactly one of leadId or clientId */
  leadId?: string
  clientId?: string
  /** Current logged-in user */
  currentUserId: string
  /** Pre-serialized from server — no network fetch needed */
  fieldHistory: FieldHistoryEntry[]
  stageHistory?: StageHistoryEntry[]
}

// ── Timeline event union ───────────────────────────────────────────────────────

type TimelineEvent =
  | { kind: "comment"; ts: string; data: SerializedComment }
  | { kind: "field"; ts: string; data: FieldHistoryEntry }
  | { kind: "stage"; ts: string; data: StageHistoryEntry }
  | { kind: "activity"; ts: string; data: SerializedActivity }

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDt(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

const FIELD_LABELS: Record<string, string> = {
  projectedRevenue: "Projected Revenue",
  projectType: "Project Type",
  billingPlan: "Billing Plan",
  healthStatus: "Health Status",
  clientStatus: "Client Status",
  officeAddress: "Office Address",
  engagementType: "Engagement Type",
  industry: "Industry",
  orgSize: "Org Size",
  primaryAe: "AE",
}

const STAGE_LABELS: Record<PipelineStage, string> = {
  leads: "Leads",
  pipeline: "Pipeline",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  lost_deal: "Lost Deal",
  invoiced: "Invoiced",
  contract_renewal: "Contract Renewal",
  no_response: "No Response",
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  todo: "To-do",
  deadline: "Deadline",
}

// ── Mention renderer ──────────────────────────────────────────────────────────
// Renders @[Name](userId) tokens as bold inline badges in comment body.

const MENTION_RE = /@\[([^\]]+)\]\([^)]+\)/g

function renderBody(body: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  const re = new RegExp(MENTION_RE.source, "g")
  while ((match = re.exec(body)) !== null) {
    if (match.index > last) {
      parts.push(body.slice(last, match.index))
    }
    parts.push(
      <span
        key={match.index}
        className="inline-flex items-center rounded-sm px-1 py-0.5 text-xs font-semibold bg-accent-100 text-accent-700"
      >
        @{match[1]}
      </span>
    )
    last = match.index + match[0].length
  }
  if (last < body.length) parts.push(body.slice(last))
  return <>{parts}</>
}

// ── FollowerStrip ─────────────────────────────────────────────────────────────

interface FollowerStripProps {
  followers: Follower[]
  currentUserId: string
  leadId?: string
  clientId?: string
  onToggle: () => void
}

function FollowerStrip({ followers, currentUserId, leadId, clientId, onToggle }: FollowerStripProps) {
  const [loading, setLoading] = useState(false)
  const isFollowing = followers.some((f) => f.userId === currentUserId)
  const visible = followers.slice(0, 5)
  const overflow = followers.length - 5

  async function handleToggle() {
    setLoading(true)
    try {
      const body = leadId ? { leadId } : { clientId }
      const method = isFollowing ? "DELETE" : "POST"
      const res = await fetch("/api/followers", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Failed")
      onToggle()
    } catch {
      toast.error("Gagal mengubah status follow")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Avatar strip */}
      {followers.length > 0 && (
        <div className="flex -space-x-1.5">
          {visible.map((f) => (
            <div
              key={f.id}
              title={f.user.name}
              className="h-6 w-6 rounded-full bg-accent-100 border-2 border-card flex items-center justify-center flex-shrink-0"
            >
              <span className="text-[9px] font-semibold text-accent-700 leading-none">
                {getInitials(f.user.name)}
              </span>
            </div>
          ))}
          {overflow > 0 && (
            <div className="h-6 w-6 rounded-full bg-neutral-200 border-2 border-card flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-semibold text-neutral-600 leading-none">+{overflow}</span>
            </div>
          )}
        </div>
      )}
      {followers.length === 0 && (
        <span className="text-xs text-neutral-400">Belum ada follower</span>
      )}
      {/* Follow/unfollow button */}
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1.5 text-xs"
        onClick={() => void handleToggle()}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : isFollowing ? (
          <UserMinus className="h-3 w-3" />
        ) : (
          <UserPlus className="h-3 w-3" />
        )}
        {isFollowing ? "Unfollow" : "Follow"}
      </Button>
    </div>
  )
}

// ── MentionComposer ───────────────────────────────────────────────────────────
// Textarea with @-trigger popover for mention picker.
// Inserts @[Name](userId) tokens at cursor.

interface MentionComposerProps {
  users: UserOption[]
  leadId?: string
  clientId?: string
  onPosted: (comment: SerializedComment) => void
}

function MentionComposer({ users, leadId, clientId, onPosted }: MentionComposerProps) {
  const [body, setBody] = useState("")
  const [posting, setPosting] = useState(false)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionAnchor, setMentionAnchor] = useState(0) // cursor position when @ was typed
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    const cursor = e.target.selectionStart
    setBody(val)

    // Detect @ trigger: @ preceded by space or start-of-string
    const before = val.slice(0, cursor)
    const lastAt = before.lastIndexOf("@")
    if (lastAt !== -1 && (lastAt === 0 || /\s/.test(before[lastAt - 1]))) {
      setMentionAnchor(lastAt)
      setMentionOpen(true)
    } else {
      setMentionOpen(false)
    }
  }

  function insertMention(user: UserOption) {
    if (!textareaRef.current) return
    const cursor = textareaRef.current.selectionStart
    const before = body.slice(0, mentionAnchor)
    const after = body.slice(cursor)
    const token = `@[${user.name}](${user.id}) `
    const next = before + token + after
    setBody(next)
    setMentionOpen(false)
    // Restore focus + position
    setTimeout(() => {
      if (textareaRef.current) {
        const pos = before.length + token.length
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  async function handlePost() {
    const trimmed = body.trim()
    if (!trimmed) return
    setPosting(true)
    // Optimistic: generate temp comment
    const tempId = `temp-${Date.now()}`
    const optimistic: SerializedComment = {
      id: tempId,
      body: trimmed,
      mentions: [],
      leadId: leadId ?? null,
      clientId: clientId ?? null,
      authorId: "__optimistic__",
      author: { id: "__optimistic__", name: "You" },
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
    }
    onPosted(optimistic)
    setBody("")
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: trimmed,
          ...(leadId ? { leadId } : {}),
          ...(clientId ? { clientId } : {}),
        }),
      })
      if (!res.ok) {
        const d = (await res.json()) as { error?: string }
        throw new Error(d.error ?? "Gagal posting")
      }
      const data = (await res.json()) as { comment: SerializedComment }
      // Replace optimistic with real
      onPosted({ ...data.comment, id: tempId }) // signal caller to swap
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal posting comment")
      // Rollback: caller removes optimistic entry by id
      onPosted({ ...optimistic, deletedAt: "__rollback__" })
    } finally {
      setPosting(false)
    }
  }

  // Current mention search term
  const mentionSearch = mentionOpen
    ? body.slice(mentionAnchor + 1, textareaRef.current?.selectionStart ?? body.length)
    : ""

  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={handleBodyChange}
          onKeyDown={(e) => {
            if (e.key === "Escape") setMentionOpen(false)
          }}
          placeholder="Log note... Ketik @ untuk mention"
          rows={3}
          className="resize-none pr-8 text-sm"
        />
        {/* @ button hint */}
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-600"
          onClick={() => {
            if (!textareaRef.current) return
            const pos = textareaRef.current.selectionStart
            const before = body.slice(0, pos)
            const after = body.slice(pos)
            const next = before + "@" + after
            setBody(next)
            setMentionAnchor(pos)
            setMentionOpen(true)
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.focus()
                textareaRef.current.setSelectionRange(pos + 1, pos + 1)
              }
            }, 0)
          }}
        >
          <AtSign className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Mention popover — positioned below textarea */}
      {mentionOpen && (
        <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
          <PopoverTrigger asChild>
            <span className="sr-only">mention anchor</span>
          </PopoverTrigger>
          <PopoverContent
            className="p-0 w-56"
            side="bottom"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command>
              <CommandInput
                placeholder="Cari nama..."
                value={mentionSearch}
                onValueChange={() => {/* controlled by body state */}}
                autoFocus={false}
              />
              <CommandList>
                <CommandEmpty>Tidak ditemukan</CommandEmpty>
                <CommandGroup>
                  {users
                    .filter((u) =>
                      u.name.toLowerCase().includes(mentionSearch.toLowerCase())
                    )
                    .map((u) => (
                      <CommandItem
                        key={u.id}
                        value={u.name}
                        onSelect={() => insertMention(u)}
                      >
                        <div className="h-5 w-5 rounded-full bg-accent-100 flex items-center justify-center mr-2 flex-shrink-0">
                          <span className="text-[8px] font-semibold text-accent-700">
                            {getInitials(u.name)}
                          </span>
                        </div>
                        {u.name}
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => void handlePost()}
          disabled={posting || !body.trim()}
          className="h-8 gap-1.5 text-xs"
        >
          {posting ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
          Log Note
        </Button>
      </div>
    </div>
  )
}

// ── CommentItem ───────────────────────────────────────────────────────────────

interface CommentItemProps {
  comment: SerializedComment
  currentUserId: string
  onEdited: (updated: SerializedComment) => void
  onDeleted: (id: string) => void
}

function CommentItem({ comment, currentUserId, onEdited, onDeleted }: CommentItemProps) {
  const isAuthor = comment.authorId === currentUserId
  const isOptimistic = comment.authorId === "__optimistic__"
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(comment.body)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    const trimmed = editBody.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      })
      if (!res.ok) {
        const d = (await res.json()) as { error?: string }
        throw new Error(d.error ?? "Gagal menyimpan")
      }
      const data = (await res.json()) as { comment: SerializedComment }
      onEdited(data.comment)
      setEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/comments/${comment.id}`, { method: "DELETE" })
      if (!res.ok) {
        const d = (await res.json()) as { error?: string }
        throw new Error(d.error ?? "Gagal menghapus")
      }
      onDeleted(comment.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus")
      setDeleting(false)
    }
  }

  return (
    <div
      className={cn(
        "flex gap-3 group",
        isOptimistic && "opacity-60"
      )}
    >
      {/* Author avatar */}
      <div className="h-7 w-7 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-[10px] font-semibold text-accent-700 leading-none">
          {getInitials(comment.author.name)}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        {/* Author + timestamp */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xs font-semibold text-neutral-800">{comment.author.name}</span>
          <span className="text-xs text-neutral-400">{fmtDt(comment.createdAt)}</span>
          {comment.editedAt && (
            <span className="text-xs text-neutral-400 italic">(diedit)</span>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={2}
              className="resize-none text-sm"
              autoFocus
            />
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => { setEditing(false); setEditBody(comment.body) }}
                disabled={saving}
              >
                Batal
              </Button>
              <Button
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => void handleSave()}
                disabled={saving || !editBody.trim()}
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Simpan"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-accent-50 border border-accent-100 px-3 py-2 text-sm text-neutral-800 whitespace-pre-wrap break-words relative">
            {renderBody(comment.body)}

            {/* Action buttons — show on hover for author, only if not optimistic */}
            {isAuthor && !isOptimistic && (
              <div className="absolute right-2 top-2 hidden group-hover:flex gap-1">
                <button
                  onClick={() => setEditing(true)}
                  className="rounded p-0.5 text-neutral-400 hover:text-neutral-600 hover:bg-card/80 transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  className="rounded p-0.5 text-neutral-400 hover:text-danger-600 hover:bg-card/80 transition-colors"
                  title="Hapus"
                >
                  {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── TimelineEntry — field / stage / activity rows ─────────────────────────────

interface FieldRowProps { entry: FieldHistoryEntry }
function FieldRow({ entry }: FieldRowProps) {
  const label = FIELD_LABELS[entry.field] ?? entry.field.replace(/([A-Z])/g, " $1")
  return (
    <div className="flex gap-3 items-start">
      <div className="h-5 w-5 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <History className="h-3 w-3 text-neutral-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-neutral-400 mb-0.5">{fmtDt(entry.changedAt)}</p>
        <p className="text-sm text-neutral-700">
          <span className="font-semibold text-neutral-500 uppercase tracking-wide text-xs">{label}</span>
          {" "}
          <span className="text-neutral-400">{entry.oldValue ?? "—"}</span>
          {" "}
          <span className="text-neutral-400">→</span>
          {" "}
          <span className="font-medium text-neutral-800">{entry.newValue ?? "—"}</span>
        </p>
        {entry.changer && (
          <p className="text-xs text-neutral-400 mt-0.5">oleh {entry.changer.name}</p>
        )}
      </div>
    </div>
  )
}

interface StageRowProps { entry: StageHistoryEntry }
function StageRow({ entry }: StageRowProps) {
  return (
    <div className="flex gap-3 items-start">
      <div className="h-5 w-5 rounded-full bg-info-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <ArrowRightLeft className="h-3 w-3 text-info-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-neutral-400 mb-0.5">{fmtDt(entry.changedAt)}</p>
        <p className="text-sm text-neutral-700">
          <span className="font-medium text-neutral-500">{STAGE_LABELS[entry.fromStage]}</span>
          {" "}
          <span className="text-neutral-400">→</span>
          {" "}
          <span className="font-semibold text-neutral-800">{STAGE_LABELS[entry.toStage]}</span>
        </p>
        {entry.changer && (
          <p className="text-xs text-neutral-400 mt-0.5">oleh {entry.changer.name}</p>
        )}
      </div>
    </div>
  )
}

interface ActivityRowProps { activity: SerializedActivity }
function ActivityRow({ activity }: ActivityRowProps) {
  const typeLabel = ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type
  const doneAt = activity.doneAt ? fmtDt(activity.doneAt) : null
  return (
    <div className="flex gap-3 items-start">
      <div className="h-5 w-5 rounded-full bg-success-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <CheckCircle2 className="h-3 w-3 text-success-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-neutral-400 mb-0.5">{doneAt ?? "—"}</p>
        <p className="text-sm text-neutral-700">
          <span className="font-semibold text-neutral-500 uppercase tracking-wide text-xs">{typeLabel}</span>
          {" — "}
          <span className="text-neutral-800">{activity.subject}</span>
        </p>
        <p className="text-xs text-neutral-400 mt-0.5">
          diselesaikan oleh {activity.assignee.name}
        </p>
      </div>
    </div>
  )
}

// ── RecordTimeline (main export) ──────────────────────────────────────────────

export function RecordTimeline({
  leadId,
  clientId,
  currentUserId,
  fieldHistory,
  stageHistory,
}: RecordTimelineProps) {
  const router = useRouter()
  const [comments, setComments] = useState<SerializedComment[]>([])
  const [activities, setActivities] = useState<SerializedActivity[]>([])
  const [followers, setFollowers] = useState<Follower[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)

  const recordParam = leadId ? `leadId=${leadId}` : `clientId=${clientId}`

  // Fetch all dynamic data on mount
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [commentsRes, activitiesRes, followersRes, usersRes] = await Promise.all([
          fetch(`/api/comments?${recordParam}`),
          fetch(`/api/activities?${recordParam}&status=done`),
          fetch(`/api/followers?${recordParam}`),
          fetch("/api/users"),
        ])

        if (commentsRes.ok) {
          const d = (await commentsRes.json()) as { comments: SerializedComment[] }
          setComments(d.comments)
        }
        if (activitiesRes.ok) {
          const d = (await activitiesRes.json()) as { activities: SerializedActivity[] }
          setActivities(d.activities)
        }
        if (followersRes.ok) {
          const d = (await followersRes.json()) as { followers: Follower[] }
          setFollowers(d.followers)
        }
        if (usersRes.ok) {
          const d = (await usersRes.json()) as { users: UserOption[] }
          setUsers(d.users)
        }
      } catch {
        // silent — timeline degrades gracefully
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [recordParam])

  // Refresh followers after toggle
  const refreshFollowers = useCallback(async () => {
    try {
      const res = await fetch(`/api/followers?${recordParam}`)
      if (res.ok) {
        const d = (await res.json()) as { followers: Follower[] }
        setFollowers(d.followers)
      }
    } catch {
      // silent
    }
    router.refresh()
  }, [recordParam, router])

  // Handle optimistic comment post / edit / rollback
  function handlePosted(comment: SerializedComment) {
    if (comment.deletedAt === "__rollback__") {
      // Remove the optimistic entry
      setComments((prev) => prev.filter((c) => c.id !== comment.id))
      return
    }
    setComments((prev) => {
      const idx = prev.findIndex((c) => c.id === comment.id)
      if (idx !== -1) {
        // Swap optimistic with real, or update existing
        const next = [...prev]
        next[idx] = comment
        return next
      }
      // New comment: prepend
      return [comment, ...prev]
    })
  }

  function handleEdited(updated: SerializedComment) {
    setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  function handleDeleted(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id))
  }

  // Build unified event stream
  const events: TimelineEvent[] = [
    ...comments.map((c): TimelineEvent => ({ kind: "comment", ts: c.createdAt, data: c })),
    ...fieldHistory.map((f): TimelineEvent => ({ kind: "field", ts: f.changedAt, data: f })),
    ...(stageHistory ?? []).map((s): TimelineEvent => ({ kind: "stage", ts: s.changedAt, data: s })),
    ...activities.map((a): TimelineEvent => ({ kind: "activity", ts: a.doneAt ?? "", data: a })),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())

  return (
    <div className="rounded-lg border border-neutral-200 bg-card p-6 shadow-card">
      {/* Header — title + followers */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <h2 className="font-semibold text-neutral-800">Timeline &amp; Chatter</h2>
        <FollowerStrip
          followers={followers}
          currentUserId={currentUserId}
          leadId={leadId}
          clientId={clientId}
          onToggle={() => void refreshFollowers()}
        />
      </div>

      {/* Composer */}
      <MentionComposer
        users={users}
        leadId={leadId}
        clientId={clientId}
        onPosted={handlePosted}
      />

      {/* Divider */}
      <div className="h-px bg-neutral-100 my-5" />

      {/* Timeline feed */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-neutral-400 py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat timeline...
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm text-neutral-400 py-4">
          Belum ada aktivitas untuk record ini.
        </p>
      ) : (
        <ol className="space-y-5">
          {events.map((ev, i) => (
            <li key={`${ev.kind}-${i}`}>
              {ev.kind === "comment" && (
                <CommentItem
                  comment={ev.data as SerializedComment}
                  currentUserId={currentUserId}
                  onEdited={handleEdited}
                  onDeleted={handleDeleted}
                />
              )}
              {ev.kind === "field" && <FieldRow entry={ev.data as FieldHistoryEntry} />}
              {ev.kind === "stage" && <StageRow entry={ev.data as StageHistoryEntry} />}
              {ev.kind === "activity" && <ActivityRow activity={ev.data as SerializedActivity} />}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
