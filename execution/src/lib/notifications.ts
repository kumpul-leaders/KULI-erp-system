import { prisma } from "@/lib/prisma"
import type { PrismaClient, NotificationType } from "@prisma/client"

// PrismaClient transaction type — matches what Prisma passes inside $transaction callback
type PrismaTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

export interface CreateNotificationInput {
  /** Recipient user ID */
  userId: string
  type: NotificationType
  title: string
  body?: string
  entityType?: string
  entityId?: string
}

/**
 * Creates a single notification.
 *
 * Pass `actorId` to suppress self-notification: if userId === actorId,
 * the function is a no-op and returns null.
 *
 * Accepts an optional Prisma transaction client (tx) so it can be called
 * atomically inside an existing $transaction callback.
 */
export async function createNotification(
  input: CreateNotificationInput & { actorId?: string },
  tx?: PrismaTx
): Promise<void> {
  const { actorId, ...data } = input

  // Anti-noise: never notify someone of their own action
  if (actorId && data.userId === actorId) return

  const db = tx ?? prisma

  await db.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      body: data.body ?? null,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
    },
  })
}

/**
 * Creates multiple notifications in a single batch.
 *
 * Pass `actorId` to suppress self-notification — any entry where
 * userId === actorId is silently dropped before the insert.
 *
 * Uses createMany for efficiency. Accepts an optional Prisma transaction client.
 */
export async function createNotifications(
  inputs: CreateNotificationInput[],
  actorId?: string,
  tx?: PrismaTx
): Promise<void> {
  const filtered = actorId
    ? inputs.filter((n) => n.userId !== actorId)
    : inputs

  if (filtered.length === 0) return

  const db = tx ?? prisma

  await db.notification.createMany({
    data: filtered.map((n) => ({
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      entityType: n.entityType ?? null,
      entityId: n.entityId ?? null,
    })),
  })
}
