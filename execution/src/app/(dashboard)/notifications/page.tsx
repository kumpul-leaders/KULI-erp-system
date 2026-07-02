import type { Metadata } from "next"
import { Topbar } from "@/components/layout/topbar"
import { NotificationsView } from "@/components/notifications/notifications-view"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import type { AppNotification } from "@/types/notification"

export const metadata: Metadata = {
  title: "Notifikasi",
}

// ── Data fetching ─────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{
    unread?: string
    page?: string
  }>
}

const PAGE_SIZE = 20

async function fetchNotificationsPage(
  userId: string,
  unreadOnly: boolean,
  page: number
): Promise<{ notifications: AppNotification[]; total: number; unreadCount: number }> {
  const where: Record<string, unknown> = { userId }
  if (unreadOnly) where.readAt = null

  const skip = (page - 1) * PAGE_SIZE

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ])

  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      userId: n.userId,
      type: n.type as AppNotification["type"],
      title: n.title,
      body: n.body,
      entityType: n.entityType,
      entityId: n.entityId,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    total,
    unreadCount,
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function NotificationsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email ?? "" },
    select: { id: true },
  })
  if (!dbUser) return null

  const params = await searchParams
  const unreadOnly = params.unread === "1"
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1)

  const { notifications, total, unreadCount } = await fetchNotificationsPage(
    dbUser.id,
    unreadOnly,
    page
  )

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <>
      <Topbar title="Notifikasi" />
      <main className="flex-1 overflow-y-auto px-8 py-6">
        <NotificationsView
          initialNotifications={notifications}
          total={total}
          totalPages={totalPages}
          currentPage={page}
          unreadCount={unreadCount}
          initialUnreadOnly={unreadOnly}
          pageSize={PAGE_SIZE}
        />
      </main>
    </>
  )
}
