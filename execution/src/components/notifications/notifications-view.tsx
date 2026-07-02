"use client"

// Justification for "use client":
// - Toggle filter state (unread only)
// - Router.replace() to update URL params
// - Mark-read mutations + read-all
// - Optimistic updates after mutations

import * as React from "react"
import { useRouter } from "next/navigation"
import { Bell, AtSign, UserPlus, BellOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/utils"
import type { AppNotification } from "@/types/notification"

// ── Helpers ────────────────────────────────────────────────────────────────────

function notificationIcon(type: AppNotification["type"]) {
  if (type === "mention") {
    return <AtSign className="h-4 w-4 flex-shrink-0 text-accent-600" />
  }
  if (type === "lead_assigned") {
    return <UserPlus className="h-4 w-4 flex-shrink-0 text-success-700" />
  }
  return <Bell className="h-4 w-4 flex-shrink-0 text-neutral-400" />
}

function entityPath(
  entityType: string | null,
  entityId: string | null
): string | null {
  if (!entityId) return null
  if (entityType === "lead") return `/pipeline/${entityId}`
  if (entityType === "client") return `/clients/${entityId}`
  return null
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface NotificationsViewProps {
  initialNotifications: AppNotification[]
  total: number
  totalPages: number
  currentPage: number
  unreadCount: number
  initialUnreadOnly: boolean
  pageSize: number
}

// ── Component ──────────────────────────────────────────────────────────────────

export function NotificationsView({
  initialNotifications,
  total,
  totalPages,
  currentPage,
  unreadCount: initialUnreadCount,
  initialUnreadOnly,
  pageSize,
}: NotificationsViewProps) {
  const router = useRouter()
  const [notifications, setNotifications] =
    React.useState<AppNotification[]>(initialNotifications)
  const [unreadOnly, setUnreadOnly] = React.useState(initialUnreadOnly)
  const [unreadCount, setUnreadCount] = React.useState(initialUnreadCount)
  const [markingAll, setMarkingAll] = React.useState(false)

  // Sync when server rerenders (page navigation)
  React.useEffect(() => {
    setNotifications(initialNotifications)
    setUnreadCount(initialUnreadCount)
    setUnreadOnly(initialUnreadOnly)
  }, [initialNotifications, initialUnreadCount, initialUnreadOnly])

  // ── Filter toggle ────────────────────────────────────────────────────────────

  function handleToggleUnread(value: boolean) {
    setUnreadOnly(value)
    const params = new URLSearchParams()
    if (value) params.set("unread", "1")
    params.set("page", "1")
    router.replace(`/notifications?${params.toString()}`)
  }

  // ── Pagination ───────────────────────────────────────────────────────────────

  function goToPage(p: number) {
    const params = new URLSearchParams()
    if (unreadOnly) params.set("unread", "1")
    params.set("page", String(p))
    router.replace(`/notifications?${params.toString()}`)
  }

  // ── Mark single read ─────────────────────────────────────────────────────────

  async function handleItemClick(notification: AppNotification) {
    if (!notification.readAt) {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id
            ? { ...n, readAt: new Date().toISOString() }
            : n
        )
      )
      setUnreadCount((c) => Math.max(0, c - 1))

      try {
        await fetch(`/api/notifications/${notification.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "read" }),
        })
      } catch {
        // Silently fail — optimistic state is fine
      }
    }

    const path = entityPath(notification.entityType, notification.entityId)
    if (path) {
      router.push(path)
    }
  }

  // ── Read all ─────────────────────────────────────────────────────────────────

  async function handleReadAll() {
    setMarkingAll(true)
    try {
      const res = await fetch("/api/notifications/read-all", { method: "POST" })
      if (!res.ok) return
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))
      )
      setUnreadCount(0)
    } catch {
      /* Silently fail */
    } finally {
      setMarkingAll(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const startItem = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, total)

  return (
    <div className="mx-auto max-w-2xl">
      {/* Controls row */}
      <div className="mb-4 flex items-center justify-between gap-4">
        {/* Unread filter toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleToggleUnread(false)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              !unreadOnly
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-100"
            )}
          >
            Semua
          </button>
          <button
            onClick={() => handleToggleUnread(true)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              unreadOnly
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-100"
            )}
          >
            Belum dibaca
            {unreadCount > 0 && (
              <span
                className={cn(
                  "flex h-4 min-w-[1rem] items-center justify-center rounded-full px-0.5 text-[10px] font-bold leading-none",
                  unreadOnly
                    ? "bg-white text-neutral-900"
                    : "bg-danger-500 text-white"
                )}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Read all */}
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            disabled={markingAll}
            onClick={handleReadAll}
            className="text-accent-600 hover:text-accent-700"
          >
            {markingAll ? "Memproses..." : "Tandai semua dibaca"}
          </Button>
        )}
      </div>

      {/* Notification list */}
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-card">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <BellOff className="h-10 w-10 text-neutral-300" />
            <p className="text-sm font-medium text-neutral-500">
              {unreadOnly
                ? "Semua notifikasi sudah dibaca."
                : "Belum ada notifikasi."}
            </p>
            {unreadOnly && (
              <button
                onClick={() => handleToggleUnread(false)}
                className="text-xs text-accent-600 hover:underline"
              >
                Lihat semua notifikasi
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {notifications.map((n) => {
              const isUnread = !n.readAt
              const hasEntity =
                entityPath(n.entityType, n.entityId) !== null

              return (
                <li key={n.id}>
                  <button
                    onClick={() => handleItemClick(n)}
                    disabled={!hasEntity && !!n.readAt}
                    className={cn(
                      "flex w-full items-start gap-3 px-5 py-4 text-left transition-colors",
                      isUnread && "bg-accent-50",
                      (hasEntity || isUnread) && "hover:bg-neutral-50 cursor-pointer",
                      !hasEntity && !!n.readAt && "cursor-default"
                    )}
                  >
                    {/* Icon */}
                    <span className="mt-0.5">{notificationIcon(n.type)}</span>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm",
                          isUnread
                            ? "font-semibold text-neutral-800"
                            : "font-medium text-neutral-600"
                        )}
                      >
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-neutral-400">
                        {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>

                    {/* Unread indicator */}
                    {isUnread && (
                      <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-accent-600" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-neutral-500">
          <span>
            {startItem}–{endItem} dari {total} notifikasi
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              Sebelumnya
            </Button>
            <span className="text-xs">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => goToPage(currentPage + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
