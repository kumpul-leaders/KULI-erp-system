"use client"

// Justification for "use client":
// - Fetch on mount + polling interval (setInterval)
// - visibilitychange listener for refetch on tab focus
// - Controlled popover open/close state
// - Imperative navigation after mark-read

import * as React from "react"
import { useRouter } from "next/navigation"
import { Bell, AtSign, UserPlus } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/utils"
import type { AppNotification, NotificationsResponse } from "@/types/notification"

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

// ── Component ──────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60_000

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [unreadCount, setUnreadCount] = React.useState(0)
  const [notifications, setNotifications] = React.useState<AppNotification[]>([])
  const [loading, setLoading] = React.useState(false)

  // ── Fetch helpers ────────────────────────────────────────────────────────────

  const fetchUnreadCount = React.useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=1", { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as NotificationsResponse
      setUnreadCount(data.unreadCount)
    } catch {
      // Silently fail — badge will just not update
    }
  }, [])

  const fetchPreview = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/notifications?limit=10", { cache: "no-store" })
      if (!res.ok) return
      const data = (await res.json()) as NotificationsResponse
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Polling + visibility ─────────────────────────────────────────────────────

  React.useEffect(() => {
    // Initial fetch of unread count
    fetchUnreadCount()

    // Poll every 60s
    const interval = setInterval(fetchUnreadCount, POLL_INTERVAL_MS)

    // Refetch when tab becomes visible
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        fetchUnreadCount()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [fetchUnreadCount])

  // Fetch preview list when popover opens
  React.useEffect(() => {
    if (open) {
      fetchPreview()
    }
  }, [open, fetchPreview])

  // ── Mark read + navigate ─────────────────────────────────────────────────────

  async function handleItemClick(notification: AppNotification) {
    setOpen(false)

    // Mark read (fire-and-forget — don't block navigation)
    if (!notification.readAt) {
      fetch(`/api/notifications/${notification.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read" }),
      })
        .then(() => {
          setUnreadCount((c) => Math.max(0, c - 1))
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === notification.id
                ? { ...n, readAt: new Date().toISOString() }
                : n
            )
          )
        })
        .catch(() => {
          /* Silently fail */
        })
    }

    const path = entityPath(notification.entityType, notification.entityId)
    if (path) {
      router.push(path)
    }
  }

  async function handleMarkAllRead() {
    try {
      const res = await fetch("/api/notifications/read-all", { method: "POST" })
      if (!res.ok) return
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
    } catch {
      /* Silently fail */
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-neutral-500 hover:text-neutral-800"
          aria-label="Notifikasi"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger-500 px-0.5 text-[10px] font-bold text-white leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 shadow-dropdown"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <span className="text-sm font-semibold text-neutral-800">
            Notifikasi
          </span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-accent-600 hover:text-accent-700 hover:underline"
            >
              Tandai semua dibaca
            </button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="max-h-[360px]">
          {loading && notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-neutral-400">
              Memuat...
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-neutral-400">
              Belum ada notifikasi.
            </div>
          ) : (
            <ul>
              {notifications.map((n) => {
                const isUnread = !n.readAt
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => handleItemClick(n)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50",
                        isUnread && "bg-accent-50"
                      )}
                    >
                      {/* Type icon */}
                      <span className="mt-0.5">{notificationIcon(n.type)}</span>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-sm",
                            isUnread
                              ? "font-semibold text-neutral-800"
                              : "font-medium text-neutral-600"
                          )}
                        >
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">
                            {n.body}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-neutral-400">
                          {formatRelativeTime(n.createdAt)}
                        </p>
                      </div>

                      {/* Unread dot */}
                      {isUnread && (
                        <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-accent-600" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-neutral-200 px-4 py-2.5">
          <button
            onClick={() => {
              setOpen(false)
              router.push("/notifications")
            }}
            className="text-xs font-medium text-accent-600 hover:text-accent-700 hover:underline"
          >
            Lihat semua notifikasi
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
