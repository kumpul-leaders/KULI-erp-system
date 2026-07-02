// ── Notification type shared across server + client components ────────────────

export type NotificationType =
  | "mention"
  | "lead_assigned"
  | "activity_due"
  | "activity_overdue"
  | "alert"
  | "stage_change"

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string | null
  entityType: string | null // "lead" | "client" | null
  entityId: string | null
  readAt: string | null // null = unread
  createdAt: string // ISO datetime
}

export interface NotificationsResponse {
  notifications: AppNotification[]
  unreadCount: number
}
